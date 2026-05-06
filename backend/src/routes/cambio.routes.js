const router = require('express').Router()
const { v4: uuidv4 } = require('uuid')
const db = require('../data/db')
const { authMiddleware, requireRoles } = require('../middleware/auth.middleware')
const { auditLog } = require('../middleware/audit.middleware')

router.use(authMiddleware)

function getSelectedDeviceIds(payload = {}) {
  const ids = []
  if (Array.isArray(payload.dispositivos)) {
    for (const item of payload.dispositivos) {
      if (typeof item === 'string') ids.push(item)
      else if (item?.id) ids.push(item.id)
    }
  }
  if (payload.dispositivo_id) ids.push(payload.dispositivo_id)
  return [...new Set(ids.filter(Boolean))]
}

function buildMovementDeviceSnapshot(device = {}) {
  return {
    id: device.id,
    tipo: device.tipo,
    marca: device.marca,
    modelo: device.modelo,
    serie: device.serie,
    caracteristicas: device.caracteristicas || '',
    campos_extra: device.campos_extra || {},
    estado_anterior: device.estado || 'stock',
    ubicacion_tipo_anterior: device.ubicacion_tipo || 'almacen',
    ubicacion_id_anterior: device.ubicacion_id || null,
    ubicacion_nombre_anterior: device.ubicacion_nombre || 'Almacén Central',
    lat_anterior: device.lat || null,
    lng_anterior: device.lng || null,
    activo_anterior: Boolean(device.activo),
  }
}

function buildDocumentoDeviceSnapshot(device = {}) {
  return {
    id: device.id,
    tipo: device.tipo,
    marca: device.marca,
    serie: device.serie,
    serie_estado: device.serie_estado || 'capturada',
    modelo: device.modelo,
    caracteristicas: device.caracteristicas || '',
    campos_extra: device.campos_extra || {},
    costo: 0,
    proveedor_id: device.proveedor_id || null,
    proveedor_nombre: device.proveedor_nombre || null,
  }
}

function buildSummaryFields(dispositivos = []) {
  const first = dispositivos[0] || {}
  return {
    dispositivo_id: first.id || null,
    dispositivo_tipo: first.tipo || null,
    dispositivo_serie: first.serie || null,
    dispositivo_marca: first.marca || null,
    dispositivo_modelo: first.modelo || null,
    cantidad_dispositivos: dispositivos.length || 0,
  }
}

