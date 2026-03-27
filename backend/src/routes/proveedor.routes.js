const router = require('express').Router()
const { v4: uuidv4 } = require('uuid')
const db = require('../data/db')
const { authMiddleware, requireRoles } = require('../middleware/auth.middleware')

router.use(authMiddleware)

router.get('/', (req, res) => {
  res.json(db.get('proveedores').filter({ activo: true }).value())
})

router.post('/', requireRoles('super_admin', 'agente_soporte'), (req, res) => {
  const { nombre, contacto, telefono } = req.body
  if (!nombre) return res.status(400).json({ message: 'Nombre requerido' })
  const item = { id: uuidv4(), nombre, contacto: contacto || '', telefono: telefono || '', activo: true, created_at: new Date().toISOString() }
  db.get('proveedores').push(item).write()
  res.status(201).json(item)
})

router.put('/:id', requireRoles('super_admin', 'agente_soporte'), (req, res) => {
  const item = db.get('proveedores').find({ id: req.params.id }).value()
  if (!item) return res.status(404).json({ message: 'Proveedor no encontrado' })
  db.get('proveedores').find({ id: req.params.id }).assign({ ...req.body, updated_at: new Date().toISOString() }).write()
  res.json(db.get('proveedores').find({ id: req.params.id }).value())
})

router.delete('/:id', requireRoles('super_admin'), (req, res) => {
  db.get('proveedores').find({ id: req.params.id }).assign({ activo: false }).write()
  res.json({ message: 'Proveedor eliminado' })
})

module.exports = router
