const router = require('express').Router()
const { v4: uuidv4 } = require('uuid')
const db = require('../data/db')
const { authMiddleware, requireRoles } = require('../middleware/auth.middleware')
const { auditLog } = require('../middleware/audit.middleware')

router.use(authMiddleware)

const ESTADOS_VALIDOS = new Set(['activo', 'en_transferencia', 'suspendido', 'cancelado'])
const PERIODICIDADES_VALIDAS = new Set(['mensual', 'anual', 'bianual', 'unico'])

function normalizeDomain(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
}

function getExpiryState(fechaVencimiento) {
  if (!fechaVencimiento) return { estado_vencimiento: 'sin_fecha', dias_restantes: null }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expiry = new Date(fechaVencimiento)
  expiry.setHours(0, 0, 0, 0)
  const dias = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24))

  if (dias < 0) return { estado_vencimiento: 'vencido', dias_restantes: dias }
  if (dias <= 30) return { estado_vencimiento: 'por_vencer_30', dias_restantes: dias }
  if (dias <= 90) return { estado_vencimiento: 'por_vencer_90', dias_restantes: dias }
  return { estado_vencimiento: 'vigente', dias_restantes: dias }
}

function costoAnualMXN(item) {
  const costo = parseFloat(item.costo_renovacion) || 0
  const tc = parseFloat(item.tipo_cambio) || 1
  const mxn = item.moneda === 'USD' ? costo * tc : costo
  if (item.periodicidad === 'mensual') return mxn * 12
  if (item.periodicidad === 'bianual') return mxn / 2
  if (item.periodicidad === 'unico') return 0
  return mxn
}

function enrich(item) {
  return {
    ...item,
    ...getExpiryState(item.fecha_vencimiento),
    costo_anual_mxn: parseFloat(costoAnualMXN(item).toFixed(2)),
  }
}

function buildPayload(body, existing = {}, user = null) {
  const proveedorId = body.proveedor_id === undefined
    ? (existing.proveedor_id || null)
    : (body.proveedor_id || null)
  const proveedor = proveedorId
    ? db.get('proveedores').find({ id: proveedorId }).value()
    : null
  const now = new Date().toISOString()
  const dominio = normalizeDomain(body.dominio ?? existing.dominio)
  const estado = ESTADOS_VALIDOS.has(body.estado) ? body.estado : (existing.estado || 'activo')
  const periodicidad = PERIODICIDADES_VALIDAS.has(body.periodicidad) ? body.periodicidad : (existing.periodicidad || 'anual')

  return {
    ...existing,
    dominio,
    registrador: String(body.registrador ?? existing.registrador ?? '').trim(),
    proveedor_id: proveedorId,
    proveedor_nombre: proveedor?.nombre || null,
    estado,
    fecha_registro: body.fecha_registro || existing.fecha_registro || null,
    fecha_vencimiento: body.fecha_vencimiento || existing.fecha_vencimiento || null,
    renovacion_auto: Boolean(body.renovacion_auto ?? existing.renovacion_auto ?? false),
    costo_renovacion: parseFloat(body.costo_renovacion ?? existing.costo_renovacion ?? 0) || 0,
    moneda: body.moneda || existing.moneda || 'MXN',
    periodicidad,
    tipo_cambio: parseFloat(body.tipo_cambio ?? existing.tipo_cambio ?? 17.15) || 17.15,
    cuenta_admin: String(body.cuenta_admin ?? existing.cuenta_admin ?? '').trim(),
    responsable: String(body.responsable ?? existing.responsable ?? '').trim(),
    departamento: String(body.departamento ?? existing.departamento ?? '').trim(),
    uso: String(body.uso ?? existing.uso ?? '').trim(),
    dns_principal: String(body.dns_principal ?? existing.dns_principal ?? '').trim(),
    nameservers: String(body.nameservers ?? existing.nameservers ?? '').trim(),
    notas: String(body.notas ?? existing.notas ?? '').trim(),
    activo: existing.activo ?? true,
    creado_por: existing.creado_por || user?.id || null,
    creado_por_nombre: existing.creado_por_nombre || user?.nombre || null,
    created_at: existing.created_at || now,
    updated_at: now,
  }
}

