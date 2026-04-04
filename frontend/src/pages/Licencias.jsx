import { useState, useEffect, useCallback } from 'react'
import { licenciaAPI, empleadoAPI, sucursalAPI, proveedorAPI, exchangeAPI, catalogosAPI } from '../utils/api'
import { LICENSE_COST_TYPES, LICENSE_STATUS } from '../utils/constants'
import { useAuth } from '../context/AuthContext'
import Badge from '../components/Badge'
import Modal from '../components/Modal'
import Pagination from '../components/Pagination'
import ConfirmDialog from '../components/ConfirmDialog'
import {
  PlusIcon, MagnifyingGlassIcon, PencilIcon, TrashIcon,
  UserPlusIcon, XCircleIcon, KeyIcon, FunnelIcon,
  ChevronDownIcon, ChevronUpIcon, CurrencyDollarIcon,
  ShieldCheckIcon, ClockIcon
} from '@heroicons/react/24/outline'
import { format, differenceInDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { useNotification } from '../context/NotificationContext'

const EMPTY_FORM = {
  nombre: '', tipo: '', proveedor_id: '', clave_licencia: '', version: '',
  descripcion: '', costo: '', moneda: 'MXN', tipo_costo: 'mensual',
  tipo_cambio: 17.15, fecha_inicio: '', fecha_vencimiento: '', total_asientos: 1,
  tipo_asignacion: 'empleados'
}

const TIPO_ASIGNACION_OPTS = [
  { value: 'empleados',  label: '👤 Empleados',           badge: 'bg-blue-100 text-blue-700' },
  { value: 'sucursales', label: '🏢 Sucursales',           badge: 'bg-violet-100 text-violet-700' },
  { value: 'ambos',      label: '👥 Empleados y sucursales', badge: 'bg-amber-100 text-amber-700' },
]

function StatCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="card flex items-center gap-4">
      <div className={`h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <div className="text-2xl font-bold text-gray-900">{value ?? '—'}</div>
        <div className="text-sm text-gray-500">{label}</div>
        {sub && <div className="text-xs text-gray-400">{sub}</div>}
      </div>
    </div>
  )
}

export default function Licencias() {
  const { canEdit, isAdmin } = useAuth()
  const { showError } = useNotification()
  const [licencias, setLicencias] = useState([])
  const [stats, setStats] = useState(null)
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 20 })
  const [filters, setFilters] = useState({ search: '', tipo: '', estado: '' })
  const [showFilters, setShowFilters] = useState(false)
  const [loading, setLoading] = useState(true)

  // Modals
  const [modal, setModal] = useState(null) // 'create'|'edit'|'asignar'|'detalle'
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState(null)

  // Asignación
  const [empleados, setEmpleados] = useState([])
  const [sucursales, setSucursales] = useState([])
  const [searchEmp, setSearchEmp] = useState('')
  const [searchSuc, setSearchSuc] = useState('')
  const [selectedEmpId, setSelectedEmpId] = useState('')
  const [selectedSucId, setSelectedSucId] = useState('')
  const [assignMode, setAssignMode] = useState('empleado') // 'empleado' | 'sucursal'
  const [asignaciones, setAsignaciones] = useState([])
  const [liberarId, setLiberarId] = useState(null)
  const [proveedores, setProveedores] = useState([])
  const [exchangeRate, setExchangeRate] = useState(17.15)
  const [tiposLicencia, setTiposLicencia] = useState([])

  const load = useCallback((page = 1) => {
    setLoading(true)
    const params = { page, limit: 20, ...filters }
    Object.keys(params).forEach(k => !params[k] && delete params[k])
    Promise.all([
      licenciaAPI.getAll(params),
      licenciaAPI.getStats()
    ]).then(([d, s]) => {
      setLicencias(d.data)
      setPagination({ page: d.page, pages: d.pages, total: d.total, limit: d.limit })
      setStats(s)
    }).finally(() => setLoading(false))
  }, [filters])

  useEffect(() => { load(1) }, [load])

  useEffect(() => {
    proveedorAPI.getAll().then(setProveedores)
    exchangeAPI.getRate().then(r => {
      setExchangeRate(r.usd_mxn)
      setForm(f => ({ ...f, tipo_cambio: r.usd_mxn }))
    })
    catalogosAPI.tiposLicencia.getAll().then(items => {
      setTiposLicencia(items.map(i => i.nombre))
    }).catch(() => {})
  }, [])

  // ── Helpers ────────────────────────────────────────────────────────────────
  const fmt = (n, moneda = 'MXN') =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: moneda, minimumFractionDigits: 2 }).format(n || 0)

  const costoMensualMXN = (l) => {
    const costo = parseFloat(l.costo) || 0
    const tc = parseFloat(l.tipo_cambio) || 1
    const mxn = l.moneda === 'USD' ? costo * tc : costo
    if (l.tipo_costo === 'anual') return mxn / 12
    if (l.tipo_costo === 'unico') return null
    return mxn
  }

  const diasRestantes = (fecha) => {
    if (!fecha) return null
    return differenceInDays(new Date(fecha), new Date())
  }

  // ── CRUD Licencias ─────────────────────────────────────────────────────────
  const openCreate = () => {
    setForm({ ...EMPTY_FORM, tipo_cambio: exchangeRate, fecha_inicio: new Date().toISOString().split('T')[0] })
    setModal('create')
  }

  const openEdit = (l) => {
    setSelected(l)
    setForm({
      nombre: l.nombre, tipo: l.tipo, proveedor_id: l.proveedor_id || '',
      clave_licencia: l.clave_licencia || '', version: l.version || '',
      descripcion: l.descripcion || '', costo: l.costo || '',
      moneda: l.moneda || 'MXN', tipo_costo: l.tipo_costo || 'mensual',
      tipo_cambio: l.tipo_cambio || exchangeRate,
      fecha_inicio: l.fecha_inicio || '', fecha_vencimiento: l.fecha_vencimiento || '',
      total_asientos: l.total_asientos || 1,
      tipo_asignacion: l.tipo_asignacion || 'empleados'
    })
    setModal('edit')
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (modal === 'edit') await licenciaAPI.update(selected.id, form)
      else await licenciaAPI.create(form)
      setModal(null)
      load(1)
    } catch (err) { showError(err?.message || 'Error al guardar') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    try { await licenciaAPI.delete(id); load(pagination.page) }
    catch (err) { showError(err?.message || 'No se puede eliminar') }
  }

  // ── Asignaciones ───────────────────────────────────────────────────────────
  const openDetalle = async (l) => {
    setSelected(l)
    setSearchEmp('')
    setSearchSuc('')
    setSelectedEmpId('')
    setSelectedSucId('')
    setSaving(false)
    // Determinar el modo de asignación inicial según tipo_asignacion de la licencia
    const tipoAsg = l.tipo_asignacion || 'empleados'
    setAssignMode(tipoAsg === 'sucursales' ? 'sucursal' : 'empleado')

    const fetches = [licenciaAPI.getAsignaciones(l.id)]
    // Cargar empleados si aplica
    if (tipoAsg === 'empleados' || tipoAsg === 'ambos') fetches.push(empleadoAPI.getAll({ limit: 500 }))
    else fetches.push(Promise.resolve({ data: [] }))
    // Cargar sucursales si aplica
    if (tipoAsg === 'sucursales' || tipoAsg === 'ambos') fetches.push(sucursalAPI.getAll({ limit: 200 }))
    else fetches.push(Promise.resolve({ data: [] }))

    const [asg, emps, sucs] = await Promise.all(fetches)
    setAsignaciones(asg)
    setEmpleados(emps.data)
    setSucursales(sucs.data || [])
    setModal('detalle')
  }

  const handleAsignar = async () => {
    if (!selectedEmpId && !selectedSucId) return
    setSaving(true)
    try {
      const payload = assignMode === 'sucursal' ? { sucursal_id: selectedSucId } : { empleado_id: selectedEmpId }
      await licenciaAPI.asignar(selected.id, payload)
      const asg = await licenciaAPI.getAsignaciones(selected.id)
      setAsignaciones(asg)
      setSelectedEmpId('')
      setSelectedSucId('')
      load(1)
    } catch (err) { showError(err?.message || 'Error al asignar') }
    finally { setSaving(false) }
  }

  const handleLiberar = async (asignacionId) => {
    try {
      await licenciaAPI.liberar(asignacionId)
      const asg = await licenciaAPI.getAsignaciones(selected.id)
      setAsignaciones(asg)
      load(1)
    } catch (err) { showError(err?.message || 'Error') }
  }

  const empleadosDisponibles = empleados.filter(e => {
    if (!searchEmp) return true
    const q = searchEmp.toLowerCase()
    return e.nombre_completo?.toLowerCase().includes(q) || e.num_empleado?.toLowerCase().includes(q)
  }).filter(e => !asignaciones.filter(a => a.activo).some(a => a.empleado_id === e.id))

  const sucursalesDisponibles = sucursales.filter(s => {
    if (!searchSuc) return true
    const q = searchSuc.toLowerCase()
    return s.nombre?.toLowerCase().includes(q) || s.estado?.toLowerCase().includes(q)
  }).filter(s => !asignaciones.filter(a => a.activo).some(a => a.sucursal_id === s.id))

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Licencias</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gestión de licencias de software y sus asignaciones</p>
        </div>
        {canEdit() && (
          <button className="btn-primary" onClick={openCreate}>
            <PlusIcon className="h-4 w-4" /> Nueva Licencia
          </button>
        )}
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={KeyIcon} label="Total licencias" value={stats.total} color="bg-blue-100 text-blue-600" />
          <StatCard icon={ShieldCheckIcon} label="Activas" value={stats.activas} color="bg-emerald-100 text-emerald-600" />
          <StatCard icon={ClockIcon} label="Por vencer (30 días)" value={stats.por_vencer} color="bg-yellow-100 text-yellow-600" />
          <StatCard
            icon={CurrencyDollarIcon}
            label="Costo mensual est."
            value={fmt(stats.costo_mensual_mxn, 'MXN')}
            sub={`${stats.asientos_usados} / ${stats.total_asientos} asientos usados`}
            color="bg-purple-100 text-purple-600"
          />
        </div>
      )}

      {/* Filtros */}
      <div className="card p-4 space-y-3">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input type="text" className="input pl-9" placeholder="Buscar por nombre, tipo, proveedor, clave..."
              value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} />
          </div>
          <button className="btn-secondary" onClick={() => setShowFilters(!showFilters)}>
            <FunnelIcon className="h-4 w-4" /> Filtros
            {showFilters ? <ChevronUpIcon className="h-3.5 w-3.5" /> : <ChevronDownIcon className="h-3.5 w-3.5" />}
          </button>
        </div>
        {showFilters && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Tipo</label>
              <select className="input" value={filters.tipo} onChange={e => setFilters(f => ({ ...f, tipo: e.target.value }))}>
                <option value="">Todos</option>
                {tiposLicencia.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Estado</label>
              <select className="input" value={filters.estado} onChange={e => setFilters(f => ({ ...f, estado: e.target.value }))}>
                <option value="">Todos</option>
                {Object.entries(LICENSE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Tabla */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="table-header">Licencia</th>
                <th className="table-header">Tipo</th>
                <th className="table-header">Asignada a</th>
                <th className="table-header">Costo</th>
                <th className="table-header">Asientos</th>
                <th className="table-header">Vencimiento</th>
                <th className="table-header">Estado</th>
                <th className="table-header">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={8} className="py-12 text-center">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-4 border-primary-600 border-t-transparent" />
                </td></tr>
              ) : licencias.length === 0 ? (
                <tr><td colSpan={8} className="py-12 text-center text-gray-400">No se encontraron licencias</td></tr>
              ) : licencias.map(l => {
                const dias = diasRestantes(l.fecha_vencimiento)
                const mensual = costoMensualMXN(l)
                return (
                  <tr key={l.id} className="hover:bg-gray-50">
                    <td className="table-cell">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 bg-primary-50 rounded-lg flex items-center justify-center flex-shrink-0">
                          <KeyIcon className="h-4 w-4 text-primary-600" />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{l.nombre}</div>
                          <div className="text-xs text-gray-400">
                            {l.proveedor_nombre && <span>{l.proveedor_nombre}</span>}
                            {l.version && <span> · v{l.version}</span>}
                            {l.clave_licencia && <span className="font-mono"> · {l.clave_licencia}</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="table-cell">
                      <span className="badge bg-indigo-100 text-indigo-700">{l.tipo}</span>
                    </td>
                    <td className="table-cell">
                      {(() => {
                        const opt = TIPO_ASIGNACION_OPTS.find(o => o.value === (l.tipo_asignacion || 'empleados'))
                        return <span className={`badge ${opt?.badge || 'bg-gray-100 text-gray-600'}`}>{opt?.label || l.tipo_asignacion}</span>
                      })()}
                    </td>
                    <td className="table-cell">
                      <div className="font-medium text-sm">{fmt(l.costo, l.moneda)}</div>
                      <div className="text-xs text-gray-400">
                        {LICENSE_COST_TYPES[l.tipo_costo]?.label}
                        {l.moneda === 'USD' && mensual && (
                          <span className="ml-1 text-gray-300">≈ {fmt(mensual)}/mes</span>
                        )}
                      </div>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden w-16">
                          <div
                            className={`h-full rounded-full ${(l.asientos_usados / l.total_asientos) >= 0.9 ? 'bg-red-400' : (l.asientos_usados / l.total_asientos) >= 0.7 ? 'bg-yellow-400' : 'bg-emerald-400'}`}
                            style={{ width: `${Math.min(100, Math.round((l.asientos_usados / l.total_asientos) * 100))}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-600 whitespace-nowrap">
                          {l.asientos_usados}/{l.total_asientos}
                        </span>
                      </div>
                    </td>
                    <td className="table-cell">
                      {l.fecha_vencimiento ? (
                        <div>
                          <div className="text-sm">{format(new Date(l.fecha_vencimiento), 'dd/MM/yyyy')}</div>
                          {dias !== null && (
                            <div className={`text-xs ${dias < 0 ? 'text-red-500' : dias <= 30 ? 'text-yellow-600' : 'text-gray-400'}`}>
                              {dias < 0 ? `Vencida hace ${Math.abs(dias)} días` : dias === 0 ? 'Vence hoy' : `${dias} días restantes`}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">Sin vencimiento</span>
                      )}
                    </td>
                    <td className="table-cell">
                      <Badge {...(LICENSE_STATUS[l.estado_calc] || { label: l.estado_calc, color: 'bg-gray-100 text-gray-600' })} />
                    </td>
                    <td className="table-cell">
                      <div className="flex gap-1">
                        <button onClick={() => openDetalle(l)} className="p-1.5 rounded text-gray-400 hover:text-primary-600 hover:bg-primary-50" title="Ver asignaciones">
                          <UserPlusIcon className="h-4 w-4" />
                        </button>
                        {canEdit() && (
                          <button onClick={() => openEdit(l)} className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50" title="Editar">
                            <PencilIcon className="h-4 w-4" />
                          </button>
                        )}
                        {isAdmin() && (
                          <button onClick={() => setDeleteId(l.id)} className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50" title="Eliminar">
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <Pagination {...pagination} onPageChange={load} />
      </div>

      {/* ── Modal crear / editar ─────────────────────────────────────────── */}
      <Modal
        open={modal === 'create' || modal === 'edit'}
        onClose={() => setModal(null)}
        title={modal === 'edit' ? 'Editar Licencia' : 'Nueva Licencia'}
        size="xl"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Nombre de la licencia *</label>
              <input className="input" required placeholder="Microsoft 365, Adobe CC, ESET..." value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
            </div>
            <div>
              <label className="label">Tipo *</label>
              <select className="input" required value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                <option value="">Seleccionar...</option>
                {tiposLicencia.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Proveedor</label>
              <select className="input" value={form.proveedor_id} onChange={e => setForm(f => ({ ...f, proveedor_id: e.target.value }))}>
                <option value="">Sin proveedor registrado</option>
                {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Clave / Número de licencia</label>
              <input className="input font-mono" placeholder="XXXXX-XXXXX-XXXXX" value={form.clave_licencia} onChange={e => setForm(f => ({ ...f, clave_licencia: e.target.value }))} />
            </div>
            <div>
              <label className="label">Versión</label>
              <input className="input" placeholder="2024, 10.x, CC 2024..." value={form.version} onChange={e => setForm(f => ({ ...f, version: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="label">Descripción</label>
              <textarea className="input" rows={2} value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
            </div>

            {/* Costos */}
            <div>
              <label className="label">Costo *</label>
              <input type="number" step="0.01" min="0" className="input" required value={form.costo} onChange={e => setForm(f => ({ ...f, costo: e.target.value }))} />
            </div>
            <div>
              <label className="label">Moneda</label>
              <select className="input" value={form.moneda} onChange={e => setForm(f => ({ ...f, moneda: e.target.value }))}>
                <option value="MXN">MXN — Peso Mexicano</option>
                <option value="USD">USD — Dólar Americano</option>
              </select>
            </div>
            <div>
              <label className="label">Tipo de costo</label>
              <select className="input" value={form.tipo_costo} onChange={e => setForm(f => ({ ...f, tipo_costo: e.target.value }))}>
                {Object.entries(LICENSE_COST_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            {form.moneda === 'USD' && (
              <div>
                <label className="label">Tipo de cambio (USD → MXN)</label>
                <input type="number" step="0.01" className="input" value={form.tipo_cambio} onChange={e => setForm(f => ({ ...f, tipo_cambio: e.target.value }))} />
              </div>
            )}

            {/* Previsualización de costo */}
            {form.costo > 0 && (
              <div className="col-span-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 text-sm text-blue-700 flex gap-6">
                <span>
                  <span className="font-medium">Costo: </span>
                  {new Intl.NumberFormat('es-MX', { style: 'currency', currency: form.moneda }).format(parseFloat(form.costo) || 0)} / {LICENSE_COST_TYPES[form.tipo_costo]?.label?.toLowerCase()}
                </span>
                {form.moneda === 'USD' && (
                  <span>
                    <span className="font-medium">≈ MXN: </span>
                    {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format((parseFloat(form.costo) || 0) * (parseFloat(form.tipo_cambio) || 1))}
                  </span>
                )}
                {form.tipo_costo === 'anual' && (
                  <span>
                    <span className="font-medium">Mensual est.: </span>
                    {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(
                      ((parseFloat(form.costo) || 0) * (form.moneda === 'USD' ? parseFloat(form.tipo_cambio) || 1 : 1)) / 12
                    )}
                  </span>
                )}
              </div>
            )}

            <div>
              <label className="label">Total de asientos / usuarios</label>
              <input type="number" min="1" className="input" value={form.total_asientos} onChange={e => setForm(f => ({ ...f, total_asientos: e.target.value }))} />
            </div>
            <div>
              <label className="label">Asignada a</label>
              <select className="input" value={form.tipo_asignacion} onChange={e => setForm(f => ({ ...f, tipo_asignacion: e.target.value }))}>
                {TIPO_ASIGNACION_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Fecha de inicio</label>
              <input type="date" className="input" value={form.fecha_inicio} onChange={e => setForm(f => ({ ...f, fecha_inicio: e.target.value }))} />
            </div>
            <div>
              <label className="label">Fecha de vencimiento</label>
              <input type="date" className="input" value={form.fecha_vencimiento} onChange={e => setForm(f => ({ ...f, fecha_vencimiento: e.target.value }))} />
              <p className="text-xs text-gray-400 mt-0.5">Dejar vacío para licencias perpetuas</p>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : modal === 'edit' ? 'Guardar cambios' : 'Crear licencia'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Modal detalle + asignaciones ────────────────────────────────── */}
      <Modal open={modal === 'detalle'} onClose={() => setModal(null)} title={selected?.nombre} size="xl">
        {selected && (
          <div className="space-y-5">
            {/* Info resumen */}
            <div className="grid grid-cols-3 gap-3 bg-gray-50 rounded-xl p-4 text-sm">
              <div>
                <span className="text-gray-500">Tipo: </span>
                <span className="font-medium">{selected.tipo}</span>
              </div>
              <div>
                <span className="text-gray-500">Asignada a: </span>
                {(() => {
                  const opt = TIPO_ASIGNACION_OPTS.find(o => o.value === (selected.tipo_asignacion || 'empleados'))
                  return <span className={`badge text-xs ${opt?.badge || 'bg-gray-100 text-gray-600'}`}>{opt?.label || selected.tipo_asignacion || 'Empleados'}</span>
                })()}
              </div>
              <div>
                <span className="text-gray-500">Costo: </span>
                <span className="font-medium">
                  {fmt(selected.costo, selected.moneda)} / {LICENSE_COST_TYPES[selected.tipo_costo]?.label?.toLowerCase()}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Asientos: </span>
                <span className="font-medium">
                  {asignaciones.filter(a => a.activo).length} / {selected.total_asientos} usados
                </span>
              </div>
              {selected.fecha_vencimiento && (
                <div>
                  <span className="text-gray-500">Vence: </span>
                  <span className="font-medium">{format(new Date(selected.fecha_vencimiento), 'dd/MM/yyyy')}</span>
                </div>
              )}
              {selected.clave_licencia && (
                <div className="col-span-2">
                  <span className="text-gray-500">Clave: </span>
                  <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{selected.clave_licencia}</span>
                </div>
              )}
            </div>

            {/* Barra de asientos */}
            <div>
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Asientos utilizados</span>
                <span>{asignaciones.filter(a => a.activo).length} de {selected.total_asientos}</span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    (asignaciones.filter(a => a.activo).length / selected.total_asientos) >= 1 ? 'bg-red-500' :
                    (asignaciones.filter(a => a.activo).length / selected.total_asientos) >= 0.8 ? 'bg-yellow-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.round((asignaciones.filter(a => a.activo).length / selected.total_asientos) * 100))}%` }}
                />
              </div>
            </div>

            {/* Panel de asignación — dinámico según tipo_asignacion */}
            {canEdit() && asignaciones.filter(a => a.activo).length < selected.total_asientos && (() => {
              const tipoAsg = selected.tipo_asignacion || 'empleados'
              const showEmpleados = tipoAsg === 'empleados' || tipoAsg === 'ambos'
              const showSucursales = tipoAsg === 'sucursales' || tipoAsg === 'ambos'
              return (
                <div className="border border-dashed border-primary-300 rounded-xl p-4 bg-primary-50/40 space-y-3">
                  {/* Título y tabs si es "ambos" */}
                  {tipoAsg === 'ambos' ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-primary-700">Asignar a:</span>
                      <div className="flex rounded-lg overflow-hidden border border-primary-200 text-xs">
                        <button
                          className={`px-3 py-1.5 transition-colors ${assignMode === 'empleado' ? 'bg-primary-600 text-white font-semibold' : 'bg-white text-gray-600 hover:bg-primary-50'}`}
                          onClick={() => { setAssignMode('empleado'); setSelectedSucId('') }}
                        >👤 Empleado</button>
                        <button
                          className={`px-3 py-1.5 transition-colors ${assignMode === 'sucursal' ? 'bg-violet-600 text-white font-semibold' : 'bg-white text-gray-600 hover:bg-violet-50'}`}
                          onClick={() => { setAssignMode('sucursal'); setSelectedEmpId('') }}
                        >🏢 Sucursal</button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm font-medium text-primary-700">
                      {showSucursales ? '🏢 Asignar a una sucursal' : '👤 Asignar a un empleado'}
                    </div>
                  )}

                  {/* Lista de empleados */}
                  {showEmpleados && (!showSucursales || assignMode === 'empleado') && (
                    <>
                      <div className="relative">
                        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input className="input pl-9" placeholder="Buscar empleado..." value={searchEmp} onChange={e => setSearchEmp(e.target.value)} />
                      </div>
                      <div className="border border-gray-200 rounded-lg overflow-y-auto max-h-44 bg-white">
                        {empleadosDisponibles.length === 0 ? (
                          <div className="text-center text-gray-400 text-sm py-4">Sin empleados disponibles</div>
                        ) : empleadosDisponibles.map(e => (
                          <label key={e.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0">
                            <input type="radio" name="emp_asignar" value={e.id}
                              checked={selectedEmpId === e.id}
                              onChange={() => setSelectedEmpId(e.id)} />
                            <div className="flex items-center gap-2">
                              <div className="h-6 w-6 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-semibold text-xs flex-shrink-0">
                                {e.nombre_completo?.charAt(0)}
                              </div>
                              <div>
                                <div className="text-sm font-medium">{e.nombre_completo}</div>
                                <div className="text-xs text-gray-400">{e.num_empleado} · {e.puesto}</div>
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </>
                  )}

                  {/* Lista de sucursales */}
                  {showSucursales && (!showEmpleados || assignMode === 'sucursal') && (
                    <>
                      <div className="relative">
                        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input className="input pl-9" placeholder="Buscar sucursal..." value={searchSuc} onChange={e => setSearchSuc(e.target.value)} />
                      </div>
                      <div className="border border-gray-200 rounded-lg overflow-y-auto max-h-44 bg-white">
                        {sucursalesDisponibles.length === 0 ? (
                          <div className="text-center text-gray-400 text-sm py-4">Sin sucursales disponibles</div>
                        ) : sucursalesDisponibles.map(s => (
                          <label key={s.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0">
                            <input type="radio" name="suc_asignar" value={s.id}
                              checked={selectedSucId === s.id}
                              onChange={() => setSelectedSucId(s.id)} />
                            <div className="flex items-center gap-2">
                              <div className="h-6 w-6 bg-violet-100 rounded-full flex items-center justify-center text-violet-700 font-semibold text-xs flex-shrink-0">
                                🏢
                              </div>
                              <div>
                                <div className="text-sm font-medium">{s.nombre}</div>
                                <div className="text-xs text-gray-400">{s.estado || s.tipo}</div>
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </>
                  )}

                  <div className="flex justify-end">
                    <button
                      className="btn-primary"
                      onClick={handleAsignar}
                      disabled={(!selectedEmpId && !selectedSucId) || saving}
                    >
                      {saving ? 'Asignando...' : 'Asignar licencia'}
                    </button>
                  </div>
                </div>
              )
            })()}

            {/* Lista de asignaciones activas */}
            <div>
              <div className="text-sm font-semibold text-gray-700 mb-2">
                Asignaciones activas ({asignaciones.filter(a => a.activo).length})
              </div>
              <div className="space-y-2">
                {asignaciones.filter(a => a.activo).length === 0 ? (
                  <div className="text-center text-gray-400 text-sm py-6 border border-dashed border-gray-200 rounded-lg">
                    Sin asignaciones activas
                  </div>
                ) : asignaciones.filter(a => a.activo).map(a => {
                  const esSucursal = a.tipo_asignado === 'sucursal' || (!a.empleado_nombre && a.sucursal_nombre)
                  const displayNombre = esSucursal ? a.sucursal_nombre : a.empleado_nombre
                  return (
                    <div key={a.id} className={`flex items-center justify-between px-4 py-3 border rounded-lg ${esSucursal ? 'bg-violet-50 border-violet-100' : 'bg-emerald-50 border-emerald-100'}`}>
                      <div className="flex items-center gap-3">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center font-semibold text-sm ${esSucursal ? 'bg-violet-200 text-violet-700' : 'bg-emerald-200 text-emerald-700'}`}>
                          {esSucursal ? '🏢' : displayNombre?.charAt(0)}
                        </div>
                        <div>
                          <div className="text-sm font-medium">{displayNombre}</div>
                          <div className="text-xs text-gray-500">
                            {esSucursal ? 'Sucursal · ' : ''}
                            Asignado por {a.asignado_por_nombre} · {a.fecha_asignacion ? format(new Date(a.fecha_asignacion), 'dd/MM/yyyy', { locale: es }) : ''}
                          </div>
                        </div>
                      </div>
                      {canEdit() && (
                        <button onClick={() => setLiberarId(a.id)} className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Liberar asignación">
                          <XCircleIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Historial */}
              {asignaciones.filter(a => !a.activo).length > 0 && (
                <details className="mt-3">
                  <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">
                    Ver historial ({asignaciones.filter(a => !a.activo).length} anteriores)
                  </summary>
                  <div className="mt-2 space-y-1">
                    {asignaciones.filter(a => !a.activo).map(a => {
                      const esSuc = a.tipo_asignado === 'sucursal' || (!a.empleado_nombre && a.sucursal_nombre)
                      return (
                        <div key={a.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg text-xs text-gray-500">
                          <span>{esSuc ? `🏢 ${a.sucursal_nombre}` : a.empleado_nombre}</span>
                          <span>
                            {a.fecha_asignacion ? format(new Date(a.fecha_asignacion), 'dd/MM/yy') : ''} →
                            {a.fecha_liberacion ? format(new Date(a.fecha_liberacion), 'dd/MM/yy') : ''}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </details>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Confirm eliminar */}
      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => handleDelete(deleteId)}
        title="Eliminar licencia"
        message="¿Estás seguro de que deseas eliminar esta licencia? Asegúrate de que no tenga asignaciones activas."
      />

      {/* Confirm liberar */}
      <ConfirmDialog
        open={!!liberarId}
        onClose={() => setLiberarId(null)}
        onConfirm={() => { handleLiberar(liberarId); setLiberarId(null) }}
        title="Liberar asignación"
        message="Se liberará el asiento de esta licencia para el empleado. ¿Confirmar?"
        variant="warning"
      />
    </div>
  )
}
