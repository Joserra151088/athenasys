import { useState, useCallback } from 'react'
import { reportesAPI } from '../utils/api'
import { DEVICE_TYPES } from '../utils/constants'
import {
  DocumentArrowDownIcon, FunnelIcon, TableCellsIcon,
  ComputerDesktopIcon, ArrowsRightLeftIcon, KeyIcon,
  CurrencyDollarIcon, ArrowPathIcon
} from '@heroicons/react/24/outline'

const TABS = [
  { id: 'inventario',   label: 'Inventario',   icon: ComputerDesktopIcon, color: 'blue' },
  { id: 'asignaciones', label: 'Asignaciones', icon: ArrowsRightLeftIcon, color: 'emerald' },
  { id: 'licencias',    label: 'Licencias',    icon: KeyIcon,             color: 'purple' },
  { id: 'gastos',       label: 'Gastos TI',    icon: CurrencyDollarIcon,  color: 'orange' },
]

const HOY = new Date().toISOString().slice(0, 10)
const INICIO_MES = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)

function exportCSV(data, filename) {
  if (!data || data.length === 0) return
  const cols = Object.keys(data[0])
  const rows = [
    cols.join(','),
    ...data.map(row => cols.map(c => {
      const v = row[c] ?? ''
      return typeof v === 'string' && (v.includes(',') || v.includes('"') || v.includes('\n'))
        ? `"${v.replace(/"/g, '""')}"` : v
    }).join(','))
  ]
  const blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function FiltrosInventario({ filters, setFilters }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <div>
        <label className="label">Tipo de dispositivo</label>
        <select className="input" value={filters.tipo || ''} onChange={e => setFilters(f => ({ ...f, tipo: e.target.value }))}>
          <option value="">Todos los tipos</option>
          {DEVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Estado</label>
        <select className="input" value={filters.estado || ''} onChange={e => setFilters(f => ({ ...f, estado: e.target.value }))}>
          <option value="">Todos</option>
          <option value="activo">Activo</option>
          <option value="stock">En stock</option>
          <option value="en_reparacion">En reparación</option>
          <option value="baja">Baja</option>
          <option value="danado">Dañado</option>
        </select>
      </div>
      <div>
        <label className="label">Ubicación</label>
        <select className="input" value={filters.ubicacion_tipo || ''} onChange={e => setFilters(f => ({ ...f, ubicacion_tipo: e.target.value }))}>
          <option value="">Todas</option>
          <option value="almacen">Almacén</option>
          <option value="empleado">Empleado</option>
          <option value="sucursal">Sucursal</option>
          <option value="proveedor">Proveedor</option>
        </select>
      </div>
    </div>
  )
}

function FiltrosAsignaciones({ filters, setFilters }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="label">Tipo de asignación</label>
        <select className="input" value={filters.tipo_asignacion || ''} onChange={e => setFilters(f => ({ ...f, tipo_asignacion: e.target.value }))}>
          <option value="">Todas</option>
          <option value="empleado">Empleado</option>
          <option value="sucursal">Sucursal</option>
        </select>
      </div>
    </div>
  )
}

function FiltrosGastos({ filters, setFilters }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="label">Fecha inicio</label>
        <input type="date" className="input" value={filters.fecha_inicio || INICIO_MES}
          onChange={e => setFilters(f => ({ ...f, fecha_inicio: e.target.value }))} />
      </div>
      <div>
        <label className="label">Fecha fin</label>
        <input type="date" className="input" value={filters.fecha_fin || HOY}
          onChange={e => setFilters(f => ({ ...f, fecha_fin: e.target.value }))} />
      </div>
    </div>
  )
}

