import { useState, useCallback, useEffect, useRef } from 'react'
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie
} from 'recharts'
import jsPDF from 'jspdf'
import {
  reportesAPI, empleadoAPI, sucursalAPI, centroCostoAPI,
  catalogosAPI, configAPI
} from '../utils/api'
import { useNotification } from '../context/NotificationContext'
import { DEVICE_TYPES } from '../utils/constants'
import {
  ComputerDesktopIcon, ArrowsRightLeftIcon, KeyIcon, CurrencyDollarIcon,
  UserIcon, BuildingOffice2Icon, MapPinIcon, TableCellsIcon,
  DocumentArrowDownIcon, ArrowPathIcon, ChevronLeftIcon, ChevronRightIcon,
  DocumentTextIcon, PrinterIcon, XMarkIcon, FunnelIcon, ChartBarIcon,
  ArrowTrendingUpIcon, ArrowTrendingDownIcon, CheckBadgeIcon,
  BanknotesIcon, DevicePhoneMobileIcon, GlobeAltIcon,
} from '@heroicons/react/24/outline'

// ─────────────────────────────────────────────────────────────────────────────
// Constants & helpers
// ─────────────────────────────────────────────────────────────────────────────
const HOY        = new Date().toISOString().slice(0, 10)
const INICIO_MES = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
const INICIO_ANO = new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10)
const PAGE_SIZE  = 10

const normalize = (str) =>
  (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

const fmt = (n) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN',
    minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n || 0)

const fmtDec = (n) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN',
    minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0)

const COLOR_CATS    = { 'Equipo': '#6366f1', 'Licencia': '#8b5cf6', 'Servicio TI': '#f59e0b', 'Usuario': '#10b981', 'Servicio': '#6366f1' }
const TIPO_COLORS   = { Usuario: '#10b981', Servicio: '#6366f1' }
const PALETTE    = ['#6366f1','#8b5cf6','#06b6d4','#10b981','#f59e0b','#f97316','#ef4444','#ec4899']

const TABS = [
  { id: 'gastos',       label: 'Gastos TI',    icon: CurrencyDollarIcon,  accent: '#f59e0b', bg: 'from-amber-600 to-orange-600' },
  { id: 'inventario',   label: 'Inventario',   icon: ComputerDesktopIcon, accent: '#6366f1', bg: 'from-indigo-600 to-violet-600' },
  { id: 'asignaciones', label: 'Asignaciones', icon: ArrowsRightLeftIcon,  accent: '#10b981', bg: 'from-emerald-600 to-teal-600' },
  { id: 'licencias',    label: 'Licencias',    icon: KeyIcon,             accent: '#8b5cf6', bg: 'from-violet-600 to-purple-600' },
]

const ENTITY_MODES = [
  { id: 'ninguno',  label: 'General',      icon: ChartBarIcon },
  { id: 'empleado', label: 'Por Empleado', icon: UserIcon },
  { id: 'area',     label: 'Por Área',     icon: MapPinIcon },
  { id: 'cc',       label: 'Por CC',       icon: TableCellsIcon },
  { id: 'sucursal', label: 'Por Sucursal', icon: BuildingOffice2Icon },
]

