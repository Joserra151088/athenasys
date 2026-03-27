const router = require('express').Router()
const { v4: uuidv4 } = require('uuid')
const db = require('../data/db')
const { authMiddleware, requireRoles } = require('../middleware/auth.middleware')

router.use(authMiddleware)

// GET /api/config/logo
router.get('/logo', (req, res) => {
  const cfg = db.get('configuracion').find({ clave: 'logo_global' }).value()
  res.json({ logo: cfg?.valor || null })
})

// PUT /api/config/logo
router.put('/logo', requireRoles('super_admin', 'agente_soporte'), (req, res) => {
  const { logo } = req.body
  const existing = db.get('configuracion').find({ clave: 'logo_global' }).value()
  const now = new Date().toISOString()
  if (existing) {
    db.get('configuracion').find({ clave: 'logo_global' }).assign({ valor: logo || null, updated_at: now }).write()
  } else {
    db.get('configuracion').push({ id: uuidv4(), clave: 'logo_global', valor: logo || null, updated_at: now }).write()
  }
  res.json({ logo: logo || null })
})

module.exports = router