function TablaResultados({ data, loading }) {
  if (loading) return (
    <div className="py-16 text-center">
      <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary-600 border-t-transparent" />
      <p className="text-gray-400 mt-3 text-sm">Generando reporte...</p>
    </div>
  )
  if (!data) return (
    <div className="py-16 text-center text-gray-400">
      <TableCellsIcon className="h-12 w-12 mx-auto mb-3 opacity-30" />
      <p>Aplica los filtros y presiona <strong>Generar reporte</strong></p>
    </div>
  )
  if (data.length === 0) return (
    <div className="py-12 text-center text-gray-400">No se encontraron registros con los filtros seleccionados.</div>
  )

  const cols = Object.keys(data[0])
  const fmtHeader = (k) => k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  const fmtVal = (v) => {
    if (v === null || v === undefined) return '—'
    if (typeof v === 'number') return v.toLocaleString('es-MX', { maximumFractionDigits: 2 })
    return String(v)
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            {cols.map(c => (
              <th key={c} className="table-header whitespace-nowrap">{fmtHeader(c)}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {data.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50">
              {cols.map(c => (
                <td key={c} className="table-cell text-xs text-gray-700 whitespace-nowrap">
                  {fmtVal(row[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const COLOR_MAP = {
  blue:    'border-blue-500 text-blue-700 bg-blue-50',
  emerald: 'border-emerald-500 text-emerald-700 bg-emerald-50',
  purple:  'border-purple-500 text-purple-700 bg-purple-50',
  orange:  'border-orange-500 text-orange-700 bg-orange-50',
}

export default function Reportes() {
  const [tab, setTab]     = useState('inventario')
  const [filters, setFilters] = useState({ fecha_inicio: INICIO_MES, fecha_fin: HOY })
  const [result, setResult]   = useState(null)
  const [loading, setLoading] = useState(false)
  const [meta, setMeta]       = useState(null)

  const handleGenerate = useCallback(async () => {
    setLoading(true)
    setResult(null)
    setMeta(null)
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
      let res
      if (tab === 'inventario')   res = await reportesAPI.inventario(params)
      if (tab === 'asignaciones') res = await reportesAPI.asignaciones(params)
      if (tab === 'licencias')    res = await reportesAPI.licencias(params)
      if (tab === 'gastos')       res = await reportesAPI.gastos(params)
      setResult(res.data || [])
      setMeta({ titulo: res.titulo, total: res.total, total_mxn: res.total_mxn, generado: res.generado })
    } catch (err) {
      alert(err?.message || 'Error al generar reporte')
    } finally {
      setLoading(false)
    }
  }, [tab, filters])

  const handleTabChange = (id) => {
    setTab(id)
    setFilters({ fecha_inicio: INICIO_MES, fecha_fin: HOY })
    setResult(null)
    setMeta(null)
  }

  const activeTab = TABS.find(t => t.id === tab)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>
          <p className="text-sm text-gray-500 mt-0.5">Genera y exporta reportes de inventario, asignaciones, licencias y gastos</p>
        </div>
        {result && result.length > 0 && (
          <button className="btn-secondary" onClick={() => exportCSV(result, `${tab}_${HOY}.csv`)}>
            <DocumentArrowDownIcon className="h-4 w-4" /> Exportar CSV
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map(t => {
          const isActive = tab === t.id
          return (
            <button key={t.id} onClick={() => handleTabChange(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                isActive ? COLOR_MAP[t.color] : 'border-gray-200 text-gray-600 bg-white hover:bg-gray-50'
              }`}>
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Filtros */}
      <div className="card p-4 space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <FunnelIcon className="h-4 w-4" /> Filtros
        </div>
        {tab === 'inventario'   && <FiltrosInventario   filters={filters} setFilters={setFilters} />}
        {tab === 'asignaciones' && <FiltrosAsignaciones filters={filters} setFilters={setFilters} />}
        {tab === 'gastos'       && <FiltrosGastos       filters={filters} setFilters={setFilters} />}
        {tab === 'licencias'    && <p className="text-sm text-gray-400">No hay filtros adicionales para licencias.</p>}

        <div className="flex justify-end">
          <button className="btn-primary" onClick={handleGenerate} disabled={loading}>
            {loading
              ? <><ArrowPathIcon className="h-4 w-4 animate-spin" /> Generando...</>
              : 'Generar reporte'}
          </button>
        </div>
      </div>

      {/* Metadatos */}
      {meta && (
        <div className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-lg border ${activeTab ? COLOR_MAP[activeTab.color] : 'bg-gray-50 border-gray-200'}`}>
          <div className="flex items-center gap-3">
            <span className="font-semibold">{meta.titulo}</span>
            <span className="text-sm opacity-70">— {meta.total} registro{meta.total !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            {meta.total_mxn !== undefined && (
              <span className="font-bold">
                Total: ${meta.total_mxn.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN
              </span>
            )}
            <span className="opacity-60">Generado: {meta.generado}</span>
            <button className="flex items-center gap-1 opacity-70 hover:opacity-100" onClick={() => exportCSV(result, `${tab}_${HOY}.csv`)}>
              <DocumentArrowDownIcon className="h-4 w-4" /> CSV
            </button>
          </div>
        </div>
      )}

      {/* Tabla de resultados */}
      <div className="card p-0 overflow-hidden">
        <TablaResultados data={result} loading={loading} />
      </div>
    </div>
  )
}
