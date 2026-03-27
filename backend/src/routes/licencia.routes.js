const router = require('express').Router()
const { v4: uuidv4 } = require('uuid')
const db = require('../data/db')
const { authMiddleware, requireRoles } = require('../middleware/auth.middleware')
const { auditLog } = require('../middleware/audit.middleware')

router.use(authMiddleware)

// ─── ESTADÍSTICAS ────────────────────────────────────────────────────────────
router.get('/stats', (req, res) => {
  const licencias = db.get('licencias').filter({ activo: true }).value()
  const hoy = new Date()
  const en30dias = new Date(hoy.getTime() + 30 * 24 * 60 * 60 * 1000)

  const stats = {
    total: licencias.length,
    activas: 0,
    vencidas: 0,
    por_vencer: 0,
    total_asientos: 0,
    asientos_usados: 0,
    costo_mensual_mxn: 0
  }

  licencias.forEach(l => {
    const venc = l.fecha_vencimiento ? new Date(l.fecha_vencimiento) : null
    if (!venc || venc > hoy) stats.activas++
    else stats.vencidas++
    if (venc && venc > hoy && venc <= en30dias) stats.por_vencer++
    stats.total_asientos += l.total_asientos || 0
    stats.asientos_usados += (l.asientos_usados || 0)

    // Normalizar a costo mensual MXN
    const costo = parseFloat(l.costo) || 0
    const tc = parseFloat(l.tipo_cambio) || 1
    const costoMXN = l.moneda === 'USD' ? costo * tc : costo
    if (l.tipo_costo === 'anual') stats.costo_mensual_mxn += costoMXN / 12
    else if (l.tipo_costo === 'mensual') stats.costo_mensual_mxn += costoMXN
  })

  res.json(stats)
})

// ─── LISTAR ───────────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const { page = 1, limit = 20, search, tipo, estado } = req.query
  const hoy = new Date()
  const en30dias = new Date(hoy.getTime() + 30 * 24 * 60 * 60 * 1000)

  let items = db.get('licencias').filter({ activo: true }).value().map(l => {
    const venc = l.fecha_vencimiento ? new Date(l.fecha_vencimiento) : null
    let estado_calc = 'activa'
    if (venc && venc < hoy) estado_calc = 'vencida'
    else if (venc && venc <= en30dias) estado_calc = 'por_vencer'
    const asignaciones = db.get('asignaciones_licencias').filter({ licencia_id: l.id, activo: true }).value()
    return { ...l, estado_calc, asientos_usados: asignaciones.length }
  })

  if (tipo) items = items.filter(l => l.tipo === tipo)
  if (estado) items = items.filter(l => l.estado_calc === estado)
  if (search) {
    const q = search.toLowerCase()
    items = items.filter(l =>
      l.nombre?.toLowerCase().includes(q) ||
      l.proveedor_nombre?.toLowerCase().includes(q) ||
      l.tipo?.toLowerCase().includes(q) ||
      l.clave_licencia?.toLowerCase().includes(q)
    )
  }

  const total = items.length
  const offset = (parseInt(page) - 1) * parseInt(limit)
  res.json({ data: items.slice(offset, offset + parseInt(limit)), total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) })
})

// ─── OBTENER POR ID ───────────────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  const item = db.get('licencias').find({ id: req.params.id, activo: true }).value()
  if (!item) return res.status(404).json({ message: 'Licencia no encontrada' })

  const asignaciones = db.get('asignaciones_licencias').filter({ licencia_id: item.id, activo: true }).value()
    .map(a => {
      const emp = db.get('empleados').find({ id: a.empleado_id }).value()
      return { ...a, empleado: emp }
    })

  res.json({ ...item, asignaciones, asientos_usados: asignaciones.length })
})

// ─── CREAR ────────────────────────────────────────────────────────────────────
router.post('/', requireRoles('super_admin', 'agente_soporte'), auditLog('crear', 'licencia'), (req, res) => {
  const { nombre, tipo, proveedor_id, clave_licencia, version, descripcion,
          costo, moneda, tipo_costo, fecha_inicio, fecha_vencimiento,
          total_asientos, tipo_cambio } = req.body

  if (!nombre || !tipo) return res.status(400).json({ message: 'Nombre y tipo son requeridos' })

  const proveedor = proveedor_id ? db.get('proveedores').find({ id: proveedor_id }).value() : null
  const now = new Date().toISOString()
  const item = {
    id: uuidv4(), nombre, tipo,
    proveedor_id: proveedor_id || null,
    proveedor_nombre: proveedor?.nombre || null,
    clave_licencia: clave_licencia || '',
    version: version || '',
    descripcion: descripcion || '',
    costo: parseFloat(costo) || 0,
    moneda: moneda || 'MXN',
    tipo_costo: tipo_costo || 'mensual',
    tipo_cambio: parseFloat(tipo_cambio) || 17.15,
    fecha_inicio: fecha_inicio || now.split('T')[0],
    fecha_vencimiento: fecha_vencimiento || null,
    total_asientos: parseInt(total_asientos) || 1,
    activo: true,
    creado_por: req.user.id, creado_por_nombre: req.user.nombre,
    created_at: now, updated_at: now
  }
  db.get('licencias').push(item).write()
  res.status(201).json({ ...item, asientos_usados: 0 })
})

