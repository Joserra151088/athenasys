import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownTrayIcon,
  ArrowsPointingInIcon,
  ArrowsPointingOutIcon,
  ArrowPathIcon,
  BuildingOffice2Icon,
  ChevronDownIcon,
  ComputerDesktopIcon,
  DocumentArrowDownIcon,
  DocumentDuplicateIcon,
  EyeIcon,
  EyeSlashIcon,
  LockClosedIcon,
  LockOpenIcon,
  MinusIcon,
  PencilSquareIcon,
  PhotoIcon,
  PlusIcon,
  Squares2X2Icon,
  TrashIcon,
  UserCircleIcon,
  UserIcon,
  VideoCameraIcon,
  ViewColumnsIcon,
  WifiIcon,
} from '@heroicons/react/24/outline'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
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
  ancho: 1800,
  alto: 1100,
  grid_size: 24,
  config: {
    showGrid: true,
    backgroundOpacity: 0.9,
    backgroundImage: '',
    backgroundScale: 1,
    backgroundX: 0,
    backgroundY: 0,
  },
}

const LAYER_PRESETS = [
  { clave: 'infraestructura', nombre: 'Infraestructura', color: '#54657a', icono: 'layout' },
  { clave: 'mobiliario', nombre: 'Mobiliario', color: '#b5843b', icono: 'desk' },
  { clave: 'nodos_red', nombre: 'Nodos de red', color: '#2d63ff', icono: 'network' },
  { clave: 'camaras', nombre: 'Camaras', color: '#ef4444', icono: 'camera' },
  { clave: 'access_points', nombre: 'Access points', color: '#0f9b8e', icono: 'wifi' },
  { clave: 'pantallas', nombre: 'Pantallas', color: '#6d44ff', icono: 'screen' },
  { clave: 'biometricos', nombre: 'Biometricos', color: '#14b8a6', icono: 'bio' },
  { clave: 'usuarios', nombre: 'Usuarios', color: '#ff7a18', icono: 'user' },
]

const OBJECT_LIBRARY = [
  { type: 'pc', label: 'PC', category: 'tecnologia', layerKey: 'pantallas', width: 118, height: 92, color: '#3567ff' },
  { type: 'laptop', label: 'Laptop', category: 'tecnologia', layerKey: 'pantallas', width: 118, height: 88, color: '#2457d6' },
  { type: 'pantalla', label: 'Pantalla', category: 'tecnologia', layerKey: 'pantallas', width: 140, height: 88, color: '#7c3aed' },
  { type: 'impresora', label: 'Impresora', category: 'tecnologia', layerKey: 'pantallas', width: 112, height: 86, color: '#475569' },
  { type: 'mesa', label: 'Mesa', category: 'mobiliario', layerKey: 'mobiliario', width: 200, height: 108, color: '#c89a58' },
  { type: 'silla', label: 'Silla', category: 'mobiliario', layerKey: 'mobiliario', width: 60, height: 60, color: '#dbe3ef' },
  { type: 'sillon', label: 'Sillon', category: 'mobiliario', layerKey: 'mobiliario', width: 124, height: 78, color: '#d8b4fe' },
  { type: 'planta', label: 'Planta', category: 'mobiliario', layerKey: 'mobiliario', width: 72, height: 72, color: '#4ade80' },
  { type: 'pared', label: 'Pared', category: 'infraestructura', layerKey: 'infraestructura', width: 280, height: 18, color: '#475569' },
  { type: 'puerta', label: 'Puerta', category: 'infraestructura', layerKey: 'infraestructura', width: 110, height: 20, color: '#22c55e' },
  { type: 'nodo_red', label: 'Nodo de red', category: 'red', layerKey: 'nodos_red', width: 112, height: 70, color: '#2563eb' },
  { type: 'camara', label: 'Camara', category: 'red', layerKey: 'camaras', width: 118, height: 68, color: '#ef4444' },
  { type: 'access_point', label: 'Access point', category: 'red', layerKey: 'access_points', width: 118, height: 68, color: '#0d9488' },
  { type: 'biometrico', label: 'Biometrico', category: 'red', layerKey: 'biometricos', width: 92, height: 68, color: '#14b8a6' },
  { type: 'usuario', label: 'Usuario', category: 'personas', layerKey: 'usuarios', width: 124, height: 152, color: '#fb923c' },
]

const DEVICE_LINKABLE_TYPES = new Set(['pc', 'laptop', 'impresora', 'nodo_red', 'camara', 'access_point', 'pantalla', 'biometrico'])
const CATEGORY_OPTIONS = [
  { key: 'todos', label: 'Todos' },
  { key: 'tecnologia', label: 'Tecnologia' },
  { key: 'mobiliario', label: 'Mobiliario' },
  { key: 'infraestructura', label: 'Infraestructura' },
  { key: 'red', label: 'Red y seguridad' },
  { key: 'personas', label: 'Personas' },
]

const CATEGORY_LABELS = {
  todos: 'Todos',
  tecnologia: 'Tecnologia',
  mobiliario: 'Mobiliario',
  infraestructura: 'Infraestructura',
  red: 'Red',
  personas: 'Personas',
}

function uid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function toNumber(value, fallback = 0, min = null, max = null) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  const withMin = min !== null ? Math.max(min, parsed) : parsed
  return max !== null ? Math.min(max, withMin) : withMin
}

function degToRad(value) {
  return value * (Math.PI / 180)
}

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value || {}))
}

function getPreset(type) {
  return OBJECT_LIBRARY.find(item => item.type === type) || OBJECT_LIBRARY[0]
}

function getLayerPreset(clave) {
  return LAYER_PRESETS.find(item => item.clave === clave)
}

function getCategoryLabel(category) {
  return CATEGORY_LABELS[category] || category
}

function objectDisplayName(item) {
  return item.nombre?.trim() || item.vinculo_nombre?.trim() || getPreset(item.tipo).label
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('No se pudo leer la imagen seleccionada'))
    reader.readAsDataURL(file)
  })
}

function resolveVisualType(item) {
  const linkedType = String(item?.metadata?.device_type || '').toLowerCase()
  if (linkedType.includes('laptop')) return 'laptop'
  if (linkedType.includes('impresora')) return 'impresora'
  if (linkedType.includes('monitor') || linkedType.includes('pantalla')) return 'pantalla'
  if (linkedType.includes('cpu') || linkedType.includes('pc')) return 'pc'
  if (linkedType.includes('biom')) return 'biometrico'
  if (linkedType.includes('cam')) return 'camara'
  if (linkedType.includes('access') || linkedType.includes('modem') || linkedType.includes('módem')) return 'access_point'
  return item?.tipo || 'mesa'
}

