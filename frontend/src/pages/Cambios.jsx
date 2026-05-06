import { useState, useEffect, useCallback, useMemo } from 'react'
import { cambioAPI, deviceAPI, proveedorAPI } from '../utils/api'
import { CHANGE_TYPES } from '../utils/constants'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import Pagination from '../components/Pagination'
import { PlusIcon, MagnifyingGlassIcon, CheckCircleIcon, EyeIcon } from '@heroicons/react/24/outline'
import PageHeader from '../components/PageHeader'
import { format } from 'date-fns'
import { useNotification } from '../context/NotificationContext'

const EMPTY = {
  dispositivos: [],
  tipo_cambio: 'reparacion',
  proveedor_id: '',
  motivo: '',
  descripcion: '',
  fecha_estimada_retorno: '',
}

function formatDeviceLine(device = {}) {
  return `${device.tipo || 'Dispositivo'} — ${device.marca || ''} ${device.modelo || ''}`.replace(/\s+/g, ' ').trim()
}

function getMovementStatus(item) {
  if (item.estado === 'cancelado') return { label: 'Cancelado', color: 'bg-gray-100 text-gray-600' }
  if (!item.inventario_actualizado) return { label: 'Pendiente de firma', color: 'bg-amber-100 text-amber-700' }
  if (item.estado === 'completado') return { label: 'Completado', color: 'bg-emerald-100 text-emerald-700' }
  return { label: 'En proveedor', color: 'bg-blue-100 text-blue-700' }
}

