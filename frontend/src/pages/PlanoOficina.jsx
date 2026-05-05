import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowPathIcon,
  BuildingOffice2Icon,
  ComputerDesktopIcon,
  DocumentDuplicateIcon,
  EyeIcon,
  EyeSlashIcon,
  PlusIcon,
  Squares2X2Icon,
  TrashIcon,
  UserIcon,
  VideoCameraIcon,
  WifiIcon,
} from '@heroicons/react/24/outline'
import ConfirmDialog from '../components/ConfirmDialog'
import Modal from '../components/Modal'
import PageHeader from '../components/PageHeader'
import { useAuth } from '../context/AuthContext'
import { useNotification } from '../context/NotificationContext'
import { deviceAPI, empleadoAPI, planoOficinaAPI, sucursalAPI } from '../utils/api'

const DEFAULT_CREATE_FORM = {
  nombre: '',
  sucursal_id: '',
  sucursal_nombre: '',
  piso: 'Piso 1',
  descripcion: '',
  ancho: 1600,
  alto: 900,
  grid_size: 24,
}

const LAYER_PRESETS = [
  { clave: 'infraestructura', nombre: 'Infraestructura', color: '#64748b', icono: 'layout' },
  { clave: 'mobiliario', nombre: 'Mobiliario', color: '#c0841a', icono: 'desk' },
  { clave: 'nodos_red', nombre: 'Nodos de red', color: '#2563eb', icono: 'network' },
  { clave: 'camaras', nombre: 'Camaras', color: '#ef4444', icono: 'camera' },
  { clave: 'access_points', nombre: 'Access points', color: '#0d9488', icono: 'wifi' },
  { clave: 'pantallas', nombre: 'Pantallas', color: '#7c3aed', icono: 'screen' },
  { clave: 'biometricos', nombre: 'Biometricos', color: '#14b8a6', icono: 'bio' },
  { clave: 'usuarios', nombre: 'Usuarios', color: '#f97316', icono: 'user' },
]

const OBJECT_LIBRARY = [
  { type: 'mesa', label: 'Mesa', layerKey: 'mobiliario', width: 180, height: 96, color: '#cfb584', short: 'ME' },
  { type: 'silla', label: 'Silla', layerKey: 'mobiliario', width: 52, height: 52, color: '#cbd5e1', short: 'SI' },
  { type: 'sillon', label: 'Sillon', layerKey: 'mobiliario', width: 110, height: 70, color: '#d8b4fe', short: 'SO' },
  { type: 'planta', label: 'Planta', layerKey: 'mobiliario', width: 64, height: 64, color: '#4ade80', short: 'PL' },
  { type: 'pared', label: 'Pared', layerKey: 'infraestructura', width: 260, height: 18, color: '#475569', short: 'PA' },
  { type: 'puerta', label: 'Puerta', layerKey: 'infraestructura', width: 100, height: 18, color: '#22c55e', short: 'PU' },
  { type: 'nodo_red', label: 'Nodo de red', layerKey: 'nodos_red', width: 120, height: 62, color: '#2563eb', short: 'NR' },
  { type: 'camara', label: 'Camara', layerKey: 'camaras', width: 104, height: 58, color: '#ef4444', short: 'CA' },
  { type: 'access_point', label: 'Access point', layerKey: 'access_points', width: 118, height: 58, color: '#0d9488', short: 'AP' },
  { type: 'pantalla', label: 'Pantalla', layerKey: 'pantallas', width: 132, height: 76, color: '#7c3aed', short: 'TV' },
  { type: 'biometrico', label: 'Biometrico', layerKey: 'biometricos', width: 92, height: 58, color: '#14b8a6', short: 'BI' },
  { type: 'usuario', label: 'Usuario', layerKey: 'usuarios', width: 142, height: 78, color: '#fb923c', short: 'US' },
]

const DEVICE_LINKABLE_TYPES = new Set(['nodo_red', 'camara', 'access_point', 'pantalla', 'biometrico'])

function uid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function toNumber(value, fallback = 0, min = null, max = null) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  const minApplied = min !== null ? Math.max(min, parsed) : parsed
  return max !== null ? Math.min(max, minApplied) : minApplied
}

function getPreset(type) {
  return OBJECT_LIBRARY.find(item => item.type === type) || OBJECT_LIBRARY[0]
}

function makeDefaultLayer(layer, index) {
  return {
    id: uid(),
    clave: layer.clave,
    nombre: layer.nombre,
    color: layer.color,
    icono: layer.icono,
    visible: true,
    bloqueada: false,
    editable: true,
    orden: index * 10,
  }
}

function objectDisplayName(item) {
  return item.nombre?.trim() || item.vinculo_nombre?.trim() || getPreset(item.tipo).label
}

function objectBadge(item) {
  if (item.tipo === 'usuario' && item.vinculo_nombre) {
    return item.vinculo_nombre
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0]?.toUpperCase())
      .join('')
  }
  return getPreset(item.tipo).short
}

function cloneMeta(value) {
  return JSON.parse(JSON.stringify(value || {}))
}

