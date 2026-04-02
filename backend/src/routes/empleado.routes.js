const router = require('express').Router()
const { v4: uuidv4 } = require('uuid')
const multer = require('multer')
const db = require('../data/db')
const { authMiddleware, requireRoles } = require('../middleware/auth.middleware')
const { auditLog } = require('../middleware/audit.middleware')

const upload = multer({ storage: multer.memoryStorage() })

router.use(authMiddleware)

// ── Importar empleados desde CSV ─────────────────────────────────────────────
router.post('/importar-csv', requireRoles('super_admin', 'agente_soporte'), upload.single('archivo'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Archivo CSV requerido' })
  const text = req.file.buffer.toString('utf8')
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return res.status(400).json({ message: 'CSV vacío o sin datos' })

  // Parse simple CSV (handle quoted fields)
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
  const creados = [], duplicados = [], errores = []
  const now = new Date().toISOString()

  for (let i = 1; i < lines.length; i++) {
    const cols = parseRow(lines[i])
    const row = {}
    headers.forEach((h, idx) => { row[h] = cols[idx] || '' })

    if (!row.num_empleado || !row.nombre_completo) {
      errores.push({ linea: i + 1, error: 'num_empleado y nombre_completo son requeridos' })
      continue
    }

    const existe = db.get('empleados').find({ num_empleado: row.num_empleado, activo: true }).value()
    if (existe) { duplicados.push(row.num_empleado); continue }

    // Resolve sucursal by name
    let sucursal_id = null, sucursal_nombre = null
    if (row.sucursal_nombre) {
      const suc = db.get('sucursales').filter(s => s.activo && s.nombre.toLowerCase() === row.sucursal_nombre.toLowerCase()).value()[0]
      if (suc) { sucursal_id = suc.id; sucursal_nombre = suc.nombre }
    }

    const emp = {
      id: uuidv4(),
      nombre_completo: row.nombre_completo,
      num_empleado: row.num_empleado,
      puesto: row.puesto || '',
      area: row.area || '',
      email: row.email || '',
      telefono: row.telefono || '',
      centro_costos: '',
      sucursal_id, sucursal_nombre,
      activo: true, created_at: now
    }
    db.get('empleados').push(emp).write()
    creados.push(row.num_empleado)
  }

  res.json({ creados: creados.length, duplicados: duplicados.length, errores: errores.length, detalle: { creados, duplicados, errores } })
})

router.get('/', (req, res) => {
  const { search, sucursal_id, area, page = 1, limit = 50 } = req.query
  let items = db.get('empleados').filter({ activo: true }).value()

  if (sucursal_id) items = items.filter(e => e.sucursal_id === sucursal_id)
  if (area) items = items.filter(e => e.area === area)
  if (search) {
    const q = search.toLowerCase()
    items = items.filter(e =>
      e.nombre_completo?.toLowerCase().includes(q) ||
      e.num_empleado?.toLowerCase().includes(q) ||
      e.puesto?.toLowerCase().includes(q) ||
      e.email?.toLowerCase().includes(q)
    )
  }

  const total = items.length
  const offset = (parseInt(page) - 1) * parseInt(limit)
  const data = items.slice(offset, offset + parseInt(limit))
  res.json({ data, total, page: parseInt(page), limit: parseInt(limit) })
})

router.get('/:id', (req, res) => {
  const item = db.get('empleados').find({ id: req.params.id, activo: true }).value()
  if (!item) return res.status(404).json({ message: 'Empleado no encontrado' })
  res.json(item)
})

router.post('/', requireRoles('super_admin', 'agente_soporte'), auditLog('crear', 'empleado'), (req, res) => {
  const { nombre_completo, num_empleado, puesto, area, centro_costos, centro_costo_codigo, centro_costo_nombre, jefe_nombre, sucursal_id, email, telefono } = req.body
  if (!nombre_completo || !num_empleado) return res.status(400).json({ message: 'Nombre y número de empleado son requeridos' })

  const existe = db.get('empleados').find({ num_empleado, activo: true }).value()
  if (existe) return res.status(409).json({ message: 'Ya existe un empleado con ese número' })

  const sucursal = sucursal_id ? db.get('sucursales').find({ id: sucursal_id }).value() : null
  const now = new Date().toISOString()
  const item = {
    id: uuidv4(), nombre_completo, num_empleado, puesto: puesto || '',
    area: area || '',
    centro_costos: centro_costos || centro_costo_codigo || '',
    centro_costo_codigo: centro_costo_codigo || null,
    centro_costo_nombre: centro_costo_nombre || null,
    jefe_nombre: jefe_nombre || null,
    sucursal_id: sucursal_id || null, sucursal_nombre: sucursal?.nombre || null,
    email: email || '', telefono: telefono || '',
    activo: true, created_at: now
  }
  db.get('empleados').push(item).write()
  res.status(201).json(item)
})

router.put('/:id', requireRoles('super_admin', 'agente_soporte'), auditLog('actualizar', 'empleado'), (req, res) => {
  const item = db.get('empleados').find({ id: req.params.id, activo: true }).value()
  if (!item) return res.status(404).json({ message: 'Empleado no encontrado' })

  const sucursal = req.body.sucursal_id ? db.get('sucursales').find({ id: req.body.sucursal_id }).value() : null
  const updated = {
    ...item, ...req.body,
    sucursal_nombre: sucursal?.nombre || item.sucursal_nombre,
    updated_at: new Date().toISOString()
  }
  db.get('empleados').find({ id: req.params.id }).assign(updated).write()
  res.json(updated)
})

router.delete('/:id', requireRoles('super_admin'), auditLog('eliminar', 'empleado'), async (req, res) => {
  const item = db.get('empleados').find({ id: req.params.id, activo: true }).value()
  if (!item) return res.status(404).json({ message: 'Empleado no encontrado' })
  // Soft-delete: activo=false en memoria + MySQL (conserva historial de documentos/asignaciones)
  db.get('empleados').find({ id: req.params.id }).assign({ activo: false, updated_at: new Date().toISOString() }).write()
  res.json({ message: 'Empleado desactivado', id: req.params.id })
})

module.exports = router