// ─── ACTUALIZAR ───────────────────────────────────────────────────────────────
router.put('/:id', requireRoles('super_admin', 'agente_soporte'), auditLog('actualizar', 'licencia'), (req, res) => {
  const item = db.get('licencias').find({ id: req.params.id, activo: true }).value()
  if (!item) return res.status(404).json({ message: 'Licencia no encontrada' })

  const proveedor = req.body.proveedor_id ? db.get('proveedores').find({ id: req.body.proveedor_id }).value() : null
  const updated = {
    ...item, ...req.body,
    costo: parseFloat(req.body.costo ?? item.costo),
    total_asientos: parseInt(req.body.total_asientos ?? item.total_asientos),
    proveedor_nombre: proveedor?.nombre || item.proveedor_nombre,
    updated_at: new Date().toISOString()
  }
  db.get('licencias').find({ id: req.params.id }).assign(updated).write()
  res.json(updated)
})

// ─── ELIMINAR (soft) ──────────────────────────────────────────────────────────
router.delete('/:id', requireRoles('super_admin'), auditLog('eliminar', 'licencia'), (req, res) => {
  const item = db.get('licencias').find({ id: req.params.id, activo: true }).value()
  if (!item) return res.status(404).json({ message: 'Licencia no encontrada' })
  const asignadas = db.get('asignaciones_licencias').filter({ licencia_id: req.params.id, activo: true }).size().value()
  if (asignadas > 0) return res.status(409).json({ message: `La licencia tiene ${asignadas} asignación(es) activa(s). Libéralas primero.` })
  db.get('licencias').find({ id: req.params.id }).assign({ activo: false, updated_at: new Date().toISOString() }).write()
  res.json({ message: 'Licencia eliminada' })
})

// ─── ASIGNACIONES ─────────────────────────────────────────────────────────────
router.get('/:id/asignaciones', (req, res) => {
  const asignaciones = db.get('asignaciones_licencias').filter({ licencia_id: req.params.id }).value()
    .map(a => {
      const emp = db.get('empleados').find({ id: a.empleado_id }).value()
      return { ...a, empleado: emp }
    })
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  res.json(asignaciones)
})

router.post('/:id/asignar', requireRoles('super_admin', 'agente_soporte'), auditLog('asignar', 'licencia'), (req, res) => {
  const licencia = db.get('licencias').find({ id: req.params.id, activo: true }).value()
  if (!licencia) return res.status(404).json({ message: 'Licencia no encontrada' })

  const { empleado_id } = req.body
  if (!empleado_id) return res.status(400).json({ message: 'Empleado requerido' })

  const empleado = db.get('empleados').find({ id: empleado_id, activo: true }).value()
  if (!empleado) return res.status(404).json({ message: 'Empleado no encontrado' })

  // Verificar que el empleado no tenga ya esta licencia activa
  const yaAsignada = db.get('asignaciones_licencias').find({ licencia_id: req.params.id, empleado_id, activo: true }).value()
  if (yaAsignada) return res.status(409).json({ message: 'Este empleado ya tiene esta licencia asignada' })

  // Verificar asientos disponibles
  const usados = db.get('asignaciones_licencias').filter({ licencia_id: req.params.id, activo: true }).size().value()
  if (usados >= licencia.total_asientos) return res.status(409).json({ message: `Sin asientos disponibles (${licencia.total_asientos}/${licencia.total_asientos} usados)` })

  const now = new Date().toISOString()
  const asignacion = {
    id: uuidv4(), licencia_id: req.params.id,
    licencia_nombre: licencia.nombre,
    empleado_id, empleado_nombre: empleado.nombre_completo,
    asignado_por_id: req.user.id, asignado_por_nombre: req.user.nombre,
    fecha_asignacion: now, fecha_liberacion: null,
    activo: true, created_at: now
  }
  db.get('asignaciones_licencias').push(asignacion).write()
  res.status(201).json(asignacion)
})

router.delete('/asignaciones/:asignacionId', requireRoles('super_admin', 'agente_soporte'), auditLog('liberar', 'licencia'), (req, res) => {
  const asignacion = db.get('asignaciones_licencias').find({ id: req.params.asignacionId, activo: true }).value()
  if (!asignacion) return res.status(404).json({ message: 'Asignación no encontrada' })
  db.get('asignaciones_licencias').find({ id: req.params.asignacionId }).assign({
    activo: false, fecha_liberacion: new Date().toISOString()
  }).write()
  res.json({ message: 'Licencia liberada' })
})

module.exports = router
