const router  = require('express').Router()
const { v4: uuidv4 } = require('uuid')
const db      = require('../data/db')
const { authMiddleware, requireRoles } = require('../middleware/auth.middleware')

router.use(authMiddleware)

// ─── Helper genérico ──────────────────────────────────────────────────────────
// Genera CRUD completo para una tabla de catálogo con campos: id, nombre, orden, activo
function buildCatalogRouter(tabla) {
  const r = require('express').Router()

  // GET /  — listar activos ordenados
  r.get('/', (req, res) => {
    const items = db.get(tabla)
      .filter({ activo: true })
      .sort((a, b) => (a.orden || 0) - (b.orden || 0))
      .value()
    res.json(items)
  })

  // GET /todos — listar incluyendo inactivos (solo admin)
  r.get('/todos', requireRoles('super_admin'), (req, res) => {
    const items = db.get(tabla)
      .sort((a, b) => (a.orden || 0) - (b.orden || 0))
      .value()
    res.json(items)
  })

  // POST / — crear
  r.post('/', requireRoles('super_admin', 'agente_soporte'), (req, res) => {
    const { nombre, orden } = req.body
    if (!nombre?.trim()) return res.status(400).json({ message: 'El nombre es requerido' })

    const existe = db.get(tabla).filter({ activo: true }).value()
      .some(i => i.nombre.toLowerCase() === nombre.trim().toLowerCase())
    if (existe) return res.status(409).json({ message: 'Ya existe un registro con ese nombre' })

    const now  = new Date().toISOString()
    const item = { id: uuidv4(), nombre: nombre.trim(), orden: orden ?? 0, activo: true, created_at: now, updated_at: now }
    db.get(tabla).push(item).write()
    res.status(201).json(item)
  })

  // PUT /:id — actualizar
  r.put('/:id', requireRoles('super_admin', 'agente_soporte'), (req, res) => {
    const item = db.get(tabla).find({ id: req.params.id }).value()
    if (!item) return res.status(404).json({ message: 'Registro no encontrado' })

    const { nombre, orden } = req.body
    if (nombre?.trim()) {
      const duplicado = db.get(tabla).filter({ activo: true }).value()
        .some(i => i.id !== req.params.id && i.nombre.toLowerCase() === nombre.trim().toLowerCase())
      if (duplicado) return res.status(409).json({ message: 'Ya existe un registro con ese nombre' })
    }

    const updates = {
      ...(nombre !== undefined && { nombre: nombre.trim() }),
      ...(orden  !== undefined && { orden }),
      updated_at: new Date().toISOString(),
    }
    db.get(tabla).find({ id: req.params.id }).assign(updates).write()
    res.json({ ...item, ...updates })
  })

  // DELETE /:id — soft delete (solo super_admin)
  r.delete('/:id', requireRoles('super_admin'), (req, res) => {
    const item = db.get(tabla).find({ id: req.params.id, activo: true }).value()
    if (!item) return res.status(404).json({ message: 'Registro no encontrado' })
    db.get(tabla).find({ id: req.params.id }).assign({ activo: false, updated_at: new Date().toISOString() }).write()
    res.json({ message: 'Registro eliminado correctamente' })
  })

  return r
}

// ─── Montar sub-rutas por catálogo ────────────────────────────────────────────
router.use('/tipos-dispositivo', buildCatalogRouter('catalogo_tipos_dispositivo'))
router.use('/tipos-licencia',    buildCatalogRouter('catalogo_tipos_licencia'))
router.use('/areas',             buildCatalogRouter('catalogo_areas'))
router.use('/marcas',            buildCatalogRouter('catalogo_marcas'))
router.use('/supervisores',      buildCatalogRouter('catalogo_supervisores'))
router.use('/puestos',           buildCatalogRouter('catalogo_puestos'))

module.exports = router
