const jwt = require('jsonwebtoken')
const db = require('../data/db')

const JWT_SECRET = process.env.JWT_SECRET || 'kronos-ti-secret-2024'

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token requerido' })
  }
  try {
    const token = auth.split(' ')[1]
    const payload = jwt.verify(token, JWT_SECRET)
    const user = db.get('usuarios_sistema').find({ id: payload.id }).value()
    if (!user || !user.activo) return res.status(401).json({ message: 'Usuario no válido' })
    req.user = user
    next()
  } catch {
    res.status(401).json({ message: 'Token inválido o expirado' })
  }
}

function requireRoles(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.rol)) {
      return res.status(403).json({ message: 'Sin permisos para esta acción' })
    }
    next()
  }
}

module.exports = { authMiddleware, requireRoles, JWT_SECRET }
