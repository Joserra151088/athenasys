import { useState, useEffect, useCallback, useRef } from 'react'
import { deviceAPI, proveedorAPI, catalogosAPI } from '../utils/api'
import { DEVICE_TYPES, DEVICE_STATUS, LOCATION_TYPES, DEVICE_DAILY_RATES } from '../utils/constants'
import { useAuth } from '../context/AuthContext'
import { useNotification } from '../context/NotificationContext'
import PageHeader from '../components/PageHeader'
import Badge from '../components/Badge'
import Modal from '../components/Modal'
import Pagination from '../components/Pagination'
import ConfirmDialog from '../components/ConfirmDialog'
import {
  PlusIcon, MagnifyingGlassIcon, PencilIcon, TrashIcon,
  CurrencyDollarIcon, CubeIcon, TagIcon, AdjustmentsHorizontalIcon, XMarkIcon
} from '@heroicons/react/24/outline'

const SERIE_OPTIONS = {
  normal: 'capturada',
  sin_numero: 'sin_numero',
  no_visible: 'no_visible',
}
const SPECIAL_SERIAL_LABEL = {
  [SERIE_OPTIONS.sin_numero]: 'Sin número de serie',
  [SERIE_OPTIONS.no_visible]: 'Serie no visible',
}

// Tipos sin costo mensual (pertenecen a la empresa)
const TIPOS_SIN_COSTO = ['Mouse', 'Teclado', 'TP-Link', 'Biométrico']
// Tipos con costo único (no mensual)
const TIPOS_COSTO_UNICO = ['Cámara Web', 'Diadema']

// Configuración de campos extra por tipo de dispositivo
const CAMPOS_POR_TIPO = {
  'Laptop': [
    { key: 'procesador',    label: 'Procesador',              type: 'text',   placeholder: 'Intel Core i7-1165G7, AMD Ryzen 5...' },
    { key: 'ram',           label: 'Memoria RAM',             type: 'text',   placeholder: '8 GB, 16 GB, 32 GB...' },
    { key: 'sistema_op',    label: 'Sistema operativo',       type: 'text',   placeholder: 'Windows 11 Pro, macOS Ventura...' },
    { key: 'pantalla',      label: 'Tamaño de pantalla',      type: 'text',   placeholder: '14", 15.6", 13.3"...' },
    { key: 'tipo_disco',    label: 'Tipo de almacenamiento',  type: 'select', options: ['SSD', 'HDD', 'NVMe'] },
    { key: 'almacenamiento',label: 'Capacidad de almacenamiento', type: 'text', placeholder: '256 GB, 512 GB, 1 TB...' },
  ],
  'CPU': [
    { key: 'procesador',    label: 'Procesador',        type: 'text', placeholder: 'Intel Core i5-10400, AMD Ryzen 7...' },
    { key: 'ram',           label: 'Memoria RAM',       type: 'text', placeholder: '8 GB, 16 GB...' },
    { key: 'sistema_op',    label: 'Sistema operativo', type: 'text', placeholder: 'Windows 10 Pro, Windows 11...' },
  ],
  'Monitor': [
    { key: 'pantalla',      label: 'Tamaño de pantalla', type: 'text', placeholder: '24", 27", 32"...' },
  ],
  'Tablet': [
    { key: 'procesador',     label: 'Procesador',                  type: 'text', placeholder: 'Apple M1, Snapdragon 865...' },
    { key: 'ram',            label: 'Memoria RAM',                 type: 'text', placeholder: '4 GB, 8 GB...' },
    { key: 'almacenamiento', label: 'Capacidad de almacenamiento', type: 'text', placeholder: '64 GB, 128 GB...' },
    { key: 'sistema_op',     label: 'Sistema operativo',           type: 'text', placeholder: 'iPadOS 16, Android 13...' },
  ],
  'Módem de Internet_Telmex': [
    { key: 'paquete',        label: 'Nombre del paquete contratado', type: 'text', placeholder: 'Infinitum 300 MB...' },
    { key: 'telefono',       label: 'Número de teléfono',            type: 'text', placeholder: '55 1234 5678' },
    { key: 'ancho_banda',    label: 'Ancho de banda contratado',     type: 'text', placeholder: '300 Mbps, 500 Mbps...' },
  ],
  'Módem de Internet_Telcel': [
    { key: 'plan',           label: 'Nombre del plan contratado', type: 'text', placeholder: 'Plan Plus 50 GB...' },
    { key: 'imei',           label: 'IMEI',                       type: 'text', placeholder: '123456789012345' },
    { key: 'sim',            label: 'SIM',                        type: 'text', placeholder: '8952140...' },
    { key: 'telefono',       label: 'Número de teléfono',         type: 'text', placeholder: '55 1234 5678' },
  ],
}

const PROVEEDORES_SIN_COSTO = ['opentec']
const EMPTY_FORM = { tipo: '', marca: '', serie: '', serie_mode: SERIE_OPTIONS.normal, modelo: '', cantidad: 1, proveedor_id: '', caracteristicas: '', costo_dia: '', campos_extra: {}, costo_tipo: 'mensual' }

