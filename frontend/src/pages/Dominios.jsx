import { useCallback, useEffect, useState } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  ArrowPathIcon,
  CalendarDaysIcon,
  CurrencyDollarIcon,
  GlobeAltIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  PlusIcon,
  ServerStackIcon,
  ShieldCheckIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'
import Badge from '../components/Badge'
import ConfirmDialog from '../components/ConfirmDialog'
import Modal from '../components/Modal'
import PageHeader from '../components/PageHeader'
import Pagination from '../components/Pagination'
import { useAuth } from '../context/AuthContext'
import { useNotification } from '../context/NotificationContext'
import { dominioAPI, exchangeAPI, proveedorAPI } from '../utils/api'
import { DOMAIN_EXPIRY_STATUS, DOMAIN_OPERATION_STATUS, DOMAIN_PERIODICITY } from '../utils/constants'

const EMPTY_FORM = {
  dominio: '',
  registrador: '',
  proveedor_id: '',
  estado: 'activo',
  fecha_registro: '',
  fecha_vencimiento: '',
  renovacion_auto: true,
  costo_renovacion: '',
  moneda: 'MXN',
  periodicidad: 'anual',
  tipo_cambio: 17.15,
  cuenta_admin: '',
  responsable: '',
  departamento: '',
  uso: '',
  dns_principal: '',
  nameservers: '',
  notas: '',
}

function StatCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="card flex items-center gap-4">
      <div className={`h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <div className="text-2xl font-bold text-gray-900">{value ?? '-'}</div>
        <div className="text-sm text-gray-500">{label}</div>
        {sub && <div className="text-xs text-gray-400">{sub}</div>}
      </div>
    </div>
  )
}

export default function Dominios() {
  const { canEdit, isAdmin } = useAuth()
  const { showError } = useNotification()
  const [dominios, setDominios] = useState([])
  const [stats, setStats] = useState(null)
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 20 })
  const [filters, setFilters] = useState({ search: '', estado: '', vencimiento: '', proveedor_id: '' })
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [proveedores, setProveedores] = useState([])
  const [exchangeRate, setExchangeRate] = useState(17.15)

  const fmt = (n, moneda = 'MXN') =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: moneda, minimumFractionDigits: 2 }).format(n || 0)

  const load = useCallback((page = 1) => {
    setLoading(true)
    const params = { page, limit: 20, ...filters }
    Object.keys(params).forEach(k => !params[k] && delete params[k])
    Promise.all([
      dominioAPI.getAll(params),
      dominioAPI.getStats(),
    ]).then(([d, s]) => {
      setDominios(d.data || [])
      setPagination({ page: d.page, pages: d.pages, total: d.total, limit: d.limit })
      setStats(s)
    }).catch(err => {
      showError(err?.message || 'Error cargando dominios')
    }).finally(() => setLoading(false))
  }, [filters, showError])

  useEffect(() => { load(1) }, [load])

  useEffect(() => {
    proveedorAPI.getAll().then(setProveedores).catch(() => setProveedores([]))
    exchangeAPI.getRate().then(rate => {
      setExchangeRate(rate.usd_mxn)
      setForm(f => ({ ...f, tipo_cambio: rate.usd_mxn }))
    }).catch(() => {})
  }, [])

  const openCreate = () => {
    setSelected(null)
    setForm({
      ...EMPTY_FORM,
      tipo_cambio: exchangeRate,
      fecha_registro: new Date().toISOString().split('T')[0],
    })
    setModal('edit')
  }

  const openEdit = (item) => {
    setSelected(item)
    setForm({
      dominio: item.dominio || '',
      registrador: item.registrador || '',
      proveedor_id: item.proveedor_id || '',
      estado: item.estado || 'activo',
      fecha_registro: item.fecha_registro || '',
      fecha_vencimiento: item.fecha_vencimiento || '',
      renovacion_auto: Boolean(item.renovacion_auto),
      costo_renovacion: item.costo_renovacion ?? '',
      moneda: item.moneda || 'MXN',
      periodicidad: item.periodicidad || 'anual',
      tipo_cambio: item.tipo_cambio || exchangeRate,
      cuenta_admin: item.cuenta_admin || '',
      responsable: item.responsable || '',
      departamento: item.departamento || '',
      uso: item.uso || '',
      dns_principal: item.dns_principal || '',
      nameservers: item.nameservers || '',
      notas: item.notas || '',
    })
    setModal('edit')
  }

  const openDetail = (item) => {
    setSelected(item)
    setModal('detail')
  }

  const handleSave = async (event) => {
    event.preventDefault()
    setSaving(true)
    try {
      if (selected) await dominioAPI.update(selected.id, form)
      else await dominioAPI.create(form)
      setModal(null)
      setSelected(null)
      load(pagination.page)
    } catch (err) {
      showError(err?.message || 'Error al guardar dominio')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await dominioAPI.delete(id)
      load(pagination.page)
    } catch (err) {
      showError(err?.message || 'No se pudo eliminar el dominio')
    }
  }

  const renderExpiryText = (item) => {
    if (!item.fecha_vencimiento) return <span className="text-xs text-gray-400">Sin fecha</span>
    const dias = item.dias_restantes
    return (
      <div>
        <div className="text-sm text-gray-800">{format(new Date(item.fecha_vencimiento), 'dd/MM/yyyy', { locale: es })}</div>
        <div className={`text-xs ${dias < 0 ? 'text-red-500' : dias <= 30 ? 'text-orange-600' : dias <= 90 ? 'text-yellow-600' : 'text-gray-400'}`}>
          {dias < 0 ? `Venció hace ${Math.abs(dias)} días` : dias === 0 ? 'Vence hoy' : `${dias} días restantes`}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Dominios" subtitle="Gestión de dominios, DNS, renovaciones y responsables">
        {canEdit() && (
          <button className="btn-primary" onClick={openCreate}>
            <PlusIcon className="h-4 w-4" /> Nuevo dominio
          </button>
        )}
      </PageHeader>

      {stats && (
        <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
          <StatCard icon={GlobeAltIcon} label="Dominios activos" value={stats.total} color="bg-blue-100 text-blue-600" />
          <StatCard icon={ShieldCheckIcon} label="Vigentes" value={stats.vigentes} color="bg-emerald-100 text-emerald-600" />
          <StatCard icon={CalendarDaysIcon} label="Por vencer 30 días" value={stats.por_vencer_30} sub={`${stats.por_vencer_90} en 90 días`} color="bg-yellow-100 text-yellow-600" />
          <StatCard icon={ArrowPathIcon} label="Auto renovación" value={stats.renovacion_auto} color="bg-cyan-100 text-cyan-700" />
          <StatCard icon={CurrencyDollarIcon} label="Costo anual est." value={fmt(stats.costo_anual_mxn)} color="bg-violet-100 text-violet-700" />
        </div>
      )}

      <div className="card p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_180px_190px_220px]">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              className="input pl-9"
              placeholder="Buscar dominio, registrador, responsable, cuenta..."
              value={filters.search}
              onChange={event => setFilters(f => ({ ...f, search: event.target.value }))}
            />
          </div>
          <select className="input" value={filters.estado} onChange={event => setFilters(f => ({ ...f, estado: event.target.value }))}>
            <option value="">Todos los estados</option>
            {Object.entries(DOMAIN_OPERATION_STATUS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
          </select>
          <select className="input" value={filters.vencimiento} onChange={event => setFilters(f => ({ ...f, vencimiento: event.target.value }))}>
            <option value="">Todos los vencimientos</option>
            {Object.entries(DOMAIN_EXPIRY_STATUS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
          </select>
          <select className="input" value={filters.proveedor_id} onChange={event => setFilters(f => ({ ...f, proveedor_id: event.target.value }))}>
            <option value="">Todos los proveedores</option>
            {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="table-header">Dominio</th>
                <th className="table-header">Registrador</th>
                <th className="table-header">Vencimiento</th>
                <th className="table-header">Renovación</th>
                <th className="table-header">Costo</th>
                <th className="table-header">Estado</th>
                <th className="table-header">Responsable</th>
                <th className="table-header">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={8} className="py-12 text-center">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-4 border-primary-600 border-t-transparent" />
                </td></tr>
              ) : dominios.length === 0 ? (
                <tr><td colSpan={8} className="py-12 text-center text-gray-400">No se encontraron dominios</td></tr>
              ) : dominios.map(item => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="table-cell">
                    <button className="flex items-center gap-3 text-left" onClick={() => openDetail(item)}>
                      <div className="h-10 w-10 rounded-xl bg-slate-900 flex items-center justify-center text-white flex-shrink-0">
                        <GlobeAltIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900">{item.dominio}</div>
                        <div className="text-xs text-gray-400">{item.uso || 'Sin uso documentado'}</div>
                      </div>
                    </button>
                  </td>
                  <td className="table-cell">
                    <div className="text-sm text-gray-800">{item.proveedor_nombre || item.registrador || '-'}</div>
                    {item.cuenta_admin && <div className="text-xs text-gray-400">{item.cuenta_admin}</div>}
                  </td>
                  <td className="table-cell">{renderExpiryText(item)}</td>
                  <td className="table-cell">
                    <span className={`badge ${item.renovacion_auto ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                      {item.renovacion_auto ? 'Automática' : 'Manual'}
                    </span>
                  </td>
                  <td className="table-cell">
                    <div className="font-medium text-sm">{fmt(item.costo_renovacion, item.moneda)}</div>
                    <div className="text-xs text-gray-400">
                      {DOMAIN_PERIODICITY[item.periodicidad]?.label || item.periodicidad}
                      {item.costo_anual_mxn > 0 && <span className="ml-1">≈ {fmt(item.costo_anual_mxn)}/año</span>}
                    </div>
                  </td>
                  <td className="table-cell">
                    <div className="space-y-1.5">
                      <Badge {...(DOMAIN_OPERATION_STATUS[item.estado] || { label: item.estado, color: 'bg-gray-100 text-gray-600' })} />
                      <Badge {...(DOMAIN_EXPIRY_STATUS[item.estado_vencimiento] || { label: item.estado_vencimiento, color: 'bg-gray-100 text-gray-600' })} />
                    </div>
                  </td>
                  <td className="table-cell">
                    <div className="text-sm text-gray-800">{item.responsable || '-'}</div>
                    {item.departamento && <div className="text-xs text-gray-400">{item.departamento}</div>}
                  </td>
                  <td className="table-cell">
                    <div className="flex gap-1">
                      {canEdit() && (
                        <button onClick={() => openEdit(item)} className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50" title="Editar">
                          <PencilIcon className="h-4 w-4" />
                        </button>
                      )}
                      {isAdmin() && (
                        <button onClick={() => setDeleteId(item.id)} className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50" title="Eliminar">
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination {...pagination} onPageChange={load} />
      </div>

      <Modal open={modal === 'edit'} onClose={() => setModal(null)} title={selected ? 'Editar dominio' : 'Nuevo dominio'} size="xl">
        <form onSubmit={handleSave} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Dominio *</label>
              <input className="input font-mono" required placeholder="previta.com.mx" value={form.dominio} onChange={event => setForm(f => ({ ...f, dominio: event.target.value }))} />
            </div>
            <div>
              <label className="label">Estado operativo</label>
              <select className="input" value={form.estado} onChange={event => setForm(f => ({ ...f, estado: event.target.value }))}>
                {Object.entries(DOMAIN_OPERATION_STATUS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Proveedor / registrador</label>
              <select className="input" value={form.proveedor_id} onChange={event => setForm(f => ({ ...f, proveedor_id: event.target.value }))}>
                <option value="">Sin proveedor registrado</option>
                {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Registrador manual</label>
              <input className="input" placeholder="GoDaddy, Akky, Route 53..." value={form.registrador} onChange={event => setForm(f => ({ ...f, registrador: event.target.value }))} />
            </div>
            <div>
              <label className="label">Fecha de registro</label>
              <input type="date" className="input" value={form.fecha_registro} onChange={event => setForm(f => ({ ...f, fecha_registro: event.target.value }))} />
            </div>
            <div>
              <label className="label">Fecha de vencimiento</label>
              <input type="date" className="input" value={form.fecha_vencimiento} onChange={event => setForm(f => ({ ...f, fecha_vencimiento: event.target.value }))} />
            </div>
            <div>
              <label className="label">Costo de renovación</label>
              <input type="number" min="0" step="0.01" className="input" value={form.costo_renovacion} onChange={event => setForm(f => ({ ...f, costo_renovacion: event.target.value }))} />
            </div>
            <div>
              <label className="label">Moneda</label>
              <select className="input" value={form.moneda} onChange={event => setForm(f => ({ ...f, moneda: event.target.value }))}>
                <option value="MXN">MXN — Peso Mexicano</option>
                <option value="USD">USD — Dólar Americano</option>
              </select>
            </div>
            <div>
              <label className="label">Periodicidad</label>
              <select className="input" value={form.periodicidad} onChange={event => setForm(f => ({ ...f, periodicidad: event.target.value }))}>
                {Object.entries(DOMAIN_PERIODICITY).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
              </select>
            </div>
            {form.moneda === 'USD' && (
              <div>
                <label className="label">Tipo de cambio USD → MXN</label>
                <input type="number" min="0" step="0.01" className="input" value={form.tipo_cambio} onChange={event => setForm(f => ({ ...f, tipo_cambio: event.target.value }))} />
              </div>
            )}
            <div className="col-span-2">
              <label className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                <input type="checkbox" className="rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500" checked={form.renovacion_auto} onChange={event => setForm(f => ({ ...f, renovacion_auto: event.target.checked }))} />
                Renovación automática activa
              </label>
            </div>
            <div>
              <label className="label">Cuenta administradora</label>
              <input className="input" placeholder="correo o usuario de acceso" value={form.cuenta_admin} onChange={event => setForm(f => ({ ...f, cuenta_admin: event.target.value }))} />
            </div>
            <div>
              <label className="label">Responsable interno</label>
              <input className="input" placeholder="Área o persona responsable" value={form.responsable} onChange={event => setForm(f => ({ ...f, responsable: event.target.value }))} />
            </div>
            <div>
              <label className="label">Departamento / centro responsable</label>
              <input className="input" placeholder="TI, Marketing, Operaciones..." value={form.departamento} onChange={event => setForm(f => ({ ...f, departamento: event.target.value }))} />
            </div>
            <div>
              <label className="label">DNS principal</label>
              <input className="input" placeholder="Cloudflare, Route 53, GoDaddy..." value={form.dns_principal} onChange={event => setForm(f => ({ ...f, dns_principal: event.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="label">Uso del dominio</label>
              <input className="input" placeholder="Sitio corporativo, correo, landing, sistema interno..." value={form.uso} onChange={event => setForm(f => ({ ...f, uso: event.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="label">Nameservers</label>
              <textarea className="input font-mono" rows={3} placeholder="ns1.example.com&#10;ns2.example.com" value={form.nameservers} onChange={event => setForm(f => ({ ...f, nameservers: event.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="label">Notas</label>
              <textarea className="input" rows={3} placeholder="Notas de renovación, DNS, transferencias o accesos..." value={form.notas} onChange={event => setForm(f => ({ ...f, notas: event.target.value }))} />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar dominio'}</button>
          </div>
        </form>
      </Modal>

      <Modal open={modal === 'detail'} onClose={() => setModal(null)} title={selected?.dominio || 'Dominio'} size="lg">
        {selected && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white">
                  <ServerStackIcon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-950">{selected.dominio}</h3>
                  <p className="text-sm text-slate-500">{selected.uso || 'Sin uso documentado'}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge {...(DOMAIN_OPERATION_STATUS[selected.estado] || { label: selected.estado, color: 'bg-gray-100 text-gray-600' })} />
                    <Badge {...(DOMAIN_EXPIRY_STATUS[selected.estado_vencimiento] || { label: selected.estado_vencimiento, color: 'bg-gray-100 text-gray-600' })} />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <Info label="Proveedor / registrador" value={selected.proveedor_nombre || selected.registrador || '-'} />
              <Info label="Cuenta admin" value={selected.cuenta_admin || '-'} />
              <Info label="Responsable" value={selected.responsable || '-'} />
              <Info label="Departamento" value={selected.departamento || '-'} />
              <Info label="Fecha registro" value={selected.fecha_registro ? format(new Date(selected.fecha_registro), 'dd/MM/yyyy') : '-'} />
              <Info label="Fecha vencimiento" value={selected.fecha_vencimiento ? format(new Date(selected.fecha_vencimiento), 'dd/MM/yyyy') : '-'} />
              <Info label="Renovación" value={selected.renovacion_auto ? 'Automática' : 'Manual'} />
              <Info label="Costo anual estimado" value={fmt(selected.costo_anual_mxn)} />
            </div>

            {(selected.dns_principal || selected.nameservers) && (
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">DNS / Nameservers</p>
                {selected.dns_principal && <p className="mt-2 text-sm text-slate-700">{selected.dns_principal}</p>}
                {selected.nameservers && <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-slate-950 p-3 text-xs text-slate-100">{selected.nameservers}</pre>}
              </div>
            )}

            {selected.notas && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <p className="font-semibold">Notas</p>
                <p className="mt-1 whitespace-pre-wrap">{selected.notas}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => handleDelete(deleteId)}
        title="Eliminar dominio"
        message="El dominio quedará desactivado del inventario. Esta acción no elimina nada en el registrador ni en DNS."
      />
    </div>
  )
}

function Info({ label, value }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-1 break-words text-gray-800">{value}</p>
    </div>
  )
}
