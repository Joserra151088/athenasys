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
  config: {
    showGrid: true,
    backgroundOpacity: 0.88,
    backgroundImage: '',
  },
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
  { type: 'pc', label: 'PC', layerKey: 'pantallas', width: 108, height: 86, color: '#2563eb', short: 'PC' },
  { type: 'laptop', label: 'Laptop', layerKey: 'pantallas', width: 110, height: 82, color: '#1d4ed8', short: 'LP' },
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
  { type: 'impresora', label: 'Impresora', layerKey: 'pantallas', width: 108, height: 78, color: '#475569', short: 'IM' },
  { type: 'biometrico', label: 'Biometrico', layerKey: 'biometricos', width: 92, height: 58, color: '#14b8a6', short: 'BI' },
  { type: 'usuario', label: 'Usuario', layerKey: 'usuarios', width: 112, height: 132, color: '#fb923c', short: 'US' },
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

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'))
    reader.readAsDataURL(file)
  })
}

function resolveVisualType(item) {
  const linkedType = String(item?.metadata?.device_type || '').toLowerCase()
  if (linkedType.includes('laptop')) return 'laptop'
  if (linkedType.includes('impresora')) return 'impresora'
  if (linkedType.includes('monitor') || linkedType.includes('pantalla')) return 'pantalla'
  if (linkedType.includes('cpu')) return 'pc'
  if (linkedType.includes('biom')) return 'biometrico'
  if (linkedType.includes('cam')) return 'camara'
  if (linkedType.includes('modem') || linkedType.includes('módem')) return 'access_point'
  return item?.tipo || 'mesa'
}