function isProveedorSinCosto(nombre = '') {
  return PROVEEDORES_SIN_COSTO.some(proveedor => (nombre || '').toLowerCase().includes(proveedor))
}

function resolveCostoValor(costo, fallback = 0) {
  if (costo === 0 || costo === '0') return 0
  if (costo === null || costo === undefined || costo === '') return fallback

  const parsed = parseFloat(costo)
  return Number.isFinite(parsed) ? parsed : fallback
}

function getSpecialSerieMode(serie = '', serieEstado = '') {
  if (serieEstado === SERIE_OPTIONS.sin_numero || serieEstado === SERIE_OPTIONS.no_visible) return serieEstado
  if (!serie) return SERIE_OPTIONS.normal
  const normalized = serie.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
  if (normalized.startsWith('SIN NUMERO DE SERIE ::')) return SERIE_OPTIONS.sin_numero
  if (normalized.startsWith('SERIE NO VISIBLE ::')) return SERIE_OPTIONS.no_visible
  return SERIE_OPTIONS.normal
}

function getSerieBadgeLabel(dispositivo) {
  const mode = getSpecialSerieMode(dispositivo?.serie || '', dispositivo?.serie_estado || '')
  return mode === SERIE_OPTIONS.normal ? '' : SPECIAL_SERIAL_LABEL[mode]
}

function normalizeCamposExtra(camposExtra) {
  if (!camposExtra) return {}
  if (typeof camposExtra === 'string') {
    try {
      const parsed = JSON.parse(camposExtra)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
    } catch (_) {
      return {}
    }
  }
  if (typeof camposExtra === 'object' && !Array.isArray(camposExtra)) return camposExtra
  return {}
}

function formatCampoLabel(key = '') {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase())
}

function formatCamposExtra(camposExtra) {
  return Object.entries(normalizeCamposExtra(camposExtra))
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '')
    .map(([key, value]) => `${formatCampoLabel(key)}: ${value}`)
}

function formatDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

// Muestra costo con estilo según tipo de tarifa
function CostoBadge({ tipo, costo, proveedorNombre }) {
  const rate = DEVICE_DAILY_RATES[tipo]
  const proveedorSinCosto = isProveedorSinCosto(proveedorNombre)
  const costoMostrado = proveedorSinCosto ? 0 : resolveCostoValor(costo, rate?.costo ?? 0)
  if (!rate) return <span className="text-gray-400 text-xs">—</span>

  if (proveedorSinCosto) return (
    <div className="flex flex-col items-end">
      <span className="text-slate-700 font-medium text-sm">
        $0.00
        <span className="text-xs font-normal text-gray-400">/dia</span>
      </span>
      <span className="text-xs text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded mt-0.5">Propio</span>
    </div>
  )

  if (rate.tipo === 'paquete') return (
    <div className="flex flex-col">
      <span className="text-emerald-700 font-semibold text-sm">
        ${costoMostrado.toFixed(2)}
        <span className="text-xs font-normal text-gray-400">/dia</span>
      </span>
      <span className="text-xs text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded mt-0.5 inline-flex items-center gap-0.5">
        <CubeIcon className="h-3 w-3" /> Paquete
      </span>
    </div>
  )
  if (rate.tipo === 'incluido') return (
    <div className="flex flex-col">
      <span className="text-gray-400 text-sm">$0.00<span className="text-xs">/dia</span></span>
      <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded mt-0.5">En CPU</span>
    </div>
  )
  if (rate.tipo === 'accesorio') return (
    <div className="flex flex-col">
      <span className="text-gray-400 text-sm">$0.00<span className="text-xs">/dia</span></span>
      <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded mt-0.5">Accesorio</span>
    </div>
  )
  if (costoMostrado === 0) return (
    <div className="flex flex-col items-end">
      <span className="text-slate-700 font-medium text-sm">
        $0.00
        <span className="text-xs font-normal text-gray-400">/dia</span>
      </span>
      <span className="text-xs text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded mt-0.5">Sin renta</span>
    </div>
  )
  return (
    <span className="text-gray-700 font-medium text-sm">
      ${costoMostrado.toFixed(2)}
      <span className="text-xs font-normal text-gray-400">/dia</span>
    </span>
  )
}

