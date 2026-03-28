import { useState, useEffect, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts'
import {
  CurrencyDollarIcon, ChartBarIcon, Cog6ToothIcon, PlusIcon,
  PencilSquareIcon, TrashIcon, ArrowPathIcon, MagnifyingGlassIcon,
  CheckCircleIcon, ExclamationTriangleIcon, DocumentDuplicateIcon
} from '@heroicons/react/24/outline'
import { presupuestoAPI } from '../utils/api'
import Modal from '../components/Modal'

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
    } catch(e) { alert(e?.message || 'Error') }
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
                const variacion = presupuestoPeriodo - gastoPeriodo - ahoorroPeriodo
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
      ahorro_soporte: '', ahorro_descripcion: ''
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
      ahorro_soporte: '', ahorro_descripcion: ''
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

  const calcTotals = (f) => {
    let subtotal
    if (f.modo_calculo === 'total') {
      subtotal = parseFloat(f.subtotal_directo) || 0
    } else {
      subtotal = (parseFloat(f.dias_facturados) || 0) * (parseFloat(f.costo_dia) || 0)
    }
    const aplica = f.aplica_iva === true || f.aplica_iva === 1
    const iva = aplica ? subtotal * 0.16 : 0
    return { subtotal, iva_monto: iva, total: subtotal + iva }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = {
        ...form,
        subtotal_directo: form.modo_calculo === 'total' ? (parseFloat(form.subtotal_directo) || 0) : undefined,
      }
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
    } catch(e) { alert(e?.message || 'Error') }
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
    } catch(e) { alert(e?.message || 'Error al eliminar') }
    finally { setBulkDeleting(false) }
  }

  const handleClonar = async () => {
    setSaving(true)
    try {
      const r = await presupuestoAPI.clonarMes({ ...clonarForm, mes_destino: mes, anio_destino: anio })
      setModal(null)
      load()
      alert(`${r.clonados} registros clonados correctamente`)
    } catch(e) { alert(e?.message || 'Error') }
    finally { setSaving(false) }
  }

  const { subtotal, iva_monto, total } = calcTotals(form)

  // Presupuesto de la partida seleccionada para el mes del form
  const selPartida = proveedoresLista.find(p => p.partida_id === form.partida_id)
  const _mpm = Array.isArray(selPartida?.montos_por_mes) ? selPartida.montos_por_mes : null
  const partidaBudgetMes = selPartida
    ? (_mpm ? (_mpm[(form.mes || mes) - 1] || 0) : (selPartida.monto_mensual || 0))
    : 0
  const diferencia = partidaBudgetMes - total
  const ahorroVal = parseFloat(form.ahorro_soporte) || 0
  const noEjercidoVal = Math.max(0, diferencia - ahorroVal)

  const totalesGlobal = detalle.reduce((acc, d) => ({
    subtotal: acc.subtotal + (d.subtotal || 0),
    iva: acc.iva + (d.iva_monto || 0),
    total: acc.total + (d.total || 0)
  }), { subtotal: 0, iva: 0, total: 0 })

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
        <div className="flex-1" />
        <button onClick={() => setModal('clonar')} className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
          <DocumentDuplicateIcon className="h-4 w-4" /> Clonar mes anterior
        </button>
        <button onClick={openNew} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700">
          <PlusIcon className="h-4 w-4" /> Nueva línea
        </button>
      </div>

      {/* Totals banner */}
      {detalle.length > 0 && (
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
            <div className="text-xs text-primary-600">Total</div>
            <div className="text-lg font-bold text-primary-700">{fmtDec(totalesGlobal.total)}</div>
          </div>
        </div>
      )}

      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
          <span className="text-sm font-semibold text-red-700">{selected.size} registro{selected.size !== 1 ? 's' : ''} seleccionado{selected.size !== 1 ? 's' : ''}</span>
          <div className="flex-1" />
          <button onClick={() => setSelected(new Set())} className="text-sm text-gray-500 hover:text-gray-700">Deseleccionar</button>
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
                    checked={selected.size === detalle.length && detalle.length > 0}
                    onChange={e => setSelected(e.target.checked ? new Set(detalle.map(d => d.id)) : new Set())}
                  />
                </th>
                <th className="px-3 py-2.5 text-left text-gray-500 font-medium">Nombre</th>
                <th className="px-3 py-2.5 text-left text-gray-500 font-medium">Serie/Tel</th>
                <th className="px-3 py-2.5 text-left text-gray-500 font-medium">Servicio</th>
                <th className="px-3 py-2.5 text-left text-gray-500 font-medium">Proveedor</th>
                <th className="px-3 py-2.5 text-right text-gray-500 font-medium">Días</th>
                <th className="px-3 py-2.5 text-right text-gray-500 font-medium">$/día</th>
                <th className="px-3 py-2.5 text-right text-gray-500 font-medium">Subtotal</th>
                <th className="px-3 py-2.5 text-center text-gray-500 font-medium">IVA</th>
                <th className="px-3 py-2.5 text-right text-gray-500 font-medium">Total</th>
                <th className="px-3 py-2.5 text-left text-gray-500 font-medium">CC</th>
                <th className="px-3 py-2.5 text-left text-gray-500 font-medium">Tipo</th>
                <th className="px-3 py-2.5 text-center text-gray-500 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={13} className="py-10 text-center"><div className="inline-block animate-spin rounded-full h-5 w-5 border-4 border-primary-500 border-t-transparent"/></td></tr>
              ) : detalle.length === 0 ? (
                <tr><td colSpan={13} className="py-10 text-center text-gray-400">No hay registros para este período. Agrega líneas o clona el mes anterior.</td></tr>
              ) : detalle.map(d => (
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
                  <td className="px-3 py-2 font-medium text-gray-800 max-w-[160px] truncate">{d.nombre}</td>
                  <td className="px-3 py-2 font-mono text-gray-500">{d.telefono_serie || '—'}</td>
                  <td className="px-3 py-2 text-gray-600">{d.tipo_servicio || '—'}</td>
                  <td className="px-3 py-2 text-gray-500">{d.proveedor || '—'}</td>
                  <td className="px-3 py-2 text-right font-mono">{d.dias_facturados}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmtDec(d.costo_dia)}</td>
                  <td className="px-3 py-2 text-right font-mono text-gray-700">{fmtDec(d.subtotal)}</td>
                  <td className="px-3 py-2 text-center">
                    {d.aplica_iva ? <CheckCircleIcon className="h-4 w-4 text-primary-500 mx-auto" /> : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-semibold text-primary-700">{fmtDec(d.total)}</td>
                  <td className="px-3 py-2"><span className="bg-navy-50 text-navy-700 px-1.5 py-0.5 rounded text-xs">{d.centro_costo_codigo || '—'}</span></td>
                  <td className="px-3 py-2"><span className={`px-1.5 py-0.5 rounded text-xs ${d.identificador === 'CAF' ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>{d.identificador}</span></td>
                  <td className="px-3 py-2">
                    <div className="flex justify-center gap-1">
                      <button onClick={() => openEdit(d)} className="p-1 rounded hover:bg-primary-50 text-gray-400 hover:text-primary-600"><PencilSquareIcon className="h-3.5 w-3.5"/></button>
                      <button onClick={() => handleDelete(d.id)} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"><TrashIcon className="h-3.5 w-3.5"/></button>
                    </div>
                  </td>
                </tr>
              ))}
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
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={form.departamento || ''} onChange={e => setForm(f => ({...f, departamento: e.target.value}))} />
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
                <label className="block text-xs font-medium text-gray-600 mb-1">Costo por Día (MXN)</label>
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
            <div className="bg-white rounded-lg border p-2.5"><div className="text-xs text-gray-400">Subtotal</div><div className="font-bold text-gray-700">{fmtDec(subtotal)}</div></div>
            <div className="bg-amber-50 rounded-lg border border-amber-200 p-2.5"><div className="text-xs text-amber-500">IVA 16%</div><div className="font-bold text-amber-700">{fmtDec(iva_monto)}</div></div>
            <div className="bg-primary-50 rounded-lg border border-primary-200 p-2.5"><div className="text-xs text-primary-500">Total</div><div className="font-bold text-primary-700 text-lg">{fmtDec(total)}</div></div>
          </div>

          {/* Comparativa vs partida */}
          {selPartida && (
            <div className="col-span-2">
              {total > partidaBudgetMes ? (
                <div className="bg-red-50 border border-red-300 rounded-xl p-3 flex items-start gap-2">
                  <span className="text-red-500 text-lg mt-0.5">⚠️</span>
                  <div>
                    <p className="text-sm font-semibold text-red-700">Excede el presupuesto de la partida</p>
                    <p className="text-xs text-red-500 mt-0.5">
                      Gasto registrado <span className="font-bold">{fmtDec(total)}</span> &gt; Presupuesto <span className="font-bold">{fmtDec(partidaBudgetMes)}</span>
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-3">
                  {/* Resumen presupuesto vs gasto */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div>
                      <div className="text-gray-400">Presupuesto partida</div>
                      <div className="font-bold text-gray-700 mt-0.5">{fmtDec(partidaBudgetMes)}</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Gasto registrado</div>
                      <div className="font-bold text-primary-700 mt-0.5">{fmtDec(total)}</div>
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
    } catch(e) { alert(e?.message || 'Error') }
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
    } catch(e) { alert(e?.message || 'Error') }
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
              alert(r.mensaje)
              load()
            } catch(e) { alert(e?.message || 'Error al importar') }
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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Finanzas TI</h1>
        <p className="text-sm text-gray-500 mt-0.5">Presupuesto, gasto real y análisis financiero</p>
      </div>
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
