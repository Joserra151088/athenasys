import { useState, useEffect, useCallback, useMemo, Fragment } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts'
import {
  CurrencyDollarIcon, ChartBarIcon, Cog6ToothIcon, PlusIcon,
  PencilSquareIcon, TrashIcon, ArrowPathIcon, MagnifyingGlassIcon,
  ExclamationTriangleIcon, DocumentDuplicateIcon,
  FunnelIcon, ArrowsUpDownIcon, DocumentArrowDownIcon, XMarkIcon,
  ChevronDownIcon, ChevronRightIcon, Square2StackIcon
} from '@heroicons/react/24/outline'
import { presupuestoAPI } from '../utils/api'
import { useNotification } from '../context/NotificationContext'
import Modal from '../components/Modal'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import jsPDF from 'jspdf'
import PageHeader from '../components/PageHeader'

// ── EmpleadoSearch ────────────────────────────────────────────────────────────
function EmpleadoSearch({ value, display, onSelect, onClear }) {
  const [query, setQuery] = useState(display || '')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  useEffect(() => { if (!value) setQuery('') }, [value])

  const search = async (q) => {
    setQuery(q)
    if (q.length < 2) { setResults([]); setOpen(false); return }
    try {
      const data = await fetch(`/api/empleados?search=${encodeURIComponent(q)}&limit=10`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('ti_token')}` }
      }).then(r => r.json())
      setResults((data.data || data).slice(0, 10))
      setOpen(true)
    } catch(_) {}
  }
  const select = (emp) => { setQuery(emp.nombre_completo); setOpen(false); onSelect(emp) }
  const clear = () => { setQuery(''); setResults([]); setOpen(false); onClear() }

  return (
    <div className="relative">
      <div className="flex gap-1">
        <input
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
          value={query}
          onChange={e => search(e.target.value)}
          onFocus={() => query && results.length && setOpen(true)}
          placeholder="Buscar por nombre o número..."
        />
        {value && (
          <button type="button" onClick={clear} className="px-2 text-gray-400 hover:text-red-400 text-lg">×</button>
        )}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 w-full bg-white border border-gray-200 rounded-xl shadow-xl mt-1 max-h-48 overflow-y-auto">
          {results.map(e => (
            <div key={e.id} onClick={() => select(e)} className="px-3 py-2 hover:bg-primary-50 cursor-pointer">
              <div className="text-xs font-semibold text-gray-800">{e.nombre_completo}</div>
              <div className="text-xs text-gray-400">{[e.num_empleado && `#${e.num_empleado}`, e.puesto, e.sucursal_nombre].filter(Boolean).join(' · ')}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── SucursalSearch ────────────────────────────────────────────────────────────
function SucursalSearch({ value, display, onSelect, onClear }) {
  const [query, setQuery] = useState(display || '')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  useEffect(() => { if (!value) setQuery('') }, [value])

  const search = async (q) => {
    setQuery(q)
    if (q.length < 2) { setResults([]); setOpen(false); return }
    try {
      const data = await fetch(`/api/sucursales?search=${encodeURIComponent(q)}&limit=10`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('ti_token')}` }
      }).then(r => r.json())
      setResults((data.data || data).slice(0, 10))
      setOpen(true)
    } catch(_) {}
  }
  const select = (sucursal) => { setQuery(sucursal.nombre); setOpen(false); onSelect(sucursal) }
  const clear = () => { setQuery(''); setResults([]); setOpen(false); onClear() }

  return (
    <div className="relative">
      <div className="flex gap-1">
        <input
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
          value={query}
          onChange={e => search(e.target.value)}
          onFocus={() => query && results.length && setOpen(true)}
          placeholder="Buscar por sucursal, determinante o estado..."
        />
        {value && (
          <button type="button" onClick={clear} className="px-2 text-gray-400 hover:text-red-400 text-lg">×</button>
        )}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 w-full bg-white border border-gray-200 rounded-xl shadow-xl mt-1 max-h-48 overflow-y-auto">
          {results.map(s => (
            <div key={s.id} onClick={() => select(s)} className="px-3 py-2 hover:bg-emerald-50 cursor-pointer">
              <div className="text-xs font-semibold text-gray-800">{s.nombre}</div>
              <div className="text-xs text-gray-400">{[s.determinante && `Det. ${s.determinante}`, s.estado, s.tipo].filter(Boolean).join(' · ')}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── CentroCostoSearch ─────────────────────────────────────────────────────────
function CentroCostoSearch({ value, nombre, onChange }) {
  const [query, setQuery] = useState(nombre || '')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  useEffect(() => { setQuery(nombre || '') }, [nombre])
  const search = async (q) => {
    setQuery(q)
    if (q.length < 1) { setResults([]); setOpen(false); return }
    try {
      const data = await fetch(`/api/centros-costo/search?q=${encodeURIComponent(q)}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('ti_token')}` }
      }).then(r => r.json())
      setResults(data.slice(0, 15)); setOpen(true)
    } catch(_) {}
  }
  const select = (item) => {
    setQuery(`${item.codigo} — ${item.nombre}`)
    setOpen(false)
    onChange(item.codigo, item.nombre)
  }
  const clear = () => { setQuery(''); setResults([]); setOpen(false); onChange('', '') }
  return (
    <div className="relative">
      <div className="flex gap-1">
        <input
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
          value={query}
          onChange={e => search(e.target.value)}
          onFocus={() => query && results.length && setOpen(true)}
          placeholder="Buscar código o nombre..."
        />
        {value && <button type="button" onClick={clear} className="px-2 text-gray-400 hover:text-red-400 text-lg">×</button>}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 w-full bg-white border border-gray-200 rounded-xl shadow-xl mt-1 max-h-48 overflow-y-auto">
          {results.map(r => (
            <div key={r.id} onClick={() => select(r)} className="px-3 py-2 hover:bg-primary-50 cursor-pointer text-xs">
              <span className="font-mono font-semibold text-primary-700 mr-2">{r.codigo}</span>
              <span className="text-gray-600">{r.nombre}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const EMPRESAS = ['Previta','EHT','Medclub']
const fmt = (n) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n || 0)
const fmtDec = (n) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0)
const IVA_RATE = 0.16
const roundMoney = (n) => Math.round(((parseFloat(n) || 0) + Number.EPSILON) * 100) / 100
const isIvaApplied = (d) => d?.aplica_iva === true || d?.aplica_iva === 1 || d?.aplica_iva === '1'
const calcIvaBreakdown = (subtotalValue, aplicaIva) => {
  const subtotal = roundMoney(subtotalValue)
  const total = aplicaIva ? roundMoney(subtotal * (1 + IVA_RATE)) : subtotal
  const iva_monto = aplicaIva ? roundMoney(total - subtotal) : 0
  return { subtotal, iva_monto, total }
}
const calcIvaMonto = (d) => {
  if (!isIvaApplied(d)) return 0
  const stored = parseFloat(d?.iva_monto)
  if (Number.isFinite(stored)) return roundMoney(stored)
  return calcIvaBreakdown(d?.subtotal, true).iva_monto
}

// Calcula el total en MXN de un registro de detalle (usa total_mxn si ya está calculado)
const calcTotalMXN = (d) => {
  if (d.total_mxn != null) return roundMoney(d.total_mxn)
  const total = parseFloat(d.total) || 0
  if (d.moneda === 'USD') return roundMoney(total * (parseFloat(d.tipo_cambio) || 1))
  return roundMoney(total)
}

// ── Gauge (medidor semicircular) ──────────────────────────────────────────────
function GaugeMeter({ porcentaje = 0 }) {
  const pct = Math.min(100, Math.max(0, porcentaje))
  const angle = (pct / 100) * 180
  const r = 70
  const cx = 110, cy = 100
  const startX = cx - r, startY = cy
  const endX = cx + r, endY = cy
  const rad = (angle - 180) * Math.PI / 180
  const arcX = cx + r * Math.cos(rad)
  const arcY = cy + r * Math.sin(rad)
  const color = pct <= 60 ? '#5DB847' : pct <= 85 ? '#e8a820' : '#ef4444'

  return (
    <div className="flex flex-col items-center">
      <svg width="220" height="120" viewBox="0 0 220 120">
        {/* Background arc */}
        <path d={`M ${startX} ${cy} A ${r} ${r} 0 0 1 ${endX} ${cy}`} fill="none" stroke="#e5e7eb" strokeWidth="14" strokeLinecap="round"/>
        {/* Progress arc */}
        {pct > 0 && (
          <path d={`M ${startX} ${cy} A ${r} ${r} 0 ${angle > 180 ? 1 : 0} 1 ${arcX} ${arcY}`} fill="none" stroke={color} strokeWidth="14" strokeLinecap="round"/>
        )}
        {/* Center text */}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="22" fontWeight="bold" fill={color}>{pct.toFixed(1)}%</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize="10" fill="#6b7280">Ejercido</text>
        {/* Labels */}
        <text x={startX - 2} y={cy + 18} textAnchor="middle" fontSize="9" fill="#9ca3af">0%</text>
        <text x={endX + 2} y={cy + 18} textAnchor="end" fontSize="9" fill="#9ca3af">100%</text>
      </svg>
      <div className="text-center -mt-2">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${pct <= 60 ? 'bg-green-100 text-green-700' : pct <= 85 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
          {pct <= 60 ? '✓ Bajo control' : pct <= 85 ? '⚠ Vigilar' : '✗ Excedido'}
        </span>
      </div>
    </div>
  )
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color = 'green' }) {
  const colors = {
    green: 'border-l-4 border-primary-500',
    navy: 'border-l-4 border-navy-600',
    gold: 'border-l-4 border-gold-500',
    gray: 'border-l-4 border-gray-400',
  }
  const valColors = { green: 'text-primary-600', navy: 'text-navy-700', gold: 'text-gold-600', gray: 'text-gray-600' }
  return (
    <div className={`bg-white rounded-xl p-4 shadow-sm ${colors[color]}`}>
      <div className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">{label}</div>
      <div className={`text-2xl font-bold ${valColors[color]}`}>{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  )
}

// ── Selector de período ───────────────────────────────────────────────────────
function PeriodSelector({ value, onChange }) {
  const [modo, setModo] = useState('mes') // 'mes' | 'q' | 'anual'
  const [meses, setMeses] = useState([1,2,3]) // selected months
  const [q, setQ] = useState(1)
  const [anio, setAnio] = useState(new Date().getFullYear())

  useEffect(() => {
    if (modo === 'mes') onChange({ meses, anio })
    else if (modo === 'q') {
      const m = [1,2,3].map(x => (q-1)*3 + x)
      onChange({ meses: m, anio })
    } else {
      onChange({ meses: [1,2,3,4,5,6,7,8,9,10,11,12], anio })
    }
  }, [modo, meses, q, anio])

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 flex flex-wrap items-center gap-3">
      {/* Modo */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
        {[['mes','Mensual'],['q','Trimestral'],['anual','Anual']].map(([k,l]) => (
          <button key={k} onClick={() => setModo(k)} className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${modo===k ? 'bg-white shadow text-primary-700' : 'text-gray-500 hover:text-gray-700'}`}>{l}</button>
        ))}
      </div>
      {/* Año */}
      <select className="border border-gray-200 rounded-lg px-2 py-1 text-xs" value={anio} onChange={e => setAnio(parseInt(e.target.value))}>
        {[2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
      </select>
      {/* Meses (modo mes) */}
      {modo === 'mes' && (
        <div className="flex gap-1 flex-wrap">
          {MESES.map((m, i) => (
            <button key={i} onClick={() => setMeses(prev => prev.includes(i+1) ? prev.filter(x=>x!==i+1) : [...prev,i+1].sort((a,b)=>a-b))}
              className={`px-2 py-0.5 rounded-full text-xs border transition-all ${meses.includes(i+1) ? 'bg-primary-500 text-white border-primary-500' : 'border-gray-200 text-gray-500 hover:border-primary-300'}`}>
              {m.slice(0,3)}
            </button>
          ))}
        </div>
      )}
      {/* Q selector */}
      {modo === 'q' && (
        <div className="flex gap-1">
          {[1,2,3,4].map(n => (
            <button key={n} onClick={() => setQ(n)} className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${q===n ? 'bg-primary-500 text-white border-primary-500' : 'border-gray-200 text-gray-500'}`}>Q{n}</button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Custom tooltip ────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs">
      <div className="font-semibold text-gray-700 mb-2">{MESES[(label||1)-1]}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 mb-1">
          <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{background: p.fill}} />
          <span className="text-gray-600">{p.name}:</span>
          <span className="font-semibold text-gray-800">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

// ── Tab Presupuesto Dashboard ─────────────────────────────────────────────────
const COL_DEFS = [
  { key: 'empresa',     label: 'Empresa' },
  { key: 'agrupador',   label: 'Agrupador' },
  { key: 'proveedor',   label: 'Proveedor' },
  { key: 'concepto',    label: 'Concepto' },
  { key: 'presupuesto', label: 'Presupuesto' },
  { key: 'gasto_real',  label: 'Gasto Real' },
  { key: 'ahorro',      label: 'Ahorro' },
  { key: 'variacion',   label: 'Variación' },
]

function TabPresupuesto() {
  const { showError } = useNotification()
  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filtros, setFiltros] = useState({ anio: new Date().getFullYear(), empresa: '', agrupador: '', proveedor: '' })
  const [proveedorInput, setProveedorInput] = useState('')
  const [periodo, setPeriodo] = useState({ meses: [1,2,3], anio: new Date().getFullYear() })
  const [agrupadores, setAgrupadores] = useState([])
  // Partidas table controls
  const [tablaBusq, setTablaBusq] = useState('')
  const [tablaPageSize, setTablaPageSize] = useState(20)
  const [tablaPage, setTablaPage] = useState(0)
  const [showColMenu, setShowColMenu] = useState(false)
  const [colsVisible, setColsVisible] = useState({ empresa:true, agrupador:true, proveedor:false, concepto:true, presupuesto:true, gasto_real:true, ahorro:true, variacion:true })
  const [colOrder, setColOrder] = useState(['empresa','agrupador','proveedor','concepto','presupuesto','gasto_real','ahorro','variacion'])
  // Modal gasto
  const [modalGasto, setModalGasto] = useState(null) // { partida, mes }
  const [gastoForm, setGastoForm] = useState({ gasto_real: '', factura_folio: '', ahorro_soporte: '', ahorro_descripcion: '' })
  const [savingGasto, setSavingGasto] = useState(false)
  // Modal cambio presupuesto
  const [modalCambio, setModalCambio] = useState(null)
  const [cambioForm, setCambioForm] = useState({ monto_nuevo: '', nota: '' })

  const load = useCallback(() => {
    setLoading(true)
    const nowY = new Date().getFullYear(), nowM = new Date().getMonth() + 1
    const mesEfectivo = periodo.anio < nowY ? 12 : (periodo.anio > nowY ? 0 : nowM)
    presupuestoAPI.getDashboard({ anio: periodo.anio, empresa: filtros.empresa, agrupador: filtros.agrupador, proveedor: filtros.proveedor, mes_actual: mesEfectivo })
      .then(setDashboard).finally(() => setLoading(false))
    presupuestoAPI.getAgrupadores().then(setAgrupadores)
  }, [filtros, periodo.anio])

  useEffect(() => { load() }, [load])

  // Debounce del filtro proveedor: actualiza filtros.proveedor 400ms después de que el usuario deje de escribir
  useEffect(() => {
    const t = setTimeout(() => setFiltros(f => ({ ...f, proveedor: proveedorInput })), 400)
    return () => clearTimeout(t)
  }, [proveedorInput])

  // Filter chart data by selected months
  const chartData = dashboard?.meses?.filter(m => periodo.meses.includes(m.mes))
    .map(m => ({ ...m, name: m.mes, label: MESES[m.mes-1].slice(0,3) })) || []

  const saveGasto = async () => {
    if (!modalGasto) return
    setSavingGasto(true)
    try {
      await presupuestoAPI.saveGasto({
        partida_id: modalGasto.partida.id, mes: modalGasto.mes, anio: periodo.anio,
        gasto_real: parseFloat(gastoForm.gasto_real) || 0,
        factura_folio: gastoForm.factura_folio,
        ahorro_soporte: parseFloat(gastoForm.ahorro_soporte) || 0,
        ahorro_descripcion: gastoForm.ahorro_descripcion
      })
      setModalGasto(null)
      load()
    } catch(e) { showError(e?.message || 'Error') }
    finally { setSavingGasto(false) }
  }

  if (loading) return <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent"/></div>
  // ── KPIs dinámicos según período seleccionado ────────────────────────────────
  // Presupuesto = refleja el período seleccionado (cambia con el selector)
  // Gasto Real / Ahorro / No Ejercido = solo hasta el mes corriente
  const nowMonth = new Date().getMonth() + 1
  const mesesData = dashboard?.meses || []
  const selectedElapsed = periodo.meses.filter(m => m <= nowMonth) // meses del período que ya pasaron

  const kpiPresupuesto    = mesesData.filter(m => periodo.meses.includes(m.mes)).reduce((s, m) => s + m.presupuesto, 0)
  const kpiGasto          = mesesData.filter(m => selectedElapsed.includes(m.mes)).reduce((s, m) => s + m.gasto_real, 0)
  const kpiAhorro         = mesesData.filter(m => selectedElapsed.includes(m.mes)).reduce((s, m) => s + m.ahorro_soporte, 0)
  // No Ejercido: solo en meses con actividad (gasto > 0 o ahorro > 0)
  const mesesConActividad = mesesData.filter(m => selectedElapsed.includes(m.mes) && (m.gasto_real > 0 || m.ahorro_soporte > 0))
  const kpiPresupuestoActivo = mesesConActividad.reduce((s, m) => s + m.presupuesto, 0)
  const kpiNoEjercido     = Math.max(0, kpiPresupuestoActivo - kpiGasto - kpiAhorro)
  const kpiPresupuestoHoy = mesesData.filter(m => selectedElapsed.includes(m.mes)).reduce((s, m) => s + m.presupuesto, 0)
  const kpiPct            = kpiPresupuestoHoy > 0 ? (kpiGasto / kpiPresupuestoHoy) * 100 : 0

  // Computed for partidas table
  const orderedVisibleCols = colOrder.map(k => COL_DEFS.find(c => c.key === k)).filter(c => c && colsVisible[c.key])
  const filteredPartidas = (dashboard?.partidas || []).filter(p => {
    if (!tablaBusq) return true
    const q = tablaBusq.toLowerCase()
    return (p.concepto||'').toLowerCase().includes(q)||(p.proveedor||'').toLowerCase().includes(q)||
           (p.empresa||'').toLowerCase().includes(q)||(p.agrupador||'').toLowerCase().includes(q)
  })
  const totalPages = Math.ceil(filteredPartidas.length / tablaPageSize)
  const pagedPartidas = filteredPartidas.slice(tablaPage * tablaPageSize, (tablaPage + 1) * tablaPageSize)

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm" value={filtros.empresa} onChange={e => setFiltros(f => ({...f, empresa: e.target.value}))}>
          <option value="">Todas las empresas</option>
          {EMPRESAS.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <select className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm" value={filtros.agrupador} onChange={e => setFiltros(f => ({...f, agrupador: e.target.value}))}>
          <option value="">Todos los agrupadores</option>
          {agrupadores.map(a => <option key={a.id} value={a.nombre}>{a.nombre}</option>)}
        </select>
        <input className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-44" placeholder="Filtrar proveedor..." value={proveedorInput} onChange={e => setProveedorInput(e.target.value)} />
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 text-primary-700 border border-primary-200 rounded-lg text-sm hover:bg-primary-100">
          <ArrowPathIcon className="h-4 w-4" /> Actualizar
        </button>
      </div>

      {/* KPIs + Gauge */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Presupuesto" value={fmt(kpiPresupuesto)}
            sub={periodo.meses.length === 12 ? 'Anual' : `${periodo.meses.length} mes${periodo.meses.length > 1 ? 'es' : ''} seleccionado${periodo.meses.length > 1 ? 's' : ''}`}
            color="green" />
          <KpiCard label="Gasto Real" value={fmt(kpiGasto)}
            sub={`Hasta ${MESES[nowMonth-1]}`} color="navy" />
          <KpiCard label="Ahorrado Soporte" value={fmt(kpiAhorro)}
            sub={`Hasta ${MESES[nowMonth-1]}`} color="gold" />
          <KpiCard label="No Ejercido" value={fmt(kpiNoEjercido)}
            sub={`Hasta ${MESES[nowMonth-1]}`} color="gray" />
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col items-center justify-center">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Objetivo</div>
          <GaugeMeter porcentaje={kpiPct} />
        </div>
      </div>

      {/* Period selector */}
      <PeriodSelector value={periodo} onChange={p => setPeriodo(prev => ({...prev, meses: p.meses, anio: p.anio || prev.anio}))} />

      {/* Bar Chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Análisis de Presupuesto por Período</h3>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 20, bottom: 5 }} barCategoryGap="25%" barGap={3}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b7280' }} />
            <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="presupuesto" name="Presupuesto" fill="#5DB847" radius={[3,3,0,0]} />
            <Bar dataKey="gasto_real" name="Gasto Real" fill="#1a3471" radius={[3,3,0,0]} />
            <Bar dataKey="ahorro_soporte" name="Ahorrado por Soporte" fill="#e8a820" radius={[3,3,0,0]} />
            <Bar dataKey="no_ejercido" name="No Ejercido" fill="#d1d5db" radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Partidas table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Table toolbar */}
        <div className="px-5 py-3 border-b border-gray-100 flex flex-wrap items-center gap-3">
          <h3 className="text-sm font-semibold text-gray-700 flex-shrink-0">Detalle por Partida</h3>
          <span className="text-xs text-gray-400">{filteredPartidas.length} de {dashboard?.partidas?.length || 0} partidas</span>
          {periodo.meses.length > 0 && (
            <span className="text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full">
              {periodo.meses.length === 12
                ? 'Anual'
                : periodo.meses.length === 1
                  ? MESES[periodo.meses[0]-1]
                  : `${MESES[periodo.meses[0]-1]} – ${MESES[periodo.meses[periodo.meses.length-1]-1]}`}
            </span>
          )}
          <div className="flex-1"/>
          {/* Búsqueda */}
          <div className="relative">
            <MagnifyingGlassIcon className="h-3.5 w-3.5 text-gray-400 absolute left-2.5 top-2" />
            <input
              className="border border-gray-200 rounded-lg pl-7 pr-3 py-1.5 text-xs w-52"
              placeholder="Buscar concepto, proveedor..."
              value={tablaBusq}
              onChange={e => { setTablaBusq(e.target.value); setTablaPage(0) }}
            />
          </div>
          {/* Columnas */}
          <div className="relative">
            <button onClick={() => setShowColMenu(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50">
              <Cog6ToothIcon className="h-3.5 w-3.5" /> Columnas
            </button>
            {showColMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowColMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-xl p-3 w-52">
                  <div className="text-xs font-semibold text-gray-600 mb-2">Visibles / Orden</div>
                  {colOrder.map((key, i) => {
                    const c = COL_DEFS.find(d => d.key === key)
                    if (!c) return null
                    return (
                      <div key={key} className="flex items-center justify-between py-1 border-b border-gray-50 last:border-0">
                        <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer flex-1">
                          <input type="checkbox" checked={!!colsVisible[key]}
                            onChange={() => setColsVisible(v => ({...v, [key]: !v[key]}))}
                            className="accent-primary-600" />
                          {c.label}
                        </label>
                        <div className="flex gap-0.5 ml-2">
                          <button disabled={i===0}
                            onClick={() => setColOrder(prev => { const a=[...prev]; [a[i-1],a[i]]=[a[i],a[i-1]]; return a })}
                            className="px-1 py-0.5 rounded hover:bg-gray-100 disabled:opacity-30 text-gray-400 text-xs">↑</button>
                          <button disabled={i===colOrder.length-1}
                            onClick={() => setColOrder(prev => { const a=[...prev]; [a[i],a[i+1]]=[a[i+1],a[i]]; return a })}
                            className="px-1 py-0.5 rounded hover:bg-gray-100 disabled:opacity-30 text-gray-400 text-xs">↓</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
          {/* Registros por página */}
          <select className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
            value={tablaPageSize}
            onChange={e => { setTablaPageSize(parseInt(e.target.value)); setTablaPage(0) }}>
            {[10,20,50].map(n => <option key={n} value={n}>{n} / pág</option>)}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {orderedVisibleCols.map(c => (
                  <th key={c.key} className={`px-4 py-2.5 text-xs font-medium text-gray-500 uppercase ${['presupuesto','gasto_real','ahorro','variacion'].includes(c.key) ? 'text-right' : 'text-left'}`}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pagedPartidas.length === 0 ? (
                <tr><td colSpan={orderedVisibleCols.length || 1} className="py-10 text-center text-gray-400 text-sm">
                  {tablaBusq ? 'Sin resultados para la búsqueda.' : 'No hay partidas. Agrega partidas en Configuración.'}
                </td></tr>
              ) : pagedPartidas.map(p => {
                // Period-aware calculations using the selected months from PeriodSelector
                const montosArr = Array.isArray(p.montos_por_mes) ? p.montos_por_mes : new Array(12).fill(p.monto_mensual || 0)
                const gastosArr = p.gastos_por_mes || new Array(12).fill(0)
                const ahorroArr = p.ahorro_por_mes || new Array(12).fill(0)
                const mesesElapsed = periodo.meses.filter(m => m <= nowMonth)
                const presupuestoPeriodo = periodo.meses.reduce((s, m) => s + (montosArr[m-1] || 0), 0)
                const gastoPeriodo = mesesElapsed.reduce((s, m) => s + (gastosArr[m-1] || 0), 0)
                const ahoorroPeriodo = mesesElapsed.reduce((s, m) => s + (ahorroArr[m-1] || 0), 0)
                const variacion = presupuestoPeriodo - gastoPeriodo
                const colMap = {
                  empresa:     <td key="empresa" className="px-4 py-2.5"><span className="text-xs bg-navy-100 text-navy-700 px-2 py-0.5 rounded-full">{p.empresa}</span></td>,
                  agrupador:   <td key="agrupador" className="px-4 py-2.5 text-gray-600 text-xs">{p.agrupador}</td>,
                  proveedor:   <td key="proveedor" className="px-4 py-2.5 text-gray-500 text-xs">{p.proveedor || '—'}</td>,
                  concepto:    <td key="concepto" className="px-4 py-2.5 font-medium text-gray-800 max-w-xs">{p.concepto}</td>,
                  presupuesto: <td key="presupuesto" className="px-4 py-2.5 text-right font-mono text-gray-700">{fmt(presupuestoPeriodo)}</td>,
                  gasto_real:  <td key="gasto_real" className="px-4 py-2.5 text-right font-mono text-navy-700">{fmt(gastoPeriodo)}</td>,
                  ahorro:      <td key="ahorro" className="px-4 py-2.5 text-right font-mono text-gold-600">{fmt(ahoorroPeriodo)}</td>,
                  variacion:   <td key="variacion" className={`px-4 py-2.5 text-right font-mono font-semibold ${variacion >= 0 ? 'text-primary-600' : 'text-red-500'}`}>{variacion >= 0 ? '+' : ''}{fmt(variacion)}</td>,
                }
                return <tr key={p.id} className="hover:bg-gray-50">{orderedVisibleCols.map(c => colMap[c.key])}</tr>
              })}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              Mostrando {tablaPage * tablaPageSize + 1}–{Math.min((tablaPage+1)*tablaPageSize, filteredPartidas.length)} de {filteredPartidas.length}
            </span>
            <div className="flex items-center gap-1">
              <button disabled={tablaPage === 0} onClick={() => setTablaPage(p => p-1)}
                className="px-2.5 py-1 rounded border border-gray-200 text-xs disabled:opacity-30 hover:bg-gray-50">←</button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                const pg = totalPages <= 7 ? i : (tablaPage < 4 ? i : (tablaPage > totalPages-4 ? totalPages-7+i : tablaPage-3+i))
                return (
                  <button key={pg} onClick={() => setTablaPage(pg)}
                    className={`px-2.5 py-1 rounded border text-xs ${tablaPage===pg ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-200 hover:bg-gray-50'}`}>
                    {pg+1}
                  </button>
                )
              })}
              <button disabled={tablaPage >= totalPages-1} onClick={() => setTablaPage(p => p+1)}
                className="px-2.5 py-1 rounded border border-gray-200 text-xs disabled:opacity-30 hover:bg-gray-50">→</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── BulkDeleteConfirm ─────────────────────────────────────────────────────────
function BulkDeleteConfirm({ count, onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backdropFilter: 'blur(4px)', background: 'rgba(0,0,0,0.4)', animation: 'fadeIn 0.2s ease' }}>
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center"
        style={{ animation: 'scaleIn 0.25s cubic-bezier(0.34,1.56,0.64,1)' }}>
        {loading ? (
          <>
            <div className="text-5xl mb-4 animate-bounce">🗑️</div>
            <div className="text-lg font-bold text-gray-800 mb-2">Eliminando...</div>
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-red-500 border-t-transparent mt-2" />
          </>
        ) : (
          <>
            <div className="text-5xl mb-4">⚠️</div>
            <div className="text-lg font-bold text-gray-800 mb-2">¿Eliminar {count} registro{count !== 1 ? 's' : ''}?</div>
            <div className="text-sm text-gray-500 mb-6">Esta acción no se puede deshacer. Se eliminarán permanentemente del desgloce.</div>
            <div className="flex gap-3">
              <button onClick={onCancel} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-gray-600 font-medium hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={onConfirm} className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700">
                Sí, eliminar
              </button>
            </div>
          </>
        )}
      </div>
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes scaleIn { from { transform: scale(0.85); opacity: 0 } to { transform: scale(1); opacity: 1 } }
      `}</style>
    </div>
  )
}

// ── Tab Desgloce de Gastos ────────────────────────────────────────────────────
function TabDesgloce() {
  const { showError, showSuccess } = useNotification()
  const now = new Date()
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [anio, setAnio] = useState(now.getFullYear())
  const [detalle, setDetalle] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // 'new' | 'edit' | 'clonar'
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [serieSearch, setSerieSearch] = useState('')
  const [proveedoresLista, setProveedoresLista] = useState([])
  const [clonarForm, setClonarForm] = useState({ mes_origen: now.getMonth(), anio_origen: now.getFullYear() })
  const [selected, setSelected] = useState(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [showBulkConfirm, setShowBulkConfirm] = useState(false)
  const [facturaBulk, setFacturaBulk] = useState(null)
  const [facturaBulkFolio, setFacturaBulkFolio] = useState('')

  // ── Filtros y ordenamiento ──────────────────────────────────────────────────
  const [showFilters, setShowFilters] = useState(false)
  const [filtros, setFiltros] = useState({ proveedor: '', partida: '', factura: '', centroCosto: '', texto: '' })
  const [sortConfig, setSortConfig] = useState({ campo: '', dir: 'asc' })
  // ── Vista agrupada ──────────────────────────────────────────────────────────
  const [agrupar, setAgrupar] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState(new Set())
  const toggleGroup = (key) => setExpandedGroups(prev => {
    const next = new Set(prev)
    if (next.has(key)) next.delete(key); else next.add(key)
    return next
  })

  const setFiltro = (key, val) => setFiltros(f => ({ ...f, [key]: val }))
  const limpiarFiltros = () => setFiltros({ proveedor: '', partida: '', factura: '', centroCosto: '', texto: '' })
  const filtrosActivos = Object.values(filtros).some(v => v.trim() !== '')

  const toggleSort = (campo) => {
    setSortConfig(prev => prev.campo === campo
      ? { campo, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { campo, dir: 'asc' }
    )
  }

  const detalleFiltrado = useMemo(() => {
    let rows = [...detalle]

    if (filtros.proveedor)    rows = rows.filter(d => (d.proveedor || '').toLowerCase().includes(filtros.proveedor.toLowerCase()))
    if (filtros.partida)      rows = rows.filter(d => (d.tipo_servicio || d.nombre || '').toLowerCase().includes(filtros.partida.toLowerCase()))
    if (filtros.factura)      rows = rows.filter(d => (d.factura_folio || '').toLowerCase().includes(filtros.factura.toLowerCase()))
    if (filtros.centroCosto)  rows = rows.filter(d => (d.centro_costo_codigo || d.centro_costo_nombre || '').toLowerCase().includes(filtros.centroCosto.toLowerCase()))
    if (filtros.texto)        rows = rows.filter(d => JSON.stringify(d).toLowerCase().includes(filtros.texto.toLowerCase()))

    if (sortConfig.campo) {
      rows.sort((a, b) => {
        let va = a[sortConfig.campo] ?? ''
        let vb = b[sortConfig.campo] ?? ''
        if (typeof va === 'number' && typeof vb === 'number') {
          return sortConfig.dir === 'asc' ? va - vb : vb - va
        }
        va = String(va).toLowerCase(); vb = String(vb).toLowerCase()
        if (va < vb) return sortConfig.dir === 'asc' ? -1 : 1
        if (va > vb) return sortConfig.dir === 'asc' ? 1 : -1
        return 0
      })
    }
    return rows
  }, [detalle, filtros, sortConfig])

  // ── Agrupado por proveedor ──────────────────────────────────────────────────
  const agrupadoData = useMemo(() => {
    const grupos = {}
    detalleFiltrado.forEach(d => {
      // Agrupar por proveedor
      const key = d.proveedor || '(Sin proveedor)'
      if (!grupos[key]) {
        grupos[key] = {
          key,
          proveedor: d.proveedor || '(Sin proveedor)',
          aplica_iva: false,
          lines: [],
          subtotal: 0, iva_monto: 0, total: 0, total_mxn: 0,
        }
      }
      grupos[key].lines.push(d)
      grupos[key].subtotal  += roundMoney(d.subtotal)
      grupos[key].iva_monto += calcIvaMonto(d)
      grupos[key].total     += roundMoney(d.total)
      grupos[key].total_mxn += calcTotalMXN(d)
      if (isIvaApplied(d)) grupos[key].aplica_iva = true
    })
    return Object.values(grupos).sort((a, b) => a.proveedor.localeCompare(b.proveedor))
  }, [detalleFiltrado])

  // ── Exportar ────────────────────────────────────────────────────────────────
  const buildExportRows = () => detalleFiltrado.map(d => ({
    'Nombre / Descripción': d.nombre || '',
    'Serie / Teléfono':     d.telefono_serie || '',
    'Tipo Servicio':        d.tipo_servicio || '',
    'Proveedor':            d.proveedor || '',
    'Factura':              d.factura_folio || '',
    'Días':                 d.dias_facturados || 0,
    'Costo/Día':            d.costo_dia || 0,
    'Subtotal':             roundMoney(d.subtotal),
    'IVA':                  calcIvaMonto(d),
    'Total':                roundMoney(d.total),
    'Total MXN':            calcTotalMXN(d),
    'Moneda':               d.moneda || 'MXN',
    'Centro Costo':         d.centro_costo_codigo || '',
    'Asignado a':           d.empleado_nombre || d.sucursal_nombre || '',
    'Tipo asignación':      d.empleado_nombre ? 'Empleado' : d.sucursal_nombre ? 'Sucursal' : '',
    'Tipo':                 d.identificador || '',
    'Departamento':         d.departamento || '',
    'Factura Folio':        d.factura_folio || '',
  }))

  const exportCSV = () => {
    const rows = buildExportRows()
    if (!rows.length) return showError('No hay datos para exportar')
    const headers = Object.keys(rows[0])
    const csvContent = [
      headers.join(','),
      ...rows.map(r => headers.map(h => `"${String(r[h]).replace(/"/g, '""')}"`).join(','))
    ].join('\n')
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    saveAs(blob, `desgloce_gastos_${MESES[mes-1]}_${anio}.csv`)
    showSuccess('CSV exportado correctamente')
  }

  const exportExcel = () => {
    const rows = buildExportRows()
    if (!rows.length) return showError('No hay datos para exportar')
    const ws = XLSX.utils.json_to_sheet(rows)
    const colWidths = Object.keys(rows[0]).map(k => ({ wch: Math.max(k.length, 16) }))
    ws['!cols'] = colWidths
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, `${MESES[mes-1]} ${anio}`)
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    saveAs(new Blob([buf], { type: 'application/octet-stream' }), `desgloce_gastos_${MESES[mes-1]}_${anio}.xlsx`)
    showSuccess('Excel exportado correctamente')
  }

  const exportPDF = () => {
    const rows = buildExportRows()
    if (!rows.length) return showError('No hay datos para exportar')
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' })
    const pageW = doc.internal.pageSize.getWidth()

    // Encabezado
    doc.setFillColor(30, 41, 59)
    doc.rect(0, 0, pageW, 46, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text(`Desgloce de Gastos — ${MESES[mes-1]} ${anio}`, 24, 28)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(`Exportado: ${new Date().toLocaleDateString('es-MX')}   Registros: ${rows.length}`, 24, 40)

    // Tabla manual
    const cols = ['Nombre','Serie/Tel','Servicio','Proveedor','Factura','Días','Subtotal','IVA','Total','CC','Tipo']
    const fields = ['Nombre / Descripción','Serie / Teléfono','Tipo Servicio','Proveedor','Factura','Días','Subtotal','IVA','Total','Centro Costo','Tipo']
    const colW =  [120, 70, 80, 90, 65, 30, 65, 55, 65, 50, 50]
    const startX = 20
    let y = 66

    // Encabezado tabla
    doc.setFillColor(241, 245, 249)
    doc.rect(startX, y - 12, colW.reduce((a,b)=>a+b,0), 16, 'F')
    doc.setTextColor(71, 85, 105)
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'bold')
    let cx = startX
    cols.forEach((c, i) => { doc.text(c, cx + 3, y); cx += colW[i] })
    y += 8

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    const fmtN = (n) => new Intl.NumberFormat('es-MX', { style:'currency', currency:'MXN', minimumFractionDigits:0 }).format(n||0)

    rows.forEach((r, ri) => {
      if (y > 520) {
        doc.addPage()
        y = 30
      }
      if (ri % 2 === 0) {
        doc.setFillColor(248, 250, 252)
        doc.rect(startX, y - 10, colW.reduce((a,b)=>a+b,0), 14, 'F')
      }
      doc.setTextColor(30, 41, 59)
      cx = startX
      fields.forEach((f, i) => {
        let val = String(r[f] ?? '')
        if (['Subtotal','IVA','Total'].includes(cols[i])) val = fmtN(r[f])
        if (['Días'].includes(cols[i])) val = String(r[f] || 0)
        const maxW = colW[i] - 6
        const truncated = doc.getStringUnitWidth(val) * 7 > maxW ? val.slice(0, Math.floor(maxW / 4.2)) + '…' : val
        doc.text(truncated, cx + 3, y)
        cx += colW[i]
      })
      y += 14
    })

    // Totales
    y += 8
    const totalSum = rows.reduce((s, r) => s + (r['Total'] || 0), 0)
    const ivaSum   = rows.reduce((s, r) => s + (r['IVA'] || 0), 0)
    const subSum   = rows.reduce((s, r) => s + (r['Subtotal'] || 0), 0)
    doc.setFillColor(30, 41, 59); doc.rect(startX, y - 12, colW.reduce((a,b)=>a+b,0), 18, 'F')
    doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(8)
    doc.text(`Subtotal: ${fmtN(subSum)}   IVA: ${fmtN(ivaSum)}   Total: ${fmtN(totalSum)}`, startX + 6, y)

    doc.save(`desgloce_gastos_${MESES[mes-1]}_${anio}.pdf`)
    showSuccess('PDF exportado correctamente')
  }

  const load = useCallback(() => {
    setLoading(true)
    presupuestoAPI.getDetalle({ mes, anio }).then(r => setDetalle(r.data || r)).finally(() => setLoading(false))
  }, [mes, anio])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    presupuestoAPI.getProveedoresLista().then(setProveedoresLista).catch(() => {})
  }, [])

  const openNew = () => {
    setForm({
      mes, anio,
      nombre: '', email: '', telefono_serie: '',
      departamento: '', subdepartamento: '', puesto: '',
      tiene_vigencia: false, contrato_vigencia: '',
      proveedor: '', partida_id: '', factura_folio: '',
      tipo_servicio: '', moneda: 'MXN', tipo_cambio: 1,
      modo_calculo: 'dias',
      dias_facturados: 30, costo_dia: '', subtotal_directo: '',
      aplica_iva: true,
      identificador: 'Administrativo',
      centro_costo_codigo: '', centro_costo_nombre: '',
      ahorro_soporte: '', ahorro_descripcion: '',
      asignacion_gasto_tipo: 'ninguno',
      es_gasto_usuario: false,
      empleado_id: null, empleado_nombre: '',
      sucursal_id: null, sucursal_nombre: ''
    })
    setModal('new')
  }
  const openEdit = (d) => {
    setForm({
      ...d,
      aplica_iva: !!d.aplica_iva,
      tiene_vigencia: !!d.tiene_vigencia,
      modo_calculo: d.modo_calculo || 'dias',
      subtotal_directo: d.modo_calculo === 'total' ? d.subtotal : '',
      ahorro_soporte: '', ahorro_descripcion: '',
      asignacion_gasto_tipo: (d.sucursal_id || d.sucursal_nombre) ? 'sucursal' : d.es_gasto_usuario ? 'empleado' : 'ninguno',
      es_gasto_usuario: !!d.es_gasto_usuario,
      empleado_id: d.empleado_id || null,
      empleado_nombre: d.empleado_nombre || '',
      sucursal_id: d.sucursal_id || null,
      sucursal_nombre: d.sucursal_nombre || ''
    })
    setModal('edit')
  }

  const buscarPorSerie = async (serie) => {
    if (!serie || serie.length < 3) return
    try {
      const dev = await presupuestoAPI.buscarPorSerie(serie)
      if (dev) setForm(f => ({ ...f, costo_dia: dev.costo_dia || f.costo_dia, tipo_servicio: dev.tipo || f.tipo_servicio, dispositivo_id: dev.id }))
    } catch(_) {}
  }

  // Convierte el total de una línea guardada a MXN (para comparativas de presupuesto)
  const toMXN = (d) => {
    // Preferir total_mxn si ya está calculado (líneas nuevas/editadas)
    if (d.total_mxn != null) return roundMoney(d.total_mxn)
    const total = parseFloat(d.total) || 0
    const tc    = parseFloat(d.tipo_cambio) || 1
    return d.moneda === 'USD' ? roundMoney(total * tc) : roundMoney(total)
  }

  const calcTotals = (f) => {
    let subtotal
    if (f.modo_calculo === 'total') {
      subtotal = parseFloat(f.subtotal_directo) || 0
    } else {
      subtotal = (parseFloat(f.dias_facturados) || 0) * (parseFloat(f.costo_dia) || 0)
    }
    const { subtotal: subtotalCalc, iva_monto, total } = calcIvaBreakdown(subtotal, f.aplica_iva === true || f.aplica_iva === 1 || f.aplica_iva === '1')
    // Equivalente en MXN para comparativa vs presupuesto (partida siempre es MXN)
    const tc       = parseFloat(f.tipo_cambio) || 1
    const totalMXN = f.moneda === 'USD' ? roundMoney(total * tc) : total
    return { subtotal: subtotalCalc, iva_monto, total, totalMXN }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = {
        ...form,
        subtotal_directo: form.modo_calculo === 'total' ? (parseFloat(form.subtotal_directo) || 0) : undefined,
      }
      delete payload.asignacion_gasto_tipo
      if (modal === 'new') await presupuestoAPI.createDetalle(payload)
      else await presupuestoAPI.updateDetalle(form.id, payload)

      // Si hay ahorro_soporte registrado, guardarlo en presupuesto_gastos_mes
      const ahorro = parseFloat(form.ahorro_soporte) || 0
      if (form.partida_id && ahorro > 0) {
        await presupuestoAPI.saveGasto({
          partida_id: form.partida_id,
          mes: form.mes,
          anio: form.anio,
          ahorro_soporte: ahorro,
          ahorro_descripcion: form.ahorro_descripcion || ''
        })
      }

      setModal(null)
      load()
    } catch(e) { showError(e?.message || 'Error') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este registro?')) return
    await presupuestoAPI.deleteDetalle(id)
    load()
  }

  const handleBulkDelete = async () => {
    setBulkDeleting(true)
    try {
      await presupuestoAPI.bulkDeleteDetalle([...selected])
      await new Promise(r => setTimeout(r, 800))
      setShowBulkConfirm(false)
      setSelected(new Set())
      load()
    } catch(e) { showError(e?.message || 'Error al eliminar') }
    finally { setBulkDeleting(false) }
  }

  const openFacturaBulk = (rows, label = 'líneas seleccionadas') => {
    const lines = rows.filter(Boolean)
    if (!lines.length) return
    const folios = [...new Set(lines.map(d => d.factura_folio || '').filter(Boolean))]
    setFacturaBulk({
      ids: lines.map(d => d.id),
      count: lines.length,
      label,
      sample: lines.slice(0, 5),
    })
    setFacturaBulkFolio(folios.length === 1 ? folios[0] : '')
  }

  const handleFacturaBulk = async () => {
    const folio = facturaBulkFolio.trim()
    if (!facturaBulk?.ids?.length) return
    if (!folio) return showError('Captura el folio de factura para continuar')

    setSaving(true)
    try {
      const r = await presupuestoAPI.bulkUpdateFactura(facturaBulk.ids, folio)
      setFacturaBulk(null)
      setFacturaBulkFolio('')
      setSelected(new Set())
      load()
      showSuccess(`${r.actualizados} línea${r.actualizados !== 1 ? 's' : ''} actualizada${r.actualizados !== 1 ? 's' : ''} con la factura ${folio}`)
    } catch(e) { showError(e?.message || 'Error al actualizar folio') }
    finally { setSaving(false) }
  }

  const handleClonar = async () => {
    setSaving(true)
    try {
      const r = await presupuestoAPI.clonarMes({ ...clonarForm, mes_destino: mes, anio_destino: anio })
      setModal(null)
      load()
      showSuccess(`${r.clonados} registros clonados correctamente`)
    } catch(e) { showError(e?.message || 'Error') }
    finally { setSaving(false) }
  }

  const { subtotal, iva_monto, total, totalMXN } = calcTotals(form)

  // Presupuesto de la partida seleccionada para el mes del form
  const selPartida = proveedoresLista.find(p => p.partida_id === form.partida_id)
  const _mpm = Array.isArray(selPartida?.montos_por_mes) ? selPartida.montos_por_mes : null
  const partidaBudgetMes = selPartida
    ? (_mpm ? (_mpm[(form.mes || mes) - 1] || 0) : (selPartida.monto_mensual || 0))
    : 0

  // Gasto acumulado en MXN = suma de TODAS las líneas de la misma partida en el mismo mes,
  // excluyendo la línea que se está editando (para no duplicarla) + total MXN del form actual
  const gastoOtrasLineas = detalle
    .filter(d => d.partida_id === form.partida_id && d.id !== form.id)
    .reduce((s, d) => s + toMXN(d), 0)
  const gastoAcumulado = gastoOtrasLineas + totalMXN

  const diferencia = partidaBudgetMes - gastoAcumulado
  const ahorroVal = parseFloat(form.ahorro_soporte) || 0
  const noEjercidoVal = Math.max(0, diferencia - ahorroVal)

  const totalesGlobal = detalleFiltrado.reduce((acc, d) => {
    const tc  = parseFloat(d.tipo_cambio) || 1
    const mxnFactor = d.moneda === 'USD' ? tc : 1
    return {
      subtotal: acc.subtotal + roundMoney(roundMoney(d.subtotal) * mxnFactor),
      iva:      acc.iva      + roundMoney(calcIvaMonto(d) * mxnFactor),
      total:    acc.total    + toMXN(d),
    }
  }, { subtotal: 0, iva: 0, total: 0 })

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <select className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm" value={mes} onChange={e => setMes(parseInt(e.target.value))}>
          {MESES.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
        </select>
        <select className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm" value={anio} onChange={e => setAnio(parseInt(e.target.value))}>
          {[2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>

        {/* Búsqueda rápida */}
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <input
            className="border border-gray-200 rounded-lg pl-8 pr-3 py-1.5 text-sm w-48"
            placeholder="Búsqueda rápida…"
            value={filtros.texto}
            onChange={e => setFiltro('texto', e.target.value)}
          />
          {filtros.texto && (
            <button onClick={() => setFiltro('texto', '')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <XMarkIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Filtros avanzados toggle */}
        <button
          onClick={() => setShowFilters(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm transition-colors ${showFilters || filtrosActivos ? 'border-primary-400 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
        >
          <FunnelIcon className="h-4 w-4" />
          Filtros
          {filtrosActivos && <span className="ml-1 bg-primary-600 text-white text-xs rounded-full px-1.5 py-0.5">
            {Object.values(filtros).filter(v => v.trim() !== '').length}
          </span>}
        </button>

        {/* Agrupar por partida */}
        <button
          onClick={() => { setAgrupar(v => !v); setExpandedGroups(new Set()) }}
          className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm transition-colors ${agrupar ? 'border-indigo-400 bg-indigo-50 text-indigo-700 font-medium' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          title="Agrupar líneas por partida y sumar totales"
        >
          <Square2StackIcon className="h-4 w-4" />
          {agrupar ? 'Vista agrupada' : 'Agrupar'}
        </button>

        <div className="flex-1" />

        {/* Exportar */}
        <div className="relative group">
          <button className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            <DocumentArrowDownIcon className="h-4 w-4" /> Exportar ▾
          </button>
          <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-gray-200 rounded-xl shadow-xl z-30 hidden group-hover:block">
            <button onClick={exportExcel} className="w-full text-left px-4 py-2.5 text-sm hover:bg-green-50 text-green-700 font-medium rounded-t-xl flex items-center gap-2">
              <span>📊</span> Excel (.xlsx)
            </button>
            <button onClick={exportCSV} className="w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 text-blue-700 font-medium flex items-center gap-2">
              <span>📄</span> CSV
            </button>
            <button onClick={exportPDF} className="w-full text-left px-4 py-2.5 text-sm hover:bg-red-50 text-red-700 font-medium rounded-b-xl flex items-center gap-2">
              <span>📑</span> PDF
            </button>
          </div>
        </div>

        <button onClick={() => setModal('clonar')} className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
          <DocumentDuplicateIcon className="h-4 w-4" /> Clonar mes anterior
        </button>
        <button onClick={openNew} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700">
          <PlusIcon className="h-4 w-4" /> Nueva línea
        </button>
      </div>

      {/* Panel de filtros avanzados */}
      {showFilters && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
              <FunnelIcon className="h-4 w-4 text-slate-500" /> Filtros avanzados
            </span>
            {filtrosActivos && (
              <button onClick={limpiarFiltros} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
                <XMarkIcon className="h-3.5 w-3.5" /> Limpiar filtros
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Proveedor</label>
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white"
                placeholder="Filtrar por proveedor…"
                value={filtros.proveedor}
                onChange={e => setFiltro('proveedor', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Partida / Servicio</label>
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white"
                placeholder="Tipo servicio o concepto…"
                value={filtros.partida}
                onChange={e => setFiltro('partida', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Factura / Folio</label>
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white"
                placeholder="Número de factura…"
                value={filtros.factura}
                onChange={e => setFiltro('factura', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Centro de Costos</label>
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white"
                placeholder="Código o nombre CC…"
                value={filtros.centroCosto}
                onChange={e => setFiltro('centroCosto', e.target.value)}
              />
            </div>
          </div>
          {filtrosActivos && (
            <p className="mt-2 text-xs text-primary-600">
              Mostrando <strong>{detalleFiltrado.length}</strong> de <strong>{detalle.length}</strong> registros
            </p>
          )}
        </div>
      )}

      {/* Totals banner */}
      {detalleFiltrado.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-50 rounded-xl p-3 text-center border border-gray-200">
            <div className="text-xs text-gray-500">Subtotal</div>
            <div className="text-lg font-bold text-gray-800">{fmtDec(totalesGlobal.subtotal)}</div>
          </div>
          <div className="bg-amber-50 rounded-xl p-3 text-center border border-amber-200">
            <div className="text-xs text-amber-600">IVA 16%</div>
            <div className="text-lg font-bold text-amber-700">{fmtDec(totalesGlobal.iva)}</div>
          </div>
          <div className="bg-primary-50 rounded-xl p-3 text-center border border-primary-200">
            <div className="text-xs text-primary-600">Total MXN</div>
            <div className="text-lg font-bold text-primary-700">{fmtDec(totalesGlobal.total)}</div>
            <div className="text-[10px] text-primary-400 mt-0.5">Conversión incluida</div>
          </div>
        </div>
      )}

      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl">
          <span className="text-sm font-semibold text-slate-700">{selected.size} registro{selected.size !== 1 ? 's' : ''} seleccionado{selected.size !== 1 ? 's' : ''}</span>
          <div className="flex-1" />
          <button onClick={() => setSelected(new Set())} className="text-sm text-gray-500 hover:text-gray-700">Deseleccionar</button>
          <button
            onClick={() => openFacturaBulk(detalle.filter(d => selected.has(d.id)), 'líneas seleccionadas')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
          >
            <PencilSquareIcon className="h-4 w-4" /> Cambiar folio
          </button>
          <button onClick={() => setShowBulkConfirm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">
            <TrashIcon className="h-4 w-4" /> Eliminar {selected.size} registro{selected.size !== 1 ? 's' : ''}
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2.5 w-10">
                  <input type="checkbox"
                    className="rounded border-gray-300"
                    checked={selected.size === detalleFiltrado.length && detalleFiltrado.length > 0}
                    onChange={e => setSelected(e.target.checked ? new Set(detalleFiltrado.map(d => d.id)) : new Set())}
                  />
                </th>
                {[
                  { label: 'Nombre', campo: 'nombre', align: 'left' },
                  { label: 'Serie/Tel', campo: 'telefono_serie', align: 'left' },
                  { label: 'Servicio', campo: 'tipo_servicio', align: 'left' },
                  { label: 'Proveedor', campo: 'proveedor', align: 'left' },
                  { label: 'Factura', campo: 'factura_folio', align: 'left' },
                  { label: 'Días', campo: 'dias_facturados', align: 'right' },
                  { label: '$/día', campo: 'costo_dia', align: 'right' },
                  { label: 'Subtotal', campo: 'subtotal', align: 'right' },
                  { label: 'IVA', campo: null, align: 'center' },
                  { label: 'Total', campo: 'total', align: 'right' },
                  { label: 'Total MXN', campo: 'total_mxn', align: 'right' },
                  { label: 'Centro de Costos', campo: 'centro_costo_codigo', align: 'left' },
                  { label: 'Tipo', campo: 'identificador', align: 'left' },
                ].map(col => (
                  <th key={col.label}
                    className={`px-3 py-2.5 text-${col.align} text-gray-500 font-medium ${col.campo ? 'cursor-pointer select-none hover:text-primary-600' : ''}`}
                    onClick={() => col.campo && toggleSort(col.campo)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {col.campo && (
                        <ArrowsUpDownIcon className={`h-3 w-3 transition-colors ${sortConfig.campo === col.campo ? 'text-primary-600' : 'text-gray-300'}`} />
                      )}
                      {sortConfig.campo === col.campo && (
                        <span className="text-primary-600 text-xs">{sortConfig.dir === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </span>
                  </th>
                ))}
                <th className="px-3 py-2.5 text-center text-gray-500 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={15} className="py-10 text-center"><div className="inline-block animate-spin rounded-full h-5 w-5 border-4 border-primary-500 border-t-transparent"/></td></tr>
              ) : detalleFiltrado.length === 0 ? (
                <tr><td colSpan={15} className="py-10 text-center text-gray-400">
                  {filtrosActivos ? 'Ningún registro coincide con los filtros aplicados.' : 'No hay registros para este período. Agrega líneas o clona el mes anterior.'}
                </td></tr>

              ) : agrupar ? (
                // ── Vista agrupada: una fila resumen por grupo + detalle colapsable ──
                agrupadoData.map(grupo => {
                  const isOpen = expandedGroups.has(grupo.key)
                  const count = grupo.lines.length
                  return (
                    <Fragment key={grupo.key}>
                      {/* Fila resumen del grupo */}
                      <tr
                        className="bg-slate-50 hover:bg-slate-100 cursor-pointer select-none border-l-4 border-indigo-400"
                        onClick={() => toggleGroup(grupo.key)}
                      >
                        <td className="px-3 py-2.5 w-10">
                          {isOpen
                            ? <ChevronDownIcon className="h-4 w-4 text-indigo-500" />
                            : <ChevronRightIcon className="h-4 w-4 text-gray-400" />}
                        </td>
                        {/* colSpan=5 cubre: Nombre + Serie/Tel + Servicio + Proveedor + Factura */}
                        <td className="px-3 py-2.5 font-semibold text-gray-900 max-w-[220px]" colSpan={5}>
                          <div className="flex items-center gap-2">
                            <div className="truncate text-indigo-800">{grupo.proveedor}</div>
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation()
                                openFacturaBulk(grupo.lines, `grupo ${grupo.proveedor}`)
                              }}
                              className="rounded-lg border border-indigo-200 bg-white px-2 py-1 text-[11px] font-semibold text-indigo-700 transition-colors hover:bg-indigo-50"
                              title="Actualizar el folio de factura para todas las líneas de este grupo"
                            >
                              Actualizar factura
                            </button>
                          </div>
                          <div className="text-xs font-normal text-indigo-500 mt-0.5">
                            {count} {count === 1 ? 'línea' : 'líneas'} · expandir para ver detalle
                          </div>
                        </td>
                        {/* Días */}
                        <td className="px-3 py-2.5 text-right font-mono text-gray-400 text-xs">×{count}</td>
                        {/* $/día */}
                        <td className="px-3 py-2.5 text-center text-gray-300">—</td>
                        {/* Subtotal */}
                        <td className="px-3 py-2.5 text-right font-mono font-semibold text-gray-700">{fmtDec(grupo.subtotal)}</td>
                        {/* IVA — monto acumulado */}
                        <td className="px-3 py-2.5 text-right font-mono text-xs">
                          {grupo.iva_monto > 0
                            ? <span className="font-semibold text-amber-600">{fmtDec(grupo.iva_monto)}</span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        {/* Total (en moneda original) */}
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-indigo-700 text-sm">{fmtDec(grupo.total)}</td>
                        {/* Total MXN (conversión) */}
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-700 text-sm">{fmtDec(grupo.total_mxn)}</td>
                        {/* Centro Costos, Tipo, Acciones */}
                        <td className="px-3 py-2.5 text-xs text-gray-300">—</td>
                        <td className="px-3 py-2.5 text-xs text-gray-300">—</td>
                        <td className="px-3 py-2.5 text-xs text-gray-300">—</td>
                      </tr>

                      {/* Filas de detalle del grupo (visibles solo si expandido) */}
                      {isOpen && grupo.lines.map((d, li) => (
                        <tr key={d.id} className="hover:bg-blue-50 bg-white">
                          <td className="px-3 py-1.5 w-10">
                            <input type="checkbox"
                              className="rounded border-gray-300 ml-3"
                              checked={selected.has(d.id)}
                              onChange={e => setSelected(prev => {
                                const next = new Set(prev)
                                if (e.target.checked) next.add(d.id); else next.delete(d.id)
                                return next
                              })}
                              onClick={e => e.stopPropagation()}
                            />
                          </td>
                          <td className="px-3 py-1.5 pl-8 text-gray-600 text-xs max-w-[160px]">
                            <div className="truncate"><span className="text-gray-300 mr-1">{li + 1}.</span>{d.nombre}</div>
                            {d.empleado_nombre && (
                              <div className="text-xs text-blue-500 mt-0.5 truncate">👤 {d.empleado_nombre}</div>
                            )}
                            {d.sucursal_nombre && (
                              <div className="text-xs text-emerald-600 mt-0.5 truncate">🏢 {d.sucursal_nombre}</div>
                            )}
                          </td>
                          <td className="px-3 py-1.5 font-mono text-gray-500 text-xs">{d.telefono_serie || '—'}</td>
                          <td className="px-3 py-1.5 text-gray-500 text-xs">{d.tipo_servicio || '—'}</td>
                          <td className="px-3 py-1.5 text-gray-400 text-xs">{d.proveedor || '—'}</td>
                          <td className="px-3 py-1.5 font-mono text-gray-500 text-xs">{d.factura_folio || '—'}</td>
                          <td className="px-3 py-1.5 text-right font-mono text-xs">{d.dias_facturados}</td>
                          <td className="px-3 py-1.5 text-right font-mono text-xs">{fmtDec(d.costo_dia)}</td>
                          <td className="px-3 py-1.5 text-right font-mono text-gray-600 text-xs">{fmtDec(d.subtotal)}</td>
                          <td className="px-3 py-1.5 text-center">
                            {isIvaApplied(d) ? <span className="font-mono text-amber-700 text-xs">{fmtDec(calcIvaMonto(d))}</span> : <span className="text-gray-200">—</span>}
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono font-semibold text-primary-600 text-xs">
                            <div>{fmtDec(d.total)}</div>
                            {d.moneda === 'USD' && <div className="text-[10px] text-gray-400 font-normal">USD</div>}
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono font-semibold text-emerald-700 text-xs">
                            {fmtDec(calcTotalMXN(d))}
                          </td>
                          <td className="px-3 py-1.5 text-xs">
                            {d.centro_costo_codigo ? (
                              <div>
                                <span className="bg-navy-50 text-navy-700 px-1.5 py-0.5 rounded text-xs font-mono">{d.centro_costo_codigo}</span>
                                {d.centro_costo_nombre && <div className="text-xs text-gray-400 mt-0.5 max-w-[130px] truncate">{d.centro_costo_nombre}</div>}
                              </div>
                            ) : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-3 py-1.5 text-xs"><span className={`px-1.5 py-0.5 rounded text-xs ${d.identificador === 'CAF' ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>{d.identificador}</span></td>
                          <td className="px-3 py-1.5">
                            <div className="flex justify-center gap-1">
                              <button onClick={() => openEdit(d)} className="p-1 rounded hover:bg-primary-50 text-gray-400 hover:text-primary-600"><PencilSquareIcon className="h-3 w-3"/></button>
                              <button onClick={() => handleDelete(d.id)} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"><TrashIcon className="h-3 w-3"/></button>
                            </div>
                          </td>
                        </tr>
                      ))}

                      {/* Fila subtotal del grupo (solo si tiene más de 1 línea y está expandido) */}
                      {isOpen && count > 1 && (
                        <tr key={`sub-${grupo.key}`} className="bg-indigo-50 border-b-2 border-indigo-200">
                          <td colSpan={8} className="px-3 py-1.5 pl-8 text-xs text-indigo-600 font-semibold">
                            Subtotal — {grupo.proveedor} ({count} líneas)
                          </td>
                          {/* Subtotal */}
                          <td className="px-3 py-1.5 text-right font-mono font-semibold text-indigo-700 text-xs">{fmtDec(grupo.subtotal)}</td>
                          {/* IVA acumulado */}
                          <td className="px-3 py-1.5 text-right font-mono text-xs">
                            {grupo.iva_monto > 0
                              ? <span className="font-semibold text-amber-700">{fmtDec(grupo.iva_monto)}</span>
                              : <span className="text-indigo-300">—</span>}
                          </td>
                          {/* Total */}
                          <td className="px-3 py-1.5 text-right font-mono font-bold text-indigo-800 text-sm">{fmtDec(grupo.total)}</td>
                          {/* Total MXN */}
                          <td className="px-3 py-1.5 text-right font-mono font-bold text-emerald-700 text-sm">{fmtDec(grupo.total_mxn)}</td>
                          <td colSpan={3} />
                        </tr>
                      )}
                    </Fragment>
                  )
                })

              ) : (
                // ── Vista detallada normal (una fila por línea) ──────────────────
                detalleFiltrado.map(d => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 w-10">
                      <input type="checkbox"
                        className="rounded border-gray-300"
                        checked={selected.has(d.id)}
                        onChange={e => setSelected(prev => {
                          const next = new Set(prev)
                          if (e.target.checked) next.add(d.id)
                          else next.delete(d.id)
                          return next
                        })}
                      />
                    </td>
                    <td className="px-3 py-2 font-medium text-gray-800 max-w-[160px]">
                      <div className="truncate">{d.nombre}</div>
                      {d.empleado_nombre && (
                        <div className="text-xs text-blue-600 mt-0.5 flex items-center gap-1 truncate">
                          <span>👤</span> {d.empleado_nombre}
                        </div>
                      )}
                      {d.sucursal_nombre && (
                        <div className="text-xs text-emerald-600 mt-0.5 flex items-center gap-1 truncate">
                          <span>🏢</span> {d.sucursal_nombre}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-gray-500">{d.telefono_serie || '—'}</td>
                    <td className="px-3 py-2 text-gray-600">{d.tipo_servicio || '—'}</td>
                    <td className="px-3 py-2 text-gray-500">{d.proveedor || '—'}</td>
                    <td className="px-3 py-2 font-mono text-gray-500">{d.factura_folio || '—'}</td>
                    <td className="px-3 py-2 text-right font-mono">{d.dias_facturados}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmtDec(d.costo_dia)}</td>
                    <td className="px-3 py-2 text-right font-mono text-gray-700">{fmtDec(d.subtotal)}</td>
                    <td className="px-3 py-2 text-center">
                      {isIvaApplied(d) ? <span className="font-mono text-amber-700 text-xs">{fmtDec(calcIvaMonto(d))}</span> : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-semibold text-primary-700">
                      <div>{fmtDec(d.total)}</div>
                      {d.moneda === 'USD' && <div className="text-[10px] text-gray-400 font-normal">USD</div>}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-semibold text-emerald-700">
                      {fmtDec(calcTotalMXN(d))}
                    </td>
                    <td className="px-3 py-2">
                      {d.centro_costo_codigo ? (
                        <div>
                          <span className="bg-navy-50 text-navy-700 px-1.5 py-0.5 rounded text-xs font-mono">{d.centro_costo_codigo}</span>
                          {d.centro_costo_nombre && <div className="text-xs text-gray-500 mt-0.5 max-w-[140px] truncate">{d.centro_costo_nombre}</div>}
                        </div>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-3 py-2"><span className={`px-1.5 py-0.5 rounded text-xs ${d.identificador === 'CAF' ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>{d.identificador}</span></td>
                    <td className="px-3 py-2">
                      <div className="flex justify-center gap-1">
                        <button onClick={() => openEdit(d)} className="p-1 rounded hover:bg-primary-50 text-gray-400 hover:text-primary-600"><PencilSquareIcon className="h-3.5 w-3.5"/></button>
                        <button onClick={() => handleDelete(d.id)} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"><TrashIcon className="h-3.5 w-3.5"/></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal nueva/editar línea */}
      <Modal open={modal === 'new' || modal === 'edit'} onClose={() => setModal(null)} title={modal === 'new' ? 'Nueva Línea de Gasto' : 'Editar Línea'} size="xl">
        <div className="grid grid-cols-2 gap-3 text-sm">
          {/* Nombre */}
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Nombre / Descripción *</label>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={form.nombre || ''} onChange={e => setForm(f => ({...f, nombre: e.target.value}))} />
          </div>

          {/* Proveedor — dropdown de partidas */}
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Partida / Proveedor *</label>
            <select
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              value={form.partida_id || ''}
              onChange={e => {
                const sel = proveedoresLista.find(p => p.partida_id === e.target.value)
                if (sel) setForm(f => ({ ...f, partida_id: sel.partida_id, proveedor: sel.proveedor, tipo_servicio: f.tipo_servicio || sel.concepto }))
                else setForm(f => ({ ...f, partida_id: '', proveedor: '' }))
              }}
            >
              <option value="">Seleccionar partida...</option>
              {proveedoresLista.map(p => (
                <option key={p.partida_id} value={p.partida_id}>
                  [{p.empresa}] {p.proveedor} — {p.concepto}
                </option>
              ))}
            </select>
          </div>

          {/* Serie / Teléfono */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Serie / Teléfono <span className="text-gray-400 font-normal">(opcional)</span></label>
            <div className="flex gap-1">
              <input className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono" value={form.telefono_serie || ''} onChange={e => setForm(f => ({...f, telefono_serie: e.target.value}))} placeholder="NUM-SERIE o teléfono" />
              <button type="button" onClick={() => buscarPorSerie(form.telefono_serie)} className="px-2 py-1.5 bg-gray-100 rounded-lg hover:bg-gray-200" title="Buscar en inventario"><MagnifyingGlassIcon className="h-4 w-4 text-gray-500"/></button>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">Dejar vacío para servicios cloud (Azure, Mailchimp, WIX, etc.)</p>
          </div>

          {/* Tipo de servicio */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tipo de Servicio</label>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={form.tipo_servicio || ''} onChange={e => setForm(f => ({...f, tipo_servicio: e.target.value}))} placeholder="M365-Basic, Jira, Renta Tablet..." />
          </div>

          {/* Folio Factura */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Folio Factura</label>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono" value={form.factura_folio || ''} onChange={e => setForm(f => ({...f, factura_folio: e.target.value}))} placeholder="M165755" />
          </div>

          {/* Departamento */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Departamento</label>
            <input
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              value={form.departamento || ''}
              onChange={e => setForm(f => ({...f, departamento: e.target.value}))}
              readOnly={!!form.empleado_id}
            />
          </div>

          {/* Asignación del gasto */}
          <div className="col-span-2">
            <div className="flex items-center gap-3 mb-2">
              <label className="block text-xs font-medium text-gray-600">Asignar gasto a</label>
              <div className="flex gap-1">
                <button type="button"
                  onClick={() => setForm(f => ({
                    ...f,
                    asignacion_gasto_tipo: 'ninguno',
                    es_gasto_usuario: false,
                    empleado_id: null, empleado_nombre: '',
                    sucursal_id: null, sucursal_nombre: ''
                  }))}
                  className={`px-3 py-1 rounded-lg border text-xs font-medium transition-all ${(form.asignacion_gasto_tipo || 'ninguno') === 'ninguno' ? 'bg-gray-200 text-gray-700 border-gray-300' : 'border-gray-200 text-gray-400 hover:bg-gray-50'}`}>
                  No
                </button>
                <button type="button"
                  onClick={() => setForm(f => ({
                    ...f,
                    asignacion_gasto_tipo: 'empleado',
                    es_gasto_usuario: true,
                    sucursal_id: null, sucursal_nombre: ''
                  }))}
                  className={`px-3 py-1 rounded-lg border text-xs font-medium transition-all ${form.asignacion_gasto_tipo === 'empleado' ? 'bg-blue-100 text-blue-700 border-blue-300' : 'border-gray-200 text-gray-400 hover:bg-gray-50'}`}>
                  Empleado
                </button>
                <button type="button"
                  onClick={() => setForm(f => ({
                    ...f,
                    asignacion_gasto_tipo: 'sucursal',
                    es_gasto_usuario: false,
                    empleado_id: null, empleado_nombre: '', puesto: '', email: '',
                    sucursal_id: f.sucursal_id || null
                  }))}
                  className={`px-3 py-1 rounded-lg border text-xs font-medium transition-all ${form.asignacion_gasto_tipo === 'sucursal' ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'border-gray-200 text-gray-400 hover:bg-gray-50'}`}>
                  Sucursal
                </button>
              </div>
            </div>
            {form.asignacion_gasto_tipo === 'empleado' && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 space-y-2">
                <label className="block text-xs font-semibold text-blue-700 mb-1">Empleado asignado</label>
                {form.empleado_id ? (
                  <div className="flex items-start justify-between bg-white border border-blue-200 rounded-lg px-3 py-2.5">
                    <div>
                      <div className="text-sm font-semibold text-gray-800">{form.empleado_nombre}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {[form.puesto, form.departamento].filter(Boolean).join(' · ')}
                      </div>
                      {form.email && <div className="text-xs text-gray-400 mt-0.5">{form.email}</div>}
                    </div>
                    <button type="button"
                      onClick={() => setForm(f => ({...f, empleado_id: null, empleado_nombre: '', puesto: '', departamento: '', email: ''}))}
                      className="ml-3 text-gray-400 hover:text-red-400 text-xl leading-none">×</button>
                  </div>
                ) : (
                  <EmpleadoSearch
                    value={form.empleado_id}
                    display={form.empleado_nombre}
                    onSelect={emp => setForm(f => ({
                      ...f,
                      asignacion_gasto_tipo: 'empleado',
                      empleado_id: emp.id,
                      empleado_nombre: emp.nombre_completo,
                      sucursal_id: null,
                      sucursal_nombre: '',
                      email: f.email || emp.email || '',
                      departamento: f.departamento || emp.area || emp.departamento_nombre || '',
                      puesto: f.puesto || emp.puesto || ''
                    }))}
                    onClear={() => setForm(f => ({...f, empleado_id: null, empleado_nombre: ''}))}
                  />
                )}
              </div>
            )}
            {form.asignacion_gasto_tipo === 'sucursal' && (
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 space-y-2">
                <label className="block text-xs font-semibold text-emerald-700 mb-1">Sucursal asignada</label>
                {form.sucursal_id ? (
                  <div className="flex items-start justify-between bg-white border border-emerald-200 rounded-lg px-3 py-2.5">
                    <div>
                      <div className="text-sm font-semibold text-gray-800">{form.sucursal_nombre}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {[form.departamento, form.centro_costo_codigo].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    <button type="button"
                      onClick={() => setForm(f => ({...f, sucursal_id: null, sucursal_nombre: '', departamento: ''}))}
                      className="ml-3 text-gray-400 hover:text-red-400 text-xl leading-none">×</button>
                  </div>
                ) : (
                  <SucursalSearch
                    value={form.sucursal_id}
                    display={form.sucursal_nombre}
                    onSelect={sucursal => setForm(f => ({
                      ...f,
                      asignacion_gasto_tipo: 'sucursal',
                      es_gasto_usuario: false,
                      empleado_id: null,
                      empleado_nombre: '',
                      sucursal_id: sucursal.id,
                      sucursal_nombre: sucursal.nombre,
                      departamento: f.departamento || sucursal.tipo || sucursal.estado || '',
                      centro_costo_codigo: f.centro_costo_codigo || sucursal.centro_costo_codigo || '',
                      centro_costo_nombre: f.centro_costo_nombre || sucursal.centro_costo_nombre || sucursal.centro_costos || ''
                    }))}
                    onClear={() => setForm(f => ({...f, sucursal_id: null, sucursal_nombre: ''}))}
                  />
                )}
              </div>
            )}
          </div>

          {/* Vigencia — toggle + campo condicional */}
          <div className="col-span-2">
            <div className="flex items-center gap-3 mb-2">
              <label className="block text-xs font-medium text-gray-600">Vigencia / Contrato</label>
              <div className="flex gap-1">
                <button type="button" onClick={() => setForm(f => ({...f, tiene_vigencia: false, contrato_vigencia: ''}))}
                  className={`px-3 py-1 rounded-lg border text-xs font-medium transition-all ${!form.tiene_vigencia ? 'bg-gray-200 text-gray-700 border-gray-300' : 'border-gray-200 text-gray-400'}`}>
                  Sin vigencia
                </button>
                <button type="button" onClick={() => setForm(f => ({...f, tiene_vigencia: true}))}
                  className={`px-3 py-1 rounded-lg border text-xs font-medium transition-all ${form.tiene_vigencia ? 'bg-primary-100 text-primary-700 border-primary-300' : 'border-gray-200 text-gray-400'}`}>
                  Con vigencia
                </button>
              </div>
            </div>
            {form.tiene_vigencia && (
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={form.contrato_vigencia || ''} onChange={e => setForm(f => ({...f, contrato_vigencia: e.target.value}))} placeholder="13/48, 12 meses, Renovación Feb 2027..." />
            )}
          </div>

          {/* Moneda */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Moneda</label>
            <div className="flex gap-2">
              {['MXN','USD'].map(m => (
                <button key={m} type="button" onClick={() => setForm(f => ({...f, moneda: m, aplica_iva: m === 'MXN'}))}
                  className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${form.moneda === m ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-500'}`}>{m}</button>
              ))}
            </div>
          </div>
          {form.moneda === 'USD' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tipo de Cambio</label>
              <input type="number" step="0.01" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={form.tipo_cambio || 1} onChange={e => setForm(f => ({...f, tipo_cambio: parseFloat(e.target.value) || 1}))} />
            </div>
          )}

          {/* Modo de cálculo */}
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-2">Modo de cálculo</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setForm(f => ({...f, modo_calculo: 'dias'}))}
                className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${form.modo_calculo !== 'total' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-500'}`}>
                📅 Por días facturados
              </button>
              <button type="button" onClick={() => setForm(f => ({...f, modo_calculo: 'total'}))}
                className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${form.modo_calculo === 'total' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-500'}`}>
                💰 Gasto total del mes
              </button>
            </div>
          </div>

          {/* Cálculo */}
          {form.modo_calculo === 'total' ? (
            <div className="col-span-2 bg-gray-50 rounded-xl p-3">
              <label className="block text-xs font-medium text-gray-600 mb-1">Gasto del mes (subtotal sin IVA)</label>
              <input type="number" min="0" step="0.01" className="w-full border border-white rounded-lg px-3 py-2.5 text-sm text-right font-mono bg-white text-lg" value={form.subtotal_directo || ''} onChange={e => setForm(f => ({...f, subtotal_directo: e.target.value}))} placeholder="0.00" />
              <p className="text-xs text-gray-400 mt-1">Usa este modo para servicios con cargo fijo mensual (Azure, Mailchimp, WIX, JIRA, etc.)</p>
            </div>
          ) : (
            <div className="col-span-2 bg-gray-50 rounded-xl p-3 grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Días Facturados</label>
                <input type="number" min="1" max="31" className="w-full border border-white rounded-lg px-3 py-2 text-sm text-center font-mono bg-white" value={form.dias_facturados || 30} onChange={e => setForm(f => ({...f, dias_facturados: parseInt(e.target.value) || 30}))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Costo por Día ({form.moneda || 'MXN'})</label>
                <input type="number" min="0" step="0.0001" className="w-full border border-white rounded-lg px-3 py-2 text-sm text-right font-mono bg-white" value={form.costo_dia || ''} onChange={e => setForm(f => ({...f, costo_dia: e.target.value}))} placeholder="0.00" />
              </div>
            </div>
          )}

          {/* IVA toggle */}
          <div className="col-span-2">
            <button type="button" onClick={() => setForm(f => ({...f, aplica_iva: !f.aplica_iva}))}
              className={`w-full py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${form.aplica_iva ? 'border-primary-400 bg-primary-50 text-primary-700' : 'border-gray-200 bg-gray-50 text-gray-400'}`}>
              {form.aplica_iva ? '✓ Con IVA 16% (proveedor nacional)' : '✗ Sin IVA (pago extranjero / exento)'}
            </button>
          </div>

          {/* Totals preview */}
          <div className="col-span-2 grid grid-cols-3 gap-2 text-center">
            <div className="bg-white rounded-lg border p-2.5">
              <div className="text-xs text-gray-400">Subtotal {form.moneda === 'USD' ? '(USD)' : ''}</div>
              <div className="font-bold text-gray-700">{fmtDec(subtotal)}</div>
            </div>
            <div className="bg-amber-50 rounded-lg border border-amber-200 p-2.5">
              <div className="text-xs text-amber-500">IVA 16%</div>
              <div className="font-bold text-amber-700">{fmtDec(iva_monto)}</div>
            </div>
            <div className="bg-primary-50 rounded-lg border border-primary-200 p-2.5">
              <div className="text-xs text-primary-500">Total {form.moneda === 'USD' ? '(USD)' : '(MXN)'}</div>
              <div className="font-bold text-primary-700 text-lg">{fmtDec(total)}</div>
              {form.moneda === 'USD' && totalMXN !== total && (
                <div className="text-xs text-gray-400 mt-0.5">≈ {fmtDec(totalMXN)} MXN</div>
              )}
            </div>
          </div>

          {/* Comparativa vs partida */}
          {selPartida && (
            <div className="col-span-2">
              {gastoAcumulado > partidaBudgetMes ? (
                <div className="bg-red-50 border border-red-300 rounded-xl p-3 flex items-start gap-2">
                  <span className="text-red-500 text-lg mt-0.5">⚠️</span>
                  <div>
                    <p className="text-sm font-semibold text-red-700">Excede el presupuesto de la partida</p>
                    <p className="text-xs text-red-500 mt-0.5">
                      Gasto acumulado <span className="font-bold">{fmtDec(gastoAcumulado)}</span> &gt; Presupuesto <span className="font-bold">{fmtDec(partidaBudgetMes)}</span>
                    </p>
                    {gastoOtrasLineas > 0 && (
                      <p className="text-xs text-red-400 mt-1">Incluye {fmtDec(gastoOtrasLineas)} de otras líneas de esta partida</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-3">
                  {/* Resumen presupuesto vs gasto acumulado */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div>
                      <div className="text-gray-400">Presupuesto partida</div>
                      <div className="font-bold text-gray-700 mt-0.5">{fmtDec(partidaBudgetMes)}</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Gasto acumulado</div>
                      <div className="font-bold text-primary-700 mt-0.5">{fmtDec(gastoAcumulado)}</div>
                      {gastoOtrasLineas > 0 && (
                        <div className="text-gray-400 mt-0.5" style={{fontSize:'10px'}}>({fmtDec(gastoOtrasLineas)} otras líneas)</div>
                      )}
                    </div>
                    <div>
                      <div className="text-gray-400">Diferencia</div>
                      <div className="font-bold text-green-600 mt-0.5">{fmtDec(diferencia)}</div>
                    </div>
                  </div>

                  {diferencia > 0 && (
                    <>
                      <div className="border-t border-gray-200 pt-2">
                        <p className="text-xs font-semibold text-gray-600 mb-2">Clasificar diferencia de {fmtDec(diferencia)}</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Ahorro por Soporte (MXN)</label>
                            <input
                              type="number" min="0" max={diferencia} step="0.01"
                              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-right font-mono bg-white"
                              value={form.ahorro_soporte || ''}
                              onChange={e => setForm(f => ({...f, ahorro_soporte: e.target.value}))}
                              placeholder="0.00"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">No Ejercido (auto)</label>
                            <div className="border border-dashed border-gray-300 rounded-lg px-2 py-1.5 text-sm text-right font-mono bg-white text-gray-500">
                              {fmtDec(noEjercidoVal)}
                            </div>
                          </div>
                        </div>
                        {parseFloat(form.ahorro_soporte) > 0 && (
                          <div className="mt-2">
                            <label className="block text-xs font-medium text-gray-500 mb-1">Descripción del ahorro por soporte</label>
                            <input
                              type="text"
                              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white"
                              value={form.ahorro_descripcion || ''}
                              onChange={e => setForm(f => ({...f, ahorro_descripcion: e.target.value}))}
                              placeholder="Ej. Negociación con proveedor, crédito aplicado..."
                            />
                          </div>
                        )}
                        <div className="mt-2 flex justify-between text-xs text-gray-400">
                          <span>Ahorro: <span className="text-yellow-600 font-semibold">{fmtDec(ahorroVal)}</span></span>
                          <span>No ejercido: <span className="text-gray-600 font-semibold">{fmtDec(noEjercidoVal)}</span></span>
                          <span>Total clasificado: <span className={ahorroVal + noEjercidoVal > diferencia ? 'text-red-500 font-bold' : 'text-green-600 font-semibold'}>{fmtDec(ahorroVal + noEjercidoVal)}</span></span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* CC + Identificador */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Centro de Costos</label>
            <CentroCostoSearch
              value={form.centro_costo_codigo || ''}
              nombre={form.centro_costo_nombre || (form.centro_costo_codigo ? `${form.centro_costo_codigo} — ${form.centro_costo_nombre}` : '')}
              onChange={(codigo, nombre) => setForm(f => ({...f, centro_costo_codigo: codigo, centro_costo_nombre: nombre}))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Identificador</label>
            <div className="flex gap-2">
              {['Administrativo','CAF'].map(id => (
                <button key={id} type="button" onClick={() => setForm(f => ({...f, identificador: id}))}
                  className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${form.identificador === id ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-500'}`}>{id}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-4">
          <button type="button" onClick={() => setModal(null)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
          <button type="button" onClick={handleSave} disabled={saving} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </Modal>

      {/* Modal actualización masiva de factura */}
      <Modal open={!!facturaBulk} onClose={() => setFacturaBulk(null)} title="Actualizar folio de factura">
        {facturaBulk && (
          <div className="space-y-4 text-sm">
            <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3">
              <p className="font-semibold text-indigo-800">
                Se actualizarán {facturaBulk.count} línea{facturaBulk.count !== 1 ? 's' : ''} de {facturaBulk.label}.
              </p>
              <p className="mt-1 text-xs text-indigo-600">
                Solo cambiará el folio de factura. No se modificarán costos, IVA, centros de costo ni asignaciones.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nuevo folio de factura *</label>
              <input
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono"
                value={facturaBulkFolio}
                onChange={e => setFacturaBulkFolio(e.target.value)}
                placeholder="Ej. FAC-ABR-2026-001"
                autoFocus
              />
            </div>

            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Vista previa</p>
              <div className="space-y-1.5">
                {facturaBulk.sample.map(line => (
                  <div key={line.id} className="flex items-center justify-between gap-3 text-xs">
                    <span className="truncate text-gray-600">{line.nombre || line.tipo_servicio || line.proveedor || 'Línea sin nombre'}</span>
                    <span className="font-mono text-gray-400">{line.factura_folio || 'Sin folio'}</span>
                  </div>
                ))}
                {facturaBulk.count > facturaBulk.sample.length && (
                  <p className="text-xs text-gray-400">+ {facturaBulk.count - facturaBulk.sample.length} línea{facturaBulk.count - facturaBulk.sample.length !== 1 ? 's' : ''} más</p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button onClick={() => setFacturaBulk(null)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
              <button onClick={handleFacturaBulk} disabled={saving || !facturaBulkFolio.trim()} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">
                {saving ? 'Actualizando...' : 'Actualizar folio'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal clonar */}
      <Modal open={modal === 'clonar'} onClose={() => setModal(null)} title="Clonar Mes Anterior">
        <div className="space-y-4 text-sm">
          <p className="text-gray-500">Copia todos los registros de un mes origen al mes actual ({MESES[mes-1]} {anio}). Solo actualiza la factura y los costos que cambien.</p>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Mes Origen</label>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2" value={clonarForm.mes_origen} onChange={e => setClonarForm(f => ({...f, mes_origen: parseInt(e.target.value)}))}>
                {MESES.map((m,i) => <option key={i+1} value={i+1}>{m}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Año Origen</label>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2" value={clonarForm.anio_origen} onChange={e => setClonarForm(f => ({...f, anio_origen: parseInt(e.target.value)}))}>
                {[2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setModal(null)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600">Cancelar</button>
            <button onClick={handleClonar} disabled={saving} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">
              {saving ? 'Clonando...' : 'Clonar'}
            </button>
          </div>
        </div>
      </Modal>

      {showBulkConfirm && (
        <BulkDeleteConfirm
          count={selected.size}
          onConfirm={handleBulkDelete}
          onCancel={() => !bulkDeleting && setShowBulkConfirm(false)}
          loading={bulkDeleting}
        />
      )}
    </div>
  )
}

// ── Tab Configuración ─────────────────────────────────────────────────────────
function TabConfig() {
  const { showError, showSuccess } = useNotification()
  const [partidas, setPartidas] = useState([])
  const [agrupadores, setAgrupadores] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [tabConfig, setTabConfig] = useState('partidas')

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([presupuestoAPI.getPartidas(), presupuestoAPI.getAgrupadores()])
      .then(([p, a]) => { setPartidas(p); setAgrupadores(a) })
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  const openNewPartida = () => {
    setForm({ empresa: 'Previta', agrupador: '', proveedor: '', concepto: '', monto_mensual: '', tipo_monto: 'fijo', montos_por_mes: Array(12).fill(0) })
    setModal('partida')
  }
  const openEditPartida = (p) => {
    const hasMpm = Array.isArray(p.montos_por_mes) && p.montos_por_mes.length === 12
    const isVariable = hasMpm && p.montos_por_mes.some((v, i) => i > 0 && v !== p.montos_por_mes[0])
    setForm({ ...p, tipo_monto: isVariable ? 'variable' : 'fijo', montos_por_mes: hasMpm ? p.montos_por_mes : Array(12).fill(parseFloat(p.monto_mensual) || 0) })
    setModal('editPartida')
  }

  const handleSavePartida = async () => {
    setSaving(true)
    try {
      const montos = form.tipo_monto === 'variable'
        ? (form.montos_por_mes || Array(12).fill(0)).map(v => parseFloat(v) || 0)
        : null
      const payload = {
        ...form,
        montos_por_mes: montos,
        monto_mensual: form.tipo_monto === 'variable'
          ? (montos.reduce((s, v) => s + v, 0) / 12)
          : parseFloat(form.monto_mensual) || 0
      }
      if (modal === 'partida') await presupuestoAPI.createPartida(payload)
      else await presupuestoAPI.updatePartida(form.id, payload)
      setModal(null); load()
    } catch(e) { showError(e?.message || 'Error') }
    finally { setSaving(false) }
  }

  const handleDeletePartida = async (id) => {
    if (!confirm('¿Eliminar partida?')) return
    await presupuestoAPI.deletePartida(id)
    load()
  }

  const handleSaveAgrupador = async () => {
    setSaving(true)
    try {
      if (modal === 'agrupador') await presupuestoAPI.createAgrupador({ nombre: form.nombre })
      else await presupuestoAPI.updateAgrupador(form.id, { nombre: form.nombre })
      setModal(null); load()
    } catch(e) { showError(e?.message || 'Error') }
    finally { setSaving(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-gray-200 pb-2">
        {[['partidas','Partidas de Presupuesto'],['agrupadores','Agrupadores']].map(([k,l]) => (
          <button key={k} onClick={() => setTabConfig(k)} className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${tabConfig===k ? 'bg-primary-50 text-primary-700 border border-primary-200' : 'text-gray-500 hover:text-gray-700'}`}>{l}</button>
        ))}
      </div>

      {tabConfig === 'partidas' && (
        <div>
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm text-gray-500">{partidas.length} partidas configuradas</span>
            <button onClick={openNewPartida} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700"><PlusIcon className="h-4 w-4"/> Nueva Partida</button>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs text-gray-500 font-medium">Empresa</th>
                  <th className="px-4 py-2.5 text-left text-xs text-gray-500 font-medium">Agrupador</th>
                  <th className="px-4 py-2.5 text-left text-xs text-gray-500 font-medium">Proveedor</th>
                  <th className="px-4 py-2.5 text-left text-xs text-gray-500 font-medium">Concepto</th>
                  <th className="px-4 py-2.5 text-right text-xs text-gray-500 font-medium">Monto/mes</th>
                  <th className="px-4 py-2.5 text-center text-xs text-gray-500 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={6} className="py-8 text-center"><div className="inline-block animate-spin rounded-full h-5 w-5 border-4 border-primary-500 border-t-transparent"/></td></tr>
                ) : partidas.length === 0 ? (
                  <tr><td colSpan={6} className="py-8 text-center text-gray-400">Sin partidas. Agrega las líneas de presupuesto anual.</td></tr>
                ) : partidas.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5"><span className="bg-navy-100 text-navy-700 text-xs px-2 py-0.5 rounded-full">{p.empresa}</span></td>
                    <td className="px-4 py-2.5 text-gray-600 text-xs">{p.agrupador}</td>
                    <td className="px-4 py-2.5 text-gray-600">{p.proveedor || '—'}</td>
                    <td className="px-4 py-2.5 font-medium text-gray-800 max-w-xs truncate">{p.concepto}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold text-primary-700">{fmtDec(p.monto_mensual)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-center gap-1">
                        <button onClick={() => openEditPartida(p)} className="p-1.5 rounded hover:bg-primary-50 text-gray-400 hover:text-primary-600"><PencilSquareIcon className="h-4 w-4"/></button>
                        <button onClick={() => handleDeletePartida(p.id)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"><TrashIcon className="h-4 w-4"/></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tabConfig === 'agrupadores' && (
        <div>
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm text-gray-500">{agrupadores.length} agrupadores</span>
            <button onClick={() => { setForm({ nombre: '' }); setModal('agrupador') }} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700"><PlusIcon className="h-4 w-4"/> Nuevo Agrupador</button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {agrupadores.map(a => (
              <div key={a.id} className="bg-white rounded-xl border border-gray-200 p-3 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">{a.nombre}</span>
                <div className="flex gap-1">
                  <button onClick={() => { setForm({ ...a }); setModal('editAgrupador') }} className="p-1 rounded hover:bg-primary-50 text-gray-400 hover:text-primary-600"><PencilSquareIcon className="h-3.5 w-3.5"/></button>
                  <button onClick={async () => { if(confirm('¿Eliminar?')) { await presupuestoAPI.deleteAgrupador(a.id); load() } }} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"><TrashIcon className="h-3.5 w-3.5"/></button>
                </div>
              </div>
            ))}
            {agrupadores.length === 0 && !loading && (
              <div className="col-span-3 py-8 text-center text-gray-400 text-sm">Sin agrupadores. Los agrupadores son las categorías del presupuesto (TI Nube, TI Licencias, etc.)</div>
            )}
          </div>
        </div>
      )}

      {/* Modal partida */}
      <Modal open={modal === 'partida' || modal === 'editPartida'} onClose={() => setModal(null)} title={modal === 'partida' ? 'Nueva Partida' : 'Editar Partida'} size="lg">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Empresa</label>
            <select className="w-full border border-gray-200 rounded-lg px-3 py-2" value={form.empresa || 'Previta'} onChange={e => setForm(f => ({...f, empresa: e.target.value}))}>
              {EMPRESAS.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Agrupador</label>
            <select className="w-full border border-gray-200 rounded-lg px-3 py-2" value={form.agrupador || ''} onChange={e => setForm(f => ({...f, agrupador: e.target.value}))}>
              <option value="">Seleccionar...</option>
              {agrupadores.map(a => <option key={a.id} value={a.nombre}>{a.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Proveedor</label>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2" value={form.proveedor || ''} onChange={e => setForm(f => ({...f, proveedor: e.target.value}))} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-2">Presupuesto Mensual</label>
            <div className="flex gap-2 mb-3">
              <button type="button" onClick={() => setForm(f => ({...f, tipo_monto: 'fijo'}))}
                className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${form.tipo_monto !== 'variable' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-500'}`}>
                📅 Mismo monto cada mes
              </button>
              <button type="button" onClick={() => setForm(f => ({...f, tipo_monto: 'variable'}))}
                className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${form.tipo_monto === 'variable' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-500'}`}>
                📊 Diferente por mes
              </button>
            </div>
            {form.tipo_monto === 'variable' ? (
              <div>
                <div className="grid grid-cols-4 gap-2">
                  {MESES.map((m, i) => (
                    <div key={i}>
                      <label className="block text-xs text-gray-500 mb-0.5 font-medium">{m.slice(0,3)}</label>
                      <input type="number" step="0.01" min="0"
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-mono text-right focus:ring-1 focus:ring-primary-300"
                        value={form.montos_por_mes?.[i] ?? 0}
                        onChange={e => setForm(f => {
                          const mpm = [...(f.montos_por_mes || Array(12).fill(0))]
                          mpm[i] = parseFloat(e.target.value) || 0
                          return { ...f, montos_por_mes: mpm }
                        })}
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                  Total anual: <span className="font-semibold text-primary-700">{fmtDec((form.montos_por_mes||[]).reduce((s,v)=>s+(parseFloat(v)||0),0))}</span>
                  {' '}· Promedio mensual: <span className="font-semibold">{fmtDec((form.montos_por_mes||[]).reduce((s,v)=>s+(parseFloat(v)||0),0)/12)}</span>
                </div>
              </div>
            ) : (
              <input type="number" step="0.01" className="w-full border border-gray-200 rounded-lg px-3 py-2 font-mono" value={form.monto_mensual || ''} onChange={e => setForm(f => ({...f, monto_mensual: e.target.value}))} placeholder="0.00" />
            )}
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Concepto</label>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2" value={form.concepto || ''} onChange={e => setForm(f => ({...f, concepto: e.target.value}))} />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-4">
          <button onClick={() => setModal(null)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600">Cancelar</button>
          <button onClick={handleSavePartida} disabled={saving} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">{saving ? 'Guardando...' : 'Guardar'}</button>
        </div>
      </Modal>

      {/* Import Excel */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between mt-4">
        <div>
          <div className="font-medium text-amber-800 text-sm">Importar Presupuesto 2026 desde Excel</div>
          <div className="text-xs text-amber-600 mt-0.5">Carga las 38 partidas con sus agrupadores y gastos reales de Ene-Mar 2026</div>
        </div>
        <button
          onClick={async () => {
            if (!confirm('¿Importar los datos del presupuesto 2026? Se crearán las partidas, agrupadores y gastos reales de enero-marzo.')) return
            try {
              const r = await presupuestoAPI.seedExcel()
              showSuccess(r.mensaje)
              load()
            } catch(e) { showError(e?.message || 'Error al importar') }
          }}
          className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm hover:bg-amber-600 font-medium whitespace-nowrap ml-4"
        >
          Importar datos
        </button>
      </div>

      {/* Modal agrupador */}
      <Modal open={modal === 'agrupador' || modal === 'editAgrupador'} onClose={() => setModal(null)} title={modal === 'agrupador' ? 'Nuevo Agrupador' : 'Editar Agrupador'}>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nombre del Agrupador</label>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={form.nombre || ''} onChange={e => setForm(f => ({...f, nombre: e.target.value}))} placeholder="Ej: TI Nube, TI Licencias..." autoFocus />
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setModal(null)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600">Cancelar</button>
            <button onClick={handleSaveAgrupador} disabled={saving || !form.nombre} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">{saving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ── Main Finanzas Page ────────────────────────────────────────────────────────
export default function Finanzas() {
  const [tab, setTab] = useState('presupuesto')
  const tabs = [
    { key: 'presupuesto', label: 'Presupuesto', icon: ChartBarIcon },
    { key: 'detalle', label: 'Desgloce de Gastos', icon: CurrencyDollarIcon },
    { key: 'config', label: 'Configuración', icon: Cog6ToothIcon },
  ]
  return (
    <div className="space-y-5">
      <PageHeader title="Finanzas TI" subtitle="Presupuesto, gasto real y análisis financiero" />
      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab===t.key ? 'bg-white shadow text-primary-700' : 'text-gray-500 hover:text-gray-700'}`}>
            <t.icon className="h-4 w-4" />{t.label}
          </button>
        ))}
      </div>
      {tab === 'presupuesto' && <TabPresupuesto />}
      {tab === 'detalle' && <TabDesgloce />}
      {tab === 'config' && <TabConfig />}
    </div>
  )
}