function renderMiniIcon(icon) {
  if (icon === 'camera') return <VideoCameraIcon className="h-3.5 w-3.5" />
  if (icon === 'wifi') return <WifiIcon className="h-3.5 w-3.5" />
  if (icon === 'user') return <UserIcon className="h-3.5 w-3.5" />
  if (icon === 'screen') return <ComputerDesktopIcon className="h-3.5 w-3.5" />
  if (icon === 'layout') return <Squares2X2Icon className="h-3.5 w-3.5" />
  return <BuildingOffice2Icon className="h-3.5 w-3.5" />
}

function LayerChip({ layer, count }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/85 px-3 py-2 shadow-[0_10px_28px_rgba(148,163,184,0.12)]">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-xl text-white" style={{ backgroundColor: layer.color }}>
          {renderMiniIcon(layer.icono)}
        </span>
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{layer.nombre}</div>
          <div className="text-sm font-semibold text-slate-800">{count} objeto(s)</div>
        </div>
      </div>
    </div>
  )
}

export default function PlanoOficina() {
  const { canEdit } = useAuth()
  const { showError, showSuccess, showInfo } = useNotification()
  const editable = canEdit()

  const [plans, setPlans] = useState([])
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [plan, setPlan] = useState(null)
  const [layers, setLayers] = useState([])
  const [objects, setObjects] = useState([])
  const [sucursales, setSucursales] = useState([])
  const [empleados, setEmpleados] = useState([])
  const [dispositivos, setDispositivos] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [createForm, setCreateForm] = useState(DEFAULT_CREATE_FORM)
  const [selectedObjectId, setSelectedObjectId] = useState('')
  const [dirty, setDirty] = useState(false)

  const canvasWrapRef = useRef(null)
  const interactionRef = useRef(null)

  const layerById = useMemo(() => new Map(layers.map(layer => [layer.id, layer])), [layers])
  const selectedObject = useMemo(() => objects.find(item => item.id === selectedObjectId) || null, [objects, selectedObjectId])

  const visibleObjects = useMemo(() => {
    const visibleLayerIds = new Set(layers.filter(layer => layer.visible).map(layer => layer.id))
    return objects
      .filter(item => visibleLayerIds.has(item.capa_id))
      .sort((a, b) => {
        const layerA = layerById.get(a.capa_id)
        const layerB = layerById.get(b.capa_id)
        const orderDiff = (layerA?.orden || 0) - (layerB?.orden || 0)
        return orderDiff !== 0 ? orderDiff : (a.z_index || 0) - (b.z_index || 0)
      })
  }, [objects, layers, layerById])

  const layerStats = useMemo(() => {
    const counts = new Map()
    objects.forEach(item => counts.set(item.capa_id, (counts.get(item.capa_id) || 0) + 1))
    return counts
  }, [objects])

  const loadPlans = useCallback(async (preferredId = '') => {
    const response = await planoOficinaAPI.getAll()
    const rows = response.data || []
    setPlans(rows)
    if (!rows.length) {
      setSelectedPlanId('')
      setPlan(null)
      setLayers([])
      setObjects([])
      return
    }

    const targetId = preferredId && rows.some(item => item.id === preferredId)
      ? preferredId
      : (selectedPlanId && rows.some(item => item.id === selectedPlanId) ? selectedPlanId : rows[0].id)
    setSelectedPlanId(targetId)
  }, [selectedPlanId])

  const loadBootstrap = useCallback(async () => {
    setLoading(true)
    try {
      const [planRows, sucRows, empRows, devRows] = await Promise.all([
        planoOficinaAPI.getAll(),
        sucursalAPI.getAll({ limit: 400 }),
        empleadoAPI.getAll({ limit: 1200 }),
        deviceAPI.getAll({ limit: 1200 }),
      ])
      const rows = planRows.data || []
      setPlans(rows)
      setSucursales(sucRows.data || sucRows || [])
      setEmpleados(empRows.data || empRows || [])
      setDispositivos(devRows.data || devRows || [])
      if (rows.length) setSelectedPlanId(rows[0].id)
    } catch (err) {
      showError(err?.message || 'No se pudo cargar el modulo de plano de oficina')
    } finally {
      setLoading(false)
    }
  }, [showError])

  const loadPlan = useCallback(async (planId) => {
    if (!planId) return
    try {
      const response = await planoOficinaAPI.getById(planId)
      setPlan({
        id: response.id,
        nombre: response.nombre,
        sucursal_id: response.sucursal_id || '',
        sucursal_nombre: response.sucursal_nombre || '',
        piso: response.piso || '',
        descripcion: response.descripcion || '',
        ancho: response.ancho || 1600,
        alto: response.alto || 900,
        grid_size: response.grid_size || 24,
        config: response.config || {},
      })
      setLayers((response.layers || []).length ? response.layers : LAYER_PRESETS.map(makeDefaultLayer))
      setObjects(response.objetos || [])
      setSelectedObjectId('')
      setDirty(false)
    } catch (err) {
      showError(err?.message || 'No se pudo cargar el plano seleccionado')
    }
  }, [showError])

  useEffect(() => {
    loadBootstrap()
  }, [loadBootstrap])

  useEffect(() => {
    if (selectedPlanId) loadPlan(selectedPlanId)
  }, [selectedPlanId, loadPlan])

  useEffect(() => {
    function onMove(event) {
      const interaction = interactionRef.current
      if (!interaction || !plan) return

      const currentObject = objects.find(item => item.id === interaction.id)
      if (!currentObject) return

      const dx = event.clientX - interaction.startX
      const dy = event.clientY - interaction.startY

      setObjects(prev => prev.map(item => {
        if (item.id !== interaction.id) return item

        if (interaction.mode === 'drag') {
          return {
            ...item,
            x: toNumber(interaction.origX + dx, item.x, 0, Math.max(0, plan.ancho - item.ancho)),
            y: toNumber(interaction.origY + dy, item.y, 0, Math.max(0, plan.alto - item.alto)),
          }
        }

        if (interaction.mode === 'resize') {
          return {
            ...item,
            ancho: toNumber(interaction.origWidth + dx, item.ancho, 16, 4000),
            alto: toNumber(interaction.origHeight + dy, item.alto, 16, 4000),
          }
        }

        return item
      }))
      setDirty(true)
    }

    function onUp() {
      interactionRef.current = null
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [objects, plan])

  const startDrag = (item, event) => {
    if (!editable) return
    const layer = layerById.get(item.capa_id)
    if (layer?.bloqueada) return
    event.preventDefault()
    interactionRef.current = {
      mode: 'drag',
      id: item.id,
      startX: event.clientX,
      startY: event.clientY,
      origX: item.x,
      origY: item.y,
    }
    setSelectedObjectId(item.id)
  }

  const startResize = (item, event) => {
    if (!editable) return
    const layer = layerById.get(item.capa_id)
    if (layer?.bloqueada) return
    event.preventDefault()
    event.stopPropagation()
    interactionRef.current = {
      mode: 'resize',
      id: item.id,
      startX: event.clientX,
      startY: event.clientY,
      origWidth: item.ancho,
      origHeight: item.alto,
    }
    setSelectedObjectId(item.id)
  }

  const updatePlanField = (field, value) => {
    setPlan(prev => ({ ...prev, [field]: value }))
    setDirty(true)
  }

  const updateSelectedObject = (patch) => {
    if (!selectedObjectId) return
    setObjects(prev => prev.map(item => item.id === selectedObjectId ? { ...item, ...patch } : item))
    setDirty(true)
  }

  const addObject = (type) => {
    if (!editable || !plan) return
    const preset = getPreset(type)
    const targetLayer = layers.find(layer => layer.clave === preset.layerKey) || layers[0]
    if (!targetLayer) return

    const nextIndex = objects.length + 1
    const object = {
      id: uid(),
      tipo: type,
      nombre: preset.label,
      capa_id: targetLayer.id,
      capa_clave: targetLayer.clave,
      x: 48 + ((nextIndex * 26) % 240),
      y: 48 + ((nextIndex * 22) % 180),
      ancho: preset.width,
      alto: preset.height,
      rotacion: 0,
      color: preset.color,
      z_index: nextIndex,
      vinculo_tipo: '',
      vinculo_id: '',
      vinculo_nombre: '',
      metadata: {},
    }

    setObjects(prev => [...prev, object])
    setSelectedObjectId(object.id)
    setDirty(true)
  }

  const duplicateSelected = () => {
    if (!editable || !selectedObject) return
    const clone = {
      ...selectedObject,
      id: uid(),
      x: toNumber(selectedObject.x + 24, 24, 0, Math.max(0, plan.ancho - selectedObject.ancho)),
      y: toNumber(selectedObject.y + 24, 24, 0, Math.max(0, plan.alto - selectedObject.alto)),
      z_index: objects.length + 1,
      metadata: cloneMeta(selectedObject.metadata),
    }
    setObjects(prev => [...prev, clone])
    setSelectedObjectId(clone.id)
    setDirty(true)
  }

  const removeSelectedObject = () => {
    if (!editable || !selectedObject) return
    setObjects(prev => prev.filter(item => item.id !== selectedObject.id))
    setSelectedObjectId('')
    setDirty(true)
  }

  const addLayer = () => {
    if (!editable) return
    const nextIndex = layers.length + 1
    const layer = {
      id: uid(),
      clave: `personalizada_${nextIndex}`,
      nombre: `Capa ${nextIndex}`,
      color: '#94a3b8',
      icono: 'layer',
      visible: true,
      bloqueada: false,
      editable: true,
      orden: nextIndex * 10,
    }
    setLayers(prev => [...prev, layer])
    setDirty(true)
  }

  const updateLayer = (layerId, patch) => {
    setLayers(prev => prev.map(layer => layer.id === layerId ? { ...layer, ...patch } : layer))
    if (patch.clave || patch.id) {
      setObjects(prev => prev.map(item => item.capa_id === layerId ? { ...item, capa_clave: patch.clave || item.capa_clave } : item))
    }
    setDirty(true)
  }

  const removeLayer = (layerId) => {
    if (!editable) return
    const target = layers.find(layer => layer.id === layerId)
    if (!target?.editable) {
      showInfo('Las capas base del plano no se eliminan; solo se pueden ocultar o bloquear.')
      return
    }
    const fallbackLayer = layers.find(layer => layer.id !== layerId) || null
    setLayers(prev => prev.filter(layer => layer.id !== layerId))
    if (fallbackLayer) {
      setObjects(prev => prev.map(item => item.capa_id === layerId
        ? { ...item, capa_id: fallbackLayer.id, capa_clave: fallbackLayer.clave }
        : item))
    } else {
      setObjects([])
    }
    setDirty(true)
  }

  const openCreatePlan = () => {
    setCreateForm(DEFAULT_CREATE_FORM)
    setCreateOpen(true)
  }

  const createPlan = async () => {
    if (!createForm.nombre.trim()) {
      showInfo('Indica el nombre del plano para continuar.')
      return
    }
    try {
      const response = await planoOficinaAPI.create({
        ...createForm,
        ancho: toNumber(createForm.ancho, 1600, 600, 5000),
        alto: toNumber(createForm.alto, 900, 400, 4000),
        grid_size: toNumber(createForm.grid_size, 24, 8, 120),
      })
      setCreateOpen(false)
      await loadPlans(response.id)
      setSelectedPlanId(response.id)
      showSuccess('Plano creado correctamente.')
    } catch (err) {
      showError(err?.message || 'No se pudo crear el plano')
    }
  }

  const savePlan = async () => {
    if (!editable || !plan) return
    setSaving(true)
    try {
      const response = await planoOficinaAPI.saveLayout(plan.id, {
        ...plan,
        ancho: toNumber(plan.ancho, 1600, 600, 5000),
        alto: toNumber(plan.alto, 900, 400, 4000),
        grid_size: toNumber(plan.grid_size, 24, 8, 120),
        layers,
        objetos: objects,
      })
      setPlan({
        id: response.id,
        nombre: response.nombre,
        sucursal_id: response.sucursal_id || '',
        sucursal_nombre: response.sucursal_nombre || '',
        piso: response.piso || '',
        descripcion: response.descripcion || '',
        ancho: response.ancho || 1600,
        alto: response.alto || 900,
        grid_size: response.grid_size || 24,
        config: response.config || {},
      })
      setLayers(response.layers || [])
      setObjects(response.objetos || [])
      setDirty(false)
      await loadPlans(plan.id)
      showSuccess('Plano guardado correctamente.')
    } catch (err) {
      showError(err?.message || 'No se pudo guardar el plano')
    } finally {
      setSaving(false)
    }
  }

  const deletePlan = async () => {
    if (!plan) return
    try {
      await planoOficinaAPI.remove(plan.id)
      setDeleteOpen(false)
      await loadPlans('')
      showSuccess('Plano archivado correctamente.')
    } catch (err) {
      showError(err?.message || 'No se pudo archivar el plano')
    }
  }

  const linkEmployee = (employeeId) => {
    const employee = empleados.find(item => item.id === employeeId)
    updateSelectedObject({
      vinculo_tipo: employee ? 'empleado' : '',
      vinculo_id: employee?.id || '',
      vinculo_nombre: employee?.nombre_completo || '',
      nombre: employee?.nombre_completo || selectedObject?.nombre || 'Usuario',
      metadata: {
        ...(selectedObject?.metadata || {}),
        puesto: employee?.puesto || '',
        sucursal_nombre: employee?.sucursal_nombre || '',
      },
    })
  }

  const linkDevice = (deviceId) => {
    const device = dispositivos.find(item => item.id === deviceId)
    updateSelectedObject({
      vinculo_tipo: device ? 'dispositivo' : '',
      vinculo_id: device?.id || '',
      vinculo_nombre: device ? `${device.tipo} - ${device.marca} ${device.modelo || ''}`.trim() : '',
      nombre: device ? `${device.tipo} ${device.marca}` : selectedObject?.nombre || getPreset(selectedObject?.tipo).label,
      metadata: {
        ...(selectedObject?.metadata || {}),
        serie: device?.serie || '',
        ubicacion: device?.ubicacion_nombre || '',
      },
    })
  }

  const canvasStyle = useMemo(() => {
    if (!plan) return {}
    const grid = toNumber(plan.grid_size, 24, 8, 120)
    return {
      width: `${plan.ancho}px`,
      height: `${plan.alto}px`,
      backgroundColor: '#f8fafc',
      backgroundImage: `linear-gradient(to right, rgba(148,163,184,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.12) 1px, transparent 1px), radial-gradient(circle at top right, rgba(56,189,248,0.12), transparent 26%), radial-gradient(circle at bottom left, rgba(59,130,246,0.08), transparent 30%)`,
      backgroundSize: `${grid}px ${grid}px, ${grid}px ${grid}px, 100% 100%, 100% 100%`,
    }
  }, [plan])

  const renderObject = (item) => {
    const preset = getPreset(item.tipo)
    const layer = layerById.get(item.capa_id)
    const isSelected = selectedObjectId === item.id
    const isLocked = layer?.bloqueada
    const background = item.color || preset.color

    let shapeClass = 'rounded-3xl border shadow-[0_16px_32px_rgba(15,23,42,0.12)]'
    let extraStyle = {}
    if (item.tipo === 'pared') {
      shapeClass = 'rounded-full shadow-[0_10px_20px_rgba(15,23,42,0.16)]'
      extraStyle = { border: 'none', background: '#475569' }
    } else if (item.tipo === 'puerta') {
      shapeClass = 'rounded-full border-2 border-dashed'
      extraStyle = { background: 'rgba(34,197,94,0.12)' }
    } else if (item.tipo === 'planta') {
      shapeClass = 'rounded-full border shadow-[0_12px_24px_rgba(34,197,94,0.2)]'
    } else if (item.tipo === 'usuario') {
      shapeClass = 'rounded-[28px] border shadow-[0_18px_38px_rgba(249,115,22,0.18)]'
    }

    return (
      <div
        key={item.id}
        onMouseDown={(event) => startDrag(item, event)}
        onClick={(event) => {
          event.stopPropagation()
          setSelectedObjectId(item.id)
        }}
        className={`absolute overflow-hidden ${shapeClass} ${
          isSelected ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-blue-50' : ''
        } ${isLocked ? 'cursor-not-allowed opacity-85' : 'cursor-move'}`}
        style={{
          left: item.x,
          top: item.y,
          width: item.ancho,
          height: item.alto,
          transform: `rotate(${item.rotacion || 0}deg)`,
          background,
          borderColor: item.tipo === 'puerta' ? background : 'rgba(255,255,255,0.82)',
          ...extraStyle,
        }}
      >
        {item.tipo !== 'pared' && (
          <div className="flex h-full w-full flex-col justify-between px-3 py-2 text-white">
            <div className="flex items-center justify-between gap-2">
              <span className="rounded-full bg-white/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em]">
                {objectBadge(item)}
              </span>
              {item.vinculo_nombre && (
                <span className="max-w-[55%] truncate text-[10px] font-medium text-white/80">
                  Vinculado
                </span>
              )}
            </div>
            <div>
              <div className="line-clamp-2 text-sm font-semibold leading-tight">{objectDisplayName(item)}</div>
              {item.metadata?.serie && (
                <div className="mt-1 truncate text-[11px] text-white/80">{item.metadata.serie}</div>
              )}
              {item.metadata?.puesto && (
                <div className="mt-1 truncate text-[11px] text-white/80">{item.metadata.puesto}</div>
              )}
            </div>
          </div>
        )}

        {isSelected && editable && !isLocked && (
          <button
            type="button"
            data-resize="true"
            onMouseDown={(event) => startResize(item, event)}
            className="absolute bottom-1.5 right-1.5 h-4 w-4 rounded border border-white/70 bg-white/90"
            title="Redimensionar"
          />
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Plano de Oficina" subtitle="Capas, mobiliario y equipos sobre un plano editable de oficina">
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-secondary" onClick={loadBootstrap}>
            <ArrowPathIcon className="h-4 w-4" />
            <span>Actualizar</span>
          </button>
          {editable && (
            <>
              <button className="btn-secondary" onClick={openCreatePlan}>
                <PlusIcon className="h-4 w-4" />
                <span>Nuevo plano</span>
              </button>
              <button className="btn-primary" onClick={savePlan} disabled={!plan || saving || !dirty}>
                {saving ? 'Guardando...' : dirty ? 'Guardar cambios' : 'Sin cambios'}
              </button>
            </>
          )}
        </div>
      </PageHeader>

      <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)_330px]">
        <aside className="space-y-4 rounded-[28px] border border-slate-200/80 bg-white/90 p-4 shadow-[0_24px_60px_rgba(148,163,184,0.12)] backdrop-blur">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">Planos</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-900">{plans.length} disponibles</h2>
            </div>
            {editable && (
              <button
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                onClick={openCreatePlan}
                title="Crear plano"
              >
                <PlusIcon className="h-5 w-5" />
              </button>
            )}
          </div>

          <div className="space-y-2">
            {plans.map(item => (
              <button
                key={item.id}
                onClick={() => setSelectedPlanId(item.id)}
                className={`w-full rounded-3xl border px-4 py-3 text-left transition-all ${
                  selectedPlanId === item.id
                    ? 'border-blue-200 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 text-white shadow-[0_18px_40px_rgba(15,23,42,0.22)]'
                    : 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_12px_28px_rgba(15,23,42,0.08)]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">{item.nombre}</div>
                    <div className={`mt-1 text-xs ${selectedPlanId === item.id ? 'text-blue-100' : 'text-slate-500'}`}>
                      {item.sucursal_nombre || 'Sin sucursal ligada'}{item.piso ? ` - ${item.piso}` : ''}
                    </div>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${selectedPlanId === item.id ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    {item.total_objetos || 0}
                  </span>
                </div>
              </button>
            ))}
            {!plans.length && (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                Aun no hay planos creados. Crea el primero para comenzar a mapear la oficina.
              </div>
            )}
          </div>

          {plan && (
            <div className="space-y-3 rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Capas</p>
                  <h3 className="mt-1 text-sm font-semibold text-slate-900">Visibilidad y orden</h3>
                </div>
                {editable && (
                  <button
                    onClick={addLayer}
                    className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                  >
                    Nueva capa
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {layers
                  .slice()
                  .sort((a, b) => (a.orden || 0) - (b.orden || 0))
                  .map(layer => (
                    <div key={layer.id} className="rounded-2xl border border-white bg-white/90 px-3 py-3 shadow-sm">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => updateLayer(layer.id, { visible: !layer.visible })}
                          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition hover:bg-slate-100"
                          title={layer.visible ? 'Ocultar capa' : 'Mostrar capa'}
                        >
                          {layer.visible ? <EyeIcon className="h-4 w-4" /> : <EyeSlashIcon className="h-4 w-4" />}
                        </button>
                        <span className="h-9 w-9 rounded-xl border border-white shadow-sm" style={{ backgroundColor: layer.color }} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-slate-800">{layer.nombre}</div>
                          <div className="text-xs text-slate-500">{layerStats.get(layer.id) || 0} objetos</div>
                        </div>
                        {editable && (
                          <button
                            type="button"
                            onClick={() => removeLayer(layer.id)}
                            className="flex h-9 w-9 items-center justify-center rounded-xl border border-red-100 text-red-500 transition hover:bg-red-50"
                            title="Eliminar capa"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        )}
                      </div>

                      {editable && (
                        <div className="mt-3 grid gap-2 md:grid-cols-[1fr_88px_88px]">
                          <input
                            className="input text-sm"
                            value={layer.nombre}
                            onChange={event => updateLayer(layer.id, { nombre: event.target.value })}
                          />
                          <input
                            className="input h-11 p-1"
                            type="color"
                            value={layer.color || '#94a3b8'}
                            onChange={event => updateLayer(layer.id, { color: event.target.value })}
                          />
                          <button
                            type="button"
                            onClick={() => updateLayer(layer.id, { bloqueada: !layer.bloqueada })}
                            className={`rounded-2xl border px-3 py-2 text-xs font-semibold transition ${
                              layer.bloqueada
                                ? 'border-amber-200 bg-amber-50 text-amber-700'
                                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                            }`}
                          >
                            {layer.bloqueada ? 'Bloqueada' : 'Editable'}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}
        </aside>

        <section className="space-y-4">
          {plan ? (
            <>
              <div className="rounded-[30px] border border-slate-200/80 bg-gradient-to-br from-white via-slate-50 to-blue-50/60 p-5 shadow-[0_26px_64px_rgba(148,163,184,0.14)]">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white">
                        Plano activo
                      </span>
                      {dirty && <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">Cambios sin guardar</span>}
                    </div>
                    <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">{plan.nombre}</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {plan.sucursal_nombre || 'Sin sucursal ligada'}{plan.piso ? ` - ${plan.piso}` : ''}
                    </p>
                    {plan.descripcion && <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">{plan.descripcion}</p>}
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    {layers.map(layer => (
                      <LayerChip key={layer.id} layer={layer} count={layerStats.get(layer.id) || 0} />
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-[30px] border border-slate-200/80 bg-white/95 p-4 shadow-[0_22px_56px_rgba(148,163,184,0.12)]">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-2 pb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Lienzo de oficina</h3>
                    <p className="text-sm text-slate-500">Arrastra los objetos, redimensiónalos y usa las capas para organizar el plano.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="rounded-full bg-slate-100 px-3 py-2 font-semibold text-slate-700">
                      {plan.ancho} x {plan.alto}px
                    </span>
                    <span className="rounded-full bg-blue-50 px-3 py-2 font-semibold text-blue-700">
                      Reticula {plan.grid_size}px
                    </span>
                    {editable && (
                      <button className="rounded-full bg-slate-900 px-4 py-2 font-semibold text-white transition hover:bg-slate-800" onClick={savePlan} disabled={saving || !dirty}>
                        {saving ? 'Guardando...' : 'Guardar'}
                      </button>
                    )}
                  </div>
                </div>

                <div ref={canvasWrapRef} className="mt-4 overflow-auto rounded-[28px] border border-slate-200 bg-slate-100/80 p-4">
                  <div
                    className="relative rounded-[30px] border border-slate-200 shadow-inner"
                    style={canvasStyle}
                    onClick={() => setSelectedObjectId('')}
                  >
                    <div className="pointer-events-none absolute inset-0 rounded-[30px] border border-white/60" />
                    {visibleObjects.map(renderObject)}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-[34px] border border-dashed border-slate-200 bg-white/90 px-8 py-20 text-center shadow-[0_20px_56px_rgba(148,163,184,0.1)]">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-900 text-white shadow-[0_18px_38px_rgba(15,23,42,0.16)]">
                <BuildingOffice2Icon className="h-8 w-8" />
              </div>
              <h2 className="mt-5 text-2xl font-semibold text-slate-900">Crea tu primer plano editable</h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-500">
                Desde aqui podremos dibujar la oficina, separar capas, ubicar usuarios y colocar infraestructura como access points, camaras, nodos de red, pantallas, puertas, mesas y mobiliario.
              </p>
              {editable && (
                <button className="btn-primary mt-6" onClick={openCreatePlan}>
                  <PlusIcon className="h-4 w-4" />
                  <span>Crear plano</span>
                </button>
              )}
            </div>
          )}
        </section>

        <aside className="space-y-4 rounded-[28px] border border-slate-200/80 bg-white/90 p-4 shadow-[0_24px_60px_rgba(148,163,184,0.12)] backdrop-blur">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">Biblioteca</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">Objetos del plano</h2>
            <p className="mt-1 text-sm text-slate-500">Agrega infraestructura, mobiliario, dispositivos y usuarios al lienzo.</p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-2">
            {OBJECT_LIBRARY.map(item => (
              <button
                key={item.type}
                onClick={() => addObject(item.type)}
                disabled={!editable || !plan}
                className="rounded-3xl border border-slate-200 bg-white px-3 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_12px_26px_rgba(15,23,42,0.08)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl text-sm font-semibold text-white" style={{ backgroundColor: item.color }}>
                    {item.short}
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{item.label}</div>
                    <div className="text-xs text-slate-500">{LAYER_PRESETS.find(layer => layer.clave === item.layerKey)?.nombre}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {selectedObject ? (
            <div className="space-y-4 rounded-[30px] border border-slate-200 bg-slate-50/90 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Seleccion actual</p>
                  <h3 className="mt-1 text-lg font-semibold text-slate-900">{objectDisplayName(selectedObject)}</h3>
                  <p className="text-sm text-slate-500">{getPreset(selectedObject.tipo).label}</p>
                </div>
                {editable && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={duplicateSelected}
                      className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                      title="Duplicar"
                    >
                      <DocumentDuplicateIcon className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={removeSelectedObject}
                      className="flex h-10 w-10 items-center justify-center rounded-2xl border border-red-100 bg-white text-red-500 transition hover:bg-red-50"
                      title="Eliminar"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="grid gap-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Nombre</span>
                  <input
                    className="input"
                    value={selectedObject.nombre || ''}
                    onChange={event => updateSelectedObject({ nombre: event.target.value })}
                    disabled={!editable}
                  />
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">X</span>
                    <input
                      type="number"
                      className="input"
                      value={Math.round(selectedObject.x)}
                      onChange={event => updateSelectedObject({ x: toNumber(event.target.value, selectedObject.x, 0, Math.max(0, plan.ancho - selectedObject.ancho)) })}
                      disabled={!editable}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Y</span>
                    <input
                      type="number"
                      className="input"
                      value={Math.round(selectedObject.y)}
                      onChange={event => updateSelectedObject({ y: toNumber(event.target.value, selectedObject.y, 0, Math.max(0, plan.alto - selectedObject.alto)) })}
                      disabled={!editable}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Ancho</span>
                    <input
                      type="number"
                      className="input"
                      value={Math.round(selectedObject.ancho)}
                      onChange={event => updateSelectedObject({ ancho: toNumber(event.target.value, selectedObject.ancho, 16, 4000) })}
                      disabled={!editable}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Alto</span>
                    <input
                      type="number"
                      className="input"
                      value={Math.round(selectedObject.alto)}
                      onChange={event => updateSelectedObject({ alto: toNumber(event.target.value, selectedObject.alto, 16, 4000) })}
                      disabled={!editable}
                    />
                  </label>
                </div>

                <div className="grid grid-cols-[1fr_96px] gap-3">
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Capa</span>
                    <select
                      className="input"
                      value={selectedObject.capa_id || ''}
                      onChange={event => {
                        const layer = layers.find(item => item.id === event.target.value)
                        updateSelectedObject({ capa_id: layer?.id || '', capa_clave: layer?.clave || '' })
                      }}
                      disabled={!editable}
                    >
                      {layers.map(layer => (
                        <option key={layer.id} value={layer.id}>{layer.nombre}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Giro</span>
                    <input
                      type="number"
                      className="input"
                      value={Math.round(selectedObject.rotacion || 0)}
                      onChange={event => updateSelectedObject({ rotacion: toNumber(event.target.value, selectedObject.rotacion || 0, -360, 360) })}
                      disabled={!editable}
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Color</span>
                  <input
                    type="color"
                    className="input h-11 p-1"
                    value={selectedObject.color || getPreset(selectedObject.tipo).color}
                    onChange={event => updateSelectedObject({ color: event.target.value })}
                    disabled={!editable}
                  />
                </label>

                {selectedObject.tipo === 'usuario' && (
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Empleado vinculado</span>
                    <select
                      className="input"
                      value={selectedObject.vinculo_tipo === 'empleado' ? selectedObject.vinculo_id : ''}
                      onChange={event => linkEmployee(event.target.value)}
                      disabled={!editable}
                    >
                      <option value="">Sin vincular</option>
                      {empleados.map(item => (
                        <option key={item.id} value={item.id}>{item.nombre_completo}</option>
                      ))}
                    </select>
                  </label>
                )}

                {DEVICE_LINKABLE_TYPES.has(selectedObject.tipo) && (
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Dispositivo vinculado</span>
                    <select
                      className="input"
                      value={selectedObject.vinculo_tipo === 'dispositivo' ? selectedObject.vinculo_id : ''}
                      onChange={event => linkDevice(event.target.value)}
                      disabled={!editable}
                    >
                      <option value="">Sin vincular</option>
                      {dispositivos.map(item => (
                        <option key={item.id} value={item.id}>
                          {item.tipo} - {item.marca} {item.modelo ? `- ${item.modelo}` : ''}{item.serie ? ` (${item.serie})` : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Notas</span>
                  <textarea
                    className="input min-h-[96px]"
                    value={selectedObject.metadata?.nota || ''}
                    onChange={event => updateSelectedObject({ metadata: { ...(selectedObject.metadata || {}), nota: event.target.value } })}
                    disabled={!editable}
                  />
                </label>
              </div>
            </div>
          ) : (
            <div className="rounded-[30px] border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center text-sm text-slate-500">
              Selecciona un objeto del plano para editar su tamano, posicion, capa o vinculacion.
            </div>
          )}

          {plan && (
            <div className="space-y-4 rounded-[30px] border border-slate-200 bg-white p-4 shadow-sm">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Plano</p>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">Propiedades generales</h3>
              </div>

              <div className="grid gap-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Nombre</span>
                  <input className="input" value={plan.nombre} onChange={event => updatePlanField('nombre', event.target.value)} disabled={!editable} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Sucursal</span>
                  <select
                    className="input"
                    value={plan.sucursal_id || ''}
                    onChange={event => {
                      const branch = sucursales.find(item => item.id === event.target.value)
                      setPlan(prev => ({
                        ...prev,
                        sucursal_id: branch?.id || '',
                        sucursal_nombre: branch?.nombre || '',
                      }))
                      setDirty(true)
                    }}
                    disabled={!editable}
                  >
                    <option value="">Sin sucursal ligada</option>
                    {sucursales.map(item => (
                      <option key={item.id} value={item.id}>{item.nombre}</option>
                    ))}
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Piso</span>
                    <input className="input" value={plan.piso || ''} onChange={event => updatePlanField('piso', event.target.value)} disabled={!editable} />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Reticula</span>
                    <input
                      type="number"
                      className="input"
                      value={plan.grid_size}
                      onChange={event => updatePlanField('grid_size', toNumber(event.target.value, plan.grid_size, 8, 120))}
                      disabled={!editable}
                    />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Ancho</span>
                    <input
                      type="number"
                      className="input"
                      value={plan.ancho}
                      onChange={event => updatePlanField('ancho', toNumber(event.target.value, plan.ancho, 600, 5000))}
                      disabled={!editable}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Alto</span>
                    <input
                      type="number"
                      className="input"
                      value={plan.alto}
                      onChange={event => updatePlanField('alto', toNumber(event.target.value, plan.alto, 400, 4000))}
                      disabled={!editable}
                    />
                  </label>
                </div>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Descripcion</span>
                  <textarea className="input min-h-[96px]" value={plan.descripcion || ''} onChange={event => updatePlanField('descripcion', event.target.value)} disabled={!editable} />
                </label>
              </div>

              {editable && (
                <button className="btn-danger w-full justify-center" onClick={() => setDeleteOpen(true)}>
                  <TrashIcon className="h-4 w-4" />
                  <span>Archivar plano</span>
                </button>
              )}
            </div>
          )}
        </aside>
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nuevo plano de oficina" size="lg">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block md:col-span-2">
            <span className="mb-1 block text-sm font-medium text-slate-700">Nombre del plano</span>
            <input
              className="input"
              value={createForm.nombre}
              onChange={event => setCreateForm(prev => ({ ...prev, nombre: event.target.value }))}
              placeholder="Corporativo CDMX - Piso 1"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Sucursal u oficina</span>
            <select
              className="input"
              value={createForm.sucursal_id}
              onChange={event => {
                const branch = sucursales.find(item => item.id === event.target.value)
                setCreateForm(prev => ({
                  ...prev,
                  sucursal_id: branch?.id || '',
                  sucursal_nombre: branch?.nombre || '',
                }))
              }}
            >
              <option value="">Sin sucursal ligada</option>
              {sucursales.map(item => (
                <option key={item.id} value={item.id}>{item.nombre}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Piso</span>
            <input
              className="input"
              value={createForm.piso}
              onChange={event => setCreateForm(prev => ({ ...prev, piso: event.target.value }))}
              placeholder="Piso 1"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Ancho del plano</span>
            <input
              type="number"
              className="input"
              value={createForm.ancho}
              onChange={event => setCreateForm(prev => ({ ...prev, ancho: toNumber(event.target.value, prev.ancho, 600, 5000) }))}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Alto del plano</span>
            <input
              type="number"
              className="input"
              value={createForm.alto}
              onChange={event => setCreateForm(prev => ({ ...prev, alto: toNumber(event.target.value, prev.alto, 400, 4000) }))}
            />
          </label>

          <label className="block md:col-span-2">
            <span className="mb-1 block text-sm font-medium text-slate-700">Descripcion</span>
            <textarea
              className="input min-h-[110px]"
              value={createForm.descripcion}
              onChange={event => setCreateForm(prev => ({ ...prev, descripcion: event.target.value }))}
              placeholder="Ejemplo: sede principal, area operativa, pasillos, recepcion y estaciones de trabajo."
            />
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button className="btn-secondary" onClick={() => setCreateOpen(false)}>Cancelar</button>
          <button className="btn-primary" onClick={createPlan}>Crear plano</button>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={deletePlan}
        title="Archivar plano"
        message="El plano no se elimina fisicamente. Solo quedara inactivo para conservar su historial."
      />
    </div>
  )
}
