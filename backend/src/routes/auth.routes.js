const router = require('express').Router()
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const db = require('../data/db')
const { authMiddleware, JWT_SECRET } = require('../middleware/auth.middleware')

router.post('/login', (req, res) => {
  const { username, password } = req.body
  if (!username || !password) return res.status(400).json({ message: 'Usuario y contraseña requeridos' })

  const user = db.get('usuarios_sistema').find({ username, activo: true }).value()
  if (!user) return res.status(401).json({ message: 'Credenciales incorrectas' })

  const valid = bcrypt.compareSync(password, user.password)
  if (!valid) return res.status(401).json({ message: 'Credenciales incorrectas' })

  const token = jwt.sign({ id: user.id, rol: user.rol }, JWT_SECRET, { expiresIn: '8h' })
  const { password: _, ...userData } = user
  res.json({ token, user: userData })
})

router.get('/me', authMiddleware, (req, res) => {
  const { password: _, ...userData } = req.user
  res.json(userData)
})

module.exports = router
