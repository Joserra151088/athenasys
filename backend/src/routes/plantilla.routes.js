const router = require('express').Router()
const { v4: uuidv4 } = require('uuid')
const db = require('../data/db')
const { authMiddleware, requireRoles } = require('../middleware/auth.middleware')
const { auditLog } = require('../middleware/audit.middleware')

router.use(authMiddleware)

router.get('/', (req, res) => {
  const { tipo } = req.query
  let items = db.get('plantillas').filter({ activo: true }).value()
  if (tipo) items = items.filter(p => p.tipo === tipo)
  res.json(items)
})

router.get('/:id', (req, res) => {
  const item = db.get('plantillas').find({ id: req.params.id, activo: true }).value()
  if (!item) return res.status(404).json({ message: 'Plantilla no encontrada' })
  res.json(item)
})

router.get('/:id/versiones', (req, res) => {
  const item = db.get('plantillas').find({ id: req.params.id }).value()
  if (!item) return res.status(404).json({ message: 'Plantilla no encontrada' })
  res.json(item.versiones || [])
})

router.post('/', requireRoles('super_admin', 'agente_soporte'), auditLog('crear', 'plantilla'), (req, res) => {
  const { tipo, nombre, texto_legal } = req.body
  if (!tipo || !nombre || !texto_legal) return res.status(400).json({ message: 'Tipo, nombre y texto legal son requeridos' })

  const now = new Date().toISOString()
  const item = {
    id: uuidv4(), tipo, nombre, texto_legal, version: 1,
    activo: true, creado_por: req.user.id, creado_por_nombre: req.user.nombre,
    modificado_por: null, versiones: [], created_at: now, updated_at: now
  }
  db.get('plantillas').push(item).write()
  res.status(201).json(item)
})

router.put('/:id', requireRoles('super_admin', 'agente_soporte'), auditLog('actualizar', 'plantilla'), (req, res) => {
  const item = db.get('plantillas').find({ id: req.params.id, activo: true }).value()
  if (!item) return res.status(404).json({ message: 'Plantilla no encontrada' })

  // Guardar versión anterior
  const versionAnterior = {
    version: item.version, texto_legal: item.texto_legal, nombre: item.nombre,
    modificado_por: item.modificado_por, modificado_por_nombre: item.modificado_por_nombre,
    fecha: item.updated_at
  }

  const now = new Date().toISOString()
  const updated = {
    ...item,
    nombre: req.body.nombre || item.nombre,
    texto_legal: req.body.texto_legal || item.texto_legal,
    version: item.version + 1,
    modificado_por: req.user.id,
    modificado_por_nombre: req.user.nombre,
    versiones: [...(item.versiones || []), versionAnterior],
    updated_at: now
  }
  db.get('plantillas').find({ id: req.params.id }).assign(updated).write()
  res.json(updated)
})

module.exports = router
