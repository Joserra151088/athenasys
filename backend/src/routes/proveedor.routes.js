const router = require('express').Router()
const { v4: uuidv4 } = require('uuid')
const db = require('../data/db')
const { authMiddleware, requireRoles } = require('../middleware/auth.middleware')

router.use(authMiddleware)

router.get('/', (req, res) => {
  res.json(db.get('proveedores').filter({ activo: true }).value())
})

router.post('/', requireRoles('super_admin', 'agente_soporte'), (req, res) => {
  const { nombre, contacto, telefono, contacto_nombre, rfc, direccion, url_web, imagen } = req.body
  if (!nombre) return res.status(400).json({ message: 'Nombre requerido' })
  const item = {
    id: uuidv4(), nombre,
    contacto: contacto || '',
    telefono: telefono || '',
    contacto_nombre: contacto_nombre || '',
    rfc: rfc || '',
    direccion: direccion || '',
    url_web: url_web || '',
    imagen: imagen || null,
    activo: true,
    created_at: new Date().toISOString()
  }
  db.get('proveedores').push(item).write()
  res.status(201).json(item)
})

router.put('/:id', requireRoles('super_admin', 'agente_soporte'), (req, res) => {
  const item = db.get('proveedores').find({ id: req.params.id }).value()
  if (!item) return res.status(404).json({ message: 'Proveedor no encontrado' })
  db.get('proveedores').find({ id: req.params.id }).assign({ ...req.body, updated_at: new Date().toISOString() }).write()
  res.json(db.get('proveedores').find({ id: req.params.id }).value())
})

router.delete('/:id', requireRoles('super_admin'), (req, res) => {
  db.get('proveedores').find({ id: req.params.id }).assign({ activo: false }).write()
  res.json({ message: 'Proveedor eliminado' })
})

// ── Documentos del proveedor ─────────────────────────────────────────────────
router.get('/:id/documentos', (req, res) => {
  const docs = db.get('proveedor_documentos').filter({ proveedor_id: req.params.id }).value()
  res.json(docs)
})

router.post('/:id/documentos', requireRoles('super_admin', 'agente_soporte'), (req, res) => {
  const proveedor = db.get('proveedores').find({ id: req.params.id }).value()
  if (!proveedor) return res.status(404).json({ message: 'Proveedor no encontrado' })
  const { nombre, tipo = 'otro', archivo, nombre_archivo } = req.body
  if (!nombre) return res.status(400).json({ message: 'Nombre del documento requerido' })
  const doc = {
    id: uuidv4(),
    proveedor_id: req.params.id,
    nombre,
    tipo,
    archivo: archivo || null,
    nombre_archivo: nombre_archivo || null,
    created_at: new Date().toISOString()
  }
  db.get('proveedor_documentos').push(doc).write()
  res.status(201).json(doc)
})

router.delete('/:id/documentos/:docId', requireRoles('super_admin', 'agente_soporte'), (req, res) => {
  const doc = db.get('proveedor_documentos').find({ id: req.params.docId, proveedor_id: req.params.id }).value()
  if (!doc) return res.status(404).json({ message: 'Documento no encontrado' })
  db.get('proveedor_documentos').remove({ id: req.params.docId }).write()
  res.json({ message: 'Documento eliminado' })
})

module.exports = router