export default function Cambios() {
  const { canEdit } = useAuth()
  const { showError, showSuccess } = useNotification()
  const [movimientos, setMovimientos] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 20 })
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [dispositivos, setDispositivos] = useState([])
  const [proveedores, setProveedores] = useState([])
  const [deviceSearch, setDeviceSearch] = useState('')
  const [selected, setSelected] = useState(null)

  const load = useCallback((page = 1) => {
    setLoading(true)
    const params = { page, limit: 20 }
    if (search) params.search = search
    cambioAPI.getAll(params).then(response => {
      setMovimientos(response.data)
      setPagination({ page: response.page, pages: Math.ceil(response.total / 20), total: response.total, limit: 20 })
    }).finally(() => setLoading(false))
  }, [search])

  useEffect(() => { load(1) }, [load])

  const selectedDeviceIds = form.dispositivos

  const filteredDevices = useMemo(() => {
    const query = deviceSearch.trim().toLowerCase()
    return dispositivos.filter(device => {
      if (!device.activo) return false
      if (!query) return true
      return [
        device.tipo,
        device.marca,
        device.modelo,
        device.serie,
        device.ubicacion_nombre,
      ].filter(Boolean).join(' ').toLowerCase().includes(query)
    })
  }, [deviceSearch, dispositivos])

  const selectedDevices = useMemo(
    () => dispositivos.filter(device => selectedDeviceIds.includes(device.id)),
    [dispositivos, selectedDeviceIds],
  )

  const openCreate = async () => {
    const [devs, provs] = await Promise.all([
      deviceAPI.getAll({ limit: 600 }),
      proveedorAPI.getAll(),
    ])
    setDispositivos(devs.data || [])
    setProveedores(provs || [])
    setForm(EMPTY)
    setDeviceSearch('')
    setModal('create')
  }

  const toggleDevice = (deviceId) => {
    setForm(current => ({
      ...current,
      dispositivos: current.dispositivos.includes(deviceId)
        ? current.dispositivos.filter(id => id !== deviceId)
        : [...current.dispositivos, deviceId],
    }))
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!form.dispositivos.length) {
      showError('Selecciona al menos un dispositivo')
      return
    }

    setSaving(true)
    try {
      const response = await cambioAPI.create(form)
      setModal(null)
      showSuccess(`Movimiento registrado. Documento generado: ${response.documento?.folio || response.documento_folio}`)
      load(1)
    } catch (err) {
      showError(err?.message || 'Error al registrar el movimiento')
    } finally {
      setSaving(false)
    }
  }

  const openView = async (id) => {
    try {
      const detail = await cambioAPI.getById(id)
      setSelected(detail)
      setModal('view')
    } catch (err) {
      showError(err?.message || 'No se pudo cargar el movimiento')
    }
  }

  const completeMovement = async (id) => {
    try {
      const response = await cambioAPI.complete(id)
      showSuccess(response?.message || 'Movimiento completado')
      load(pagination.page)
    } catch (err) {
      showError(err?.message || 'Error al completar el movimiento')
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Movimientos con Proveedor"
        subtitle="Salidas a proveedor para reparación, baja definitiva o actualización, con documento formal y firma"
      >
        {canEdit() && (
          <button className="btn-primary" onClick={openCreate}>
            <PlusIcon className="h-4 w-4" />
            Registrar movimiento
          </button>
        )}
      </PageHeader>

      <div className="card p-4">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            className="input pl-9"
            placeholder="Buscar por equipo, proveedor, motivo o folio..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="card border border-blue-100 bg-gradient-to-r from-blue-50 via-white to-emerald-50 p-4">
        <div className="flex flex-col gap-2 text-sm text-slate-600 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Flujo del módulo</p>
            <p className="mt-1 text-sm font-medium text-slate-800">1. Registras el movimiento. 2. Se crea la salida a proveedor. 3. Al firmarse, el equipo sale del inventario activo.</p>
          </div>
          <div className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Documentación</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">Cada movimiento genera un documento visible en la sección de Documentos.</p>
          </div>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="table-header">Equipos</th>
                <th className="table-header">Tipo</th>
                <th className="table-header">Proveedor</th>
                <th className="table-header">Documento</th>
                <th className="table-header">Estado</th>
                <th className="table-header">Retorno Est.</th>
                <th className="table-header">Creado por</th>
                <th className="table-header">Fecha</th>
                {canEdit() && <th className="table-header">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-4 border-primary-600 border-t-transparent" />
                  </td>
                </tr>
              ) : movimientos.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-gray-400">No hay movimientos registrados</td>
                </tr>
              ) : movimientos.map(item => {
                const status = getMovementStatus(item)
                const firstLabel = formatDeviceLine(item)
                return (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="table-cell min-w-[260px]">
                      <div className="font-medium text-sm text-slate-900">{item.cantidad_dispositivos > 1 ? `${item.cantidad_dispositivos} dispositivos` : '1 dispositivo'}</div>
                      <div className="text-xs text-gray-500">{firstLabel}</div>
                      {item.cantidad_dispositivos > 1 && <div className="text-[11px] text-gray-400">Incluye más equipos en el documento</div>}
                    </td>
                    <td className="table-cell">
                      <Badge {...(CHANGE_TYPES[item.tipo_cambio] || { label: item.tipo_cambio, color: 'bg-gray-100 text-gray-600' })} />
                    </td>
                    <td className="table-cell text-sm">{item.proveedor_nombre || '—'}</td>
                    <td className="table-cell">
                      <div className="font-mono text-xs font-semibold text-slate-700">{item.documento_folio || '—'}</div>
                      <div className="text-[11px] text-slate-400">Salida a proveedor</div>
                    </td>
                    <td className="table-cell">
                      <Badge label={status.label} color={status.color} />
                    </td>
                    <td className="table-cell text-xs text-gray-500">
                      {item.fecha_estimada_retorno ? format(new Date(item.fecha_estimada_retorno), 'dd/MM/yyyy') : '—'}
                    </td>
                    <td className="table-cell text-sm">{item.creado_por_nombre}</td>
                    <td className="table-cell text-xs text-gray-500">
                      {item.created_at ? format(new Date(item.created_at), 'dd/MM/yyyy') : '—'}
                    </td>
                    {canEdit() && (
                      <td className="table-cell">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openView(item.id)}
                            className="p-1.5 rounded text-gray-400 hover:text-slate-700 hover:bg-slate-100"
                            title="Ver detalle"
                          >
                            <EyeIcon className="h-4 w-4" />
                          </button>
                          {item.estado !== 'completado' && item.tipo_cambio !== 'baja_definitiva' && item.inventario_actualizado && (
                            <button
                              onClick={() => completeMovement(item.id)}
                              className="p-1.5 rounded text-gray-400 hover:text-emerald-600 hover:bg-emerald-50"
                              title="Marcar retorno del proveedor"
                            >
                              <CheckCircleIcon className="h-4 w-4" />
                            </button>
                          )}
                        </div>
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

      <Modal open={modal === 'create'} onClose={() => setModal(null)} title="Registrar Movimiento con Proveedor" size="xl">
        <form onSubmit={handleCreate} className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-[1.4fr,0.9fr]">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="label">Dispositivos a enviar *</label>
                <span className="text-xs font-medium text-slate-400">{selectedDevices.length} seleccionado(s)</span>
              </div>
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  className="input pl-9"
                  placeholder="Buscar por serie, tipo, marca o ubicación..."
                  value={deviceSearch}
                  onChange={e => setDeviceSearch(e.target.value)}
                />
              </div>
              <div className="max-h-80 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50/80">
                {filteredDevices.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-slate-400">No hay dispositivos disponibles con ese criterio.</div>
                ) : filteredDevices.map(device => {
                  const checked = selectedDeviceIds.includes(device.id)
                  return (
                    <label
                      key={device.id}
                      className={`flex cursor-pointer items-start gap-3 border-b border-slate-200/80 px-4 py-3 transition last:border-b-0 ${
                        checked ? 'bg-emerald-50/80' : 'hover:bg-white'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                        checked={checked}
                        onChange={() => toggleDevice(device.id)}
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-900">{formatDeviceLine(device)}</div>
                        <div className="text-xs text-slate-500">
                          {device.serie || 'Sin serie'} · {device.ubicacion_nombre || 'Sin ubicación'} · {device.estado || 'stock'}
                        </div>
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Selección actual</p>
                <div className="mt-3 space-y-2">
                  {selectedDevices.length === 0 ? (
                    <p className="text-sm text-slate-400">Todavía no has agregado dispositivos.</p>
                  ) : selectedDevices.map(device => (
                    <div key={device.id} className="rounded-2xl border border-white bg-white px-3 py-2 shadow-sm">
                      <p className="text-sm font-medium text-slate-900">{formatDeviceLine(device)}</p>
                      <p className="text-xs text-slate-500">{device.serie || 'Sin serie'} · {device.ubicacion_nombre || 'Sin ubicación'}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-blue-100 bg-blue-50/80 px-4 py-3 text-sm text-blue-800">
                Se generará automáticamente un documento de salida a proveedor. El inventario se actualizará cuando ese documento quede firmado.
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="label">Tipo de movimiento *</label>
              <select className="input" value={form.tipo_cambio} onChange={e => setForm(current => ({ ...current, tipo_cambio: e.target.value }))}>
                {Object.entries(CHANGE_TYPES).map(([key, value]) => (
                  <option key={key} value={key}>{value.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Proveedor *</label>
              <select className="input" required value={form.proveedor_id} onChange={e => setForm(current => ({ ...current, proveedor_id: e.target.value }))}>
                <option value="">Seleccionar proveedor...</option>
                {proveedores.map(provider => (
                  <option key={provider.id} value={provider.id}>{provider.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Motivo *</label>
            <input
              className="input"
              required
              placeholder="Describe el motivo del movimiento..."
              value={form.motivo}
              onChange={e => setForm(current => ({ ...current, motivo: e.target.value }))}
            />
          </div>

          <div>
            <label className="label">Descripción detallada</label>
            <textarea
              className="input"
              rows={3}
              placeholder="Agrega detalle operativo, observaciones o alcances con el proveedor..."
              value={form.descripcion}
              onChange={e => setForm(current => ({ ...current, descripcion: e.target.value }))}
            />
          </div>

          {form.tipo_cambio !== 'baja_definitiva' && (
            <div>
              <label className="label">Fecha estimada de retorno</label>
              <input
                type="date"
                className="input"
                value={form.fecha_estimada_retorno}
                onChange={e => setForm(current => ({ ...current, fecha_estimada_retorno: e.target.value }))}
              />
            </div>
          )}

          {form.tipo_cambio === 'baja_definitiva' && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              Cuando el documento se firme, los equipos saldrán del inventario activo con tratamiento de baja definitiva.
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Registrando...' : 'Registrar movimiento'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={modal === 'view'} onClose={() => setModal(null)} title={selected?.documento_folio || 'Detalle del movimiento'} size="lg">
        {selected && (
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Proveedor</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{selected.proveedor_nombre || '—'}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Estado</p>
                <div className="mt-2">
                  <Badge label={getMovementStatus(selected).label} color={getMovementStatus(selected).color} />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Motivo</p>
              <p className="mt-2 text-sm text-slate-800">{selected.motivo}</p>
              {selected.descripcion && <p className="mt-2 text-sm text-slate-500">{selected.descripcion}</p>}
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Equipos incluidos</p>
              <div className="mt-3 space-y-2">
                {(selected.dispositivos || []).map(device => (
                  <div key={device.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-sm font-medium text-slate-900">{formatDeviceLine(device)}</p>
                    <p className="text-xs text-slate-500">{device.serie || 'Sin serie'}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
