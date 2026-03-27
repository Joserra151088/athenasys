const express = require('express')
const router = express.Router()
const { v4: uuidv4 } = require('uuid')
const db = require('../data/db')
const { authMiddleware, requireRoles } = require('../middleware/auth.middleware')
router.use(authMiddleware)

// GET /api/centros-costo - listar con búsqueda y paginación
router.get('/', (req, res) => {
  const { q = '', page = 1, limit = 50, activo } = req.query
  let items = db.get('centros_costo').value()

  if (activo !== undefined) {
    const isActivo = activo === 'true'
    items = items.filter(c => c.activo === isActivo)
  }

  if (q) {
    const search = q.toLowerCase()
    items = items.filter(c =>
      c.codigo?.toLowerCase().includes(search) ||
      c.nombre?.toLowerCase().includes(search) ||
      c.sort_code?.toLowerCase().includes(search)
    )
  }

  const total = items.length
  const start = (parseInt(page) - 1) * parseInt(limit)
  const data = items.slice(start, start + parseInt(limit))

  res.json({ data, total, page: parseInt(page), limit: parseInt(limit) })
})

// GET /api/centros-costo/search?q=... - búsqueda rápida para selects (top 20)
router.get('/search', (req, res) => {
  const { q = '' } = req.query
  const search = q.toLowerCase()
  const results = db.get('centros_costo')
    .filter(c => c.activo && (
      c.codigo?.toLowerCase().includes(search) ||
      c.nombre?.toLowerCase().includes(search)
    ))
    .take(20)
    .value()
  res.json(results)
})

// GET /api/centros-costo/:id
router.get('/:id', (req, res) => {
  const item = db.get('centros_costo').find({ id: req.params.id }).value()
  if (!item) return res.status(404).json({ message: 'Centro de costo no encontrado' })
  res.json(item)
})

// POST /api/centros-costo
router.post('/', requireRoles('super_admin'), (req, res) => {
  const { codigo, sort_code, nombre, valido_desde } = req.body
  if (!codigo || !nombre) return res.status(400).json({ message: 'codigo y nombre son requeridos' })
  const existe = db.get('centros_costo').filter(c => c.codigo === codigo).value()[0]
  if (existe) return res.status(409).json({ message: 'Ya existe un centro de costo con ese código' })
  const item = {
    id: uuidv4(), codigo: codigo.trim(), sort_code: sort_code?.trim() || '',
    nombre: nombre.trim(), activo: true,
    valido_desde: valido_desde || new Date().toISOString().slice(0, 10)
  }
  db.get('centros_costo').push(item).write()
  res.status(201).json(item)
})

// PUT /api/centros-costo/:id
router.put('/:id', requireRoles('super_admin'), (req, res) => {
  const item = db.get('centros_costo').find({ id: req.params.id }).value()
  if (!item) return res.status(404).json({ message: 'No encontrado' })
  const updates = {}
  if (req.body.codigo  !== undefined) updates.codigo  = req.body.codigo.trim()
  if (req.body.sort_code !== undefined) updates.sort_code = req.body.sort_code?.trim() || ''
  if (req.body.nombre  !== undefined) updates.nombre  = req.body.nombre.trim()
  if (req.body.valido_desde !== undefined) updates.valido_desde = req.body.valido_desde
  db.get('centros_costo').find({ id: req.params.id }).assign(updates).write()
  res.json(db.get('centros_costo').find({ id: req.params.id }).value())
})

// DELETE /api/centros-costo/:id  (soft-delete)
router.delete('/:id', requireRoles('super_admin'), (req, res) => {
  const item = db.get('centros_costo').find({ id: req.params.id }).value()
  if (!item) return res.status(404).json({ message: 'No encontrado' })
  db.get('centros_costo').find({ id: req.params.id }).assign({ activo: false }).write()
  res.json({ ok: true })
})

// POST /api/centros-costo/activate/:id
router.post('/activate/:id', requireRoles('super_admin'), (req, res) => {
  const item = db.get('centros_costo').find({ id: req.params.id }).value()
  if (!item) return res.status(404).json({ message: 'No encontrado' })
  db.get('centros_costo').find({ id: req.params.id }).assign({ activo: true }).write()
  res.json({ ok: true })
})

// POST /api/centros-costo/import  — compara y opcionalmente aplica
router.post('/import', requireRoles('super_admin'), (req, res) => {
  const { rows = [], apply = false } = req.body
  const existing = db.get('centros_costo').value()
  const byCode = {}
  for (const e of existing) byCode[e.codigo] = e

  const nuevo = [], actualizado = [], sinCambios = []
  for (const row of rows) {
    if (!row.codigo) continue
    const e = byCode[row.codigo]
    if (!e) {
      nuevo.push(row)
    } else {
      const changed = (e.nombre !== row.nombre) || (e.sort_code || '') !== (row.sort_code || '')
      if (changed) actualizado.push({ ...row, id: e.id, prev_nombre: e.nombre, prev_sort_code: e.sort_code })
      else sinCambios.push(row)
    }
  }

  if (apply) {
    const now = new Date().toISOString().slice(0, 10)
    for (const n of nuevo) {
      db.get('centros_costo').push({
        id: uuidv4(), codigo: n.codigo, sort_code: n.sort_code || '',
        nombre: n.nombre, activo: true, valido_desde: n.valido_desde || now
      }).write()
    }
    for (const u of actualizado) {
      db.get('centros_costo').find({ id: u.id }).assign({
        nombre: u.nombre, sort_code: u.sort_code || ''
      }).write()
    }
  }

  res.json({
    nuevo: nuevo.length, actualizado: actualizado.length, sin_cambios: sinCambios.length,
    detalle: { nuevo, actualizado }
  })
})

module.exports = router
