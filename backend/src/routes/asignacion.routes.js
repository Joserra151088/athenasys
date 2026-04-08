const router = require('express').Router()
const { v4: uuidv4 } = require('uuid')
const db = require('../data/db')
const { authMiddleware, requireRoles } = require('../middleware/auth.middleware')
const { auditLog } = require('../middleware/audit.middleware')

router.use(authMiddleware)

router.get('/', (req, res) => {
  const { tipo_asignacion, page = 1, limit = 20, search } = req.query
  let items = db.get('asignaciones').filter({ activo: true }).value()

  if (tipo_asignacion) items = items.filter(a => a.tipo_asignacion === tipo_asignacion)
  if (search) {
    const q = search.toLowerCase()
    items = items.filter(a =>
      a.asignado_a_nombre?.toLowerCase().includes(q) ||
      a.dispositivo_serie?.toLowerCase().includes(q) ||
      a.dispositivo_tipo?.toLowerCase().includes(q)
    )
  }

  // Enriquecer con datos actuales del dispositivo
  items = items.map(a => {
    const d = db.get('dispositivos').find({ id: a.dispositivo_id }).value()
    return { ...a, dispositivo: d }
  })

  const total = items.length
  const offset = (parseInt(page) - 1) * parseInt(limit)
  res.json({ data: items.slice(offset, offset + parseInt(limit)), total, page: parseInt(page), limit: parseInt(limit) })
})

router.get('/:tipo/:id', (req, res) => {
  const { tipo, id } = req.params
  const items = db.get('asignaciones').filter({
    [`${tipo === 'empleado' ? 'tipo_asignacion' : 'tipo_asignacion'}`]: tipo,
    asignado_a_id: id,
    activo: true
  }).value()

  const enriched = items.map(a => {
    const d = db.get('dispositivos').find({ id: a.dispositivo_id }).value()
    return { ...a, dispositivo: d }
  })
  res.json(enriched)
})

router.post('/', requireRoles('super_admin', 'agente_soporte'), auditLog('asignar', 'asignacion'), (req, res) => {
  const { dispositivo_id, tipo_asignacion, asignado_a_id, observaciones } = req.body
  if (!dispositivo_id || !tipo_asignacion || !asignado_a_id) {
    return res.status(400).json({ message: 'Dispositivo, tipo de asignación y destinatario son requeridos' })
  }

  const dispositivo = db.get('dispositivos').find({ id: dispositivo_id, activo: true }).value()
  if (!dispositivo) return res.status(404).json({ message: 'Dispositivo no encontrado' })

  // Verificar disponibilidad
  const asignacionActiva = db.get('asignaciones').find({ dispositivo_id, activo: true }).value()
  if (asignacionActiva) return res.status(409).json({ message: 'El dispositivo ya tiene una asignación activa' })

  // Obtener nombre del destino
  let destinatario = null
  let lat = null, lng = null
  if (tipo_asignacion === 'empleado') {
    destinatario = db.get('empleados').find({ id: asignado_a_id, activo: true }).value()
    if (!destinatario) return res.status(404).json({ message: 'Empleado no encontrado' })
    const sucursal = destinatario.sucursal_id ? db.get('sucursales').find({ id: destinatario.sucursal_id }).value() : null
    lat = sucursal?.lat || null
    lng = sucursal?.lng || null
  } else {
    destinatario = db.get('sucursales').find({ id: asignado_a_id, activo: true }).value()
    if (!destinatario) return res.status(404).json({ message: 'Sucursal no encontrada' })
    lat = destinatario.lat
    lng = destinatario.lng
  }

  const now = new Date().toISOString()
  const asignacion = {
    id: uuidv4(), dispositivo_id,
    dispositivo_tipo: dispositivo.tipo, dispositivo_serie: dispositivo.serie,
    dispositivo_marca: dispositivo.marca, dispositivo_modelo: dispositivo.modelo,
    tipo_asignacion, asignado_a_id,
    asignado_a_nombre: tipo_asignacion === 'empleado' ? destinatario.nombre_completo : destinatario.nombre,
    asignado_por_id: req.user.id, asignado_por_nombre: req.user.nombre,
    observaciones: observaciones || '',
    fecha_asignacion: now, fecha_devolucion: null, activo: true, created_at: now
  }
  db.get('asignaciones').push(asignacion).write()

  // Actualizar ubicación del dispositivo
  db.get('dispositivos').find({ id: dispositivo_id }).assign({
    estado: 'activo', ubicacion_tipo: tipo_asignacion,
    ubicacion_id: asignado_a_id,
    ubicacion_nombre: tipo_asignacion === 'empleado' ? destinatario.nombre_completo : destinatario.nombre,
    lat, lng, updated_at: now
  }).write()

  res.status(201).json(asignacion)
})