function renderMiniIcon(icon) {
  if (icon === 'camera') return <VideoCameraIcon className="h-4 w-4" />
  if (icon === 'wifi') return <WifiIcon className="h-4 w-4" />
  if (icon === 'user') return <UserIcon className="h-4 w-4" />
  if (icon === 'screen') return <ComputerDesktopIcon className="h-4 w-4" />
  if (icon === 'layout') return <Squares2X2Icon className="h-4 w-4" />
  return <BuildingOffice2Icon className="h-4 w-4" />
}

function SurfaceCard({ children, className = '' }) {
  return (
    <div className={`rounded-[28px] border border-white/80 bg-white/88 shadow-[0_18px_50px_rgba(148,163,184,0.12)] backdrop-blur-xl ${className}`}>
      {children}
    </div>
  )
}

function LayerBadge({ layer, count }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/70 bg-white/90 px-3 py-2 shadow-sm">
      <span className="flex h-9 w-9 items-center justify-center rounded-2xl text-white shadow-lg" style={{ backgroundColor: layer.color }}>
        {renderMiniIcon(layer.icono)}
      </span>
      <div className="min-w-0">
        <div className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{layer.nombre}</div>
        <div className="text-sm font-semibold text-slate-800">{count} objeto(s)</div>
      </div>
    </div>
  )
}

function ObjectArtwork({ item, compact = false }) {
  const visualType = resolveVisualType(item)
  const color = item.color || getPreset(visualType).color
  const stroke = 'rgba(15,23,42,0.68)'
  const userPhoto = item.metadata?.foto_url
  const label = objectDisplayName(item)
  const baseSvgClass = compact ? 'h-12 w-12' : 'h-full w-full'

  if (visualType === 'usuario') {
    return (
      <div className={`flex h-full w-full flex-col items-center justify-center ${compact ? 'gap-1' : 'gap-2'}`}>
        <div
          className={`overflow-hidden rounded-full border-[5px] border-white shadow-[0_18px_30px_rgba(15,23,42,0.18)] ${compact ? 'h-11 w-11' : 'h-[70%] w-[70%]'}`}
          style={{ background: 'linear-gradient(145deg, #ffffff, #dbeafe)' }}
        >
          {userPhoto ? (
            <img src={userPhoto} alt={label} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-orange-400 via-pink-500 to-fuchsia-500 text-white">
              <UserCircleIcon className={compact ? 'h-5 w-5' : 'h-10 w-10'} />
            </div>
          )}
        </div>
        {!compact && (
          <div className="max-w-[90%] rounded-full bg-slate-950/90 px-3 py-1 text-center text-[11px] font-semibold text-white shadow-lg">
            <span className="block truncate">{label}</span>
          </div>
        )}
      </div>
    )
  }

  if (visualType === 'pared') {
    return (
      <div className="h-full w-full rounded-full" style={{ background: `linear-gradient(180deg, ${color}, #334155)`, boxShadow: 'inset 0 2px 5px rgba(255,255,255,0.18), 0 10px 22px rgba(15,23,42,0.18)' }} />
    )
  }

  if (visualType === 'puerta') {
    return (
      <div className="relative h-full w-full overflow-hidden rounded-full border-2 border-dashed bg-white/90" style={{ borderColor: color }}>
        <div className="absolute left-[10%] top-[8%] h-[80%] w-[68%] rounded-r-2xl border-2 bg-emerald-50 shadow-inner" style={{ borderColor: color }} />
        <div className="absolute left-[61%] top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full" style={{ backgroundColor: color }} />
      </div>
    )
  }

  const graphics = {
    pc: (
      <svg viewBox="0 0 120 100" className={baseSvgClass}>
        <defs>
          <linearGradient id="pc-screen" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#dbeafe" />
            <stop offset="100%" stopColor="#bfdbfe" />
          </linearGradient>
        </defs>
        <rect x="18" y="13" width="84" height="50" rx="10" fill="#111827" stroke={stroke} strokeWidth="4" />
        <rect x="24" y="19" width="72" height="38" rx="7" fill="url(#pc-screen)" />
        <rect x="51" y="64" width="18" height="12" rx="4" fill="#475569" />
        <rect x="34" y="76" width="52" height="8" rx="4" fill="#94a3b8" />
        <rect x="28" y="85" width="64" height="6" rx="3" fill={color} opacity="0.22" />
      </svg>
    ),
    laptop: (
      <svg viewBox="0 0 120 100" className={baseSvgClass}>
        <rect x="28" y="16" width="64" height="38" rx="8" fill="#111827" stroke={stroke} strokeWidth="4" />
        <rect x="33" y="20" width="54" height="30" rx="5" fill="#dbeafe" />
        <path d="M17 66h86l-9 16H26L17 66Z" fill="#94a3b8" stroke={stroke} strokeWidth="4" strokeLinejoin="round" />
        <rect x="48" y="69" width="24" height="3" rx="1.5" fill="#e2e8f0" />
      </svg>
    ),
    pantalla: (
      <svg viewBox="0 0 140 100" className={baseSvgClass}>
        <rect x="16" y="14" width="108" height="52" rx="10" fill="#0f172a" stroke={stroke} strokeWidth="4" />
        <rect x="23" y="21" width="94" height="38" rx="6" fill="#ede9fe" />
        <rect x="66" y="66" width="10" height="10" rx="3" fill="#64748b" />
        <rect x="48" y="76" width="46" height="8" rx="4" fill="#94a3b8" />
      </svg>
    ),
    impresora: (
      <svg viewBox="0 0 110 100" className={baseSvgClass}>
        <rect x="31" y="14" width="48" height="24" rx="6" fill="#dbe3ef" stroke={stroke} strokeWidth="4" />
        <rect x="20" y="36" width="70" height="42" rx="10" fill="#64748b" stroke={stroke} strokeWidth="4" />
        <rect x="30" y="50" width="50" height="24" rx="4" fill="#f8fafc" />
        <circle cx="78" cy="46" r="3.5" fill="#22c55e" />
      </svg>
    ),
    mesa: (
      <svg viewBox="0 0 160 100" className={baseSvgClass}>
        <defs>
          <linearGradient id="desk-top" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f3dfb7" />
            <stop offset="100%" stopColor={color} />
          </linearGradient>
        </defs>
        <rect x="18" y="18" width="124" height="52" rx="14" fill="url(#desk-top)" stroke="#8a622c" strokeWidth="4" />
        <rect x="28" y="26" width="104" height="34" rx="10" fill="#fff5df" opacity="0.45" />
        <rect x="28" y="70" width="9" height="20" rx="4.5" fill="#8a622c" />
        <rect x="123" y="70" width="9" height="20" rx="4.5" fill="#8a622c" />
      </svg>
    ),
    silla: (
      <svg viewBox="0 0 100 100" className={baseSvgClass}>
        <rect x="28" y="18" width="44" height="24" rx="10" fill="#dce4ef" stroke={stroke} strokeWidth="4" />
        <rect x="24" y="46" width="52" height="18" rx="9" fill="#eef2f7" stroke={stroke} strokeWidth="4" />
        <rect x="30" y="64" width="6" height="18" rx="3" fill="#64748b" />
        <rect x="64" y="64" width="6" height="18" rx="3" fill="#64748b" />
      </svg>
    ),
    sillon: (
      <svg viewBox="0 0 140 100" className={baseSvgClass}>
        <rect x="18" y="38" width="104" height="30" rx="14" fill="#ddd6fe" stroke="#7c3aed" strokeWidth="4" />
        <rect x="30" y="22" width="80" height="24" rx="12" fill="#c4b5fd" />
        <rect x="20" y="66" width="10" height="16" rx="5" fill="#7c3aed" />
        <rect x="110" y="66" width="10" height="16" rx="5" fill="#7c3aed" />
      </svg>
    ),
    planta: (
      <svg viewBox="0 0 100 100" className={baseSvgClass}>
        <ellipse cx="50" cy="32" rx="12" ry="18" fill="#22c55e" />
        <ellipse cx="34" cy="40" rx="12" ry="18" fill="#16a34a" transform="rotate(-25 34 40)" />
        <ellipse cx="66" cy="40" rx="12" ry="18" fill="#4ade80" transform="rotate(25 66 40)" />
        <path d="M38 62h24l-4 18H42Z" fill="#a16207" />
      </svg>
    ),
    nodo_red: (
      <svg viewBox="0 0 110 100" className={baseSvgClass}>
        <rect x="16" y="20" width="78" height="52" rx="12" fill="#eff6ff" stroke={color} strokeWidth="5" />
        <rect x="28" y="34" width="14" height="14" rx="3" fill={color} />
        <rect x="48" y="34" width="14" height="14" rx="3" fill={color} opacity="0.86" />
        <rect x="68" y="34" width="14" height="14" rx="3" fill={color} opacity="0.72" />
        <rect x="28" y="54" width="54" height="7" rx="3.5" fill="#93c5fd" />
      </svg>
    ),
    camara: (
      <svg viewBox="0 0 120 100" className={baseSvgClass}>
        <path d="M28 44 76 28c8-3 14 5 10 12L69 67c-2 5-7 8-13 6L28 66Z" fill="#f8fafc" stroke={stroke} strokeWidth="4" strokeLinejoin="round" />
        <circle cx="62" cy="45" r="10" fill="#1d4ed8" />
        <path d="M22 61h18l-10 18H14Z" fill="#64748b" />
        <path d="M80 66l18 16" stroke="#64748b" strokeWidth="6" strokeLinecap="round" />
      </svg>
    ),
    access_point: (
      <svg viewBox="0 0 110 100" className={baseSvgClass}>
        <circle cx="55" cy="52" r="20" fill="#ecfeff" stroke={color} strokeWidth="5" />
        <circle cx="55" cy="52" r="4.8" fill={color} />
        <path d="M34 37c7-8 12-11 21-11s14 3 21 11" fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" />
        <path d="M40 31c5-5 9-7 15-7s10 2 15 7" fill="none" stroke="#99f6e4" strokeWidth="4" strokeLinecap="round" />
      </svg>
    ),
    biometrico: (
      <svg viewBox="0 0 100 100" className={baseSvgClass}>
        <rect x="30" y="16" width="40" height="66" rx="11" fill="#f0fdfa" stroke={color} strokeWidth="5" />
        <rect x="38" y="26" width="24" height="14" rx="4" fill="#99f6e4" />
        <path d="M50 49c-9 0-15 6-15 15 0 9 6 15 15 15s15-6 15-15c0-9-6-15-15-15Zm0 6c5 0 9 4 9 9s-4 9-9 9-9-4-9-9 4-9 9-9Z" fill={color} />
      </svg>
    ),
  }

  return (
    <div className={`flex h-full w-full items-center justify-center ${compact ? 'p-1' : 'p-2.5'}`}>
      {graphics[visualType] || graphics.pc}
    </div>
  )
}

