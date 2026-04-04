const router = require('express').Router()
const { v4: uuidv4 } = require('uuid')
const multer = require('multer')
const db = require('../data/db')
const { authMiddleware, requireRoles } = require('../middleware/auth.middleware')
const { auditLog } = require('../middleware/audit.middleware')

const upload = multer({ storage: multer.memoryStorage() })

router.use(authMiddleware)

// ── Importar sucursales desde CSV ────────────────────────────────────────────
router.post('/importar-csv', requireRoles('super_admin', 'agente_soporte'), upload.single('archivo'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Archivo CSV requerido' })
  const text = req.file.buffer.toString('utf8')
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return res.status(400).json({ message: 'CSV vacío o sin datos' })

  const parseRow = (line) => {
    const result = []
    let cur = '', inQ = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') { inQ = !inQ }
      else if (ch === ',' && !inQ) { result.push(cur.trim()); cur = '' }
      else { cur += ch }
    }
    result.push(cur.trim())
    return result
  }

  const headers = parseRow(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, '_'))
  const creados = [], errores = []
  const now = new Date().toISOString()

  for (let i = 1; i < lines.length; i++) {
    const cols = parseRow(lines[i])
    const row = {}
    headers.forEach((h, idx) => { row[h] = cols[idx] || '' })

    if (!row.nombre || !row.tipo) {
      errores.push({ linea: i + 1, error: 'nombre y tipo son requeridos' })
      continue
    }

    const suc = {
      id: uuidv4(),
      nombre: row.nombre,
      tipo: row.tipo || 'sucursal',
      direccion: row.direccion || '',
      estado: row.estado || '',
      lat: row.lat ? parseFloat(row.lat) : null,
      lng: row.lng ? parseFloat(row.lng) : null,
      activo: true, created_at: now
    }
    db.get('sucursales').push(suc).write()
    creados.push(row.nombre)
  }

  res.json({ creados: creados.length, errores: errores.length, detalle: { creados, errores } })
})

router.get('/', (req, res) => {
  const { search, tipo, page = 1, limit = 50 } = req.query
  let items = db.get('sucursales').filter({ activo: true }).value()

  if (tipo) items = items.filter(s => s.tipo === tipo)
  if (search) {
    const normalizeStr = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
    const q = normalizeStr(search)
    items = items.filter(s =>
      normalizeStr(s.nombre).includes(q) ||
      normalizeStr(s.estado).includes(q) ||
      normalizeStr(s.direccion).includes(q)
    )
  }

  const total = items.length
  const offset = (parseInt(page) - 1) * parseInt(limit)
  const data = items.slice(offset, offset + parseInt(limit))
  res.json({ data, total, page: parseInt(page), limit: parseInt(limit) })
})

router.get('/:id', (req, res) => {
  const item = db.get('sucursales').find({ id: req.params.id, activo: true }).value()
  if (!item) return res.status(404).json({ message: 'Sucursal no encontrada' })
  res.json(item)
})

router.post('/', requireRoles('super_admin', 'agente_soporte'), auditLog('crear', 'sucursal'), (req, res) => {
  const { nombre, tipo, direccion, estado, lat, lng, email, determinante, centro_costos, centro_costo_codigo, centro_costo_nombre } = req.body
  if (!nombre || !tipo) return res.status(400).json({ message: 'Nombre y tipo son requeridos' })

  const now = new Date().toISOString()
  const item = {
    id: uuidv4(), nombre, tipo, direccion: direccion || '',
    estado: estado || '', lat: parseFloat(lat) || null, lng: parseFloat(lng) || null,
    email: email || null,
    determinante: determinante !== undefined && determinante !== '' ? parseInt(determinante) : null,
    centro_costos: centro_costos || centro_costo_codigo || null,
    centro_costo_codigo: centro_costo_codigo || null,
    centro_costo_nombre: centro_costo_nombre || null,
    activo: true, created_at: now
  }
  db.get('sucursales').push(item).write()
  res.status(201).json(item)
})

router.put('/:id', requireRoles('super_admin', 'agente_soporte'), auditLog('actualizar', 'sucursal'), (req, res) => {
  const item = db.get('sucursales').find({ id: req.params.id, activo: true }).value()
  if (!item) return res.status(404).json({ message: 'Sucursal no encontrada' })

  const updated = {
    ...item, ...req.body,
    lat: req.body.lat !== undefined ? parseFloat(req.body.lat) : item.lat,
    lng: req.body.lng !== undefined ? parseFloat(req.body.lng) : item.lng,
    updated_at: new Date().toISOString()
  }
  db.get('sucursales').find({ id: req.params.id }).assign(updated).write()
  res.json(updated)
})

router.delete('/:id', requireRoles('super_admin'), auditLog('eliminar', 'sucursal'), (req, res) => {
  const item = db.get('sucursales').find({ id: req.params.id, activo: true }).value()
  if (!item) return res.status(404).json({ message: 'Sucursal no encontrada' })
  db.get('sucursales').find({ id: req.params.id }).assign({ activo: false }).write()
  res.json({ message: 'Sucursal eliminada' })
})

module.exports = router
