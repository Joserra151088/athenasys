const express = require('express')
const router = express.Router()
const db = require('../data/db')
const { authMiddleware, requireRoles } = require('../middleware/auth.middleware')
router.use(authMiddleware)

// GET /api/tarifas - listar todas las tarifas
router.get('/', (req, res) => {
  const tarifas = db.get('tarifas_equipo').filter({ activo: true }).value()
  res.json(tarifas)
})

// PUT /api/tarifas/:id - actualizar tarifa (solo super_admin y agente_soporte)
router.put('/:id', requireRoles('super_admin', 'agente_soporte'), (req, res) => {
  const { costo_dia } = req.body
  if (costo_dia === undefined || isNaN(parseFloat(costo_dia))) {
    return res.status(400).json({ message: 'costo_dia inválido' })
  }
  const tarifa = db.get('tarifas_equipo').find({ id: req.params.id }).value()
  if (!tarifa) return res.status(404).json({ message: 'Tarifa no encontrada' })

  db.get('tarifas_equipo').find({ id: req.params.id }).assign({
    costo_dia: parseFloat(costo_dia),
    updated_at: new Date().toISOString()
  }).write()

  res.json(db.get('tarifas_equipo').find({ id: req.params.id }).value())
})

module.exports = router