function FloorObjectGraphic({ item, compact = false }) {
  const visualType = resolveVisualType(item)
  const color = item.color || getPreset(visualType).color
  const stroke = 'rgba(15,23,42,0.72)'
  const userPhoto = item.metadata?.foto_url
  const label = objectDisplayName(item)
  const baseSvgClass = compact ? 'h-11 w-11' : 'h-full w-full'

  if (visualType === 'usuario') {
    return (
      <div className={`flex h-full w-full flex-col items-center justify-center ${compact ? 'gap-1' : 'gap-2'}`}>
        <div
          className={`overflow-hidden rounded-full border-4 border-white shadow-[0_12px_26px_rgba(15,23,42,0.18)] ${compact ? 'h-10 w-10' : 'h-[68%] w-[68%]'}`}
          style={{ background: 'linear-gradient(145deg, #ffffff, #e2e8f0)' }}
        >
          {userPhoto ? (
            <img src={userPhoto} alt={label} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-orange-400 to-pink-500 text-white">
              <UserIcon className={compact ? 'h-5 w-5' : 'h-8 w-8'} />
            </div>
          )}
        </div>
        {!compact && (
          <div className="max-w-full rounded-full bg-slate-900/85 px-3 py-1 text-center text-[11px] font-semibold text-white shadow-lg">
            <span className="block truncate">{label}</span>
          </div>
        )}
      </div>
    )
  }

  if (visualType === 'pared') {
    return <div className="h-full w-full rounded-full" style={{ background: color, boxShadow: 'inset 0 2px 5px rgba(255,255,255,0.22), 0 8px 16px rgba(15,23,42,0.18)' }} />
  }

  if (visualType === 'puerta') {
    return (
      <div className="relative h-full w-full overflow-hidden rounded-full border-2 border-dashed bg-white/80" style={{ borderColor: color }}>
        <div className="absolute left-[12%] top-[12%] h-[76%] w-[62%] rounded-r-2xl border-2 bg-emerald-50" style={{ borderColor: color }} />
        <div className="absolute left-[58%] top-1/2 h-2 w-2 -translate-y-1/2 rounded-full" style={{ backgroundColor: color }} />
      </div>
    )
  }

  const graphics = {
    pc: (
      <svg viewBox="0 0 100 100" className={baseSvgClass}>
        <rect x="18" y="15" width="64" height="44" rx="8" fill="#1e293b" stroke={stroke} strokeWidth="4" />
        <rect x="23" y="20" width="54" height="34" rx="6" fill="#dbeafe" />
        <rect x="42" y="60" width="16" height="11" rx="4" fill="#475569" />
        <rect x="28" y="72" width="44" height="8" rx="4" fill="#64748b" />
        <rect x="22" y="83" width="56" height="7" rx="3.5" fill="#cbd5e1" />
      </svg>
    ),
    laptop: (
      <svg viewBox="0 0 100 100" className={baseSvgClass}>
        <rect x="22" y="18" width="56" height="34" rx="7" fill="#1e293b" stroke={stroke} strokeWidth="4" />
        <rect x="27" y="22" width="46" height="26" rx="4" fill="#bfdbfe" />
        <path d="M15 64h70l-8 14H23L15 64Z" fill="#94a3b8" stroke={stroke} strokeWidth="4" strokeLinejoin="round" />
        <rect x="42" y="68" width="16" height="3" rx="1.5" fill="#e2e8f0" />
      </svg>
    ),
    pantalla: (
      <svg viewBox="0 0 120 100" className={baseSvgClass}>
        <rect x="14" y="16" width="92" height="46" rx="8" fill="#111827" stroke={stroke} strokeWidth="4" />
        <rect x="20" y="22" width="80" height="34" rx="5" fill="#ede9fe" />
        <rect x="55" y="62" width="10" height="11" rx="3" fill="#6b7280" />
        <rect x="40" y="74" width="40" height="7" rx="3.5" fill="#94a3b8" />
      </svg>
    ),
    impresora: (
      <svg viewBox="0 0 100 100" className={baseSvgClass}>
        <rect x="27" y="15" width="46" height="21" rx="6" fill="#cbd5e1" stroke={stroke} strokeWidth="4" />
        <rect x="18" y="34" width="64" height="38" rx="9" fill="#64748b" stroke={stroke} strokeWidth="4" />
        <rect x="28" y="50" width="44" height="24" rx="4" fill="#f8fafc" />
        <circle cx="70" cy="44" r="3" fill="#22c55e" />
      </svg>
    ),
    nodo_red: (
      <svg viewBox="0 0 100 100" className={baseSvgClass}>
        <rect x="16" y="20" width="68" height="52" rx="12" fill="#eff6ff" stroke={color} strokeWidth="5" />
        <rect x="26" y="34" width="14" height="14" rx="3" fill={color} />
        <rect x="43" y="34" width="14" height="14" rx="3" fill={color} opacity="0.88" />
        <rect x="60" y="34" width="14" height="14" rx="3" fill={color} opacity="0.75" />
        <rect x="26" y="52" width="48" height="8" rx="4" fill="#93c5fd" />
      </svg>
    ),
    camara: (
      <svg viewBox="0 0 100 100" className={baseSvgClass}>
        <path d="M24 42 66 28c6-2 10 4 7 9L58 61c-2 4-7 6-11 5L24 60Z" fill="#f8fafc" stroke={stroke} strokeWidth="4" strokeLinejoin="round" />
        <circle cx="54" cy="44" r="9" fill="#1d4ed8" />
        <path d="M20 57h15l-10 17H14Z" fill="#64748b" />
        <path d="M69 61l11 14" stroke="#64748b" strokeWidth="6" strokeLinecap="round" />
      </svg>
    ),
    access_point: (
      <svg viewBox="0 0 100 100" className={baseSvgClass}>
        <circle cx="50" cy="52" r="19" fill="#ecfeff" stroke={color} strokeWidth="5" />
        <circle cx="50" cy="52" r="4.5" fill={color} />
        <path d="M31 36c6-7 11-10 19-10s13 3 19 10" fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" />
        <path d="M36 31c4-5 8-7 14-7s10 2 14 7" fill="none" stroke="#99f6e4" strokeWidth="4" strokeLinecap="round" />
      </svg>
    ),
    biometrico: (
      <svg viewBox="0 0 100 100" className={baseSvgClass}>
        <rect x="29" y="18" width="42" height="64" rx="10" fill="#f0fdfa" stroke={color} strokeWidth="5" />
        <rect x="37" y="28" width="26" height="14" rx="4" fill="#99f6e4" />
        <path d="M50 52c-8 0-14 6-14 14 0 8 6 14 14 14s14-6 14-14c0-8-6-14-14-14Zm0 5c5 0 9 4 9 9s-4 9-9 9-9-4-9-9 4-9 9-9Z" fill={color} />
      </svg>
    ),
    mesa: (
      <svg viewBox="0 0 140 100" className={baseSvgClass}>
        <rect x="22" y="18" width="96" height="50" rx="12" fill={color} stroke="#7c5b2d" strokeWidth="4" />
        <rect x="30" y="26" width="80" height="34" rx="9" fill="#f4e4c8" opacity="0.65" />
        <rect x="28" y="68" width="8" height="22" rx="4" fill="#9a7136" />
        <rect x="104" y="68" width="8" height="22" rx="4" fill="#9a7136" />
      </svg>
    ),
    silla: (
      <svg viewBox="0 0 100 100" className={baseSvgClass}>
        <rect x="28" y="18" width="44" height="24" rx="10" fill="#cbd5e1" stroke={stroke} strokeWidth="4" />
        <rect x="24" y="46" width="52" height="18" rx="8" fill="#e2e8f0" stroke={stroke} strokeWidth="4" />
        <rect x="30" y="64" width="6" height="18" rx="3" fill="#64748b" />
        <rect x="64" y="64" width="6" height="18" rx="3" fill="#64748b" />
      </svg>
    ),
    sillon: (
      <svg viewBox="0 0 120 100" className={baseSvgClass}>
        <rect x="16" y="40" width="88" height="28" rx="14" fill="#ddd6fe" stroke="#7c3aed" strokeWidth="4" />
        <rect x="26" y="24" width="68" height="24" rx="12" fill="#c4b5fd" />
        <rect x="18" y="64" width="10" height="18" rx="5" fill="#7c3aed" />
        <rect x="92" y="64" width="10" height="18" rx="5" fill="#7c3aed" />
      </svg>
    ),
    planta: (
      <svg viewBox="0 0 100 100" className={baseSvgClass}>
        <ellipse cx="50" cy="35" rx="11" ry="18" fill="#22c55e" />
        <ellipse cx="34" cy="43" rx="12" ry="18" fill="#16a34a" transform="rotate(-28 34 43)" />
        <ellipse cx="66" cy="43" rx="12" ry="18" fill="#4ade80" transform="rotate(28 66 43)" />
        <path d="M38 62h24l-4 18H42Z" fill="#a16207" />
      </svg>
    ),
  }

  return (
    <div className={`flex h-full w-full items-center justify-center ${compact ? 'p-1.5' : 'p-2.5'}`}>
      {graphics[visualType] || graphics.pc}
    </div>
  )
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
        config: {
          showGrid: true,
          backgroundOpacity: 0.88,
          backgroundImage: '',
          ...(response.config || {}),
        },
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

  const updatePlanConfig = (patch) => {
    setPlan(prev => ({
      ...prev,
      config: {
        showGrid: true,
        backgroundOpacity: 0.88,
        ...(prev?.config || {}),
        ...patch,
      },
    }))
    setDirty(true)
  }

  const updateSelectedObject = (patch) => {
    if (!selectedObjectId) return
    setObjects(prev => prev.map(item => item.id === selectedObjectId ? { ...item, ...patch } : item))
    setDirty(true)
  }

  const uploadBackgroundImage = async (file) => {
    if (!file) return
    try {
      const dataUrl = await readFileAsDataUrl(file)
      updatePlanConfig({ backgroundImage: dataUrl })
    } catch (err) {
      showError(err?.message || 'No se pudo cargar la imagen del plano')
    }
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
        config: createForm.config,
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
        config: {
          showGrid: true,
          backgroundOpacity: 0.88,
          backgroundImage: '',
          ...(response.config || {}),
        },
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
        foto_url: employee?.foto_url || '',
        email: employee?.email || '',
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
        device_type: device?.tipo || '',
        marca: device?.marca || '',
        modelo: device?.modelo || '',
      },
    })
  }

  const canvasStyle = useMemo(() => {
    if (!plan) return {}
    const grid = toNumber(plan.grid_size, 24, 8, 120)
    const showGrid = plan.config?.showGrid !== false
    return {
      width: `${plan.ancho}px`,
      height: `${plan.alto}px`,
      backgroundColor: '#ffffff',
      backgroundImage: showGrid
        ? `linear-gradient(to right, rgba(148,163,184,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.12) 1px, transparent 1px), radial-gradient(circle at top right, rgba(56,189,248,0.08), transparent 26%), radial-gradient(circle at bottom left, rgba(59,130,246,0.04), transparent 30%)`
        : `radial-gradient(circle at top right, rgba(56,189,248,0.08), transparent 26%), radial-gradient(circle at bottom left, rgba(59,130,246,0.04), transparent 30%)`,
      backgroundSize: showGrid
        ? `${grid}px ${grid}px, ${grid}px ${grid}px, 100% 100%, 100% 100%`
        : `100% 100%, 100% 100%`,
    }
  }, [plan])

  const renderObject = (item) => {
    const preset = getPreset(resolveVisualType(item))
    const layer = layerById.get(item.capa_id)
    const isSelected = selectedObjectId === item.id
    const isLocked = layer?.bloqueada
    const isStructural = item.tipo === 'pared' || item.tipo === 'puerta'

    return (
      <div
        key={item.id}
        onMouseDown={(event) => startDrag(item, event)}
        onClick={(event) => {
          event.stopPropagation()
          setSelectedObjectId(item.id)
        }}
        className={`absolute ${isSelected ? 'z-30' : 'z-10'} ${isLocked ? 'cursor-not-allowed opacity-90' : 'cursor-move'}`}
        style={{
          left: item.x,
          top: item.y,
          width: item.ancho,
          height: item.alto,
          transform: `rotate(${item.rotacion || 0}deg)`,
        }}
      >
        <div
          className={`relative h-full w-full ${
            isStructural ? '' : 'rounded-[26px]'
          } ${isSelected ? 'bg-blue-50/60 shadow-[0_24px_46px_rgba(59,130,246,0.14)]' : ''}`}
        >
          <FloorObjectGraphic item={item} />
          {!isStructural && item.tipo !== 'usuario' && (
            <div className="pointer-events-none absolute inset-x-0 bottom-1 flex justify-center px-1">
              <div className="max-w-full rounded-full bg-white/92 px-2.5 py-1 text-center text-[10px] font-semibold text-slate-700 shadow-[0_8px_18px_rgba(15,23,42,0.14)] backdrop-blur">
                <span className="block truncate">{objectDisplayName(item)}</span>
              </div>
            </div>
          )}
          {isSelected && (
            <div className="pointer-events-none absolute inset-0 rounded-[26px] border-2 border-dashed border-blue-500" />
          )}
        </div>

        {isSelected && editable && !isLocked && (
          <button
            type="button"
            data-resize="true"
            onMouseDown={(event) => startResize(item, event)}
            className="absolute bottom-1.5 right-1.5 h-5 w-5 rounded-md border border-blue-200 bg-white shadow"
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
                    {plan.config?.backgroundImage && (
                      <span className="rounded-full bg-emerald-50 px-3 py-2 font-semibold text-emerald-700">
                        Plano base cargado
                      </span>
                    )}
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
                    {plan.config?.backgroundImage && (
                      <div className="pointer-events-none absolute inset-0 rounded-[30px] p-4">
                        <img
                          src={plan.config.backgroundImage}
                          alt="Plano base"
                          className="h-full w-full object-contain"
                          style={{ opacity: toNumber(plan.config.backgroundOpacity, 0.88, 0.15, 1) }}
                        />
                      </div>
                    )}
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
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 shadow-inner">
                    <FloorObjectGraphic item={{ ...item, nombre: item.label, metadata: {} }} compact />
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

                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                  <div className="mb-3">
                    <span className="block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Plano base</span>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Sube una imagen del layout de la oficina, como en Packet Tracer, para colocar objetos encima del plano real.
                    </p>
                  </div>

                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Imagen del plano</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      className="input h-11 p-2"
                      onChange={async event => {
                        const file = event.target.files?.[0]
                        await uploadBackgroundImage(file)
                        event.target.value = ''
                      }}
                      disabled={!editable}
                    />
                  </label>

                  <div className="mt-3 grid grid-cols-[1fr_96px] gap-3">
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Opacidad</span>
                      <input
                        type="range"
                        min="0.15"
                        max="1"
                        step="0.05"
                        value={toNumber(plan.config?.backgroundOpacity, 0.88, 0.15, 1)}
                        onChange={event => updatePlanConfig({ backgroundOpacity: toNumber(event.target.value, 0.88, 0.15, 1) })}
                        disabled={!editable}
                        className="w-full"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Reticula</span>
                      <button
                        type="button"
                        onClick={() => updatePlanConfig({ showGrid: !(plan.config?.showGrid !== false) })}
                        disabled={!editable}
                        className={`w-full rounded-2xl border px-3 py-2.5 text-xs font-semibold transition ${
                          plan.config?.showGrid !== false
                            ? 'border-blue-200 bg-blue-50 text-blue-700'
                            : 'border-slate-200 bg-white text-slate-600'
                        }`}
                      >
                        {plan.config?.showGrid !== false ? 'Visible' : 'Oculta'}
                      </button>
                    </label>
                  </div>

                  {plan.config?.backgroundImage && (
                    <button
                      type="button"
                      className="mt-3 w-full rounded-2xl border border-red-100 bg-white px-3 py-2.5 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                      onClick={() => updatePlanConfig({ backgroundImage: '' })}
                      disabled={!editable}
                    >
                      Quitar imagen del plano
                    </button>
                  )}
                </div>
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
