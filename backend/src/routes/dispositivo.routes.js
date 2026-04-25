const router = require('express').Router()
const { v4: uuidv4 } = require('uuid')
const db = require('../data/db')
const { authMiddleware, requireRoles } = require('../middleware/auth.middleware')
const { auditLog } = require('../middleware/audit.middleware')
const {
  SERIE_ESTADOS,
  isMissingSerial,
  nextGeneratedSerial,
  normalizeSerieEstado,
} = require('../utils/deviceSerials')

router.use(authMiddleware)

// Tipos incluidos en el paquete CPU (costo = 0 independiente)
const TIPOS_EN_PAQUETE_CPU = ['Monitor', 'Teclado', 'Mouse']
// Accesorios sin costo de renta
const TIPOS_ACCESORIO = ['Cable de Datos', 'Cable de Corriente', 'Cable VGA', 'Cable HDMI']
// Equipos que ya son propiedad de la empresa
const PROVEEDORES_SIN_COSTO = ['opentec']

function esProveedorSinCosto(nombre = '') {
  const normalizado = nombre.toLowerCase()
  return PROVEEDORES_SIN_COSTO.some(proveedor => normalizado.includes(proveedor))
}

function getCostoDia(tipo) {
  if (TIPOS_EN_PAQUETE_CPU.includes(tipo) || TIPOS_ACCESORIO.includes(tipo)) return 0
  const tarifa = db.get('tarifas_equipo').find({ tipo, activo: true }).value()
  return tarifa ? parseFloat(tarifa.costo_dia) : 0
}

function resolveCostoDia(tipo, proveedorNombre, costoDiaBody) {
  if (esProveedorSinCosto(proveedorNombre)) return 0

  if (costoDiaBody !== undefined && costoDiaBody !== '') {
    const parsed = parseFloat(costoDiaBody)
    if (Number.isFinite(parsed)) return parsed
  }

  return getCostoDia(tipo)
}

function resolveDeviceSerial({ tipo, serie, serie_estado, existingId = null, currentSerie = '', currentTipo = '', currentSerieEstado = '' }) {
  const estado = normalizeSerieEstado(serie_estado)
  const dispositivos = db.get('dispositivos').value()

  if (estado === SERIE_ESTADOS.CAPTURADA) {
    const normalizedSerie = String(serie || '').trim()
    if (!normalizedSerie) throw Object.assign(new Error('El número de serie es requerido'), { status: 400 })

    const duplicate = dispositivos.find(d =>
      d.activo &&
      d.id !== existingId &&
      String(d.serie || '').trim().toLowerCase() === normalizedSerie.toLowerCase()
    )
    if (duplicate) throw Object.assign(new Error('Ya existe un dispositivo con ese número de serie'), { status: 409 })

    return { serie: normalizedSerie, serie_estado: SERIE_ESTADOS.CAPTURADA }
  }

  if (
    currentSerie &&
    currentTipo === tipo &&
    normalizeSerieEstado(currentSerieEstado) !== SERIE_ESTADOS.CAPTURADA &&
    !isMissingSerial(currentSerie)
  ) {
    const duplicate = dispositivos.find(d =>
      d.activo &&
      d.id !== existingId &&
      String(d.serie || '').trim().toLowerCase() === String(currentSerie).trim().toLowerCase()
    )
    if (!duplicate) return { serie: currentSerie, serie_estado: estado }
  }

  return {
    serie: nextGeneratedSerial(tipo, dispositivos),
    serie_estado: estado,
  }
}

function normalizeCamposExtra(camposExtra, fallback = {}) {
  if (camposExtra === undefined || camposExtra === null) return fallback || {}

  if (typeof camposExtra === 'string') {
    try {
      const parsed = JSON.parse(camposExtra)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
    } catch (_) {
      return {}
    }
  }

  if (typeof camposExtra === 'object' && !Array.isArray(camposExtra)) return camposExtra
  return {}
}

function camposExtraSearchText(camposExtra) {
  if (typeof camposExtra === 'string') {
    try {
      const parsed = JSON.parse(camposExtra)
      return camposExtraSearchText(parsed)
    } catch (_) {
      return camposExtra
    }
  }

  const normalized = normalizeCamposExtra(camposExtra)
  return Object.entries(normalized)
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '')
    .map(([key, value]) => `${key} ${value}`)
    .join(' ')
}

function includesSearch(value, query) {
  return String(value || '').toLowerCase().includes(query)
}

// Estadísticas
router.get('/stats', (req, res) => {
  const dispositivos = db.get('dispositivos').filter({ activo: true }).value()
  const stats = {
    total: dispositivos.length,
    por_estado: {},
    por_tipo: {},
    por_ubicacion: {}
  }
  dispositivos.forEach(d => {
    stats.por_estado[d.estado] = (stats.por_estado[d.estado] || 0) + 1
    stats.por_tipo[d.tipo] = (stats.por_tipo[d.tipo] || 0) + 1
    stats.por_ubicacion[d.ubicacion_tipo] = (stats.por_ubicacion[d.ubicacion_tipo] || 0) + 1
  })
  res.json(stats)
})