// Previsualización del costo en el formulario
function CostoPreview({ tipo, costo, proveedorNombre }) {
  if (!tipo && !proveedorNombre) return null
  const rate = DEVICE_DAILY_RATES[tipo]
  const proveedorSinCosto = isProveedorSinCosto(proveedorNombre)
  if (!rate && !proveedorSinCosto) return null

  const colorMap = {
    paquete:   'bg-emerald-50 border-emerald-200 text-emerald-800',
    unitario:  'bg-blue-50   border-blue-200   text-blue-800',
    incluido:  'bg-amber-50  border-amber-200  text-amber-800',
    accesorio: 'bg-gray-50   border-gray-200   text-gray-600',
  }

  if (proveedorSinCosto) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border text-xs bg-blue-50 border-blue-200 text-blue-800">
        <CurrencyDollarIcon className="h-4 w-4 flex-shrink-0" />
        <div>
          <span className="font-semibold">$0.00 MXN/dia</span>
          {' - '}
          <span className="opacity-80">Equipo adquirido por la empresa con proveedor Opentec</span>
        </div>
      </div>
    )
  }

  const costoMostrado = resolveCostoValor(costo, rate.costo)

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${colorMap[rate.tipo]}`}>
      <CurrencyDollarIcon className="h-4 w-4 flex-shrink-0" />
      <div>
        <span className="font-semibold">
          {costoMostrado > 0 ? `$${costoMostrado.toFixed(2)} MXN/dia` : 'Sin costo de renta'}
        </span>
        {' — '}
        <span className="opacity-80">{rate.nota}</span>
      </div>
    </div>
  )
}

export default function Dispositivos() {
  const { canEdit, isAdmin } = useAuth()
  const { showError } = useNotification()
  const [dispositivos, setDispositivos] = useState([])
  const [proveedores, setProveedores] = useState([])
  const [tiposDispositivo, setTiposDispositivo] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 20 })
  const [search, setSearch] = useState('')
  const [filterTipo, setFilterTipo] = useState('')
  const [filterEstado, setFilterEstado] = useState('')
  const [filterUbicacion, setFilterUbicacion] = useState('')
  const [filterProveedor, setFilterProveedor] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState(null)

  // Sorting
  const [sortCol, setSortCol] = useState('')
  const [sortDir, setSortDir] = useState('asc')

  // Column visibility
  const [visibleCols, setVisibleCols] = useState({
    tipo: true, marca_modelo: true, serie: true, proveedor: true,
    caracteristicas: true, costo: true, estado: true, ubicacion: true,
    created_at: true, updated_at: true, actualizado_por: true
  })
  const [colsMenuOpen, setColsMenuOpen] = useState(false)
  const colsMenuRef = useRef(null)

  // Column resize
  const [colWidths, setColWidths] = useState({})
  const resizingRef = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (colsMenuRef.current && !colsMenuRef.current.contains(e.target)) setColsMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const startResize = (colKey, e) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = e.currentTarget.parentElement.offsetWidth
    resizingRef.current = { colKey, startX, startWidth }

    const onMove = (ev) => {
      if (!resizingRef.current) return
      const diff = ev.clientX - resizingRef.current.startX
      const newWidth = Math.max(60, resizingRef.current.startWidth + diff)
      setColWidths(w => ({ ...w, [resizingRef.current.colKey]: newWidth }))
    }
    const onUp = () => {
      resizingRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const clearFilters = () => {
    setSearch('')
    setFilterTipo('')
    setFilterEstado('')
    setFilterUbicacion('')
    setFilterProveedor('')
  }

  const hasActiveFilters = search || filterTipo || filterEstado || filterUbicacion || filterProveedor

  const load = useCallback((page = 1) => {
    setLoading(true)
    const params = { page, limit: 20 }
    if (search) params.search = search
    if (filterTipo) params.tipo = filterTipo
    if (filterEstado) params.estado = filterEstado
    if (filterUbicacion) params.ubicacion_tipo = filterUbicacion
    if (filterProveedor) params.proveedor_id = filterProveedor
    deviceAPI.getAll(params).then(d => {
      setDispositivos(d.data)
      setPagination({ page: d.page, pages: d.pages, total: d.total, limit: d.limit })
    }).finally(() => setLoading(false))
  }, [search, filterTipo, filterEstado, filterUbicacion, filterProveedor])

  useEffect(() => { load(1) }, [load])
  useEffect(() => {
    proveedorAPI.getAll().then(setProveedores)
    catalogosAPI.tiposDispositivo.getAll().then(r => setTiposDispositivo(r.map(t => t.nombre || t.valor || t)))
  }, [])

  const proveedorSeleccionado = proveedores.find(p => p.id === form.proveedor_id)
  const proveedorSeleccionadoNombre = proveedorSeleccionado?.nombre || ''
  const proveedorSeleccionadoSinCosto = isProveedorSinCosto(proveedorSeleccionadoNombre)

  useEffect(() => {
    if (!proveedorSeleccionadoSinCosto) return
    if (form.costo_dia === 0 || form.costo_dia === '0') return
    setForm(prev => ({ ...prev, costo_dia: 0 }))
  }, [form.costo_dia, proveedorSeleccionadoSinCosto])

  // Client-side sorting
  const sorted = [...dispositivos].sort((a, b) => {
    if (!sortCol) return 0
    let va = '', vb = ''
    if (sortCol === 'tipo') { va = (a.tipo || '').toLowerCase(); vb = (b.tipo || '').toLowerCase() }
    else if (sortCol === 'marca') { va = (a.marca || '').toLowerCase(); vb = (b.marca || '').toLowerCase() }
    else if (sortCol === 'serie') { va = (a.serie || '').toLowerCase(); vb = (b.serie || '').toLowerCase() }
    else if (sortCol === 'estado') { va = (a.estado || '').toLowerCase(); vb = (b.estado || '').toLowerCase() }
    else if (sortCol === 'ubicacion') { va = (a.ubicacion_tipo || '').toLowerCase(); vb = (b.ubicacion_tipo || '').toLowerCase() }
    else if (sortCol === 'created_at' || sortCol === 'updated_at') {
      va = new Date(a[sortCol] || 0).getTime()
      vb = new Date(b[sortCol] || 0).getTime()
      return sortDir === 'asc' ? va - vb : vb - va
    }
    else if (sortCol === 'actualizado_por') {
      va = (a.actualizado_por_nombre || a.creado_por_nombre || '').toLowerCase()
      vb = (b.actualizado_por_nombre || b.creado_por_nombre || '').toLowerCase()
    }
    return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
  })

  // Detecta qué campos extra mostrar según tipo y proveedor (para módem)
  const getCamposExtra = () => {
    if (!form.tipo) return []
    if (form.tipo === 'Módem de Internet') {
      const prov = proveedores.find(p => p.id === form.proveedor_id)
      const nombre = (prov?.nombre || '').toLowerCase()
      if (nombre.includes('telmex')) return CAMPOS_POR_TIPO['Módem de Internet_Telmex'] || []
      if (nombre.includes('telcel')) return CAMPOS_POR_TIPO['Módem de Internet_Telcel'] || []
      return []
    }
    return CAMPOS_POR_TIPO[form.tipo] || []
  }

  // Determina costo_tipo según el tipo de dispositivo seleccionado
  const getCostoTipo = (tipo) => {
    if (TIPOS_SIN_COSTO.includes(tipo)) return 'sin_costo'
    if (TIPOS_COSTO_UNICO.includes(tipo)) return 'unico'
    return 'mensual'
  }

  const handleTipoChange = (tipo) => {
    const costo_tipo = getCostoTipo(tipo)
    const costo_dia = (costo_tipo === 'sin_costo' || proveedorSeleccionadoSinCosto) ? 0 : ''
    setForm(f => ({ ...f, tipo, campos_extra: {}, costo_tipo, costo_dia }))
  }

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setModal(true) }
  const openEdit = (d) => {
    const serieMode = getSpecialSerieMode(d.serie || '', d.serie_estado || '')
    setEditing(d)
    setForm({
      tipo: d.tipo, marca: d.marca, serie: serieMode === SERIE_OPTIONS.normal ? (d.serie || '') : '', serie_mode: serieMode, modelo: d.modelo || '',
      cantidad: d.cantidad || 1, proveedor_id: d.proveedor_id || '',
      caracteristicas: d.caracteristicas || '',
      costo_dia: d.costo_dia !== undefined ? d.costo_dia : '',
      campos_extra: normalizeCamposExtra(d.campos_extra),
      costo_tipo: d.costo_tipo || 'mensual'
    })
    setModal(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = { ...form }
      payload.serie_estado = payload.serie_mode
      if (payload.serie_mode === SERIE_OPTIONS.normal) {
        payload.serie = payload.serie.trim()
      } else {
        payload.serie = ''
      }
      payload.cantidad = 1
      delete payload.serie_mode

      if (editing) await deviceAPI.update(editing.id, payload)
      else await deviceAPI.create(payload)
      setModal(false)
      load(1)
    } catch (err) {
      showError(err?.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await deviceAPI.delete(id)
      load(pagination.page)
    } catch (err) {
      showError(err?.message || 'No se puede eliminar')
    }
  }

  const colLabels = {
    tipo: 'Tipo',
    marca_modelo: 'Marca / Modelo',
    serie: 'Serie',
    proveedor: 'Proveedor',
    caracteristicas: 'Características',
    costo: 'Costo/dia',
    estado: 'Estado',
    ubicacion: 'Ubicación',
    created_at: 'Fecha de creación',
    updated_at: 'Fecha de modificación',
    actualizado_por: 'Usuario última mod.',
  }

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return <span className="text-gray-300 ml-1">⇅</span>
    return <span className="text-blue-500 ml-1">{sortDir === 'asc' ? '▲' : '▼'}</span>
  }

  const ResizeHandle = ({ colKey }) => (
    <div
      className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400 opacity-0 hover:opacity-100 transition-opacity"
      onMouseDown={(e) => startResize(colKey, e)}
    />
  )

  const visibleColumnCount = Object.values(visibleCols).filter(Boolean).length + (canEdit() ? 1 : 0)

  return (
    <div className="space-y-5">
      <PageHeader title="Dispositivos" subtitle="Inventario completo de equipos y periféricos">
        {canEdit() && (
          <button className="btn-primary" onClick={openCreate}>
            <PlusIcon className="h-4 w-4" /> Agregar Dispositivo
          </button>
        )}
      </PageHeader>

      {/* Leyenda de tarifas */}
      <div className="flex flex-wrap gap-2 text-xs">
        <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1.5 rounded-lg">
          <CubeIcon className="h-3.5 w-3.5" />
          <span><strong>Paquete CPU</strong> — Monitor + Teclado + Mouse incluidos ($85/dia)</span>
        </div>
        <div className="flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1.5 rounded-lg">
          <TagIcon className="h-3.5 w-3.5" />
          <span><strong>Unitario</strong> — Costo independiente por dispositivo</span>
        </div>
        <div className="flex items-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1.5 rounded-lg">
          <span><strong>En CPU</strong> — Monitor, Teclado y Mouse: $0 (van con el CPU)</span>
        </div>
      </div>

      {/* Barra de filtros */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-wrap gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text" className="input pl-9"
              placeholder="Buscar por serie, marca, modelo, proveedor, características u observaciones..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Filtro Tipo */}
          <select className="input w-44" value={filterTipo} onChange={e => setFilterTipo(e.target.value)}>
            <option value="">Todos los tipos</option>
            {(tiposDispositivo.length > 0 ? tiposDispositivo : DEVICE_TYPES).map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          {/* Filtro Estado */}
          <select className="input w-44" value={filterEstado} onChange={e => setFilterEstado(e.target.value)}>
            <option value="">Todos los estados</option>
            <option value="stock">En Stock</option>
            <option value="activo">Activo</option>
            <option value="en_reparacion">En Reparación</option>
            <option value="pendiente">Pendiente firma</option>
          </select>

          {/* Filtro Ubicación */}
          <select className="input w-44" value={filterUbicacion} onChange={e => setFilterUbicacion(e.target.value)}>
            <option value="">Todas las ubicaciones</option>
            <option value="almacen">Almacén</option>
            <option value="sucursal">Sucursal</option>
            <option value="empleado">Empleado</option>
          </select>

          {/* Filtro Proveedor */}
          <select className="input w-48" value={filterProveedor} onChange={e => setFilterProveedor(e.target.value)}>
            <option value="">Todos los proveedores</option>
            {proveedores.map(p => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>

          {/* Toggle columnas */}
          <div ref={colsMenuRef} className="relative">
            <button className="btn-secondary" onClick={() => setColsMenuOpen(o => !o)}>
              <AdjustmentsHorizontalIcon className="h-4 w-4" /> Columnas
            </button>
            {colsMenuOpen && (
              <div className="absolute right-0 mt-1 z-50 max-h-80 min-w-56 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-xl p-2">
                {Object.entries(colLabels).map(([k, label]) => (
                  <label key={k} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded-lg cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={visibleCols[k]}
                      onChange={() => setVisibleCols(v => ({ ...v, [k]: !v[k] }))}
                      className="rounded"
                    />
                    {label}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Limpiar filtros */}
          {hasActiveFilters && (
            <button
              className="btn-secondary text-xs py-1.5 text-red-500 border-red-200 hover:bg-red-50"
              onClick={clearFilters}
            >
              <XMarkIcon className="h-4 w-4" /> Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Tabla */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1500px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {visibleCols.tipo && (
                  <th
                    className="table-header cursor-pointer select-none hover:bg-gray-100 transition-colors"
                    style={{ width: colWidths['tipo'] || 'auto', position: 'relative' }}
                    onClick={() => handleSort('tipo')}
                  >
                    <div className="flex items-center gap-1">
                      Tipo <SortIcon col="tipo" />
                    </div>
                    <ResizeHandle colKey="tipo" />
                  </th>
                )}
                {visibleCols.marca_modelo && (
                  <th
                    className="table-header cursor-pointer select-none hover:bg-gray-100 transition-colors"
                    style={{ width: colWidths['marca_modelo'] || 'auto', position: 'relative' }}
                    onClick={() => handleSort('marca')}
                  >
                    <div className="flex items-center gap-1">
                      Marca / Modelo <SortIcon col="marca" />
                    </div>
                    <ResizeHandle colKey="marca_modelo" />
                  </th>
                )}
                {visibleCols.serie && (
                  <th
                    className="table-header cursor-pointer select-none hover:bg-gray-100 transition-colors"
                    style={{ width: colWidths['serie'] || 'auto', position: 'relative' }}
                    onClick={() => handleSort('serie')}
                  >
                    <div className="flex items-center gap-1">
                      Serie <SortIcon col="serie" />
                    </div>
                    <ResizeHandle colKey="serie" />
                  </th>
                )}
                {visibleCols.proveedor && (
                  <th
                    className="table-header"
                    style={{ width: colWidths['proveedor'] || 'auto', position: 'relative' }}
                  >
                    Proveedor
                    <ResizeHandle colKey="proveedor" />
                  </th>
                )}
                {visibleCols.caracteristicas && (
                  <th
                    className="table-header"
                    style={{ width: colWidths['caracteristicas'] || 'auto', position: 'relative' }}
                  >
                    Características
                    <ResizeHandle colKey="caracteristicas" />
                  </th>
                )}
                {visibleCols.costo && (
                  <th
                    className="table-header text-right"
                    style={{ width: colWidths['costo'] || 'auto', position: 'relative' }}
                  >
                    Costo/dia
                    <ResizeHandle colKey="costo" />
                  </th>
                )}
                {visibleCols.estado && (
                  <th
                    className="table-header cursor-pointer select-none hover:bg-gray-100 transition-colors"
                    style={{ width: colWidths['estado'] || 'auto', position: 'relative' }}
                    onClick={() => handleSort('estado')}
                  >
                    <div className="flex items-center gap-1">
                      Estado <SortIcon col="estado" />
                    </div>
                    <ResizeHandle colKey="estado" />
                  </th>
                )}
                {visibleCols.ubicacion && (
                  <th
                    className="table-header cursor-pointer select-none hover:bg-gray-100 transition-colors"
                    style={{ width: colWidths['ubicacion'] || 'auto', position: 'relative' }}
                    onClick={() => handleSort('ubicacion')}
                  >
                    <div className="flex items-center gap-1">
                      Ubicación <SortIcon col="ubicacion" />
                    </div>
                    <ResizeHandle colKey="ubicacion" />
                  </th>
                )}
                {visibleCols.created_at && (
                  <th
                    className="table-header cursor-pointer select-none hover:bg-gray-100 transition-colors"
                    style={{ width: colWidths['created_at'] || 'auto', position: 'relative' }}
                    onClick={() => handleSort('created_at')}
                  >
                    <div className="flex items-center gap-1">
                      Fecha creación <SortIcon col="created_at" />
                    </div>
                    <ResizeHandle colKey="created_at" />
                  </th>
                )}
                {visibleCols.updated_at && (
                  <th
                    className="table-header cursor-pointer select-none hover:bg-gray-100 transition-colors"
                    style={{ width: colWidths['updated_at'] || 'auto', position: 'relative' }}
                    onClick={() => handleSort('updated_at')}
                  >
                    <div className="flex items-center gap-1">
                      Fecha modificación <SortIcon col="updated_at" />
                    </div>
                    <ResizeHandle colKey="updated_at" />
                  </th>
                )}
                {visibleCols.actualizado_por && (
                  <th
                    className="table-header cursor-pointer select-none hover:bg-gray-100 transition-colors"
                    style={{ width: colWidths['actualizado_por'] || 'auto', position: 'relative' }}
                    onClick={() => handleSort('actualizado_por')}
                  >
                    <div className="flex items-center gap-1">
                      Última modificación <SortIcon col="actualizado_por" />
                    </div>
                    <ResizeHandle colKey="actualizado_por" />
                  </th>
                )}
                {canEdit() && (
                  <th className="table-header" style={{ position: 'relative' }}>
                    Acciones
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={visibleColumnCount} className="py-12 text-center">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-4 border-primary-600 border-t-transparent" />
                </td></tr>
              ) : sorted.length === 0 ? (
                <tr><td colSpan={visibleColumnCount} className="py-12 text-center text-gray-400">No se encontraron dispositivos</td></tr>
              ) : sorted.map(d => {
                const camposExtra = formatCamposExtra(d.campos_extra)
                const ultimoUsuario = d.actualizado_por_nombre || d.creado_por_nombre || 'Sistema'
                const esSoloCreacion = !d.actualizado_por_nombre
                return (
                <tr key={d.id} className="hover:bg-gray-50">
                  {visibleCols.tipo && <td className="table-cell font-medium">{d.tipo}</td>}
                  {visibleCols.marca_modelo && (
                    <td className="table-cell">
                      <div className="font-medium">{d.marca}</div>
                      <div className="text-xs text-gray-400">{d.modelo}</div>
                    </td>
                  )}
                  {visibleCols.serie && (
                    <td className="table-cell font-mono text-xs text-gray-600">
                      <span>{d.serie || '—'}</span>
                      {getSerieBadgeLabel(d) && (
                        <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 font-sans text-[10px] font-semibold text-slate-500">
                          {getSerieBadgeLabel(d)}
                        </span>
                      )}
                    </td>
                  )}
                  {visibleCols.proveedor && <td className="table-cell text-sm">{d.proveedor_nombre || '—'}</td>}
                  {visibleCols.caracteristicas && (
                    <td className="table-cell max-w-48">
                      {d.caracteristicas || camposExtra.length > 0 ? (
                        <div className="space-y-1 text-xs text-gray-500">
                          {d.caracteristicas && (
                            <p className="line-clamp-2" title={d.caracteristicas}>{d.caracteristicas}</p>
                          )}
                          {camposExtra.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {camposExtra.slice(0, 4).map(campo => (
                                <span key={campo} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
                                  {campo}
                                </span>
                              ))}
                              {camposExtra.length > 4 && (
                                <span className="rounded-md bg-slate-50 px-1.5 py-0.5 text-[11px] text-slate-400">
                                  +{camposExtra.length - 4}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  )}
                  {visibleCols.costo && (
                    <td className="table-cell text-right">
                      <CostoBadge tipo={d.tipo} costo={d.costo_dia} proveedorNombre={d.proveedor_nombre} />
                    </td>
                  )}
                  {visibleCols.estado && (
                    <td className="table-cell">
                      <Badge {...(DEVICE_STATUS[d.estado] || { label: d.estado, color: 'bg-gray-100 text-gray-600' })} />
                    </td>
                  )}
                  {visibleCols.ubicacion && (
                    <td className="table-cell">
                      <Badge {...(LOCATION_TYPES[d.ubicacion_tipo] || { label: d.ubicacion_tipo, color: 'bg-gray-100 text-gray-600' })} />
                      <div className="mt-0.5 max-w-[220px] whitespace-normal break-words text-xs leading-4 text-gray-400">
                        {d.ubicacion_nombre}
                      </div>
                    </td>
                  )}
                  {visibleCols.created_at && (
                    <td className="table-cell whitespace-nowrap text-xs text-gray-500">
                      {formatDateTime(d.created_at)}
                    </td>
                  )}
                  {visibleCols.updated_at && (
                    <td className="table-cell whitespace-nowrap text-xs text-gray-500">
                      {formatDateTime(d.updated_at)}
                    </td>
                  )}
                  {visibleCols.actualizado_por && (
                    <td className="table-cell min-w-44">
                      <div className="max-w-[220px] truncate text-sm font-medium text-gray-700" title={ultimoUsuario}>
                        {ultimoUsuario}
                      </div>
                      {esSoloCreacion && (
                        <div className="text-xs text-gray-400">Registro inicial</div>
                      )}
                    </td>
                  )}
                  {canEdit() && (
                    <td className="table-cell">
                      <div className="flex gap-1 items-center">
                        <button onClick={() => openEdit(d)} className="p-1.5 rounded text-gray-400 hover:text-primary-600 hover:bg-primary-50" title="Editar dispositivo">
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        {isAdmin() && (
                          <button onClick={() => setDeleteId(d.id)} className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50" title="Eliminar">
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      {d.actualizado_por_nombre && (
                        <div className="text-xs text-gray-400 mt-0.5 max-w-28 truncate" title={`Actualizado por ${d.actualizado_por_nombre}`}>
                          ✏️ {d.actualizado_por_nombre}
                        </div>
                      )}
                    </td>
                  )}
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <Pagination {...pagination} onPageChange={load} />
      </div>

      {/* Modal crear/editar */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Editar Dispositivo' : 'Agregar Dispositivo'} size="lg">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Tipo de dispositivo *</label>
              <select className="input" required value={form.tipo}
                onChange={e => handleTipoChange(e.target.value)}>
                <option value="">Seleccionar...</option>
                {(tiposDispositivo.length > 0 ? tiposDispositivo : DEVICE_TYPES).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Marca *</label>
              <input className="input" required placeholder="Dell, HP, Logitech..."
                value={form.marca} onChange={e => setForm(f => ({ ...f, marca: e.target.value }))} />
            </div>

            <div>
              <label className="label">
                Número de serie {form.serie_mode === SERIE_OPTIONS.normal ? '*' : ''}
              </label>
              <select
                className="input mb-2"
                value={form.serie_mode}
                onChange={e => setForm(f => ({ ...f, serie_mode: e.target.value, serie: e.target.value === SERIE_OPTIONS.normal ? f.serie : '' }))}
              >
                <option value={SERIE_OPTIONS.normal}>Capturar número de serie</option>
                <option value={SERIE_OPTIONS.sin_numero}>Sin número de serie</option>
                <option value={SERIE_OPTIONS.no_visible}>Serie no visible</option>
              </select>
              <input
                className={`input ${form.serie_mode !== SERIE_OPTIONS.normal ? 'bg-gray-50 text-gray-400' : ''}`}
                required={form.serie_mode === SERIE_OPTIONS.normal}
                disabled={form.serie_mode !== SERIE_OPTIONS.normal}
                placeholder={form.serie_mode === SERIE_OPTIONS.normal ? 'SN-XXXXXXXX' : SPECIAL_SERIAL_LABEL[form.serie_mode]}
                value={form.serie}
                onChange={e => setForm(f => ({ ...f, serie: e.target.value }))}
              />
              {form.serie_mode !== SERIE_OPTIONS.normal && (
                <p className="mt-1 text-xs text-gray-500">
                  El sistema generará un consecutivo único para control de inventario y mantendrá la nota <strong>{SPECIAL_SERIAL_LABEL[form.serie_mode]}</strong>.
                </p>
              )}
            </div>
            <div>
              <label className="label">Modelo</label>
              <input className="input" placeholder="OptiPlex 7090, EliteBook 840..."
                value={form.modelo} onChange={e => setForm(f => ({ ...f, modelo: e.target.value }))} />
            </div>

            <div className="col-span-2">
              <label className="label">Proveedor</label>
              <select className="input" value={form.proveedor_id}
                onChange={e => {
                  const proveedorId = e.target.value
                  const proveedor = proveedores.find(p => p.id === proveedorId)
                  const proveedorSinCosto = isProveedorSinCosto(proveedor?.nombre || '')
                  setForm(f => ({
                    ...f,
                    proveedor_id: proveedorId,
                    costo_dia: proveedorSinCosto ? 0 : f.costo_dia
                  }))
                }}>
                <option value="">Sin proveedor</option>
                {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>

            {/* ── Campos específicos por tipo de dispositivo ── */}
            {getCamposExtra().length > 0 && (
              <div className="col-span-2 space-y-3 bg-blue-50 border border-blue-100 rounded-xl p-4">
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
                  Especificaciones — {form.tipo}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {getCamposExtra().map(campo => (
                    <div key={campo.key} className={campo.type === 'select' ? '' : ''}>
                      <label className="label">{campo.label}</label>
                      {campo.type === 'select' ? (
                        <select className="input" value={form.campos_extra[campo.key] || ''}
                          onChange={e => setForm(f => ({ ...f, campos_extra: { ...f.campos_extra, [campo.key]: e.target.value } }))}>
                          <option value="">Seleccionar...</option>
                          {campo.options.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : (
                        <input className="input" type="text" placeholder={campo.placeholder}
                          value={form.campos_extra[campo.key] || ''}
                          onChange={e => setForm(f => ({ ...f, campos_extra: { ...f.campos_extra, [campo.key]: e.target.value } }))} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Aviso para módem sin proveedor Telmex/Telcel seleccionado */}
            {form.tipo === 'Módem de Internet' && getCamposExtra().length === 0 && form.proveedor_id && (
              <div className="col-span-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                El proveedor seleccionado no es Telmex ni Telcel. Solo se guardarán los campos generales.
              </div>
            )}
            {form.tipo === 'Módem de Internet' && !form.proveedor_id && (
              <div className="col-span-2 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                Selecciona el proveedor (Telmex o Telcel) para ver los campos específicos del módem.
              </div>
            )}

            <div className="col-span-2">
              <label className="label">Observaciones generales</label>
              <textarea className="input" rows={2} placeholder="Notas adicionales..."
                value={form.caracteristicas}
                onChange={e => setForm(f => ({ ...f, caracteristicas: e.target.value }))} />
            </div>

            {/* ── Costo según tipo ── */}
            {(form.costo_tipo === 'sin_costo' || proveedorSeleccionadoSinCosto) ? (
              <div className="col-span-2 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-500">
                <span className="text-lg">🏢</span>
                <span>{proveedorSeleccionadoSinCosto ? <>Los equipos del proveedor <strong>Opentec</strong> se registran con <strong>costo $0</strong> porque ya son propiedad de la empresa.</> : <>Este dispositivo <strong>no tiene costo mensual</strong> - pertenece a la empresa.</>}</span>
              </div>
            ) : (
              <>
                <div>
                  <label className="label">
                    {form.costo_tipo === 'unico' ? 'Costo único (MXN)' : 'Costo de renta / día (MXN)'}
                  </label>
                  {form.costo_tipo === 'unico' && (
                    <p className="text-xs text-blue-600 mb-1">Este costo es único, no afecta los cálculos mensuales.</p>
                  )}
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                    <input type="number" min="0" step="0.01" className="input pl-7"
                      placeholder="0.00"
                      value={form.costo_dia === 0 || form.costo_dia === '0' ? '0' : (form.costo_dia || '')}
                      onChange={e => {
                        const val = e.target.value
                        setForm(f => ({ ...f, costo_dia: val === '' ? '' : parseFloat(val) }))
                      }} />
                  </div>
                  {form.costo_tipo === 'mensual' && (
                    <button type="button"
                      onClick={() => setForm(f => ({ ...f, costo_dia: 0 }))}
                      className="text-xs text-gray-400 hover:text-emerald-600 mt-1 underline">
                      Sin costo (establecer en $0)
                    </button>
                  )}
                  {form.tipo && DEVICE_DAILY_RATES[form.tipo] && (
                    <p className="text-xs text-gray-400 mt-1">{DEVICE_DAILY_RATES[form.tipo].nota}</p>
                  )}
                </div>
                <div className="flex items-end pb-1">
                  {((form.tipo && DEVICE_DAILY_RATES[form.tipo]) || proveedorSeleccionadoSinCosto) && (
                    <CostoPreview tipo={form.tipo} costo={form.costo_dia} proveedorNombre={proveedorSeleccionadoNombre} />
                  )}
                </div>
              </>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Agregar dispositivo'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => handleDelete(deleteId)}
        title="Eliminar dispositivo"
        message="¿Estás seguro de que deseas eliminar este dispositivo? Esta acción no se puede deshacer."
      />
    </div>
  )
}

