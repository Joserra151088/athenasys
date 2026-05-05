const router = require('express').Router()
const { v4: uuidv4 } = require('uuid')
const db = require('../data/db')
const { authMiddleware, requireRoles } = require('../middleware/auth.middleware')
const { auditLog } = require('../middleware/audit.middleware')

router.use(authMiddleware)

const DEFAULT_LAYERS = [
  { clave: 'infraestructura', nombre: 'Infraestructura', color: '#64748b', icono: 'layout', orden: 10, editable: true },
  { clave: 'mobiliario', nombre: 'Mobiliario', color: '#c0841a', icono: 'desk', orden: 20, editable: true },
  { clave: 'nodos_red', nombre: 'Nodos de red', color: '#2563eb', icono: 'network', orden: 30, editable: true },
  { clave: 'camaras', nombre: 'Camaras', color: '#ef4444', icono: 'camera', orden: 40, editable: true },
  { clave: 'access_points', nombre: 'Access points', color: '#0d9488', icono: 'wifi', orden: 50, editable: true },
  { clave: 'pantallas', nombre: 'Pantallas', color: '#7c3aed', icono: 'screen', orden: 60, editable: true },
  { clave: 'biometricos', nombre: 'Biometricos', color: '#14b8a6', icono: 'bio', orden: 70, editable: true },
  { clave: 'usuarios', nombre: 'Usuarios', color: '#f97316', icono: 'user', orden: 80, editable: true },
]

const TYPE_TO_LAYER = {
  pared: 'infraestructura',
  puerta: 'infraestructura',
  mesa: 'mobiliario',
  silla: 'mobiliario',
  sillon: 'mobiliario',
  planta: 'mobiliario',
  nodo_red: 'nodos_red',
  camara: 'camaras',
  access_point: 'access_points',
  pantalla: 'pantallas',
  biometrico: 'biometricos',
  usuario: 'usuarios',
}

function toBool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback
  return value === true || value === 1 || value === '1' || value === 'true'
}

function toInt(value, fallback, min = null, max = null) {
  const parsed = parseInt(value, 10)
  if (!Number.isFinite(parsed)) return fallback
  const minApplied = min !== null ? Math.max(min, parsed) : parsed
  return max !== null ? Math.min(max, minApplied) : minApplied
}

function toFloat(value, fallback, min = null, max = null) {
  const parsed = parseFloat(value)
  if (!Number.isFinite(parsed)) return fallback
  const minApplied = min !== null ? Math.max(min, parsed) : parsed
  return max !== null ? Math.min(max, minApplied) : minApplied
}

function cleanText(value, fallback = '') {
  return String(value ?? fallback).trim()
}

function buildPlanPayload(item) {
  const config = item.config && typeof item.config === 'object' ? item.config : {}
  return {
    ...item,
    ancho: toInt(item.ancho, 1600, 600, 5000),
    alto: toInt(item.alto, 900, 400, 4000),
    grid_size: toInt(item.grid_size, 24, 8, 120),
    config,
  }
}

function getPlanLayers(planoId) {
  return db.get('plano_oficina_capas')
    .filter({ plano_id: planoId })
    .sort((a, b) => (a.orden || 0) - (b.orden || 0))
    .value()
}

function getPlanObjects(planoId) {
  return db.get('plano_oficina_objetos')
    .filter({ plano_id: planoId })
    .sort((a, b) => (a.z_index || 0) - (b.z_index || 0))
    .value()
}

function buildFullPlan(plan) {
  const normalized = buildPlanPayload(plan)
  return {
    ...normalized,
    layers: getPlanLayers(plan.id),
    objetos: getPlanObjects(plan.id),
  }
}