function exportCSV(data, filename) {
  if (!data?.length) return
  const cols = Object.keys(data[0]).filter(k => !k.startsWith('_'))
  const rows = [cols.join(','), ...data.map(row =>
    cols.map(c => { const v = row[c] ?? ''
      return typeof v === 'string' && (v.includes(',') || v.includes('"'))
        ? `"${v.replace(/"/g, '""')}"` : v }).join(','))]
  const blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF Generator — jsPDF native text (no screenshot)
// ─────────────────────────────────────────────────────────────────────────────
async function generatePDF({ data, meta, historico, filters, logo, headerConfig }) {
  const doc       = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pw        = doc.internal.pageSize.getWidth()   // 297
  const ph        = doc.internal.pageSize.getHeight()  // 210
  const margin    = 14
  const empresa   = headerConfig?.empresa  || 'Previta'
  const subtitulo = headerConfig?.subtitulo || 'Área de Tecnologías de la Información'
  const colorHex  = headerConfig?.color    || '#1e3a5f'

  const hexToRgb = h => {
    const r = parseInt(h.slice(1,3),16), g = parseInt(h.slice(3,5),16), b = parseInt(h.slice(5,7),16)
    return [r, g, b]
  }
  const [hr, hg, hb] = hexToRgb(colorHex)

  // ── Header band ─────────────────────────────────────────────────────────────
  doc.setFillColor(hr, hg, hb)
  doc.rect(0, 0, pw, 26, 'F')

  // Logo
  if (logo) {
    try { doc.addImage(logo, 'PNG', margin, 4, 30, 18, '', 'FAST') } catch (_) {}
  }

  // Company name
  doc.setTextColor(255,255,255)
  doc.setFont('helvetica','bold'); doc.setFontSize(14)
  doc.text(empresa, logo ? margin + 34 : margin, 12)
  doc.setFont('helvetica','normal'); doc.setFontSize(8)
  doc.setTextColor(200,210,220)
  doc.text(subtitulo, logo ? margin + 34 : margin, 18)

  // Report title top-right
  const modo = filters._modo || 'ninguno'
  const modeLabel = { ninguno:'Reporte General', empleado:'Por Empleado',
    area:'Por Área', cc:'Por Centro de Costo', sucursal:'Por Sucursal' }[modo]
  doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(255,255,255)
  doc.text(meta?.titulo || 'Reporte', pw - margin, 10, { align:'right' })
  doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(190,205,220)
  doc.text(modeLabel, pw - margin, 16, { align:'right' })

  let y = 34

  // ── Entity / period bar ─────────────────────────────────────────────────────
  doc.setFillColor(245,247,250); doc.roundedRect(margin, y-4, pw - margin*2, 12, 2, 2, 'F')
  doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(80,90,110)
  const entityLabel = {
    ninguno:  'Todos los registros',
    empleado: `Empleado: ${filters.empleado_nombre || '—'}`,
    area:     `Área: ${filters.area || '—'}`,
    cc:       `Centro de Costo: ${filters.centro_costo_codigo || '—'} ${filters.centro_costo_nombre ? '— '+filters.centro_costo_nombre : ''}`,
    sucursal: `Sucursal: ${filters.sucursal_nombre || '—'}`,
  }[modo]
  doc.text(`Entidad: ${entityLabel}`, margin + 4, y + 3)
  doc.text(`Período: ${filters.fecha_inicio || '—'} al ${filters.fecha_fin || '—'}`, pw/2, y + 3, { align:'center' })
  doc.text(`Generado: ${meta?.generado || HOY}`, pw - margin - 4, y + 3, { align:'right' })
  y += 14

  // ── KPI cards (gastos only) ─────────────────────────────────────────────────
  if (meta?.total_mxn !== undefined && data?.length) {
    const tipoMap = {}
    data.forEach(d => { tipoMap[d.tipo || 'Servicio'] = (tipoMap[d.tipo || 'Servicio'] || 0) + (d.total_mxn || 0) })
    const promedio = data.length > 0 ? meta.total_mxn / data.length : 0
    const kpis = [
      { label:'Total Gastos TI',     value: fmtDec(meta.total_mxn),           color:[99,102,241]  },
      { label:'Gastos de Usuario',   value: fmtDec(tipoMap['Usuario']||0),    color:[16,185,129]  },
      { label:'Gastos de Servicio',  value: fmtDec(tipoMap['Servicio']||0),   color:[99,102,241]  },
      { label:'Promedio / registro', value: fmtDec(promedio),                 color:[245,158,11]  },
      { label:'Registros',           value: String(data.length),              color:[100,116,139] },
    ]
    const cardW = (pw - margin*2 - 8) / kpis.length
    kpis.forEach((k, i) => {
      const cx = margin + i * (cardW + 2)
      doc.setFillColor(k.color[0], k.color[1], k.color[2], 0.08)
      doc.setFillColor(248,249,252)
      doc.roundedRect(cx, y, cardW, 16, 2, 2, 'F')
      doc.setDrawColor(k.color[0], k.color[1], k.color[2])
      doc.setLineWidth(0.5)
      doc.line(cx, y, cx, y+16)
      doc.setFont('helvetica','normal'); doc.setFontSize(6.5); doc.setTextColor(100,110,130)
      doc.text(k.label, cx + 3, y + 5)
      doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(k.color[0], k.color[1], k.color[2])
      doc.text(k.value, cx + 3, y + 12)
    })
    y += 22
  }

  // ── Data table ───────────────────────────────────────────────────────────────
  if (data?.length) {
    const cols = Object.keys(data[0]).filter(k => !k.startsWith('_'))
    const colLabels = cols.map(c => c.replace(/_/g,' ').replace(/\b\w/g, l=>l.toUpperCase()))

    // Column widths — distribute proportionally
    const availW = pw - margin * 2
    const baseW  = availW / cols.length
    const colW   = cols.map(() => baseW)

    // Header row
    doc.setFillColor(hr, hg, hb)
    doc.rect(margin, y, availW, 7, 'F')
    doc.setFont('helvetica','bold'); doc.setFontSize(6.5); doc.setTextColor(255,255,255)
    let cx = margin
    colLabels.forEach((label, i) => {
      doc.text(label.slice(0,16), cx + 1, y + 4.8)
      cx += colW[i]
    })
    y += 7

    // Data rows
    doc.setFont('helvetica','normal'); doc.setFontSize(6.5)
    let page = 1
    data.forEach((row, ri) => {
      if (y > ph - 16) {
        // Footer
        doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(160,170,180)
        doc.text(`${empresa} — Confidencial`, margin, ph - 5)
        doc.text(`Página ${page}`, pw - margin, ph - 5, { align:'right' })
        doc.addPage()
        page++
        y = 14
        // Repeat header
        doc.setFillColor(hr, hg, hb)
        doc.rect(margin, y, availW, 7, 'F')
        doc.setFont('helvetica','bold'); doc.setFontSize(6.5); doc.setTextColor(255,255,255)
        cx = margin
        colLabels.forEach((label, i) => { doc.text(label.slice(0,16), cx + 1, y + 4.8); cx += colW[i] })
        y += 7
        doc.setFont('helvetica','normal'); doc.setFontSize(6.5)
      }

      doc.setFillColor(ri % 2 === 0 ? 252 : 246, ri % 2 === 0 ? 252 : 247, ri % 2 === 0 ? 252 : 252)
      doc.rect(margin, y, availW, 6, 'F')
      doc.setTextColor(50, 60, 80)
      cx = margin
      cols.forEach((col, i) => {
        const val = row[col] !== null && row[col] !== undefined ? String(row[col]) : '—'
        const truncated = val.length > 20 ? val.slice(0,18)+'…' : val
        doc.text(truncated, cx + 1, y + 4.2)
        cx += colW[i]
      })
      y += 6
    })

    // Total row (gastos)
    if (meta?.total_mxn !== undefined) {
      doc.setFillColor(hr, hg, hb, 0.15)
      doc.setFillColor(230, 235, 250)
      doc.rect(margin, y, availW, 7, 'F')
      doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor(hr, hg, hb)
      doc.text('TOTAL', margin + 2, y + 5)
      doc.text(fmtDec(meta.total_mxn), pw - margin - 2, y + 5, { align:'right' })
      y += 7
    }
  }

  // ── Footer last page ────────────────────────────────────────────────────────
  doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(160,170,180)
  doc.text(`${empresa} — Documento confidencial. Generado automáticamente.`, margin, ph - 5)
  doc.text(`Página final`, pw - margin, ph - 5, { align:'right' })

  doc.save(`Reporte_GastosTI_${HOY}.pdf`)
}

// ─────────────────────────────────────────────────────────────────────────────
// Search/autocomplete components
// ─────────────────────────────────────────────────────────────────────────────
function SearchDropdown({ value, placeholder, results, onSearch, onSelect, onClear, confirmed, renderItem, renderTag }) {
  const [open, setOpen] = useState(false)
  const ref = useRef()
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <div className={`flex items-center gap-2 rounded-xl border bg-white transition-all ${
        confirmed ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200'}`}>
        <input
          className="flex-1 px-3 py-2.5 text-sm bg-transparent rounded-xl outline-none"
          value={value} placeholder={placeholder}
          onChange={e => { onSearch(e.target.value); setOpen(true) }}
          onFocus={() => { if (results.length) setOpen(true) }}
        />
        {value && (
          <button onClick={onClear} className="pr-3 text-gray-400 hover:text-red-400">
            <XMarkIcon className="h-4 w-4" />
          </button>
        )}
      </div>
      {confirmed && renderTag && (
        <div className="mt-1.5">{renderTag()}</div>
      )}
      {open && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden">
          {results.map((item, i) => (
            <button key={i} type="button"
              className="w-full text-left px-3 py-2.5 hover:bg-slate-50 border-b border-gray-50 last:border-0 transition-colors"
              onClick={() => { onSelect(item); setOpen(false) }}>
              {renderItem(item)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function EmpleadoSearch({ empleadoId, empleadoNombre, onSelect, onClear }) {
  const [query, setQuery] = useState(empleadoNombre || '')
  const [results, setResults] = useState([])
  useEffect(() => { setQuery(empleadoNombre || '') }, [empleadoNombre])

  const search = async (q) => {
    setQuery(q)
    if (q.length < 2) { setResults([]); return }
    try {
      const data = await empleadoAPI.getAll({ search: q, limit: 8 })
      setResults((data.data || data).slice(0,8))
    } catch (_) {}
  }

  return (
    <SearchDropdown
      value={query} placeholder="Buscar empleado por nombre o número..."
      results={results} onSearch={search} onClear={() => { setQuery(''); setResults([]); onClear() }}
      onSelect={emp => { setQuery(emp.nombre_completo); setResults([]); onSelect(emp) }}
      confirmed={!!empleadoId}
      renderItem={emp => (
        <div>
          <div className="text-sm font-medium text-gray-800">{emp.nombre_completo}</div>
          <div className="text-xs text-gray-400 mt-0.5">{[emp.num_empleado && `#${emp.num_empleado}`, emp.puesto, emp.sucursal_nombre].filter(Boolean).join(' · ')}</div>
        </div>
      )}
      renderTag={() => (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-medium">
          <CheckBadgeIcon className="h-3.5 w-3.5" /> Empleado vinculado al reporte
        </div>
      )}
    />
  )
}

function SucursalSearch({ sucursalId, sucursalNombre, onSelect, onClear }) {
  const [query, setQuery] = useState(sucursalNombre || '')
  const [results, setResults] = useState([])
  useEffect(() => { setQuery(sucursalNombre || '') }, [sucursalNombre])

  const search = async (q) => {
    setQuery(q)
    if (q.length < 2) { setResults([]); return }
    try {
      const resp = await sucursalAPI.getAll({ search: q, limit: 8 })
      setResults((resp.data || resp || []).slice(0,8))
    } catch (_) {}
  }

  return (
    <SearchDropdown
      value={query} placeholder="Buscar sucursal..."
      results={results} onSearch={search} onClear={() => { setQuery(''); setResults([]); onClear() }}
      onSelect={s => { setQuery(s.nombre); setResults([]); onSelect(s) }}
      confirmed={!!sucursalId}
      renderItem={s => (
        <div>
          <div className="text-sm font-medium text-gray-800">{s.nombre}</div>
          <div className="text-xs text-gray-400 mt-0.5">{[s.tipo, s.estado].filter(Boolean).join(' · ')}</div>
        </div>
      )}
      renderTag={() => (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-medium">
          <CheckBadgeIcon className="h-3.5 w-3.5" /> Sucursal vinculada al reporte
        </div>
      )}
    />
  )
}

function CCSearch({ ccCodigo, ccNombre, onSelect, onClear }) {
  const [query, setQuery] = useState(ccNombre ? `${ccCodigo} — ${ccNombre}` : ccCodigo || '')
  const [results, setResults] = useState([])
  useEffect(() => { setQuery(ccNombre ? `${ccCodigo} — ${ccNombre}` : ccCodigo || '') }, [ccCodigo, ccNombre])

  const search = async (q) => {
    setQuery(q)
    if (!q) { setResults([]); return }
    try {
      const data = await centroCostoAPI.search(q)
      setResults((data || []).slice(0,8))
    } catch (_) {}
  }

  return (
    <SearchDropdown
      value={query} placeholder="Buscar por código o nombre del CC..."
      results={results} onSearch={search} onClear={() => { setQuery(''); setResults([]); onClear() }}
      onSelect={cc => { setQuery(`${cc.codigo} — ${cc.nombre}`); setResults([]); onSelect(cc) }}
      confirmed={!!ccCodigo}
      renderItem={cc => (
        <div>
          <div className="text-sm font-medium text-gray-800">{cc.codigo} — {cc.nombre}</div>
        </div>
      )}
      renderTag={() => (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-medium">
          <CheckBadgeIcon className="h-3.5 w-3.5" /> CC: {ccCodigo} vinculado
        </div>
      )}
    />
  )
}

function AreaSearch({ area, onSelect, onClear }) {
  const [query, setQuery] = useState(area || '')
  const [all, setAll] = useState([])
  const [results, setResults] = useState([])
  useEffect(() => { setQuery(area || '') }, [area])
  useEffect(() => {
    catalogosAPI.areas.getAll().then(items => {
      setAll((items || []).map(i => i.nombre || i).filter(Boolean))
    }).catch(() => {})
  }, [])

  const search = (q) => {
    setQuery(q)
    const qn = normalize(q)
    setResults(qn ? all.filter(a => normalize(a).includes(qn)).slice(0,8) : all.slice(0,8))
  }

  return (
    <SearchDropdown
      value={query} placeholder="Buscar área..."
      results={results} onSearch={search}
      onClear={() => { setQuery(''); setResults([]); onClear() }}
      onSelect={a => { setQuery(a); setResults([]); onSelect(a) }}
      confirmed={!!area}
      renderItem={a => <div className="text-sm font-medium text-gray-800">{a}</div>}
      renderTag={() => (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-medium">
          <CheckBadgeIcon className="h-3.5 w-3.5" /> Área vinculada al reporte
        </div>
      )}
    />
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI Cards
// ─────────────────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, color, trend }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl p-5 bg-white border border-gray-100 shadow-sm`}>
      <div className={`absolute top-0 right-0 w-24 h-24 rounded-full opacity-5`}
        style={{ background: color, transform: 'translate(30%,-30%)' }} />
      <div className="flex items-start justify-between">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center`}
          style={{ background: color + '18' }}>
          <Icon className="h-5 w-5" style={{ color }} />
        </div>
        {trend !== undefined && (
          <span className={`flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full ${
            trend > 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
            {trend > 0 ? <ArrowTrendingUpIcon className="h-3 w-3"/> : <ArrowTrendingDownIcon className="h-3 w-3"/>}
            {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
      <div className="mt-3">
        <div className="text-2xl font-bold text-gray-900 tabular-nums">{value}</div>
        <div className="text-xs font-medium text-gray-500 mt-0.5">{label}</div>
        {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Toast notification
// ─────────────────────────────────────────────────────────────────────────────
function Toast({ message, type = 'success', icon: Icon, onClose }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const rAF = requestAnimationFrame(() => setVisible(true))
    const hideT  = setTimeout(() => setVisible(false), 3200)
    const closeT = setTimeout(onClose, 3600)
    return () => { cancelAnimationFrame(rAF); clearTimeout(hideT); clearTimeout(closeT) }
  }, [onClose])

  const styles = {
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    info:    'bg-indigo-50  border-indigo-200  text-indigo-800',
  }
  const iconColor = { success: 'text-emerald-500', info: 'text-indigo-500' }

  return (
    <div className={`fixed top-5 right-5 z-[9999] transition-all duration-300 ease-out pointer-events-none ${
      visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-3'}`}>
      <div className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl border pointer-events-auto ${styles[type] || styles.success}`}>
        {Icon
          ? <Icon className={`h-5 w-5 flex-shrink-0 ${iconColor[type] || iconColor.success}`} />
          : <CheckBadgeIcon className={`h-5 w-5 flex-shrink-0 ${iconColor[type] || iconColor.success}`} />
        }
        <span className="text-sm font-medium">{message}</span>
        <button onClick={onClose} className="ml-1 text-gray-400 hover:text-gray-600 transition-colors">
          <XMarkIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Executive Charts
// ─────────────────────────────────────────────────────────────────────────────
function GastosCharts({ result, historico }) {
  if (!result?.length) return null

  // Distribute by tipo (Usuario / Servicio) since all records are from finanzas_detalle
  const tipoMap = {}
  result.forEach(d => { tipoMap[d.tipo || 'Servicio'] = (tipoMap[d.tipo || 'Servicio']||0) + (d.total_mxn||0) })
  const catData = Object.entries(tipoMap).map(([name, value]) => ({ name, value: +value.toFixed(2) }))

  const isRealName = (name) =>
    name && name !== 'Sin asignar' && !/^\d+\s*usuario/i.test(name)
  const topMap = {}
  result.forEach(d => {
    if (isRealName(d.asignado_a)) {
      topMap[d.asignado_a] = (topMap[d.asignado_a]||0) + (d.total_mxn||0)
    }
  })
  const topData = Object.entries(topMap).sort(([,a],[,b])=>b-a).slice(0,6)
    .map(([name,value],i) => ({
      name: name.length > 20 ? name.slice(0,19)+'…' : name,
      value: +value.toFixed(2), fill: PALETTE[i%PALETTE.length]
    }))

  const Tip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-white/95 backdrop-blur border border-gray-100 rounded-xl shadow-xl px-3 py-2 text-xs">
        <div className="font-semibold text-gray-700 mb-1">{label}</div>
        {payload.map((p,i) => (
          <div key={i} className="flex items-center gap-2">
            <span style={{ color: p.fill||p.color }}>●</span>
            <span className="text-gray-600">{p.name}: <strong>{fmt(p.value)}</strong></span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
      {/* Pie — categorías */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">Distribución por Tipo</h3>
        <p className="text-xs text-gray-400 mb-3">Gastos de usuario vs servicios TI</p>
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie data={catData} dataKey="value" nameKey="name" cx="50%" cy="50%"
              innerRadius={45} outerRadius={75} paddingAngle={3}>
              {catData.map(entry => (
                <Cell key={entry.name} fill={TIPO_COLORS[entry.name] || PALETTE[0]} stroke="none"/>
              ))}
            </Pie>
            <Tooltip content={<Tip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="flex flex-col gap-1.5 mt-1">
          {catData.map(c => (
            <div key={c.name} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: TIPO_COLORS[c.name] || PALETTE[0] }} />
                <span className="text-gray-600">{c.name}</span>
              </div>
              <span className="font-semibold text-gray-800">{fmt(c.value)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Trend — mensual */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">Tendencia de Gasto</h3>
        <p className="text-xs text-gray-400 mb-3">Servicios TI últimos 12 meses</p>
        {historico && historico.length > 1 ? (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={historico}>
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize:9, fill:'#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize:9, fill:'#94a3b8' }} tickFormatter={v=>`$${(v/1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
              <Tooltip content={<Tip />} />
              <Area type="monotone" dataKey="total" name="Total MXN" stroke="#6366f1" strokeWidth={2}
                fill="url(#areaGrad)" dot={{ r:3, fill:'#6366f1', strokeWidth:0 }} activeDot={{ r:5, fill:'#6366f1' }} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Sin datos históricos</div>
        )}
      </div>

      {/* Top asignados */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">Top Asignados</h3>
        <p className="text-xs text-gray-400 mb-3">Mayor gasto por persona / entidad</p>
        {topData.length > 0 ? (
          <div className="space-y-3">
            {topData.map(({ name, value, fill }, i) => {
              const pct = topData[0].value > 0 ? (value / topData[0].value) * 100 : 0
              return (
                <div key={i}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-gray-700 truncate max-w-[60%]">{name}</span>
                    <span className="font-bold text-gray-900">{fmt(value)}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full">
                    <div className="h-1.5 rounded-full transition-all" style={{ width:`${pct}%`, background: fill }} />
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Sin asignaciones individuales</div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Paginated Table
// ─────────────────────────────────────────────────────────────────────────────
function PaginatedTable({ data, tab }) {
  const [page, setPage] = useState(1)
  useEffect(() => { setPage(1) }, [data])

  if (!data) return (
    <div className="py-20 text-center">
      <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <TableCellsIcon className="h-8 w-8 text-gray-300" />
      </div>
      <p className="text-gray-400 text-sm">Configura los filtros y presiona <strong className="text-gray-600">Generar reporte</strong></p>
    </div>
  )
  if (data.length === 0) return (
    <div className="py-16 text-center">
      <p className="text-gray-400 text-sm">No se encontraron registros con los filtros seleccionados.</p>
    </div>
  )

  const cols = Object.keys(data[0]).filter(k => !k.startsWith('_'))
  const totalPages = Math.ceil(data.length / PAGE_SIZE)
  const slice = data.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE)

  const fmtHeader = k => k.replace(/_/g,' ').replace(/\b\w/g, c=>c.toUpperCase())
  const fmtVal = (k, v) => {
    if (v === null || v === undefined || v === '') return <span className="text-gray-300">—</span>
    if (k === 'total_mxn' || k === 'costo_unitario') return <span className="font-mono font-semibold text-gray-800">{fmtDec(+v)}</span>
    if (typeof v === 'number') return v.toLocaleString('es-MX', { maximumFractionDigits: 2 })
    if (k === 'categoria') {
      const color = { Equipo:'indigo', Licencia:'violet', 'Servicio TI':'amber' }[v] || 'gray'
      return (
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium bg-${color}-50 text-${color}-700 border border-${color}-100`}>
          {v}
        </span>
      )
    }
    if (k === 'asignado_a') {
      if (!v || v === 'Sin asignar') return <span className="text-gray-300 italic text-xs">Sin asignar</span>
      if (/^\d+\s*usuario/i.test(v)) return <span className="text-gray-400 text-xs">{v}</span>
    }
    if (k === 'estado') {
      const colMap = { activo:'emerald', stock:'blue', vencida:'red', por_vencer:'amber', activa:'emerald', baja:'gray', en_reparacion:'orange' }
      const c = colMap[v] || 'gray'
      return <span className={`px-2 py-0.5 rounded-full text-xs font-medium bg-${c}-50 text-${c}-700`}>{v}</span>
    }
    return <span className="text-gray-700">{String(v)}</span>
  }

  return (
    <div>
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              {cols.map(c => (
                <th key={c} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                  {fmtHeader(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {slice.map((row, i) => (
              <tr key={i} className="hover:bg-slate-50/70 transition-colors group">
                {cols.map(c => (
                  <td key={c} className="px-4 py-3 text-xs whitespace-nowrap max-w-[180px] truncate">
                    {fmtVal(c, row[c])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50">
          <span className="text-xs text-gray-500">
            Mostrando {(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE, data.length)} de <strong>{data.length}</strong> registros
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 disabled:opacity-30 hover:bg-white transition-colors">
              <ChevronLeftIcon className="h-4 w-4 text-gray-600" />
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let p
              if (totalPages <= 7) { p = i + 1 }
              else if (page <= 4) { p = i + 1 }
              else if (page >= totalPages - 3) { p = totalPages - 6 + i }
              else { p = page - 3 + i }
              return (
                <button key={p} onClick={() => setPage(p)}
                  className={`w-8 h-8 text-xs rounded-lg border transition-colors ${
                    page === p ? 'bg-indigo-600 border-indigo-600 text-white font-semibold'
                    : 'border-gray-200 text-gray-600 hover:bg-white'}`}>
                  {p}
                </button>
              )
            })}
            <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 disabled:opacity-30 hover:bg-white transition-colors">
              <ChevronRightIcon className="h-4 w-4 text-gray-600" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Filter panels per tab
// ─────────────────────────────────────────────────────────────────────────────
function FiltrosInventario({ filters, setFilters }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1.5">Tipo de dispositivo</label>
        <select className="input" value={filters.tipo||''} onChange={e=>setFilters(f=>({...f,tipo:e.target.value}))}>
          <option value="">Todos los tipos</option>
          {DEVICE_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1.5">Estado</label>
        <select className="input" value={filters.estado||''} onChange={e=>setFilters(f=>({...f,estado:e.target.value}))}>
          <option value="">Todos</option>
          {['activo','stock','en_reparacion','baja','danado'].map(s=><option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1.5">Ubicación</label>
        <select className="input" value={filters.ubicacion_tipo||''} onChange={e=>setFilters(f=>({...f,ubicacion_tipo:e.target.value}))}>
          <option value="">Todas</option>
          {['almacen','empleado','sucursal','proveedor'].map(u=><option key={u} value={u}>{u}</option>)}
        </select>
      </div>
    </div>
  )
}

function FiltrosAsignaciones({ filters, setFilters }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1.5">Tipo de asignación</label>
      <select className="input w-48" value={filters.tipo_asignacion||''} onChange={e=>setFilters(f=>({...f,tipo_asignacion:e.target.value}))}>
        <option value="">Todas</option>
        <option value="empleado">Empleado</option>
        <option value="sucursal">Sucursal</option>
      </select>
    </div>
  )
}

function FiltrosGastos({ filters, setFilters }) {
  const modo = filters._modo || 'ninguno'
  const clearEntity = () => setFilters(f => ({
    ...f,
    empleado_id: null, empleado_nombre: '',
    sucursal_id: null, sucursal_nombre: '',
    centro_costo_codigo: '', centro_costo_nombre: '',
    area: ''
  }))
  const setModo = m => { clearEntity(); setFilters(f => ({ ...f, _modo: m })) }

  return (
    <div className="space-y-5">
      {/* Dates */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Fecha inicio</label>
          <input type="date" className="input" value={filters.fecha_inicio||INICIO_MES}
            onChange={e=>setFilters(f=>({...f,fecha_inicio:e.target.value}))} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Fecha fin</label>
          <input type="date" className="input" value={filters.fecha_fin||HOY}
            onChange={e=>setFilters(f=>({...f,fecha_fin:e.target.value}))} />
        </div>
      </div>

      {/* Entity mode selector */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-2">Enfoque del reporte</label>
        <div className="grid grid-cols-5 gap-1.5 p-1 bg-gray-100 rounded-xl">
          {ENTITY_MODES.map(m => (
            <button key={m.id} onClick={() => setModo(m.id)}
              className={`flex flex-col items-center gap-1 py-2 rounded-lg text-xs font-medium transition-all ${
                modo === m.id
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}>
              <m.icon className="h-4 w-4" />
              {m.label.replace('Por ','')}
            </button>
          ))}
        </div>
      </div>

      {/* Entity picker */}
      {modo !== 'ninguno' && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">
            {{ empleado:'Empleado', area:'Área', cc:'Centro de Costo', sucursal:'Sucursal' }[modo]}
            <span className="text-red-400 ml-0.5">*</span>
          </label>
          {modo === 'empleado' && (
            <EmpleadoSearch
              empleadoId={filters.empleado_id} empleadoNombre={filters.empleado_nombre||''}
              onSelect={emp=>setFilters(f=>({...f,empleado_id:emp.id,empleado_nombre:emp.nombre_completo}))}
              onClear={()=>setFilters(f=>({...f,empleado_id:null,empleado_nombre:''}))}
            />
          )}
          {modo === 'sucursal' && (
            <SucursalSearch
              sucursalId={filters.sucursal_id} sucursalNombre={filters.sucursal_nombre||''}
              onSelect={s=>setFilters(f=>({...f,sucursal_id:s.id,sucursal_nombre:s.nombre}))}
              onClear={()=>setFilters(f=>({...f,sucursal_id:null,sucursal_nombre:''}))}
            />
          )}
          {modo === 'cc' && (
            <CCSearch
              ccCodigo={filters.centro_costo_codigo||''} ccNombre={filters.centro_costo_nombre||''}
              onSelect={cc=>setFilters(f=>({...f,centro_costo_codigo:cc.codigo,centro_costo_nombre:cc.nombre}))}
              onClear={()=>setFilters(f=>({...f,centro_costo_codigo:'',centro_costo_nombre:''}))}
            />
          )}
          {modo === 'area' && (
            <AreaSearch
              area={filters.area||''}
              onSelect={a=>setFilters(f=>({...f,area:a}))}
              onClear={()=>setFilters(f=>({...f,area:''}))}
            />
          )}
          {/* Pending selection warning */}
          {!{ empleado:filters.empleado_id, sucursal:filters.sucursal_id, cc:filters.centro_costo_codigo, area:filters.area }[modo] && (
            <p className="text-xs text-amber-600 mt-2 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
              Selecciona una opción de la lista para filtrar el reporte
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
export default function Reportes() {
  const { showError } = useNotification()
  const [tab,        setTab]        = useState('gastos')
  const [filters,    setFilters]    = useState({ fecha_inicio: INICIO_ANO, fecha_fin: HOY })
  const [result,     setResult]     = useState(null)
  const [loading,    setLoading]    = useState(false)
  const [success,    setSuccess]    = useState(false)   // brief success flash on generate
  const [meta,       setMeta]       = useState(null)
  const [historico,  setHistorico]  = useState(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [showFilters,setShowFilters]= useState(true)
  const [toast,      setToast]      = useState(null)    // { id, message, type, icon }

  const showToast = useCallback((message, type = 'success', icon = null) => {
    setToast({ id: Date.now(), message, type, icon })
  }, [])

  const getGastosParams = useCallback(() => {
    const p = {}
    if (filters.fecha_inicio) p.fecha_inicio = filters.fecha_inicio
    if (filters.fecha_fin)    p.fecha_fin    = filters.fecha_fin
    // Leer _modo directamente de filters para evitar cierre estale
    const modo = filters._modo || 'ninguno'
    // Solo incluir el parámetro de la entidad seleccionada (nunca mezclar)
    if (modo === 'empleado') {
      if (filters.empleado_id) p.empleado_id = filters.empleado_id
      else console.warn('[getGastosParams] modo empleado pero empleado_id vacío', filters)
    }
    if (modo === 'sucursal') {
      if (filters.sucursal_id) p.sucursal_id = filters.sucursal_id
      else console.warn('[getGastosParams] modo sucursal pero sucursal_id vacío', filters)
    }
    if (modo === 'cc'   && filters.centro_costo_codigo) p.centro_costo_codigo = filters.centro_costo_codigo
    if (modo === 'area' && filters.area)                p.area                = filters.area
    console.log('[getGastosParams] params enviados al backend:', p)
    return p
  }, [filters])

  const handleGenerate = useCallback(async () => {
    // Validate entity selection
    if (tab === 'gastos') {
      const modo = filters._modo || 'ninguno'
      const needs = { empleado: !filters.empleado_id, sucursal: !filters.sucursal_id,
        cc: !filters.centro_costo_codigo, area: !filters.area }
      if (modo !== 'ninguno' && needs[modo]) {
        showError('Selecciona una entidad de la lista antes de generar el reporte')
        return
      }
    }

    setLoading(true); setSuccess(false); setResult(null); setMeta(null); setHistorico(null)
    try {
      let params, res
      if (tab === 'gastos') {
        params = getGastosParams()
        res = await reportesAPI.gastos(params)
      } else {
        params = {}
        for (const [k,v] of Object.entries(filters)) {
          if (!k.startsWith('_') && v !== '' && v !== null && v !== undefined) params[k] = v
        }
        if (tab === 'inventario')   res = await reportesAPI.inventario(params)
        if (tab === 'asignaciones') res = await reportesAPI.asignaciones(params)
        if (tab === 'licencias')    res = await reportesAPI.licencias(params)
      }

      setResult(res.data || [])
      const modo = filters._modo || 'ninguno'
      const filtroLabel = {
        empleado: filters.empleado_nombre ? `Empleado: ${filters.empleado_nombre}` : null,
        sucursal: filters.sucursal_nombre ? `Sucursal: ${filters.sucursal_nombre}` : null,
        cc: filters.centro_costo_codigo ? `CC: ${filters.centro_costo_codigo}${filters.centro_costo_nombre ? ' — '+filters.centro_costo_nombre:''}` : null,
        area: filters.area ? `Área: ${filters.area}` : null,
      }[modo] || null
      setMeta({ titulo: res.titulo, total: res.total, total_mxn: res.total_mxn, generado: res.generado, filtroLabel })
      setShowFilters(false)
      // Success flash + toast
      setSuccess(true)
      setTimeout(() => setSuccess(false), 2000)
      showToast(`Reporte generado · ${res.total} registro${res.total !== 1 ? 's' : ''}${res.total_mxn !== undefined ? ` · ${fmt(res.total_mxn)}` : ''}`, 'success', CheckBadgeIcon)
    } catch (err) {
      showError(err?.message || 'Error al generar reporte')
    } finally {
      setLoading(false)
    }

    // Historical trend — independent, silent failure
    if (tab === 'gastos') {
      try {
        const hp = getGastosParams(); hp.meses = 12
        const hist = await reportesAPI.gastosHistorico(hp)
        setHistorico(Array.isArray(hist) ? hist : [])
      } catch (_) { setHistorico([]) }
    }
  }, [tab, filters, getGastosParams])

  const handleTabChange = id => {
    setTab(id)
    setFilters({ fecha_inicio: INICIO_ANO, fecha_fin: HOY })
    setResult(null); setMeta(null); setHistorico(null)
    setShowFilters(true)
  }

  const handlePDF = async () => {
    if (!result?.length) return
    setPdfLoading(true)
    try {
      const [logoRes, headerRes] = await Promise.all([
        configAPI.getLogo().catch(() => ({})),
        configAPI.getHeaderConfig().catch(() => ({})),
      ])
      await generatePDF({
        data: result, meta, historico, filters,
        logo: logoRes?.logo || null,
        headerConfig: headerRes || {},
      })
      showToast('Estado de cuenta generado y descargado correctamente', 'success', PrinterIcon)
    } catch (err) { showError('Error al generar estado de cuenta: ' + err.message) }
    finally { setPdfLoading(false) }
  }

  const activeTab = TABS.find(t => t.id === tab)

  // KPI data for gastos — finanzas_detalle only (tipo: Usuario | Servicio)
  const tipoGastos = {}
  ;(result || []).forEach(d => { tipoGastos[d.tipo || 'Servicio'] = (tipoGastos[d.tipo || 'Servicio']||0) + (d.total_mxn||0) })

  const histTotales = (historico || []).map(h => h.total)
  const trendPct = histTotales.length >= 2
    ? histTotales[histTotales.length-2] > 0
      ? ((histTotales[histTotales.length-1] - histTotales[histTotales.length-2]) / histTotales[histTotales.length-2]) * 100
      : 0
    : undefined

  return (
    <div className="flex gap-5 min-h-screen">
      {/* Global toast */}
      {toast && (
        <Toast key={toast.id} message={toast.message} type={toast.type} icon={toast.icon}
          onClose={() => setToast(null)} />
      )}

      {/* ── Left sidebar — tab navigation ─────────────────────────────────────── */}
      <aside className="w-56 flex-shrink-0">
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden sticky top-5">
          <div className="p-4 border-b border-gray-100">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Reportes</h2>
          </div>
          <nav className="p-2 space-y-1">
            {TABS.map(t => {
              const isActive = tab === t.id
              return (
                <button key={t.id} onClick={() => handleTabChange(t.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'text-white shadow-md'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                  style={isActive ? { background: `linear-gradient(135deg, ${t.accent}dd, ${t.accent})` } : {}}>
                  <t.icon className="h-4 w-4 flex-shrink-0" />
                  {t.label}
                </button>
              )
            })}
          </nav>

          {/* Quick stats sidebar */}
          {meta && (
            <div className="p-4 border-t border-gray-100 space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Resultado</p>
              <div className="text-xs text-gray-600 space-y-1">
                <div className="flex justify-between">
                  <span>Registros</span>
                  <span className="font-bold text-gray-800">{meta.total}</span>
                </div>
                {meta.total_mxn !== undefined && (
                  <div className="flex justify-between">
                    <span>Total</span>
                    <span className="font-bold text-gray-800">{fmt(meta.total_mxn)}</span>
                  </div>
                )}
                {meta.filtroLabel && (
                  <div className="mt-2 px-2 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs break-words">
                    {meta.filtroLabel}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main content ───────────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-4">

        {/* Page header */}
        <div className={`rounded-2xl p-6 bg-gradient-to-br ${activeTab?.bg || 'from-indigo-600 to-violet-600'} text-white shadow-lg`}>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                {activeTab && <activeTab.icon className="h-5 w-5 text-white/80" />}
                <span className="text-xs font-medium text-white/70 uppercase tracking-widest">Reporte Ejecutivo</span>
              </div>
              <h1 className="text-2xl font-bold">{activeTab?.label}</h1>
              {meta && (
                <p className="text-sm text-white/70 mt-1">
                  {meta.filtroLabel || 'Vista general'} · {meta.total} registros · {meta.generado}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              {result?.length > 0 && tab === 'gastos' && (
                <button onClick={handlePDF} disabled={pdfLoading}
                  className={`flex items-center gap-2 px-4 py-2 text-white rounded-xl text-sm font-medium transition-all backdrop-blur border border-white/20 ${
                    pdfLoading ? 'bg-white/30 cursor-wait' : 'bg-white/20 hover:bg-white/30'
                  }`}>
                  {pdfLoading
                    ? <><ArrowPathIcon className="h-4 w-4 animate-spin" /> Generando estado...</>
                    : <><PrinterIcon className="h-4 w-4" /> Crear estado de cuenta</>}
                </button>
              )}
              {result?.length > 0 && (
                <button onClick={() => exportCSV(result, `${tab}_${HOY}.csv`)}
                  className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl text-sm font-medium transition-all backdrop-blur border border-white/20">
                  <DocumentArrowDownIcon className="h-4 w-4" /> CSV
                </button>
              )}
            </div>
          </div>
        </div>

        {/* KPI Cards — gastos only */}
        {tab === 'gastos' && result?.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard
              label="Total Gastos TI" value={fmt(meta?.total_mxn||0)}
              sub={`${meta?.total} registros en el período`} icon={BanknotesIcon} color="#6366f1" trend={trendPct}
            />
            <KpiCard
              label="Gastos de Usuario" value={fmt(tipoGastos['Usuario']||0)}
              sub="Vinculados a un empleado" icon={UserIcon} color="#10b981"
            />
            <KpiCard
              label="Gastos de Servicio" value={fmt(tipoGastos['Servicio']||0)}
              sub="Servicios y plataformas TI" icon={GlobeAltIcon} color="#6366f1"
            />
            <KpiCard
              label="Promedio por registro" value={meta?.total ? fmt((meta.total_mxn||0) / meta.total) : fmt(0)}
              sub="Gasto promedio individual" icon={ChartBarIcon} color="#f59e0b"
            />
          </div>
        )}

        {/* Charts — gastos only */}
        {tab === 'gastos' && result?.length > 0 && (
          <GastosCharts result={result} historico={historico} />
        )}

        {/* Filters panel — note: no overflow-hidden so search dropdowns are not clipped */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm">
          <button onClick={() => setShowFilters(v=>!v)}
            className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors rounded-2xl">
            <span className="flex items-center gap-2">
              <FunnelIcon className="h-4 w-4 text-gray-400" /> Filtros de reporte
            </span>
            <ChevronRightIcon className={`h-4 w-4 text-gray-400 transition-transform ${showFilters ? 'rotate-90' : ''}`} />
          </button>

          {showFilters && (
            <div className="px-5 pb-5 border-t border-gray-100 pt-4">
              {tab === 'inventario'   && <FiltrosInventario   filters={filters} setFilters={setFilters} />}
              {tab === 'asignaciones' && <FiltrosAsignaciones filters={filters} setFilters={setFilters} />}
              {tab === 'gastos'       && <FiltrosGastos       filters={filters} setFilters={setFilters} />}
              {tab === 'licencias'    && <p className="text-sm text-gray-400">No hay filtros adicionales para licencias.</p>}

              <div className="flex justify-end mt-5">
                <button onClick={handleGenerate} disabled={loading || success}
                  className={`flex items-center gap-2 px-6 py-2.5 text-white rounded-xl text-sm font-semibold shadow-sm transition-all duration-300 ${
                    success
                      ? 'bg-emerald-500 scale-95'
                      : loading
                        ? 'bg-indigo-400 cursor-wait'
                        : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-md active:scale-95'
                  }`}>
                  {loading
                    ? <><ArrowPathIcon className="h-4 w-4 animate-spin" /> Generando...</>
                    : success
                      ? <><CheckBadgeIcon className="h-4 w-4" /> ¡Listo!</>
                      : <><ChartBarIcon className="h-4 w-4" /> Generar reporte</>}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Results table */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-16 text-center space-y-4">
              <div className="relative inline-flex items-center justify-center">
                <div className="w-14 h-14 rounded-full border-4 border-indigo-100" />
                <div className="absolute w-14 h-14 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
                <ChartBarIcon className="absolute h-5 w-5 text-indigo-400" />
              </div>
              <p className="text-sm font-medium text-gray-500">Generando reporte estratégico...</p>
              <p className="text-xs text-gray-400">Procesando datos del módulo de Finanzas</p>
              {/* skeleton rows */}
              <div className="mx-6 space-y-2 mt-2">
                {[100,80,90,70].map((w,i) => (
                  <div key={i} className="h-3 bg-gray-100 rounded-full animate-pulse" style={{ width:`${w}%`, animationDelay:`${i*120}ms` }} />
                ))}
              </div>
            </div>
          ) : (
            <>
              {result && (
                <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-gray-700">{meta?.titulo}</span>
                    {meta?.filtroLabel && (
                      <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-full border border-indigo-100">
                        {meta.filtroLabel}
                      </span>
                    )}
                    {!meta?.filtroLabel && tab === 'gastos' && (
                      <span className="px-2.5 py-0.5 bg-gray-100 text-gray-500 text-xs font-medium rounded-full">
                        Reporte general
                      </span>
                    )}
                  </div>
                  {meta?.total_mxn !== undefined && (
                    <span className="text-sm font-bold text-gray-900">
                      Total: <span className="text-indigo-600">{fmtDec(meta.total_mxn)}</span>
                    </span>
                  )}
                </div>
              )}
              <PaginatedTable data={result} tab={tab} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
