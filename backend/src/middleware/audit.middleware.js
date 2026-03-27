const db = require('../data/db')
const { v4: uuidv4 } = require('uuid')

function auditLog(accion, entidad) {
  return (req, res, next) => {
    const originalJson = res.json.bind(res)
    res.json = function (data) {
      if (res.statusCode < 400 && req.user) {
        try {
          db.get('auditoria').push({
            id: uuidv4(),
            usuario_id: req.user.id,
            usuario_nombre: req.user.nombre,
            accion,
            entidad,
            entidad_id: req.params?.id || data?.id || null,
            datos: req.method !== 'GET' ? JSON.stringify(req.body).substring(0, 500) : null,
            ip: req.ip,
            fecha: new Date().toISOString()
          }).write()
        } catch (e) {
          console.error('Audit error:', e)
        }
      }
      return originalJson(data)
    }
    next()
  }
}

module.exports = { auditLog }
