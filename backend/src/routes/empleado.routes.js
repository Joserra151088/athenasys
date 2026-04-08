const router = require('express').Router()
const { v4: uuidv4 } = require('uuid')
const multer = require('multer')
const db = require('../data/db')
const { authMiddleware, requireRoles } = require('../middleware/auth.middleware')
const { auditLog } = require('../middleware/audit.middleware')
const { uploadImage, getFotoFolder } = require('../services/s3.service')

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })

function resolveSucursal(sucursalId) {
  if (!sucursalId) return { sucursal_id: null, sucursal_nombre: null }
  const sucursal = db.get('sucursales').find({ id: sucursalId, activo: true }).value()
  if (!sucursal) return { sucursal_id: null, sucursal_nombre: null }
  return { sucursal_id: sucursal.id, sucursal_nombre: sucursal.nombre }
}

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
  const { search, sucursal_id, area, puesto, jefe_nombre, num_empleado, email, page = 1, limit = 50 } = req.query
  let items = db.get('empleados').filter({ activo: true }).value()

  const norm = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

  if (sucursal_id) items = items.filter(e => e.sucursal_id === sucursal_id)
  if (area) items = items.filter(e => e.area === area)
  if (puesto) items = items.filter(e => norm(e.puesto).includes(norm(puesto)))
  if (jefe_nombre) items = items.filter(e => norm(e.jefe_nombre).includes(norm(jefe_nombre)))
  if (num_empleado) items = items.filter(e => norm(e.num_empleado).includes(norm(num_empleado)))
  if (email) items = items.filter(e => norm(e.email).includes(norm(email)))
  if (search) {
    const q = norm(search)
    items = items.filter(e =>
      norm(e.nombre_completo).includes(q) ||
      norm(e.num_empleado).includes(q) ||
      norm(e.puesto).includes(q) ||
      norm(e.email).includes(q)
    )
  }

  const total = items.length
  const offset = (parseInt(page) - 1) * parseInt(limit)
  const data = items.slice(offset, offset + parseInt(limit))
  res.json({ data, total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) })
})

// ── Subir foto de empleado a S3 ───────────────────────────────────────────────
router.post('/:id/foto', requireRoles('super_admin', 'agente_soporte'), upload.single('foto'), async (req, res) => {
  const item = db.get('empleados').find({ id: req.params.id, activo: true }).value()
  if (!item) return res.status(404).json({ message: 'Empleado no encontrado' })
  if (!req.file) return res.status(400).json({ message: 'Archivo de foto requerido' })

  try {
    const ext = req.file.mimetype.split('/')[1] || 'jpg'
    const filename = `${item.num_empleado || item.id}_${Date.now()}.${ext}`
    const folder = getFotoFolder('empleado')
    const url = await uploadImage(req.file.buffer, folder, filename, req.file.mimetype)

    db.get('empleados').find({ id: req.params.id }).assign({ foto_url: url, updated_at: new Date().toISOString() }).write()
    res.json({ foto_url: url })
  } catch (err) {
    console.error('Error subiendo foto:', err)
    res.status(500).json({ message: 'Error al subir la foto' })
  }
})

// Trayectoria de equipos de un empleado por nombre
router.get('/trayectoria', (req, res) => {
  const { nombre } = req.query
  if (!nombre) return res.status(400).json({ message: 'Se requiere el parámetro nombre' })

  const normalizeStr = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
  const q = normalizeStr(nombre)

  const empleados = db.get('empleados').filter(e =>
    normalizeStr(e.nombre_completo).includes(q) ||
    normalizeStr(e.num_empleado).includes(q)
  ).value()

  if (!empleados.length) return res.status(404).json({ message: 'No se encontró ningún empleado con ese nombre o número' })

  const resultados = empleados.map(emp => {
    const asignaciones = db.get('asignaciones')
      .filter({ asignado_a_id: emp.id, tipo_asignacion: 'empleado' })
      .value()
      .sort((a, b) => new Date(a.fecha_asignacion) - new Date(b.fecha_asignacion))

    const nodos = []

    for (const asig of asignaciones) {
      const dispositivo = db.get('dispositivos').find({ id: asig.dispositivo_id }).value()
      nodos.push({
        tipo: 'asignacion',
        fecha: asig.fecha_asignacion,
        titulo: `${dispositivo?.tipo || 'Dispositivo'} — ${dispositivo?.marca || ''}`,
        descripcion: `Serie: ${dispositivo?.serie || 'N/A'} · Asignado por ${asig.asignado_por_nombre}`,
        serie: dispositivo?.serie || '',
        dispositivo_id: asig.dispositivo_id,
        por: asig.asignado_por_nombre,
        icono: 'asignacion'
      })

      if (!asig.activo && asig.fecha_devolucion) {
        nodos.push({
          tipo: 'retorno',
          fecha: asig.fecha_devolucion,
          titulo: 'Devuelto al almacén',
          descripcion: `${dispositivo?.tipo || 'Dispositivo'} — ${dispositivo?.serie || ''}`,
          serie: dispositivo?.serie || '',
          icono: 'almacen'
        })
      }
    }

    return { empleado: emp, nodos }
  })

  res.json(resultados)
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

  const sucursalData = resolveSucursal(sucursal_id)
  const now = new Date().toISOString()
  const item = {
    id: uuidv4(), nombre_completo, num_empleado, puesto: puesto || '',
    area: area || '',
    centro_costos: centro_costos || centro_costo_codigo || '',
    centro_costo_codigo: centro_costo_codigo || null,
    centro_costo_nombre: centro_costo_nombre || null,
    jefe_nombre: jefe_nombre || null,
    ...sucursalData,
    email: email || '', telefono: telefono || '',
    activo: true, created_at: now
  }
  db.get('empleados').push(item).write()
  res.status(201).json(item)
})

router.put('/:id', requireRoles('super_admin', 'agente_soporte'), auditLog('actualizar', 'empleado'), (req, res) => {
  const item = db.get('empleados').find({ id: req.params.id, activo: true }).value()
  if (!item) return res.status(404).json({ message: 'Empleado no encontrado' })

  const sucursalData = Object.prototype.hasOwnProperty.call(req.body, 'sucursal_id')
    ? resolveSucursal(req.body.sucursal_id)
    : { sucursal_id: item.sucursal_id, sucursal_nombre: item.sucursal_nombre }
  const updated = {
    ...item, ...req.body,
    ...sucursalData,
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
