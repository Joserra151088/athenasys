const router = require('express').Router()
const { v4: uuidv4 } = require('uuid')
const bcrypt = require('bcryptjs')
const db = require('../data/db')
const { authMiddleware, requireRoles } = require('../middleware/auth.middleware')

router.use(authMiddleware)

// ── Firma del usuario actual (cualquier rol) ──────────────────────────────────
router.get('/me/firma', (req, res) => {
  const user = db.get('usuarios_sistema').find({ id: req.user.id }).value()
  res.json({ firma_base64: user?.firma_base64 || null })
})

router.post('/me/firma', (req, res) => {
  const { firma_base64 } = req.body
  if (!firma_base64) return res.status(400).json({ message: 'firma_base64 es requerido' })
  db.get('usuarios_sistema').find({ id: req.user.id }).assign({
    firma_base64, updated_at: new Date().toISOString()
  }).write()
  const { password: _, ...userData } = db.get('usuarios_sistema').find({ id: req.user.id }).value()
  res.json(userData)
})

router.delete('/me/firma', (req, res) => {
  db.get('usuarios_sistema').find({ id: req.user.id }).assign({
    firma_base64: null, updated_at: new Date().toISOString()
  }).write()
  res.json({ message: 'Firma eliminada' })
})

// ── Rutas solo super_admin ────────────────────────────────────────────────────
router.use(requireRoles('super_admin'))

router.get('/', (req, res) => {
  const users = db.get('usuarios_sistema').value().map(({ password: _, firma_base64: __, ...u }) => u)
  res.json(users)
})

router.post('/', (req, res) => {
  const { username, password, nombre, email, rol } = req.body
  if (!username || !password || !nombre || !rol) return res.status(400).json({ message: 'Todos los campos son requeridos' })
  const existe = db.get('usuarios_sistema').find({ username }).value()
  if (existe) return res.status(409).json({ message: 'El usuario ya existe' })
  const salt = bcrypt.genSaltSync(10)
  const now = new Date().toISOString()
  const user = {
    id: uuidv4(), username, password: bcrypt.hashSync(password, salt),
    nombre, email: email || '', rol, activo: true, created_at: now, updated_at: now,
    firma_base64: null, firma_path: null
  }
  db.get('usuarios_sistema').push(user).write()
  const { password: _, firma_base64: __, ...userData } = user
  res.status(201).json(userData)
})

router.put('/:id', (req, res) => {
  const user = db.get('usuarios_sistema').find({ id: req.params.id }).value()
  if (!user) return res.status(404).json({ message: 'Usuario no encontrado' })
  const updates = { ...req.body, updated_at: new Date().toISOString() }
  if (req.body.password) {
    updates.password = bcrypt.hashSync(req.body.password, bcrypt.genSaltSync(10))
  } else {
    delete updates.password
  }
  db.get('usuarios_sistema').find({ id: req.params.id }).assign(updates).write()
  const { password: _, firma_base64: __, ...updated } = db.get('usuarios_sistema').find({ id: req.params.id }).value()
  res.json(updated)
})

router.delete('/:id', (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ message: 'No puedes eliminarte a ti mismo' })
  db.get('usuarios_sistema').find({ id: req.params.id }).assign({ activo: false }).write()
  res.json({ message: 'Usuario desactivado' })
})

module.exports = router