function LibraryCard({ item, onAdd }) {
  return (
    <button
      type="button"
      onClick={() => onAdd(item.type)}
      title={`${item.label} · ${getCategoryLabel(item.category)}`}
      className="group rounded-[24px] border border-slate-200/80 bg-white/90 p-3.5 text-left shadow-[0_12px_24px_rgba(148,163,184,0.12)] transition duration-300 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_18px_32px_rgba(15,23,42,0.12)]"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] bg-gradient-to-br from-slate-50 to-slate-100 shadow-inner">
          <ObjectArtwork item={{ tipo: item.type, color: item.color }} compact />
        </div>
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="truncate text-sm font-semibold leading-5 text-slate-900">{item.label}</div>
          <div className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{getCategoryLabel(item.category)}</div>
        </div>
      </div>
    </button>
  )
}

function ObjectCard({ selected, item, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      title={objectDisplayName(item)}
      className={`w-full rounded-[22px] border px-3 py-3 text-left transition ${
        selected
          ? 'border-blue-200 bg-blue-50/80 shadow-[0_12px_28px_rgba(59,130,246,0.12)]'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-gradient-to-br from-slate-50 to-slate-100">
          <ObjectArtwork item={item} compact />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-slate-900">{objectDisplayName(item)}</div>
          <div className="truncate text-xs text-slate-500">{item.vinculo_nombre || getPreset(item.tipo).label}</div>
        </div>
      </div>
    </button>
  )
}

function buildDefaultLayer(layer, index) {
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
  const [exporting, setExporting] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [createForm, setCreateForm] = useState(DEFAULT_CREATE_FORM)
  const [selectedObjectId, setSelectedObjectId] = useState('')
  const [dirty, setDirty] = useState(false)
  const [zoom, setZoom] = useState(0.9)
  const [libraryCategory, setLibraryCategory] = useState('todos')
  const [librarySearch, setLibrarySearch] = useState('')
  const [leftTab, setLeftTab] = useState('planos')

  const viewportRef = useRef(null)
  const canvasRef = useRef(null)
  const exportRef = useRef(null)
  const interactionRef = useRef(null)

  const selectedObject = useMemo(
    () => objects.find(item => item.id === selectedObjectId) || null,
    [objects, selectedObjectId],
  )

  const layerMap = useMemo(() => new Map(layers.map(layer => [layer.id, layer])), [layers])

  const visibleObjects = useMemo(() => {
    const visibleLayerIds = new Set(layers.filter(layer => layer.visible).map(layer => layer.id))
    return objects
      .filter(item => visibleLayerIds.has(item.capa_id))
      .sort((a, b) => {
        const orderDiff = (layerMap.get(a.capa_id)?.orden || 0) - (layerMap.get(b.capa_id)?.orden || 0)
        return orderDiff !== 0 ? orderDiff : (a.z_index || 0) - (b.z_index || 0)
      })
  }, [objects, layers, layerMap])

  const layerStats = useMemo(() => {
    const counts = new Map()
    objects.forEach(item => counts.set(item.capa_id, (counts.get(item.capa_id) || 0) + 1))
    return counts
  }, [objects])

  const filteredLibrary = useMemo(() => {
    const q = librarySearch.trim().toLowerCase()
    return OBJECT_LIBRARY.filter(item => {
      if (libraryCategory !== 'todos' && item.category !== libraryCategory) return false
      if (!q) return true
      return `${item.label} ${item.category}`.toLowerCase().includes(q)
    })
  }, [libraryCategory, librarySearch])

  const objectList = useMemo(() => {
    return [...visibleObjects].sort((a, b) => (b.z_index || 0) - (a.z_index || 0))
  }, [visibleObjects])

  const resetCreateForm = () => {
    setCreateForm(DEFAULT_CREATE_FORM)
  }

  const normalizePlan = useCallback((response) => ({
    id: response.id,
    nombre: response.nombre,
    sucursal_id: response.sucursal_id || '',
    sucursal_nombre: response.sucursal_nombre || '',
    piso: response.piso || '',
    descripcion: response.descripcion || '',
    ancho: response.ancho || 1800,
    alto: response.alto || 1100,
    grid_size: response.grid_size || 24,
    config: {
      showGrid: true,
      backgroundOpacity: 0.9,
      backgroundImage: '',
      backgroundScale: 1,
      backgroundX: 0,
      backgroundY: 0,
      ...(response.config || {}),
    },
  }), [])

  const loadPlan = useCallback(async (planId) => {
    if (!planId) return
    try {
      const response = await planoOficinaAPI.getById(planId)
      setPlan(normalizePlan(response))
      setLayers((response.layers || []).length ? response.layers : LAYER_PRESETS.map(buildDefaultLayer))
      setObjects(response.objetos || [])
      setSelectedObjectId('')
      setDirty(false)
      setZoom(0.9)
    } catch (err) {
      showError(err?.message || 'No se pudo cargar el plano seleccionado')
    }
  }, [normalizePlan, showError])

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
      showError(err?.message || 'No se pudo cargar el modulo de planos de oficina')
    } finally {
      setLoading(false)
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
      const current = interactionRef.current
      if (!current || !plan) return

      const target = objects.find(item => item.id === current.id)
      if (!target) return

      const dx = (event.clientX - current.startX) / current.zoom
      const dy = (event.clientY - current.startY) / current.zoom

      setObjects(prev => prev.map(item => {
        if (item.id !== current.id) return item
        if (current.mode === 'move') {
          return {
            ...item,
            x: toNumber(current.origin.x + dx, item.x, 0, Math.max(0, plan.ancho - item.ancho)),
            y: toNumber(current.origin.y + dy, item.y, 0, Math.max(0, plan.alto - item.alto)),
          }
        }
        if (current.mode === 'resize') {
          return {
            ...item,
            ancho: toNumber(current.origin.ancho + dx, item.ancho, 16, 4200),
            alto: toNumber(current.origin.alto + dy, item.alto, 16, 4200),
          }
        }
        if (current.mode === 'rotate') {
          const rect = canvasRef.current?.getBoundingClientRect()
          if (!rect) return item
          const centerX = rect.left + (current.origin.x + current.origin.ancho / 2) * current.zoom
          const centerY = rect.top + (current.origin.y + current.origin.alto / 2) * current.zoom
          const angle = Math.atan2(event.clientY - centerY, event.clientX - centerX)
          const nextRotation = current.origin.rotacion + ((angle - current.startAngle) * 180) / Math.PI
          return { ...item, rotacion: Math.round(nextRotation) }
        }
        return item
      }))
      setDirty(true)
    }

    function onUp() {
      interactionRef.current = null
      document.body.style.userSelect = ''
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [objects, plan])

  const openCreatePlan = () => {
    resetCreateForm()
    setCreateOpen(true)
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
        backgroundOpacity: 0.9,
        backgroundImage: '',
        backgroundScale: 1,
        backgroundX: 0,
        backgroundY: 0,
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

  const addLayer = () => {
    if (!editable) return
    const nextIndex = layers.length + 1
    const preset = LAYER_PRESETS[nextIndex % LAYER_PRESETS.length]
    const layer = {
      id: uid(),
      clave: `capa_${nextIndex}`,
      nombre: `Nueva capa ${nextIndex}`,
      color: preset.color,
      icono: preset.icono,
      visible: true,
      bloqueada: false,
      editable: true,
      orden: nextIndex * 10,
    }
    setLayers(prev => [...prev, layer])
    setDirty(true)
  }

  const moveLayer = (layerId, direction) => {
    const index = layers.findIndex(layer => layer.id === layerId)
    const targetIndex = index + direction
    if (index < 0 || targetIndex < 0 || targetIndex >= layers.length) return
    const next = [...layers]
    const [current] = next.splice(index, 1)
    next.splice(targetIndex, 0, current)
    setLayers(next.map((layer, idx) => ({ ...layer, orden: (idx + 1) * 10 })))
    setDirty(true)
  }

  const updateLayer = (layerId, patch) => {
    setLayers(prev => prev.map(layer => layer.id === layerId ? { ...layer, ...patch } : layer))
    setDirty(true)
  }

  const removeLayer = (layerId) => {
    const usingObjects = objects.some(item => item.capa_id === layerId)
    if (usingObjects) {
      showInfo('Primero mueve o elimina los objetos de la capa para poder archivarla.')
      return
    }
    setLayers(prev => prev.filter(layer => layer.id !== layerId))
    setDirty(true)
  }

  const addObject = (type) => {
    if (!editable || !plan) return
    const preset = getPreset(type)
    const targetLayer = layers.find(layer => layer.clave === preset.layerKey) || layers[0]
    if (!targetLayer) return

    const item = {
      id: uid(),
      tipo: type,
      nombre: preset.label,
      capa_id: targetLayer.id,
      capa_clave: targetLayer.clave,
      x: 80 + ((objects.length * 28) % 280),
      y: 80 + ((objects.length * 22) % 220),
      ancho: preset.width,
      alto: preset.height,
      rotacion: 0,
      color: preset.color,
      z_index: objects.length + 1,
      vinculo_tipo: '',
      vinculo_id: '',
      vinculo_nombre: '',
      metadata: {},
    }
    setObjects(prev => [...prev, item])
    setSelectedObjectId(item.id)
    setDirty(true)
  }

  const duplicateSelected = () => {
    if (!editable || !selectedObject || !plan) return
    const clone = {
      ...selectedObject,
      id: uid(),
      x: toNumber(selectedObject.x + 28, 28, 0, Math.max(0, plan.ancho - selectedObject.ancho)),
      y: toNumber(selectedObject.y + 28, 28, 0, Math.max(0, plan.alto - selectedObject.alto)),
      z_index: objects.length + 1,
      metadata: cloneValue(selectedObject.metadata),
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

  const bringSelectedForward = () => {
    if (!editable || !selectedObject) return
    setObjects(prev => prev.map(item => item.id === selectedObject.id ? { ...item, z_index: (item.z_index || 0) + 1 } : item))
    setDirty(true)
  }

  const sendSelectedBackward = () => {
    if (!editable || !selectedObject) return
    setObjects(prev => prev.map(item => item.id === selectedObject.id ? { ...item, z_index: Math.max(0, (item.z_index || 0) - 1) } : item))
    setDirty(true)
  }

  const beginInteraction = (event, item, mode) => {
    if (!editable || exporting) return
    const layer = layerMap.get(item.capa_id)
    if (!layer || layer.bloqueada) return
    event.preventDefault()
    event.stopPropagation()
    document.body.style.userSelect = 'none'

    const rect = canvasRef.current?.getBoundingClientRect()
    const centerX = rect ? rect.left + (item.x + item.ancho / 2) * zoom : 0
    const centerY = rect ? rect.top + (item.y + item.alto / 2) * zoom : 0

    interactionRef.current = {
      id: item.id,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      origin: {
        x: item.x,
        y: item.y,
        ancho: item.ancho,
        alto: item.alto,
        rotacion: item.rotacion || 0,
      },
      startAngle: Math.atan2(event.clientY - centerY, event.clientX - centerX),
      zoom,
    }
    setSelectedObjectId(item.id)
  }

  const createPlan = async () => {
    if (!createForm.nombre.trim()) {
      showInfo('Indica el nombre del plano para continuar.')
      return
    }
    try {
      const response = await planoOficinaAPI.create({
        ...createForm,
        ancho: toNumber(createForm.ancho, 1800, 600, 5000),
        alto: toNumber(createForm.alto, 1100, 400, 4000),
        grid_size: toNumber(createForm.grid_size, 24, 8, 120),
      })
      setCreateOpen(false)
      setPlans(prev => [response, ...prev])
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
        ancho: toNumber(plan.ancho, 1800, 600, 5000),
        alto: toNumber(plan.alto, 1100, 400, 4000),
        grid_size: toNumber(plan.grid_size, 24, 8, 120),
        layers,
        objetos: objects,
      })
      setPlan(normalizePlan(response))
      setLayers(response.layers || [])
      setObjects(response.objetos || [])
      setDirty(false)
      setPlans(prev => prev.map(item => item.id === response.id ? {
        ...item,
        nombre: response.nombre,
        sucursal_nombre: response.sucursal_nombre,
        piso: response.piso,
        updated_at: new Date().toISOString(),
        total_objetos: (response.objetos || []).length,
      } : item))
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
      showSuccess('Plano archivado correctamente.')
      const currentId = plan.id
      const nextPlans = plans.filter(item => item.id !== currentId)
      setPlans(nextPlans)
      if (nextPlans.length) setSelectedPlanId(nextPlans[0].id)
      else {
        setSelectedPlanId('')
        setPlan(null)
        setLayers([])
        setObjects([])
      }
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

  const zoomIn = () => setZoom(prev => toNumber(prev + 0.1, prev, 0.4, 2.4))
  const zoomOut = () => setZoom(prev => toNumber(prev - 0.1, prev, 0.4, 2.4))
  const resetView = () => setZoom(0.9)

  const exportCanvas = async (format) => {
    if (!plan || !exportRef.current) return
    setExporting(true)
    try {
      await new Promise(resolve => requestAnimationFrame(resolve))
      const canvas = await html2canvas(exportRef.current, {
        backgroundColor: '#f8fafc',
        scale: 2,
        useCORS: true,
        logging: false,
      })
      const imageData = canvas.toDataURL('image/jpeg', 0.96)

      if (format === 'jpg') {
        const link = document.createElement('a')
        link.href = imageData
        link.download = `${plan.nombre.replace(/[\\\\/:*?\"<>|]/g, '_') || 'plano'}.jpg`
        link.click()
      } else {
        const pdf = new jsPDF({
          orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
          unit: 'px',
          format: [canvas.width, canvas.height],
        })
        pdf.addImage(imageData, 'JPEG', 0, 0, canvas.width, canvas.height)
        pdf.save(`${plan.nombre.replace(/[\\\\/:*?\"<>|]/g, '_') || 'plano'}.pdf`)
      }
      showSuccess(`Plano exportado en ${format.toUpperCase()}.`)
    } catch (err) {
      showError(err?.message || `No se pudo exportar el plano a ${format.toUpperCase()}`)
    } finally {
      setExporting(false)
    }
  }

  const stageStyle = useMemo(() => {
    if (!plan) return {}
    const grid = toNumber(plan.grid_size, 24, 8, 120)
    const showGrid = plan.config?.showGrid !== false
    const bg = showGrid
      ? `
        linear-gradient(to right, rgba(148,163,184,0.12) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(148,163,184,0.12) 1px, transparent 1px),
        radial-gradient(circle at top left, rgba(219,234,254,0.48), transparent 36%),
        linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)
      `
      : 'radial-gradient(circle at top left, rgba(219,234,254,0.48), transparent 36%), linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)'
    const size = showGrid ? `${grid}px ${grid}px, ${grid}px ${grid}px, 100% 100%, 100% 100%` : '100% 100%, 100% 100%'
    return {
      width: `${plan.ancho}px`,
      height: `${plan.alto}px`,
      backgroundImage: bg,
      backgroundSize: size,
      borderRadius: '28px',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9), 0 18px 40px rgba(148,163,184,0.12)',
      transform: `scale(${zoom})`,
      transformOrigin: 'top left',
    }
  }, [plan, zoom])

  const backgroundImageStyle = useMemo(() => {
    if (!plan?.config?.backgroundImage) return null
    return {
      opacity: toNumber(plan.config.backgroundOpacity, 0.9, 0.15, 1),
      transform: `translate(${toNumber(plan.config.backgroundX, 0, -3000, 3000)}px, ${toNumber(plan.config.backgroundY, 0, -3000, 3000)}px) scale(${toNumber(plan.config.backgroundScale, 1, 0.1, 4)})`,
      transformOrigin: 'center',
    }
  }, [plan])

  if (loading) {
    return (
      <div className="flex min-h-[72vh] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-300 border-t-slate-900" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Planos de Oficina"
        subtitle="Disena espacios mas reales, trabaja por capas y exporta el plano final para operacion o soporte."
      >
        <div className="flex flex-wrap items-center gap-2">
          {editable && (
            <button className="btn-secondary" onClick={openCreatePlan}>
              <PlusIcon className="h-4 w-4" />
              Nuevo plano
            </button>
          )}
          <button className="btn-secondary" onClick={() => exportCanvas('jpg')} disabled={!plan || exporting}>
            <PhotoIcon className="h-4 w-4" />
            JPG
          </button>
          <button className="btn-secondary" onClick={() => exportCanvas('pdf')} disabled={!plan || exporting}>
            <DocumentArrowDownIcon className="h-4 w-4" />
            PDF
          </button>
          {editable && (
            <button className="btn-primary" onClick={savePlan} disabled={!plan || saving || !dirty}>
              {saving ? 'Guardando...' : dirty ? 'Guardar cambios' : 'Sin cambios'}
            </button>
          )}
        </div>
      </PageHeader>

      {!plan ? (
        <SurfaceCard className="p-10 text-center">
          <div className="mx-auto max-w-xl">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[28px] bg-gradient-to-br from-slate-900 via-slate-800 to-blue-700 text-white shadow-[0_18px_32px_rgba(15,23,42,0.16)]">
              <BuildingOffice2Icon className="h-10 w-10" />
            </div>
            <h2 className="mt-5 text-2xl font-semibold text-slate-900">Todavia no hay planos activos</h2>
            <p className="mt-2 text-sm text-slate-500">Crea un plano nuevo para empezar a organizar estaciones, dispositivos, red y personal dentro de la oficina.</p>
            {editable && (
              <button className="btn-primary mt-6" onClick={openCreatePlan}>
                <PlusIcon className="h-4 w-4" />
                Crear primer plano
              </button>
            )}
          </div>
        </SurfaceCard>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)_400px]">
          <div className="space-y-5">
            <SurfaceCard className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Planos</p>
                  <h2 className="mt-1 text-xl font-semibold text-slate-900">{plans.length} disponibles</h2>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setLeftTab('planos')}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${leftTab === 'planos' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}
                  >
                    Planos
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeftTab('capas')}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${leftTab === 'capas' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}
                  >
                    Capas
                  </button>
                </div>
              </div>

              {leftTab === 'planos' ? (
                <div className="mt-4 space-y-3">
                  {plans.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedPlanId(item.id)}
                      className={`w-full rounded-[24px] border px-4 py-4 text-left transition ${
                        selectedPlanId === item.id
                          ? 'border-blue-200 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-800 text-white shadow-[0_20px_40px_rgba(15,23,42,0.18)]'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">{item.nombre}</div>
                          <div className={`mt-1 truncate text-xs ${selectedPlanId === item.id ? 'text-slate-300' : 'text-slate-500'}`}>
                            {item.sucursal_nombre || 'Sin sucursal ligada'} - {item.piso || 'Sin piso'}
                          </div>
                        </div>
                        <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${selectedPlanId === item.id ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-500'}`}>
                          {item.total_objetos || 0}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Visibilidad y orden</p>
                    {editable && (
                      <button className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50" onClick={addLayer}>
                        Nueva capa
                      </button>
                    )}
                  </div>
                  <div className="space-y-3">
                    {layers.map((layer, index) => (
                      <div key={layer.id} className="rounded-[24px] border border-slate-200 bg-white p-3 shadow-sm">
                        <div className="flex items-start gap-3">
                          <span className="mt-1 flex h-10 w-10 items-center justify-center rounded-2xl text-white shadow-sm" style={{ backgroundColor: layer.color }}>
                            {renderMiniIcon(layer.icono)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <input
                              className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none"
                              value={layer.nombre}
                              onChange={event => updateLayer(layer.id, { nombre: event.target.value })}
                              disabled={!editable}
                            />
                            <div className="mt-1 text-xs text-slate-500">{layerStats.get(layer.id) || 0} objeto(s)</div>
                          </div>
                          <input
                            type="color"
                            value={layer.color}
                            onChange={event => updateLayer(layer.id, { color: event.target.value })}
                            disabled={!editable}
                            className="h-9 w-9 rounded-xl border border-slate-200 bg-white p-1"
                          />
                        </div>

                        <div className="mt-3 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => updateLayer(layer.id, { visible: !layer.visible })}
                            className={`flex h-9 w-9 items-center justify-center rounded-2xl border transition ${layer.visible ? 'border-slate-200 bg-white text-slate-600' : 'border-slate-200 bg-slate-100 text-slate-400'}`}
                          >
                            {layer.visible ? <EyeIcon className="h-4 w-4" /> : <EyeSlashIcon className="h-4 w-4" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => updateLayer(layer.id, { bloqueada: !layer.bloqueada })}
                            className={`flex h-9 w-9 items-center justify-center rounded-2xl border transition ${layer.bloqueada ? 'border-slate-300 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600'}`}
                          >
                            {layer.bloqueada ? <LockClosedIcon className="h-4 w-4" /> : <LockOpenIcon className="h-4 w-4" />}
                          </button>
                          <button type="button" onClick={() => moveLayer(layer.id, -1)} className="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50" disabled={!editable || index === 0}>Subir</button>
                          <button type="button" onClick={() => moveLayer(layer.id, 1)} className="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50" disabled={!editable || index === layers.length - 1}>Bajar</button>
                          {editable && (
                            <button type="button" onClick={() => removeLayer(layer.id)} className="ml-auto flex h-9 w-9 items-center justify-center rounded-2xl border border-red-100 text-red-500 transition hover:bg-red-50">
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </SurfaceCard>
          </div>

          <div className="space-y-5">
            <SurfaceCard className="p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <div className="inline-flex rounded-full bg-slate-950 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white">Plano activo</div>
                  <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{plan.nombre}</h2>
                  <p className="mt-1 text-sm text-slate-500">{plan.sucursal_nombre || 'Sin sucursal ligada'} - {plan.piso || 'Sin piso definido'}</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
                  {layers.map(layer => (
                    <LayerBadge key={layer.id} layer={layer} count={layerStats.get(layer.id) || 0} />
                  ))}
                </div>
              </div>
            </SurfaceCard>

            <SurfaceCard className="overflow-hidden">
              <div className="flex flex-col gap-4 border-b border-slate-200/80 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-2xl font-semibold text-slate-950">Studio del plano</h3>
                  <p className="mt-1 text-sm text-slate-500">Arrastra, redimensiona y rota objetos para construir un plano mas natural y presentable.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">{plan.ancho} x {plan.alto}px</span>
                  <span className="rounded-full bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700">Reticula {plan.grid_size}px</span>
                  <span className="rounded-full bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">Zoom {Math.round(zoom * 100)}%</span>
                  <button type="button" onClick={zoomOut} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50">
                    <MinusIcon className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={zoomIn} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50">
                    <PlusIcon className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={resetView} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50">
                    <ArrowsPointingInIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div ref={viewportRef} className="overflow-auto p-5">
                <div
                  className="relative rounded-[34px] border border-slate-200 bg-slate-100/80 p-5"
                  style={{ minHeight: `${Math.max(460, plan.alto * zoom + 40)}px` }}
                >
                  <div
                    ref={exportRef}
                    className="relative rounded-[28px] bg-white"
                    style={{
                      width: `${plan.ancho * zoom}px`,
                      height: `${plan.alto * zoom}px`,
                    }}
                  >
                    <div
                      ref={canvasRef}
                      className="relative overflow-hidden"
                      style={stageStyle}
                      onClick={() => setSelectedObjectId('')}
                    >
                      {backgroundImageStyle && (
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden rounded-[28px]">
                          <img
                            src={plan.config.backgroundImage}
                            alt="Plano base"
                            className="max-h-full max-w-full object-contain"
                            style={backgroundImageStyle}
                          />
                        </div>
                      )}

                      {visibleObjects.map(item => {
                        const isSelected = selectedObjectId === item.id
                        const layer = layerMap.get(item.capa_id)
                        return (
                          <div
                            key={item.id}
                            className={`absolute ${layer?.bloqueada ? 'cursor-not-allowed' : 'cursor-move'}`}
                            style={{
                              left: `${item.x}px`,
                              top: `${item.y}px`,
                              width: `${item.ancho}px`,
                              height: `${item.alto}px`,
                              transform: `rotate(${item.rotacion || 0}deg)`,
                              transformOrigin: 'center center',
                              zIndex: item.z_index || 0,
                            }}
                            onMouseDown={event => beginInteraction(event, item, 'move')}
                            onClick={event => {
                              event.stopPropagation()
                              setSelectedObjectId(item.id)
                            }}
                          >
                            <div className="relative h-full w-full rounded-[24px] border border-white/70 bg-white/72 shadow-[0_18px_28px_rgba(15,23,42,0.12)] backdrop-blur-sm">
                              <ObjectArtwork item={item} />

                              {!exporting && isSelected && (
                                <>
                                  <div className="pointer-events-none absolute inset-0 rounded-[24px] border-2 border-blue-500 shadow-[0_0_0_4px_rgba(59,130,246,0.15)]" />
                                  <button
                                    type="button"
                                    onMouseDown={event => beginInteraction(event, item, 'rotate')}
                                    className="absolute left-1/2 top-0 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-blue-200 bg-white text-blue-600 shadow-lg"
                                    title="Rotar"
                                  >
                                    <ArrowPathIcon className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onMouseDown={event => beginInteraction(event, item, 'resize')}
                                    className="absolute bottom-0 right-0 flex h-7 w-7 translate-x-1/3 translate-y-1/3 items-center justify-center rounded-full border border-blue-200 bg-white text-blue-600 shadow-lg"
                                    title="Redimensionar"
                                  >
                                    <ArrowsPointingOutIcon className="h-4 w-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </SurfaceCard>
          </div>

          <div className="space-y-5">
            <SurfaceCard className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Biblioteca</p>
                  <h3 className="mt-1 text-xl font-semibold text-slate-950">Objetos del plano</h3>
                  <p className="mt-1 text-sm text-slate-500">Selecciona un estilo, agregalo al lienzo y despues ajusta giro, tamano y vinculos.</p>
                </div>
                <ViewColumnsIcon className="h-5 w-5 text-slate-300" />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {CATEGORY_OPTIONS.map(option => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setLibraryCategory(option.key)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${libraryCategory === option.key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="mt-4">
                <input
                  className="input"
                  placeholder="Buscar objeto..."
                  value={librarySearch}
                  onChange={event => setLibrarySearch(event.target.value)}
                />
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 2xl:grid-cols-2">
                {filteredLibrary.map(item => (
                  <LibraryCard key={item.type} item={item} onAdd={addObject} />
                ))}
              </div>
            </SurfaceCard>

            <SurfaceCard className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Inspector</p>
                  <h3 className="mt-1 text-xl font-semibold text-slate-950">{selectedObject ? 'Objeto seleccionado' : 'Plano y elementos'}</h3>
                </div>
                {selectedObject && (
                  <div className="flex gap-2">
                    <button type="button" onClick={duplicateSelected} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50" title="Duplicar">
                      <DocumentDuplicateIcon className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={removeSelectedObject} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-red-100 bg-white text-red-500 transition hover:bg-red-50" title="Eliminar">
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              {selectedObject ? (
                <div className="mt-4 space-y-5">
                  <ObjectCard selected item={selectedObject} onSelect={() => {}} />

                  <div className="flex gap-2">
                    <button type="button" onClick={sendSelectedBackward} className="flex-1 rounded-2xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">Atras</button>
                    <button type="button" onClick={bringSelectedForward} className="flex-1 rounded-2xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">Adelante</button>
                  </div>

                  <div className="grid gap-3">
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Nombre</span>
                      <input className="input" value={selectedObject.nombre || ''} onChange={event => updateSelectedObject({ nombre: event.target.value })} disabled={!editable} />
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                      <label className="block">
                        <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">X</span>
                        <input type="number" className="input" value={Math.round(selectedObject.x)} onChange={event => updateSelectedObject({ x: toNumber(event.target.value, selectedObject.x, 0, Math.max(0, plan.ancho - selectedObject.ancho)) })} disabled={!editable} />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Y</span>
                        <input type="number" className="input" value={Math.round(selectedObject.y)} onChange={event => updateSelectedObject({ y: toNumber(event.target.value, selectedObject.y, 0, Math.max(0, plan.alto - selectedObject.alto)) })} disabled={!editable} />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Ancho</span>
                        <input type="number" className="input" value={Math.round(selectedObject.ancho)} onChange={event => updateSelectedObject({ ancho: toNumber(event.target.value, selectedObject.ancho, 16, 4000) })} disabled={!editable} />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Alto</span>
                        <input type="number" className="input" value={Math.round(selectedObject.alto)} onChange={event => updateSelectedObject({ alto: toNumber(event.target.value, selectedObject.alto, 16, 4000) })} disabled={!editable} />
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
                        <input type="number" className="input" value={Math.round(selectedObject.rotacion || 0)} onChange={event => updateSelectedObject({ rotacion: toNumber(event.target.value, selectedObject.rotacion || 0, -360, 360) })} disabled={!editable} />
                      </label>
                    </div>

                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Color</span>
                      <input type="color" className="input h-11 p-1" value={selectedObject.color || getPreset(selectedObject.tipo).color} onChange={event => updateSelectedObject({ color: event.target.value })} disabled={!editable} />
                    </label>

                    {selectedObject.tipo === 'usuario' && (
                      <label className="block">
                        <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Empleado vinculado</span>
                        <select className="input" value={selectedObject.vinculo_tipo === 'empleado' ? selectedObject.vinculo_id : ''} onChange={event => linkEmployee(event.target.value)} disabled={!editable}>
                          <option value="">Sin vincular</option>
                          {empleados.map(item => (
                            <option key={item.id} value={item.id}>{item.nombre_completo}</option>
                          ))}
                        </select>
                      </label>
                    )}

                    {DEVICE_LINKABLE_TYPES.has(resolveVisualType(selectedObject)) && (
                      <label className="block">
                        <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Dispositivo vinculado</span>
                        <select className="input" value={selectedObject.vinculo_tipo === 'dispositivo' ? selectedObject.vinculo_id : ''} onChange={event => linkDevice(event.target.value)} disabled={!editable}>
                          <option value="">Sin vincular</option>
                          {dispositivos.map(item => (
                            <option key={item.id} value={item.id}>
                              {item.tipo} - {item.marca}{item.modelo ? ` - ${item.modelo}` : ''}{item.serie ? ` (${item.serie})` : ''}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}

                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Notas</span>
                      <textarea className="input min-h-[92px]" value={selectedObject.metadata?.nota || ''} onChange={event => updateSelectedObject({ metadata: { ...(selectedObject.metadata || {}), nota: event.target.value } })} disabled={!editable} />
                    </label>
                  </div>
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  <div className="rounded-[26px] border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center text-sm text-slate-500">
                    Selecciona un objeto del plano para editar su posicion, giro, estilo y vinculaciones.
                  </div>

                  <div className="space-y-3">
                    <div className="grid gap-3">
                      <label className="block">
                        <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Nombre del plano</span>
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
                          <input type="number" className="input" value={plan.grid_size} onChange={event => updatePlanField('grid_size', toNumber(event.target.value, plan.grid_size, 8, 120))} disabled={!editable} />
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="block">
                          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Ancho</span>
                          <input type="number" className="input" value={plan.ancho} onChange={event => updatePlanField('ancho', toNumber(event.target.value, plan.ancho, 600, 5000))} disabled={!editable} />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Alto</span>
                          <input type="number" className="input" value={plan.alto} onChange={event => updatePlanField('alto', toNumber(event.target.value, plan.alto, 400, 4000))} disabled={!editable} />
                        </label>
                      </div>
                      <label className="block">
                        <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Descripcion</span>
                        <textarea className="input min-h-[88px]" value={plan.descripcion || ''} onChange={event => updatePlanField('descripcion', event.target.value)} disabled={!editable} />
                      </label>
                    </div>

                    <div className="rounded-[24px] border border-slate-200 bg-slate-50/90 p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-500 shadow-sm">
                          <PhotoIcon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">Plano base</p>
                          <p className="mt-1 text-xs leading-5 text-slate-500">Carga la imagen real del layout y ajusta opacidad, escala y posicion para dibujar encima con mas precision.</p>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3">
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

                        <label className="block">
                          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Opacidad</span>
                          <input type="range" min="0.15" max="1" step="0.05" className="w-full" value={toNumber(plan.config?.backgroundOpacity, 0.9, 0.15, 1)} onChange={event => updatePlanConfig({ backgroundOpacity: toNumber(event.target.value, 0.9, 0.15, 1) })} disabled={!editable} />
                        </label>

                        <label className="block">
                          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Escala</span>
                          <input type="range" min="0.3" max="2.5" step="0.05" className="w-full" value={toNumber(plan.config?.backgroundScale, 1, 0.3, 2.5)} onChange={event => updatePlanConfig({ backgroundScale: toNumber(event.target.value, 1, 0.3, 2.5) })} disabled={!editable} />
                        </label>

                        <div className="grid grid-cols-2 gap-3">
                          <label className="block">
                            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Offset X</span>
                            <input type="number" className="input" value={Math.round(toNumber(plan.config?.backgroundX, 0, -3000, 3000))} onChange={event => updatePlanConfig({ backgroundX: toNumber(event.target.value, 0, -3000, 3000) })} disabled={!editable} />
                          </label>
                          <label className="block">
                            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Offset Y</span>
                            <input type="number" className="input" value={Math.round(toNumber(plan.config?.backgroundY, 0, -3000, 3000))} onChange={event => updatePlanConfig({ backgroundY: toNumber(event.target.value, 0, -3000, 3000) })} disabled={!editable} />
                          </label>
                        </div>

                        <button
                          type="button"
                          onClick={() => updatePlanConfig({ showGrid: !(plan.config?.showGrid !== false) })}
                          className={`rounded-2xl border px-3 py-2.5 text-xs font-semibold transition ${plan.config?.showGrid !== false ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600'}`}
                          disabled={!editable}
                        >
                          {plan.config?.showGrid !== false ? 'Ocultar reticula' : 'Mostrar reticula'}
                        </button>

                        {plan.config?.backgroundImage && (
                          <button type="button" className="rounded-2xl border border-red-100 bg-white px-3 py-2.5 text-xs font-semibold text-red-600 transition hover:bg-red-50" onClick={() => updatePlanConfig({ backgroundImage: '' })} disabled={!editable}>
                            Quitar imagen base
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-5 border-t border-slate-200 pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Objetos en escena</p>
                    <p className="mt-1 text-sm text-slate-500">{objectList.length} visibles en el lienzo</p>
                  </div>
                  <ChevronDownIcon className="h-4 w-4 text-slate-300" />
                </div>
                <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
                  {objectList.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-5 text-center text-sm text-slate-400">
                      Todavia no hay objetos visibles en el plano.
                    </div>
                  ) : objectList.map(item => (
                    <ObjectCard key={item.id} item={item} selected={selectedObjectId === item.id} onSelect={setSelectedObjectId} />
                  ))}
                </div>
              </div>

              {editable && (
                <button className="btn-danger mt-5 w-full justify-center" onClick={() => setDeleteOpen(true)}>
                  <TrashIcon className="h-4 w-4" />
                  Archivar plano
                </button>
              )}
            </SurfaceCard>
          </div>
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nuevo plano de oficina" size="lg">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block md:col-span-2">
            <span className="mb-1 block text-sm font-medium text-slate-700">Nombre del plano</span>
            <input className="input" value={createForm.nombre} onChange={event => setCreateForm(prev => ({ ...prev, nombre: event.target.value }))} placeholder="Corporativo CDMX - Piso 11" />
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
            <input className="input" value={createForm.piso} onChange={event => setCreateForm(prev => ({ ...prev, piso: event.target.value }))} placeholder="Piso 11" />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Ancho</span>
            <input type="number" className="input" value={createForm.ancho} onChange={event => setCreateForm(prev => ({ ...prev, ancho: toNumber(event.target.value, prev.ancho, 600, 5000) }))} />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Alto</span>
            <input type="number" className="input" value={createForm.alto} onChange={event => setCreateForm(prev => ({ ...prev, alto: toNumber(event.target.value, prev.alto, 400, 4000) }))} />
          </label>

          <label className="block md:col-span-2">
            <span className="mb-1 block text-sm font-medium text-slate-700">Descripcion</span>
            <textarea className="input min-h-[110px]" value={createForm.descripcion} onChange={event => setCreateForm(prev => ({ ...prev, descripcion: event.target.value }))} placeholder="Describe el piso, el area y el objetivo del plano." />
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
