const router = require('express').Router()
const { v4: uuidv4 } = require('uuid')
const db = require('../data/db')
const { authMiddleware, requireRoles } = require('../middleware/auth.middleware')
const { auditLog } = require('../middleware/audit.middleware')

router.use(authMiddleware)

router.get('/', (req, res) => {
  const { tipo_cambio, estado, page = 1, limit = 20, search } = req.query
  let items = db.get('cambios').value()

  if (tipo_cambio) items = items.filter(c => c.tipo_cambio === tipo_cambio)
  if (estado) items = items.filter(c => c.estado === estado)
  if (search) {
    const q = search.toLowerCase()
    items = items.filter(c =>
      c.dispositivo_serie?.toLowerCase().includes(q) ||
      c.proveedor_nombre?.toLowerCase().includes(q) ||
      c.motivo?.toLowerCase().includes(q)
    )
  }

  items = items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  const total = items.length
  const offset = (parseInt(page) - 1) * parseInt(limit)
  res.json({ data: items.slice(offset, offset + parseInt(limit)), total, page: parseInt(page), limit: parseInt(limit) })
})

router.get('/:id', (req, res) => {
  const item = db.get('cambios').find({ id: req.params.id }).value()
  if (!item) return res.status(404).json({ message: 'Cambio no encontrado' })

  const dispositivo = db.get('dispositivos').find({ id: item.dispositivo_id }).value()
  const proveedor = item.proveedor_id ? db.get('proveedores').find({ id: item.proveedor_id }).value() : null
  res.json({ ...item, dispositivo, proveedor })
})

router.post('/', requireRoles('super_admin', 'agente_soporte'), auditLog('crear', 'cambio'), (req, res) => {
  const { dispositivo_id, tipo_cambio, proveedor_id, motivo, descripcion, fecha_estimada_retorno } = req.body
  if (!dispositivo_id || !tipo_cambio || !motivo) {
    return res.status(400).json({ message: 'Dispositivo, tipo de cambio y motivo son requeridos' })
  }

  const dispositivo = db.get('dispositivos').find({ id: dispositivo_id, activo: true }).value()
  if (!dispositivo) return res.status(404).json({ message: 'Dispositivo no encontrado' })

  const proveedor = proveedor_id ? db.get('proveedores').find({ id: proveedor_id }).value() : null

  // Si tiene asignación activa, desasignarla
  const asignacionActiva = db.get('asignaciones').find({ dispositivo_id, activo: true }).value()
  if (asignacionActiva) {
    db.get('asignaciones').find({ id: asignacionActiva.id }).assign({
      activo: false, fecha_devolucion: new Date().toISOString()
    }).write()
  }

  const now = new Date().toISOString()
  const nuevoEstado = tipo_cambio === 'baja_definitiva' ? 'baja'
    : tipo_cambio === 'reparacion' ? 'en_reparacion' : dispositivo.estado

  const cambio = {
    id: uuidv4(), dispositivo_id,
    dispositivo_tipo: dispositivo.tipo, dispositivo_serie: dispositivo.serie,
    dispositivo_marca: dispositivo.marca, dispositivo_modelo: dispositivo.modelo,
    tipo_cambio, proveedor_id: proveedor_id || null,
    proveedor_nombre: proveedor?.nombre || null,
    motivo, descripcion: descripcion || '',
    fecha_estimada_retorno: fecha_estimada_retorno || null,
    fecha_retorno: null,
    estado: tipo_cambio === 'baja_definitiva' ? 'completado' : 'en_proceso',
    estado_anterior_dispositivo: dispositivo.estado,
    ubicacion_anterior: dispositivo.ubicacion_tipo,
    creado_por: req.user.id, creado_por_nombre: req.user.nombre,
    created_at: now, updated_at: now
  }
  db.get('cambios').push(cambio).write()

  // Actualizar estado del dispositivo
  db.get('dispositivos').find({ id: dispositivo_id }).assign({
    estado: nuevoEstado,
    ubicacion_tipo: tipo_cambio === 'baja_definitiva' ? 'almacen' : 'proveedor',
    ubicacion_id: proveedor_id || null,
    ubicacion_nombre: tipo_cambio === 'baja_definitiva' ? 'Dado de Baja' : (proveedor?.nombre || 'Proveedor'),
    lat: null, lng: null,
    activo: tipo_cambio !== 'baja_definitiva',
    updated_at: now
  }).write()

  res.status(201).json(cambio)
})

// Completar cambio (retorno de reparación)
router.put('/:id/completar', requireRoles('super_admin', 'agente_soporte'), auditLog('completar_cambio', 'cambio'), (req, res) => {
  const cambio = db.get('cambios').find({ id: req.params.id }).value()
  if (!cambio) return res.status(404).json({ message: 'Cambio no encontrado' })
  if (cambio.estado === 'completado') return res.status(409).json({ message: 'El cambio ya fue completado' })

  const now = new Date().toISOString()
  db.get('cambios').find({ id: req.params.id }).assign({
    estado: 'completado', fecha_retorno: now, updated_at: now
  }).write()

  // Regresar dispositivo al almacén
  db.get('dispositivos').find({ id: cambio.dispositivo_id }).assign({
    estado: 'stock', ubicacion_tipo: 'almacen',
    ubicacion_id: null, ubicacion_nombre: 'Almacén Central',
    lat: null, lng: null, activo: true, updated_at: now
  }).write()

  res.json({ message: 'Cambio completado. Dispositivo regresado al almacén.' })
})

module.exports = router