// Listar con filtros y paginación
router.get('/', (req, res) => {
  const { page = 1, limit = 20, tipo, estado, ubicacion_tipo, proveedor_id, search, sort_by, sort_dir = 'asc' } = req.query
  let items = db.get('dispositivos').filter({ activo: true }).value()

  if (tipo) items = items.filter(d => d.tipo === tipo)
  if (estado) items = items.filter(d => d.estado === estado)
  if (ubicacion_tipo) items = items.filter(d => d.ubicacion_tipo === ubicacion_tipo)
  if (proveedor_id) items = items.filter(d => d.proveedor_id === proveedor_id)
  if (search) {
    const q = search.toLowerCase().trim()
    items = items.filter(d =>
      includesSearch(d.serie, q) ||
      includesSearch(d.marca, q) ||
      includesSearch(d.modelo, q) ||
      includesSearch(d.tipo, q) ||
      includesSearch(d.proveedor_nombre, q) ||
      includesSearch(d.caracteristicas, q) ||
      includesSearch(d.ubicacion_nombre, q) ||
      includesSearch(camposExtraSearchText(d.campos_extra), q)
    )
  }

  const sortDirection = String(sort_dir).toLowerCase() === 'desc' ? 'desc' : 'asc'
  const compareStrings = (a, b) => {
    const va = String(a || '').toLowerCase()
    const vb = String(b || '').toLowerCase()
    return sortDirection === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
  }

  if (sort_by) {
    items = [...items].sort((a, b) => {
      if (sort_by === 'tipo') return compareStrings(a.tipo, b.tipo)
      if (sort_by === 'marca') {
        const marcaCompare = compareStrings(a.marca, b.marca)
        return marcaCompare !== 0 ? marcaCompare : compareStrings(a.modelo, b.modelo)
      }
      if (sort_by === 'serie') return compareStrings(a.serie, b.serie)
      if (sort_by === 'estado') return compareStrings(a.estado, b.estado)
      if (sort_by === 'ubicacion') {
        const ubicacionCompare = compareStrings(a.ubicacion_tipo, b.ubicacion_tipo)
        return ubicacionCompare !== 0 ? ubicacionCompare : compareStrings(a.ubicacion_nombre, b.ubicacion_nombre)
      }
      if (sort_by === 'created_at' || sort_by === 'updated_at') {
        const va = new Date(a[sort_by] || 0).getTime()
        const vb = new Date(b[sort_by] || 0).getTime()
        return sortDirection === 'asc' ? va - vb : vb - va
      }
      if (sort_by === 'actualizado_por') {
        return compareStrings(a.actualizado_por_nombre || a.creado_por_nombre, b.actualizado_por_nombre || b.creado_por_nombre)
      }
      return 0
    })
  }

  const total = items.length
  const offset = (parseInt(page) - 1) * parseInt(limit)
  const data = items.slice(offset, offset + parseInt(limit))
  res.json({ data, total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) })
})

// Trayectoria de un dispositivo por número de serie
router.get('/trayectoria', (req, res) => {
  const { serie } = req.query
  if (!serie) return res.status(400).json({ message: 'Se requiere el parámetro serie' })

  const dispositivo = db.get('dispositivos').find(d => d.serie && d.serie.toLowerCase() === serie.toLowerCase().trim()).value()
  if (!dispositivo) return res.status(404).json({ message: 'No se encontró ningún dispositivo con ese número de serie' })

  const asignaciones = db.get('asignaciones')
    .filter({ dispositivo_id: dispositivo.id })
    .value()
    .sort((a, b) => new Date(a.fecha_asignacion) - new Date(b.fecha_asignacion))

  const nodos = []

  // Nodo 1: ingreso al sistema
  nodos.push({
    tipo: 'ingreso',
    fecha: dispositivo.created_at,
    titulo: 'Ingreso al sistema',
    descripcion: `Registrado por ${dispositivo.creado_por_nombre || 'Sistema'}`,
    icono: 'ingreso'
  })

  // Nodos por cada asignación
  for (const asig of asignaciones) {
    const descripcionAsignacion = asig.ajustado_por_nombre
      ? `Por ${asig.asignado_por_nombre}. Ajustado por ${asig.ajustado_por_nombre}`
      : `Por ${asig.asignado_por_nombre}`

    nodos.push({
      tipo: 'asignacion',
      fecha: asig.fecha_asignacion,
      titulo: `Asignado a ${asig.asignado_a_nombre}`,
      descripcion: descripcionAsignacion,
      asignado_a: asig.asignado_a_nombre,
      tipo_asignacion: asig.tipo_asignacion,
      por: asig.asignado_por_nombre,
      observaciones: asig.observaciones || '',
      icono: asig.tipo_asignacion === 'empleado' ? 'empleado' : 'sucursal'
    })

    if (!asig.activo && asig.fecha_devolucion) {
      nodos.push({
        tipo: 'retorno',
        fecha: asig.fecha_devolucion,
        titulo: 'Regresó a almacén',
        descripcion: 'Devuelto al almacén central',
        icono: 'almacen'
      })
    }
  }

  // Si está pendiente de firma
  if (dispositivo.estado === 'pendiente') {
    nodos.push({
      tipo: 'pendiente',
      fecha: dispositivo.updated_at,
      titulo: 'Pendiente de firma',
      descripcion: 'Documento generado, en espera de firma',
      icono: 'pendiente'
    })
  }

  res.json({ dispositivo, nodos })
})

