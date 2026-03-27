import { useState, useEffect, useCallback } from 'react'
import { cambioAPI, deviceAPI, proveedorAPI } from '../utils/api'
import { CHANGE_TYPES } from '../utils/constants'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import Pagination from '../components/Pagination'
import { PlusIcon, MagnifyingGlassIcon, CheckCircleIcon, EyeIcon } from '@heroicons/react/24/outline'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const EMPTY = { dispositivo_id: '', tipo_cambio: 'reparacion', proveedor_id: '', motivo: '', descripcion: '', fecha_estimada_retorno: '' }

export default function Cambios() {
  const { canEdit } = useAuth()
  const [cambios, setCambios] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 20 })
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [dispositivos, setDispositivos] = useState([])
  const [proveedores, setProveedores] = useState([])
  const [selected, setSelected] = useState(null)

  const load = useCallback((page = 1) => {
    setLoading(true)
    const params = { page, limit: 20 }
    if (search) params.search = search
    cambioAPI.getAll(params).then(d => {
      setCambios(d.data)
      setPagination({ page: d.page, pages: Math.ceil(d.total / 20), total: d.total, limit: 20 })
    }).finally(() => setLoading(false))
  }, [search])

  useEffect(() => { load(1) }, [load])

  const openCreate = async () => {
    const [devs, provs] = await Promise.all([
      deviceAPI.getAll({ limit: 200 }),
      proveedorAPI.getAll()
    ])
    setDispositivos(devs.data)
    setProveedores(provs)
    setForm(EMPTY)
    setModal('create')
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await cambioAPI.create(form)
      setModal(null)
      load(1)
    } catch (err) { alert(err?.message || 'Error') }
    finally { setSaving(false) }
  }

  const handleComplete = async (id) => {
    try {
      await cambioAPI.create({ id })
      // Use completar endpoint
      const res = await fetch(`/api/cambios/${id}/completar`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${localStorage.getItem('ti_token')}`, 'Content-Type': 'application/json' }
      })
      if (res.ok) load(pagination.page)
    } catch (err) { alert('Error al completar') }
  }

  const completeChange = async (id) => {
    try {
      const token = localStorage.getItem('ti_token')
      const res = await fetch(`/api/cambios/${id}/completar`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      })
      if (res.ok) load(pagination.page)
      else alert('Error al completar cambio')
    } catch { alert('Error') }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cambios de Equipo</h1>
          <p className="text-sm text-gray-500 mt-0.5">Reparaciones, bajas definitivas y actualizaciones</p>
        </div>
        {canEdit() && <button className="btn-primary" onClick={openCreate}><PlusIcon className="h-4 w-4" /> Registrar Cambio</button>}
      </div>

      <div className="card p-4">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input type="text" className="input pl-9" placeholder="Buscar por dispositivo, proveedor, motivo..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="table-header">Dispositivo</th>
                <th className="table-header">Tipo de Cambio</th>
                <th className="table-header">Proveedor</th>
                <th className="table-header">Motivo</th>
                <th className="table-header">Estado</th>
                <th className="table-header">Retorno Est.</th>
                <th className="table-header">Creado por</th>
                <th className="table-header">Fecha</th>
                {canEdit() && <th className="table-header">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={9} className="py-12 text-center"><div className="inline-block animate-spin rounded-full h-6 w-6 border-4 border-primary-600 border-t-transparent" /></td></tr>
              ) : cambios.length === 0 ? (
                <tr><td colSpan={9} className="py-12 text-center text-gray-400">No hay cambios registrados</td></tr>
              ) : cambios.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="table-cell">
                    <div className="font-medium text-sm">{c.dispositivo_tipo}</div>
                    <div className="text-xs text-gray-400">{c.dispositivo_marca} — <span className="font-mono">{c.dispositivo_serie}</span></div>
                  </td>
                  <td className="table-cell">
                    <Badge {...(CHANGE_TYPES[c.tipo_cambio] || { label: c.tipo_cambio, color: 'bg-gray-100 text-gray-600' })} />
                  </td>
                  <td className="table-cell text-sm">{c.proveedor_nombre || '—'}</td>
                  <td className="table-cell text-sm max-w-40 truncate">{c.motivo}</td>
                  <td className="table-cell">
                    {c.estado === 'completado' ? <Badge label="Completado" color="bg-emerald-100 text-emerald-700" /> :
                     c.estado === 'en_proceso' ? <Badge label="En Proceso" color="bg-yellow-100 text-yellow-700" /> :
                     <Badge label={c.estado} color="bg-gray-100 text-gray-600" />}
                  </td>
                  <td className="table-cell text-xs text-gray-500">
                    {c.fecha_estimada_retorno ? format(new Date(c.fecha_estimada_retorno), 'dd/MM/yyyy') : '—'}
                  </td>
                  <td className="table-cell text-sm">{c.creado_por_nombre}</td>
                  <td className="table-cell text-xs text-gray-500">
                    {c.created_at ? format(new Date(c.created_at), 'dd/MM/yyyy') : '—'}
                  </td>
                  {canEdit() && (
                    <td className="table-cell">
                      {c.estado === 'en_proceso' && c.tipo_cambio === 'reparacion' && (
                        <button onClick={() => completeChange(c.id)} className="p-1.5 rounded text-gray-400 hover:text-emerald-600 hover:bg-emerald-50" title="Marcar como completado (retorno)">
                          <CheckCircleIcon className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination {...pagination} onPageChange={load} />
      </div>

      <Modal open={modal === 'create'} onClose={() => setModal(null)} title="Registrar Cambio de Equipo" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="label">Dispositivo *</label>
            <select className="input" required value={form.dispositivo_id} onChange={e => setForm(f => ({ ...f, dispositivo_id: e.target.value }))}>
              <option value="">Seleccionar dispositivo...</option>
              {dispositivos.filter(d => d.activo).map(d => (
                <option key={d.id} value={d.id}>{d.tipo} — {d.marca} {d.modelo} ({d.serie}) — {d.ubicacion_nombre}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Tipo de cambio *</label>
              <select className="input" value={form.tipo_cambio} onChange={e => setForm(f => ({ ...f, tipo_cambio: e.target.value }))}>
                {Object.entries(CHANGE_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Proveedor {form.tipo_cambio !== 'actualizacion' ? '*' : ''}</label>
              <select className="input" value={form.proveedor_id} onChange={e => setForm(f => ({ ...f, proveedor_id: e.target.value }))}>
                <option value="">Sin proveedor</option>
                {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Motivo *</label>
            <input className="input" required placeholder="Describe el motivo del cambio..." value={form.motivo} onChange={e => setForm(f => ({ ...f, motivo: e.target.value }))} />
          </div>
          <div>
            <label className="label">Descripción detallada</label>
            <textarea className="input" rows={3} value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
          </div>
          {form.tipo_cambio === 'reparacion' && (
            <div>
              <label className="label">Fecha estimada de retorno</label>
              <input type="date" className="input" value={form.fecha_estimada_retorno} onChange={e => setForm(f => ({ ...f, fecha_estimada_retorno: e.target.value }))} />
            </div>
          )}
          {form.tipo_cambio === 'baja_definitiva' && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              El dispositivo será marcado como "Dado de Baja" y se descontará del inventario activo.
            </div>
          )}
          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Registrando...' : 'Registrar cambio'}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