function normalizeLayer(layer, index, planId) {
  return {
    id: layer.id || uuidv4(),
    plano_id: planId,
    clave: cleanText(layer.clave || `capa_${index + 1}`).toLowerCase().replace(/\s+/g, '_'),
    nombre: cleanText(layer.nombre || `Capa ${index + 1}`),
    color: cleanText(layer.color || '#94a3b8'),
    icono: cleanText(layer.icono || 'layer'),
    visible: toBool(layer.visible, true),
    bloqueada: toBool(layer.bloqueada, false),
    editable: toBool(layer.editable, true),
    orden: toInt(layer.orden, index * 10),
    created_at: layer.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

function normalizeObject(item, index, planId, layerMap) {
  const fallbackLayerKey = TYPE_TO_LAYER[item.tipo] || DEFAULT_LAYERS[0].clave
  const resolvedLayer = layerMap.get(item.capa_id) || Array.from(layerMap.values()).find(layer => layer.clave === (item.capa_clave || fallbackLayerKey))
  const metadata = item.metadata && typeof item.metadata === 'object' ? item.metadata : {}

  return {
    id: item.id || uuidv4(),
    plano_id: planId,
    capa_id: resolvedLayer?.id || null,
    capa_clave: resolvedLayer?.clave || cleanText(item.capa_clave || fallbackLayerKey),
    tipo: cleanText(item.tipo || 'mesa'),
    nombre: cleanText(item.nombre || ''),
    x: toFloat(item.x, 24, 0, 10000),
    y: toFloat(item.y, 24, 0, 10000),
    ancho: toFloat(item.ancho, 120, 16, 4000),
    alto: toFloat(item.alto, 80, 16, 4000),
    rotacion: toFloat(item.rotacion, 0, -360, 360),
    color: cleanText(item.color || ''),
    z_index: toInt(item.z_index, index, 0, 99999),
    vinculo_tipo: cleanText(item.vinculo_tipo || ''),
    vinculo_id: cleanText(item.vinculo_id || ''),
    vinculo_nombre: cleanText(item.vinculo_nombre || ''),
    metadata,
    created_at: item.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

function ensureDefaultLayers(planId) {
  const existing = getPlanLayers(planId)
  if (existing.length) return existing

  const now = new Date().toISOString()
  const layers = DEFAULT_LAYERS.map(layer => ({
    id: uuidv4(),
    plano_id: planId,
    clave: layer.clave,
    nombre: layer.nombre,
    color: layer.color,
    icono: layer.icono,
    visible: true,
    bloqueada: false,
    editable: layer.editable,
    orden: layer.orden,
    created_at: now,
    updated_at: now,
  }))
  db.get('plano_oficina_capas').push(...layers).write()
  return layers
}

router.get('/', (req, res) => {
  const { search = '', sucursal_id = '' } = req.query
  const q = cleanText(search).toLowerCase()

  let planes = db.get('planos_oficina').filter({ activo: true }).value()

  if (sucursal_id) planes = planes.filter(item => item.sucursal_id === sucursal_id)
  if (q) {
    planes = planes.filter(item =>
      cleanText(item.nombre).toLowerCase().includes(q) ||
      cleanText(item.sucursal_nombre).toLowerCase().includes(q) ||
      cleanText(item.piso).toLowerCase().includes(q)
    )
  }

  const data = planes
    .map(item => {
      const layers = ensureDefaultLayers(item.id)
      const objetos = getPlanObjects(item.id)
      return {
        ...buildPlanPayload(item),
        total_capas: layers.length,
        total_objetos: objetos.length,
      }
    })
    .sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0))

  res.json({ data })
})

router.get('/:id', (req, res) => {
  const item = db.get('planos_oficina').find({ id: req.params.id, activo: true }).value()
  if (!item) return res.status(404).json({ message: 'Plano no encontrado' })
  ensureDefaultLayers(item.id)
  res.json(buildFullPlan(item))
})

router.post('/', requireRoles('super_admin', 'agente_soporte'), auditLog('crear', 'plano_oficina'), (req, res) => {
  const nombre = cleanText(req.body.nombre)
  if (!nombre) return res.status(400).json({ message: 'El nombre del plano es requerido' })

  const now = new Date().toISOString()
  const item = {
    id: uuidv4(),
    nombre,
    sucursal_id: cleanText(req.body.sucursal_id || ''),
    sucursal_nombre: cleanText(req.body.sucursal_nombre || ''),
    piso: cleanText(req.body.piso || ''),
    descripcion: cleanText(req.body.descripcion || ''),
    ancho: toInt(req.body.ancho, 1600, 600, 5000),
    alto: toInt(req.body.alto, 900, 400, 4000),
    grid_size: toInt(req.body.grid_size, 24, 8, 120),
    config: req.body.config && typeof req.body.config === 'object' ? req.body.config : {},
    activo: true,
    creado_por: req.user.id,
    creado_por_nombre: req.user.nombre,
    actualizado_por: req.user.id,
    actualizado_por_nombre: req.user.nombre,
    created_at: now,
    updated_at: now,
  }

  const layers = (Array.isArray(req.body.layers) && req.body.layers.length ? req.body.layers : DEFAULT_LAYERS)
    .map((layer, index) => normalizeLayer(layer, index, item.id))

  db.get('planos_oficina').push(item).write()
  db.get('plano_oficina_capas').push(...layers).write()

  res.status(201).json({ ...buildPlanPayload(item), layers, objetos: [] })
})

router.put('/:id', requireRoles('super_admin', 'agente_soporte'), auditLog('editar', 'plano_oficina'), (req, res) => {
  const item = db.get('planos_oficina').find({ id: req.params.id, activo: true }).value()
  if (!item) return res.status(404).json({ message: 'Plano no encontrado' })

  const updates = {
    nombre: cleanText(req.body.nombre || item.nombre),
    sucursal_id: cleanText(req.body.sucursal_id ?? item.sucursal_id ?? ''),
    sucursal_nombre: cleanText(req.body.sucursal_nombre ?? item.sucursal_nombre ?? ''),
    piso: cleanText(req.body.piso ?? item.piso ?? ''),
    descripcion: cleanText(req.body.descripcion ?? item.descripcion ?? ''),
    ancho: toInt(req.body.ancho, item.ancho || 1600, 600, 5000),
    alto: toInt(req.body.alto, item.alto || 900, 400, 4000),
    grid_size: toInt(req.body.grid_size, item.grid_size || 24, 8, 120),
    config: req.body.config && typeof req.body.config === 'object' ? req.body.config : (item.config || {}),
    actualizado_por: req.user.id,
    actualizado_por_nombre: req.user.nombre,
    updated_at: new Date().toISOString(),
  }

  db.get('planos_oficina').find({ id: item.id }).assign(updates).write()
  res.json(buildFullPlan({ ...item, ...updates }))
})

router.put('/:id/layout', requireRoles('super_admin', 'agente_soporte'), auditLog('editar', 'plano_oficina_layout'), (req, res) => {
  const item = db.get('planos_oficina').find({ id: req.params.id, activo: true }).value()
  if (!item) return res.status(404).json({ message: 'Plano no encontrado' })

  const layerInput = Array.isArray(req.body.layers) && req.body.layers.length ? req.body.layers : ensureDefaultLayers(item.id)
  const normalizedLayers = layerInput.map((layer, index) => normalizeLayer(layer, index, item.id))
  const layerMap = new Map(normalizedLayers.map(layer => [layer.id, layer]))

  const objectInput = Array.isArray(req.body.objetos) ? req.body.objetos : []
  const normalizedObjects = objectInput.map((object, index) => normalizeObject(object, index, item.id, layerMap))

  const planUpdates = {
    ancho: toInt(req.body.ancho, item.ancho || 1600, 600, 5000),
    alto: toInt(req.body.alto, item.alto || 900, 400, 4000),
    grid_size: toInt(req.body.grid_size, item.grid_size || 24, 8, 120),
    config: req.body.config && typeof req.body.config === 'object' ? req.body.config : (item.config || {}),
    actualizado_por: req.user.id,
    actualizado_por_nombre: req.user.nombre,
    updated_at: new Date().toISOString(),
  }

  db.get('planos_oficina').find({ id: item.id }).assign(planUpdates).write()
  db.get('plano_oficina_capas').remove({ plano_id: item.id }).write()
  if (normalizedLayers.length) db.get('plano_oficina_capas').push(...normalizedLayers).write()
  db.get('plano_oficina_objetos').remove({ plano_id: item.id }).write()
  if (normalizedObjects.length) db.get('plano_oficina_objetos').push(...normalizedObjects).write()

  res.json({
    ...buildPlanPayload({ ...item, ...planUpdates }),
    layers: normalizedLayers,
    objetos: normalizedObjects,
  })
})

router.delete('/:id', requireRoles('super_admin', 'agente_soporte'), auditLog('eliminar', 'plano_oficina'), (req, res) => {
  const item = db.get('planos_oficina').find({ id: req.params.id, activo: true }).value()
  if (!item) return res.status(404).json({ message: 'Plano no encontrado' })

  const updates = {
    activo: false,
    actualizado_por: req.user.id,
    actualizado_por_nombre: req.user.nombre,
    updated_at: new Date().toISOString(),
  }
  db.get('planos_oficina').find({ id: item.id }).assign(updates).write()
  res.json({ ok: true })
})

module.exports = router