router.put('/:id', requireRoles('super_admin', 'agente_soporte'), auditLog('actualizar', 'asignacion'), (req, res) => {
  const asignacion = db.get('asignaciones').find({ id: req.params.id, activo: true }).value()
  if (!asignacion) return res.status(404).json({ message: 'AsignaciÃ³n no encontrada' })

  const { tipo_asignacion, asignado_a_id, observaciones } = req.body
  if (!tipo_asignacion || !asignado_a_id) {
    return res.status(400).json({ message: 'Tipo de asignaciÃ³n y destinatario son requeridos' })
  }

  let destinatario = null
  let lat = null
  let lng = null

  if (tipo_asignacion === 'empleado') {
    destinatario = db.get('empleados').find({ id: asignado_a_id, activo: true }).value()
    if (!destinatario) return res.status(404).json({ message: 'Empleado no encontrado' })
    const sucursal = destinatario.sucursal_id ? db.get('sucursales').find({ id: destinatario.sucursal_id }).value() : null
    lat = sucursal?.lat || null
    lng = sucursal?.lng || null
  } else {
    destinatario = db.get('sucursales').find({ id: asignado_a_id, activo: true }).value()
    if (!destinatario) return res.status(404).json({ message: 'Sucursal no encontrada' })
    lat = destinatario.lat || null
    lng = destinatario.lng || null
  }

  const now = new Date().toISOString()
  const asignadoANombre = tipo_asignacion === 'empleado' ? destinatario.nombre_completo : destinatario.nombre

  const updatedAsignacion = {
    tipo_asignacion,
    asignado_a_id,
    asignado_a_nombre: asignadoANombre,
    observaciones: observaciones || '',
    ajustado_por_id: req.user.id,
    ajustado_por_nombre: req.user.nombre,
    fecha_ajuste: now,
  }

  db.get('asignaciones').find({ id: req.params.id }).assign(updatedAsignacion).write()

  db.get('dispositivos').find({ id: asignacion.dispositivo_id }).assign({
    estado: 'activo',
    ubicacion_tipo: tipo_asignacion,
    ubicacion_id: asignado_a_id,
    ubicacion_nombre: asignadoANombre,
    lat,
    lng,
    actualizado_por: req.user.id,
    actualizado_por_nombre: req.user.nombre,
    updated_at: now,
  }).write()

  res.json({
    ...asignacion,
    ...updatedAsignacion,
  })
})

router.delete('/:id', requireRoles('super_admin', 'agente_soporte'), auditLog('desasignar', 'asignacion'), (req, res) => {
  const asignacion = db.get('asignaciones').find({ id: req.params.id, activo: true }).value()
  if (!asignacion) return res.status(404).json({ message: 'Asignación no encontrada' })

  const now = new Date().toISOString()
  db.get('asignaciones').find({ id: req.params.id }).assign({
    activo: false, fecha_devolucion: now
  }).write()

  // Regresar dispositivo a almacén
  db.get('dispositivos').find({ id: asignacion.dispositivo_id }).assign({
    estado: 'stock', ubicacion_tipo: 'almacen',
    ubicacion_id: null, ubicacion_nombre: 'Almacén Central',
    lat: null, lng: null, updated_at: now
  }).write()

  res.json({ message: 'Asignación cancelada. Dispositivo regresado al almacén.' })
})

module.exports = router