function movementSearchText(item = {}) {
  const dispositivos = Array.isArray(item.dispositivos) ? item.dispositivos : []
  return [
    item.dispositivo_serie,
    item.dispositivo_tipo,
    item.dispositivo_marca,
    item.dispositivo_modelo,
    item.proveedor_nombre,
    item.motivo,
    item.documento_folio,
    ...dispositivos.flatMap(device => [device?.serie, device?.tipo, device?.marca, device?.modelo]),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

router.get('/', (req, res) => {
  const { tipo_cambio, estado, page = 1, limit = 20, search } = req.query
  let items = db.get('cambios').value()

  if (tipo_cambio) items = items.filter(item => item.tipo_cambio === tipo_cambio)
  if (estado) items = items.filter(item => item.estado === estado)
  if (search) {
    const q = String(search).toLowerCase()
    items = items.filter(item => movementSearchText(item).includes(q))
  }

  const data = items
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map(item => ({
      ...item,
      cantidad_dispositivos: item.cantidad_dispositivos || (Array.isArray(item.dispositivos) ? item.dispositivos.length : 1),
    }))

  const pageNum = parseInt(page, 10) || 1
  const limitNum = parseInt(limit, 10) || 20
  const offset = (pageNum - 1) * limitNum
  res.json({ data: data.slice(offset, offset + limitNum), total: data.length, page: pageNum, limit: limitNum })
})

router.get('/:id', (req, res) => {
  const item = db.get('cambios').find({ id: req.params.id }).value()
  if (!item) return res.status(404).json({ message: 'Movimiento no encontrado' })

  const proveedor = item.proveedor_id ? db.get('proveedores').find({ id: item.proveedor_id }).value() : null
  const documento = item.documento_id ? db.get('documentos').find({ id: item.documento_id }).value() : null
  const dispositivos = (Array.isArray(item.dispositivos) ? item.dispositivos : [])
    .map(snapshot => {
      const current = db.get('dispositivos').find({ id: snapshot.id }).value()
      return { ...snapshot, actual: current || null }
    })

  res.json({ ...item, proveedor, documento, dispositivos })
})

router.post('/', requireRoles('super_admin', 'agente_soporte'), auditLog('crear', 'cambio'), (req, res) => {
  const { tipo_cambio, proveedor_id, motivo, descripcion, fecha_estimada_retorno } = req.body
  const deviceIds = getSelectedDeviceIds(req.body)

  if (!deviceIds.length || !tipo_cambio || !motivo || !proveedor_id) {
    return res.status(400).json({ message: 'Dispositivos, tipo de movimiento, proveedor y motivo son requeridos' })
  }

  const proveedor = db.get('proveedores').find({ id: proveedor_id, activo: true }).value()
  if (!proveedor) return res.status(404).json({ message: 'Proveedor no encontrado' })

  const dispositivos = deviceIds.map(id => db.get('dispositivos').find({ id, activo: true }).value()).filter(Boolean)
  if (dispositivos.length !== deviceIds.length) {
    return res.status(404).json({ message: 'Uno o más dispositivos ya no están disponibles en inventario' })
  }

  const pendiente = dispositivos.find(device => device.doc_pendiente_id)
  if (pendiente) {
    return res.status(409).json({ message: `El dispositivo ${pendiente.serie || pendiente.id} ya está ligado al documento ${pendiente.doc_pendiente_folio}` })
  }

  const snapshots = dispositivos.map(buildMovementDeviceSnapshot)
  const docDevices = dispositivos.map(buildDocumentoDeviceSnapshot)
  const now = new Date().toISOString()
  const folio = `SALIDA-${String(db.get('documentos').size().value() + 1).padStart(6, '0')}`

  const documento = {
    id: uuidv4(),
    folio,
    tipo: 'salida',
    plantilla_id: null,
    entidad_tipo: 'proveedor',
    entidad_id: proveedor.id,
    entidad_nombre: proveedor.nombre,
    entrada_origen_tipo: null,
    entrada_referencia: '',
    recibido_por_id: null,
    recibido_por_nombre: null,
    entidad_num_empleado: '',
    entidad_area: '',
    entidad_puesto: '',
    entidad_email: proveedor.email || '',
    dispositivos: docDevices,
    agente_id: req.user.id,
    agente_nombre: req.user.nombre,
    firma_agente: null,
    firma_agente_path: null,
    logistica_nombre: null,
    logistica_area: null,
    firma_logistica: null,
    firma_logistica_path: null,
    receptor_id: null,
    receptor_nombre: proveedor.nombre,
    receptor_firmante_nombre: null,
    firma_receptor: null,
    firma_receptor_path: null,
    cancelado: false,
    cancelado_motivo: null,
    cancelado_at: null,
    cancelado_por_id: null,
    cancelado_por_nombre: null,
    firmado: false,
    fecha_firma: null,
    motivo_salida: String(motivo).trim(),
    observaciones: descripcion || '',
    receptor_observaciones: null,
    created_by: req.user.id,
    created_by_nombre: req.user.nombre,
    created_at: now,
    updated_at: now,
  }
  db.get('documentos').push(documento).write()

  const movimiento = {
    id: uuidv4(),
    ...buildSummaryFields(snapshots),
    dispositivos: snapshots,
    tipo_cambio,
    proveedor_id: proveedor.id,
    proveedor_nombre: proveedor.nombre,
    documento_id: documento.id,
    documento_folio: documento.folio,
    inventario_actualizado: false,
    documento_firmado_at: null,
    motivo: String(motivo).trim(),
    descripcion: descripcion || '',
    fecha_estimada_retorno: fecha_estimada_retorno || null,
    fecha_retorno: null,
    estado: 'en_proceso',
    creado_por: req.user.id,
    creado_por_nombre: req.user.nombre,
    created_at: now,
    updated_at: now,
  }
  db.get('cambios').push(movimiento).write()

  res.status(201).json({ ...movimiento, documento: { id: documento.id, folio: documento.folio } })
})

router.put('/:id/completar', requireRoles('super_admin', 'agente_soporte'), auditLog('completar_cambio', 'cambio'), (req, res) => {
  const movimiento = db.get('cambios').find({ id: req.params.id }).value()
  if (!movimiento) return res.status(404).json({ message: 'Movimiento no encontrado' })
  if (movimiento.estado === 'cancelado') return res.status(409).json({ message: 'El movimiento fue cancelado' })
  if (movimiento.estado === 'completado') return res.status(409).json({ message: 'El movimiento ya fue completado' })
  if (movimiento.tipo_cambio === 'baja_definitiva') {
    return res.status(409).json({ message: 'Las bajas definitivas no llevan retorno al inventario' })
  }
  if (!movimiento.inventario_actualizado) {
    return res.status(409).json({ message: 'Primero firma el documento para aplicar la salida a proveedor' })
  }

  const now = new Date().toISOString()
  const snapshots = Array.isArray(movimiento.dispositivos) && movimiento.dispositivos.length
    ? movimiento.dispositivos
    : [{ id: movimiento.dispositivo_id }]

  for (const snapshot of snapshots) {
    const dispositivo = db.get('dispositivos').find({ id: snapshot.id }).value()
    if (!dispositivo) continue

    const asignacionActiva = db.get('asignaciones').find({ dispositivo_id: snapshot.id, activo: true }).value()
    if (asignacionActiva) {
      db.get('asignaciones').find({ id: asignacionActiva.id }).assign({
        activo: false,
        fecha_devolucion: now,
      }).write()
    }

    db.get('dispositivos').find({ id: snapshot.id }).assign({
      estado: 'stock',
      ubicacion_tipo: 'almacen',
      ubicacion_id: null,
      ubicacion_nombre: 'Almacén Central',
      lat: null,
      lng: null,
      activo: true,
      actualizado_por: req.user.id,
      actualizado_por_nombre: req.user.nombre,
      updated_at: now,
      doc_pendiente_id: null,
      doc_pendiente_folio: null,
    }).write()
  }

  db.get('cambios').find({ id: movimiento.id }).assign({
    estado: 'completado',
    fecha_retorno: now,
    updated_at: now,
  }).write()

  res.json({ message: 'Movimiento completado. Los dispositivos regresaron al almacén.' })
})

module.exports = router