// Obtener por ID
router.get('/:id', (req, res) => {
  const item = db.get('dispositivos').find({ id: req.params.id, activo: true }).value()
  if (!item) return res.status(404).json({ message: 'Dispositivo no encontrado' })
  res.json(item)
})

// Crear
router.post('/', requireRoles('super_admin', 'agente_soporte'), auditLog('crear', 'dispositivo'), (req, res) => {
  try {
    const { tipo, marca, serie, serie_estado, modelo, proveedor_id, caracteristicas, costo_dia, campos_extra, costo_tipo } = req.body
    if (!tipo || !marca) return res.status(400).json({ message: 'Tipo y marca son requeridos' })

    const serialInfo = resolveDeviceSerial({ tipo, serie, serie_estado })
    const proveedor = proveedor_id ? db.get('proveedores').find({ id: proveedor_id }).value() : null
    const now = new Date().toISOString()
    // costo_dia: usa el valor del body si se proporcionó, si no calcula automáticamente
    const costoDia = resolveCostoDia(tipo, proveedor?.nombre || '', costo_dia)
    const item = {
      id: uuidv4(), tipo, marca, serie: serialInfo.serie, serie_estado: serialInfo.serie_estado, modelo: modelo || '',
      cantidad: 1,
      proveedor_id: proveedor_id || null, proveedor_nombre: proveedor?.nombre || null,
      caracteristicas: caracteristicas || '',
      campos_extra: normalizeCamposExtra(campos_extra),
      costo_tipo: costo_tipo || 'mensual',
      costo_dia: costoDia,
      estado: 'stock', ubicacion_tipo: 'almacen',
      ubicacion_id: null, ubicacion_nombre: 'Almacén Central',
      lat: null, lng: null, activo: true,
      creado_por: req.user.id, creado_por_nombre: req.user.nombre,
      actualizado_por: req.user.id, actualizado_por_nombre: req.user.nombre,
      created_at: now, updated_at: now
    }
    db.get('dispositivos').push(item).write()
    res.status(201).json(item)
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || 'Error al crear dispositivo' })
  }
})

// Actualizar
router.put('/:id', requireRoles('super_admin', 'agente_soporte'), auditLog('actualizar', 'dispositivo'), (req, res) => {
  const item = db.get('dispositivos').find({ id: req.params.id, activo: true }).value()
  if (!item) return res.status(404).json({ message: 'Dispositivo no encontrado' })

  try {
    const proveedor = req.body.proveedor_id ? db.get('proveedores').find({ id: req.body.proveedor_id }).value() : null
    const nuevoTipo = req.body.tipo || item.tipo
    const serialInfo = resolveDeviceSerial({
      tipo: nuevoTipo,
      serie: req.body.serie,
      serie_estado: req.body.serie_estado ?? item.serie_estado,
      existingId: item.id,
      currentSerie: item.serie,
      currentTipo: item.tipo,
      currentSerieEstado: item.serie_estado,
    })
    // costo_dia: si viene en el body lo respeta, si no lo recalcula
    const costoDia = resolveCostoDia(nuevoTipo, proveedor?.nombre || item.proveedor_nombre || '', req.body.costo_dia)
    const updated = {
      ...item,
      ...req.body,
      serie: serialInfo.serie,
      serie_estado: serialInfo.serie_estado,
      cantidad: 1,
      proveedor_nombre: proveedor?.nombre || item.proveedor_nombre,
      campos_extra: normalizeCamposExtra(req.body.campos_extra, item.campos_extra),
      costo_tipo: req.body.costo_tipo || item.costo_tipo || 'mensual',
      costo_dia: costoDia,
      actualizado_por: req.user.id,
      actualizado_por_nombre: req.user.nombre,
      updated_at: new Date().toISOString()
    }
    db.get('dispositivos').find({ id: req.params.id }).assign(updated).write()
    res.json(updated)
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || 'Error al actualizar dispositivo' })
  }
})

// Eliminar (soft delete)
router.delete('/:id', requireRoles('super_admin'), auditLog('eliminar', 'dispositivo'), (req, res) => {
  const item = db.get('dispositivos').find({ id: req.params.id, activo: true }).value()
  if (!item) return res.status(404).json({ message: 'Dispositivo no encontrado' })

  // Verificar que no tiene asignación activa
  const asignacion = db.get('asignaciones').find({ dispositivo_id: req.params.id, activo: true }).value()
  if (asignacion) return res.status(409).json({ message: 'El dispositivo tiene una asignación activa. Primero desasígnalo.' })

  db.get('dispositivos').find({ id: req.params.id }).assign({
    activo: false,
    actualizado_por: req.user.id,
    actualizado_por_nombre: req.user.nombre,
    updated_at: new Date().toISOString()
  }).write()
  res.json({ message: 'Dispositivo eliminado correctamente' })
})

module.exports = router
