const router = require('express').Router()
const { v4: uuidv4 } = require('uuid')
const db = require('../data/db')
const { authMiddleware, requireRoles } = require('../middleware/auth.middleware')
const { auditLog } = require('../middleware/audit.middleware')

router.use(authMiddleware)

// Repositorio de productos
router.get('/repositorio', (req, res) => {
  res.json(db.get('repositorio_cotizacion').filter({ activo: true }).value())
})
router.post('/repositorio', requireRoles('super_admin', 'agente_soporte'), (req, res) => {
  const { nombre, descripcion, precio, moneda = 'MXN' } = req.body
  if (!nombre || !precio) return res.status(400).json({ message: 'Nombre y precio son requeridos' })
  const item = { id: uuidv4(), nombre, descripcion: descripcion || '', precio: parseFloat(precio), moneda, activo: true, created_at: new Date().toISOString() }
  db.get('repositorio_cotizacion').push(item).write()
  res.status(201).json(item)
})
router.put('/repositorio/:id', requireRoles('super_admin', 'agente_soporte'), (req, res) => {
  const item = db.get('repositorio_cotizacion').find({ id: req.params.id }).value()
  if (!item) return res.status(404).json({ message: 'Producto no encontrado' })
  db.get('repositorio_cotizacion').find({ id: req.params.id }).assign({ ...req.body, updated_at: new Date().toISOString() }).write()
  res.json(db.get('repositorio_cotizacion').find({ id: req.params.id }).value())
})
router.delete('/repositorio/:id', requireRoles('super_admin'), (req, res) => {
  db.get('repositorio_cotizacion').find({ id: req.params.id }).assign({ activo: false }).write()
  res.json({ message: 'Producto eliminado' })
})

// Cotizaciones
router.get('/', (req, res) => {
  const { page = 1, limit = 20, search, estado } = req.query
  let items = db.get('cotizaciones').value()
  if (estado) items = items.filter(c => c.estado === estado)
  if (search) {
    const q = search.toLowerCase()
    items = items.filter(c => c.folio?.toLowerCase().includes(q) || c.cliente?.toLowerCase().includes(q))
  }
  items = items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  const total = items.length
  const offset = (parseInt(page) - 1) * parseInt(limit)
  res.json({ data: items.slice(offset, offset + parseInt(limit)), total, page: parseInt(page), limit: parseInt(limit) })
})

router.get('/:id', (req, res) => {
  const item = db.get('cotizaciones').find({ id: req.params.id }).value()
  if (!item) return res.status(404).json({ message: 'Cotización no encontrada' })
  res.json(item)
})

router.post('/', requireRoles('super_admin', 'agente_soporte'), auditLog('crear', 'cotizacion'), (req, res) => {
  const { cliente, descripcion, items, moneda = 'MXN', tipo_cambio = 1, notas, fecha_vencimiento } = req.body
  if (!cliente || !items?.length) return res.status(400).json({ message: 'Cliente e items son requeridos' })

  const IVA = 0.16
  const subtotal = items.reduce((sum, i) => sum + (parseFloat(i.precio) * parseInt(i.cantidad)), 0)
  const iva = subtotal * IVA
  const total = subtotal + iva

  const count = db.get('cotizaciones').size().value()
  const folio = `COT-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`
  const now = new Date().toISOString()

  // Default vencimiento: 30 días desde hoy
  let venc = fecha_vencimiento
  if (!venc) {
    const d = new Date(); d.setDate(d.getDate() + 30)
    venc = d.toISOString().slice(0, 10)
  }

  const cotizacion = {
    id: uuidv4(), folio, cliente, descripcion: descripcion || '',
    items, subtotal, iva, total, moneda,
    tipo_cambio: parseFloat(tipo_cambio),
    total_mxn: moneda === 'USD' ? total * parseFloat(tipo_cambio) : total,
    notas: notas || '', estado: 'borrador',
    fecha_vencimiento: venc,
    creado_por: req.user.id, creado_por_nombre: req.user.nombre,
    created_at: now, updated_at: now
  }
  db.get('cotizaciones').push(cotizacion).write()
  res.status(201).json(cotizacion)
})

router.put('/:id', requireRoles('super_admin', 'agente_soporte'), (req, res) => {
  const item = db.get('cotizaciones').find({ id: req.params.id }).value()
  if (!item) return res.status(404).json({ message: 'Cotización no encontrada' })

  const IVA = 0.16
  const items = req.body.items || item.items
  const subtotal = items.reduce((sum, i) => sum + (parseFloat(i.precio) * parseInt(i.cantidad)), 0)
  const iva = subtotal * IVA
  const total = subtotal + iva
  const moneda = req.body.moneda || item.moneda
  const tipo_cambio = parseFloat(req.body.tipo_cambio || item.tipo_cambio)
  const fecha_vencimiento = req.body.fecha_vencimiento !== undefined ? req.body.fecha_vencimiento : item.fecha_vencimiento

  const updated = {
    ...item, ...req.body,
    items, subtotal, iva, total, moneda, tipo_cambio,
    total_mxn: moneda === 'USD' ? total * tipo_cambio : total,
    fecha_vencimiento,
    updated_at: new Date().toISOString()
  }
  db.get('cotizaciones').find({ id: req.params.id }).assign(updated).write()
  res.json(updated)
})

router.delete('/:id', requireRoles('super_admin'), (req, res) => {
  db.get('cotizaciones').remove({ id: req.params.id }).write()
  res.json({ message: 'Cotización eliminada' })
})

module.exports = router
