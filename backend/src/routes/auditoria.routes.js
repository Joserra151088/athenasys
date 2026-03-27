const router = require('express').Router()
const db = require('../data/db')
const { authMiddleware, requireRoles } = require('../middleware/auth.middleware')

router.use(authMiddleware)
router.use(requireRoles('super_admin'))

router.get('/', (req, res) => {
  const { page = 1, limit = 50, entidad, accion, usuario_id, search } = req.query
  let items = db.get('auditoria').value()

  if (entidad) items = items.filter(a => a.entidad === entidad)
  if (accion) items = items.filter(a => a.accion === accion)
  if (usuario_id) items = items.filter(a => a.usuario_id === usuario_id)
  if (search) {
    const q = search.toLowerCase()
    items = items.filter(a =>
      a.usuario_nombre?.toLowerCase().includes(q) ||
      a.accion?.toLowerCase().includes(q) ||
      a.entidad?.toLowerCase().includes(q)
    )
  }

  items = items.sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
  const total = items.length
  const offset = (parseInt(page) - 1) * parseInt(limit)
  res.json({ data: items.slice(offset, offset + parseInt(limit)), total, page: parseInt(page), limit: parseInt(limit) })
})

module.exports = router