// ─── ESTADÍSTICAS ────────────────────────────────────────────────────────────
router.get('/stats', (req, res) => {
  const dominios = db.get('dominios').filter({ activo: true }).value().map(enrich)
  const stats = {
    total: dominios.length,
    vigentes: 0,
    por_vencer_30: 0,
    por_vencer_90: 0,
    vencidos: 0,
    renovacion_auto: 0,
    costo_anual_mxn: 0,
  }

  dominios.forEach(item => {
    if (item.estado_vencimiento === 'vencido') stats.vencidos += 1
    else if (item.estado_vencimiento === 'por_vencer_30') stats.por_vencer_30 += 1
    else if (item.estado_vencimiento === 'por_vencer_90') stats.por_vencer_90 += 1
    else stats.vigentes += 1
    if (item.renovacion_auto) stats.renovacion_auto += 1
    stats.costo_anual_mxn += item.costo_anual_mxn
  })

  stats.costo_anual_mxn = parseFloat(stats.costo_anual_mxn.toFixed(2))
  res.json(stats)
})

// ─── LISTAR ─────────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const { page = 1, limit = 20, search, estado, vencimiento, proveedor_id } = req.query
  let items = db.get('dominios').filter({ activo: true }).value().map(enrich)

  if (estado) items = items.filter(item => item.estado === estado)
  if (vencimiento) items = items.filter(item => item.estado_vencimiento === vencimiento)
  if (proveedor_id) items = items.filter(item => item.proveedor_id === proveedor_id)
  if (search) {
    const q = search.toLowerCase()
    items = items.filter(item =>
      item.dominio?.toLowerCase().includes(q) ||
      item.registrador?.toLowerCase().includes(q) ||
      item.proveedor_nombre?.toLowerCase().includes(q) ||
      item.responsable?.toLowerCase().includes(q) ||
      item.cuenta_admin?.toLowerCase().includes(q)
    )
  }

  items = items.sort((a, b) => {
    if (!a.fecha_vencimiento && !b.fecha_vencimiento) return a.dominio.localeCompare(b.dominio)
    if (!a.fecha_vencimiento) return 1
    if (!b.fecha_vencimiento) return -1
    return new Date(a.fecha_vencimiento) - new Date(b.fecha_vencimiento)
  })

  const total = items.length
  const pageNum = parseInt(page) || 1
  const limitNum = parseInt(limit) || 20
  const offset = (pageNum - 1) * limitNum
  res.json({
    data: items.slice(offset, offset + limitNum),
    total,
    page: pageNum,
    limit: limitNum,
    pages: Math.ceil(total / limitNum),
  })
})

// ─── OBTENER ─────────────────────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  const item = db.get('dominios').find({ id: req.params.id, activo: true }).value()
  if (!item) return res.status(404).json({ message: 'Dominio no encontrado' })
  res.json(enrich(item))
})

// ─── CREAR ──────────────────────────────────────────────────────────────────
router.post('/', requireRoles('super_admin', 'agente_soporte'), auditLog('crear', 'dominio'), (req, res) => {
  const dominio = normalizeDomain(req.body.dominio)
  if (!dominio) return res.status(400).json({ message: 'El dominio es requerido' })

  const exists = db.get('dominios').find({ dominio, activo: true }).value()
  if (exists) return res.status(409).json({ message: 'Ya existe un dominio activo con ese nombre' })

  const item = buildPayload({ ...req.body, dominio }, { id: uuidv4() }, req.user)
  db.get('dominios').push(item).write()
  res.status(201).json(enrich(item))
})

// ─── ACTUALIZAR ─────────────────────────────────────────────────────────────
router.put('/:id', requireRoles('super_admin', 'agente_soporte'), auditLog('actualizar', 'dominio'), (req, res) => {
  const current = db.get('dominios').find({ id: req.params.id, activo: true }).value()
  if (!current) return res.status(404).json({ message: 'Dominio no encontrado' })

  const dominio = normalizeDomain(req.body.dominio ?? current.dominio)
  if (!dominio) return res.status(400).json({ message: 'El dominio es requerido' })

  const exists = db.get('dominios').find(item => item.id !== current.id && item.activo && item.dominio === dominio).value()
  if (exists) return res.status(409).json({ message: 'Ya existe un dominio activo con ese nombre' })

  const updated = buildPayload({ ...req.body, dominio }, current, req.user)
  db.get('dominios').find({ id: req.params.id }).assign(updated).write()
  res.json(enrich(updated))
})

// ─── ELIMINAR (soft) ────────────────────────────────────────────────────────
router.delete('/:id', requireRoles('super_admin'), auditLog('eliminar', 'dominio'), (req, res) => {
  const item = db.get('dominios').find({ id: req.params.id, activo: true }).value()
  if (!item) return res.status(404).json({ message: 'Dominio no encontrado' })
  db.get('dominios').find({ id: req.params.id }).assign({
    activo: false,
    updated_at: new Date().toISOString(),
  }).write()
  res.json({ message: 'Dominio eliminado' })
})

module.exports = router
