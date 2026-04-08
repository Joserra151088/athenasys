const router = require('express').Router()
const { v4: uuidv4 } = require('uuid')
const db = require('../data/db')
const { authMiddleware, requireRoles } = require('../middleware/auth.middleware')
const { auditLog } = require('../middleware/audit.middleware')

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
  const { page = 1, limit = 20, tipo, estado, ubicacion_tipo, search } = req.query
  let items = db.get('dispositivos').filter({ activo: true }).value()

  if (tipo) items = items.filter(d => d.tipo === tipo)
  if (estado) items = items.filter(d => d.estado === estado)
  if (ubicacion_tipo) items = items.filter(d => d.ubicacion_tipo === ubicacion_tipo)
  if (search) {
    const q = search.toLowerCase()
    items = items.filter(d =>
      d.serie?.toLowerCase().includes(q) ||
      d.marca?.toLowerCase().includes(q) ||
      d.modelo?.toLowerCase().includes(q) ||
      d.tipo?.toLowerCase().includes(q) ||
      d.ubicacion_nombre?.toLowerCase().includes(q)
    )
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
    nodos.push({
      tipo: 'asignacion',
      fecha: asig.fecha_asignacion,
      titulo: `Asignado a ${asig.asignado_a_nombre}`,
      descripcion: `Por ${asig.asignado_por_nombre}`,
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

const TIPOS_SIN_SERIE = ['Mouse', 'Teclado']

// Crear
router.post('/', requireRoles('super_admin', 'agente_soporte'), auditLog('crear', 'dispositivo'), (req, res) => {
  const { tipo, marca, serie, modelo, proveedor_id, caracteristicas, costo_dia, cantidad } = req.body
  if (!tipo || !marca) return res.status(400).json({ message: 'Tipo y marca son requeridos' })
  if (!TIPOS_SIN_SERIE.includes(tipo) && !serie) return res.status(400).json({ message: 'El número de serie es requerido para este tipo de dispositivo' })

  if (serie) {
    const existe = db.get('dispositivos').find({ serie, activo: true }).value()
    if (existe) return res.status(409).json({ message: 'Ya existe un dispositivo con ese número de serie' })
  }

  const proveedor = proveedor_id ? db.get('proveedores').find({ id: proveedor_id }).value() : null
  const now = new Date().toISOString()
  // costo_dia: usa el valor del body si se proporcionó, si no calcula automáticamente
  const costoDia = resolveCostoDia(tipo, proveedor?.nombre || '', costo_dia)
  const item = {
    id: uuidv4(), tipo, marca, serie: serie || null, modelo: modelo || '',
    cantidad: TIPOS_SIN_SERIE.includes(tipo) ? (parseInt(cantidad) || 1) : 1,
    proveedor_id: proveedor_id || null, proveedor_nombre: proveedor?.nombre || null,
    caracteristicas: caracteristicas || '',
    costo_dia: costoDia,
    estado: 'stock', ubicacion_tipo: 'almacen',
    ubicacion_id: null, ubicacion_nombre: 'Almacén Central',
    lat: null, lng: null, activo: true,
    creado_por: req.user.id, creado_por_nombre: req.user.nombre,
    created_at: now, updated_at: now
  }
  db.get('dispositivos').push(item).write()
  res.status(201).json(item)
})

// Actualizar
router.put('/:id', requireRoles('super_admin', 'agente_soporte'), auditLog('actualizar', 'dispositivo'), (req, res) => {
  const item = db.get('dispositivos').find({ id: req.params.id, activo: true }).value()
  if (!item) return res.status(404).json({ message: 'Dispositivo no encontrado' })

  const proveedor = req.body.proveedor_id ? db.get('proveedores').find({ id: req.body.proveedor_id }).value() : null
  const nuevoTipo = req.body.tipo || item.tipo
  // costo_dia: si viene en el body lo respeta, si no lo recalcula
  const costoDia = resolveCostoDia(nuevoTipo, proveedor?.nombre || item.proveedor_nombre || '', req.body.costo_dia)
  const updated = {
    ...item,
    ...req.body,
    proveedor_nombre: proveedor?.nombre || item.proveedor_nombre,
    costo_dia: costoDia,
    actualizado_por: req.user.id,
    actualizado_por_nombre: req.user.nombre,
    updated_at: new Date().toISOString()
  }
  db.get('dispositivos').find({ id: req.params.id }).assign(updated).write()
  res.json(updated)
})

// Eliminar (soft delete)
router.delete('/:id', requireRoles('super_admin'), auditLog('eliminar', 'dispositivo'), (req, res) => {
  const item = db.get('dispositivos').find({ id: req.params.id, activo: true }).value()
  if (!item) return res.status(404).json({ message: 'Dispositivo no encontrado' })

  // Verificar que no tiene asignación activa
  const asignacion = db.get('asignaciones').find({ dispositivo_id: req.params.id, activo: true }).value()
  if (asignacion) return res.status(409).json({ message: 'El dispositivo tiene una asignación activa. Primero desasígnalo.' })

  db.get('dispositivos').find({ id: req.params.id }).assign({ activo: false, updated_at: new Date().toISOString() }).write()
  res.json({ message: 'Dispositivo eliminado correctamente' })
})

module.exports = router
