import { useState, useEffect, useCallback } from 'react'
import { asignacionAPI, deviceAPI, empleadoAPI, sucursalAPI } from '../utils/api'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/Modal'
import Pagination from '../components/Pagination'
import ConfirmDialog from '../components/ConfirmDialog'
import Badge from '../components/Badge'
import { DEVICE_STATUS, LOCATION_TYPES } from '../utils/constants'
import { PlusIcon, MagnifyingGlassIcon, XCircleIcon, ArrowsRightLeftIcon } from '@heroicons/react/24/outline'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useNotification } from '../context/NotificationContext'

export default function Asignaciones() {
  const { canEdit } = useAuth()
  const { showError } = useNotification()
  const [asignaciones, setAsignaciones] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 20 })
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [cancelId, setCancelId] = useState(null)

  // Form state
  const [step, setStep] = useState(1)
  const [tipoAsignacion, setTipoAsignacion] = useState('empleado')
  const [dispositivosDisponibles, setDispositivosDisponibles] = useState([])
  const [destinatarios, setDestinatarios] = useState([])
  const [selectedDevices, setSelectedDevices] = useState([])
  const [selectedDest, setSelectedDest] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [loadingDev, setLoadingDev] = useState(false)
  const [searchDev, setSearchDev] = useState('')
  const [searchDest, setSearchDest] = useState('')

  const load = useCallback((page = 1) => {
    setLoading(true)
    const params = { page, limit: 20 }
    if (search) params.search = search
    asignacionAPI.getAll(params).then(d => {
      setAsignaciones(d.data)
      setPagination({ page: d.page, pages: Math.ceil(d.total / 20), total: d.total, limit: 20 })
    }).finally(() => setLoading(false))
  }, [search])

  useEffect(() => { load(1) }, [load])

  const openModal = async () => {
    setStep(1)
    setTipoAsignacion('empleado')
    setSelectedDevices([])
    setSelectedDest('')
    setObservaciones('')
    setSearchDev('')
    setSearchDest('')
    setLoadingDev(true)
    const [devs, emps] = await Promise.all([
      deviceAPI.getAll({ ubicacion_tipo: 'almacen', estado: 'stock', limit: 100 }),
      empleadoAPI.getAll({ limit: 200 })
    ])
    setDispositivosDisponibles(devs.data)
    setDestinatarios(emps.data)
    setLoadingDev(false)
    setModal(true)
  }

  const changeTipo = async (tipo) => {
    setTipoAsignacion(tipo)
    setSelectedDest('')
    setLoadingDev(true)
    const res = tipo === 'empleado'
      ? await empleadoAPI.getAll({ limit: 200 })
      : await sucursalAPI.getAll({ limit: 300 })
    setDestinatarios(tipo === 'empleado' ? res.data : res.data)
    setLoadingDev(false)
  }

  const handleSave = async () => {
    if (!selectedDevices.length || !selectedDest) return
    setSaving(true)
    try {
      for (const devId of selectedDevices) {
        await asignacionAPI.asignar({ dispositivo_id: devId, tipo_asignacion: tipoAsignacion, asignado_a_id: selectedDest, observaciones })
      }
      setModal(false)
      load(1)
    } catch (err) { showError(err?.message || 'Error') }
    finally { setSaving(false) }
  }

  const handleCancel = async (id) => {
    try { await asignacionAPI.desasignar(id); load(pagination.page) }
    catch (err) { showError(err?.message || 'Error') }
  }

  const filteredDevs = dispositivosDisponibles.filter(d =>
    !searchDev || d.tipo?.toLowerCase().includes(searchDev.toLowerCase()) ||
    d.serie?.toLowerCase().includes(searchDev.toLowerCase()) ||
    d.marca?.toLowerCase().includes(searchDev.toLowerCase())
  )

  const filteredDest = destinatarios.filter(d => {
    if (!searchDest) return true
    const q = searchDest.toLowerCase()
    return (d.nombre_completo || d.nombre)?.toLowerCase().includes(q)
  })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Asignaciones</h1>
          <p className="text-sm text-gray-500 mt-0.5">Dispositivos asignados a empleados y sucursales</p>
        </div>
        {canEdit() && <button className="btn-primary" onClick={openModal}><PlusIcon className="h-4 w-4" /> Nueva Asignación</button>}
      </div>

      <div className="card p-4">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input type="text" className="input pl-9" placeholder="Buscar por dispositivo, destinatario..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="table-header">Dispositivo</th>
                <th className="table-header">Serie</th>
                <th className="table-header">Tipo Asignación</th>
                <th className="table-header">Asignado a</th>
                <th className="table-header">Asignado por</th>
                <th className="table-header">Fecha</th>
                <th className="table-header">Estado</th>
                {canEdit() && <th className="table-header">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={8} className="py-12 text-center"><div className="inline-block animate-spin rounded-full h-6 w-6 border-4 border-primary-600 border-t-transparent" /></td></tr>
              ) : asignaciones.length === 0 ? (
                <tr><td colSpan={8} className="py-12 text-center text-gray-400">No hay asignaciones activas</td></tr>
              ) : asignaciones.map(a => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="table-cell">
                    <div className="font-medium">{a.dispositivo_tipo}</div>
                    <div className="text-xs text-gray-400">{a.dispositivo_marca} {a.dispositivo_modelo}</div>
                  </td>
                  <td className="table-cell font-mono text-xs">{a.dispositivo_serie}</td>
                  <td className="table-cell">
                    <Badge {...(LOCATION_TYPES[a.tipo_asignacion] || { label: a.tipo_asignacion, color: 'bg-gray-100 text-gray-600' })} />
                  </td>
                  <td className="table-cell text-sm font-medium">{a.asignado_a_nombre}</td>
                  <td className="table-cell text-sm text-gray-500">{a.asignado_por_nombre}</td>
                  <td className="table-cell text-xs text-gray-500">
                    {a.fecha_asignacion ? format(new Date(a.fecha_asignacion), 'dd/MM/yyyy', { locale: es }) : '—'}
                  </td>
                  <td className="table-cell">
                    {a.activo ? <Badge label="Activa" color="bg-emerald-100 text-emerald-700" /> : <Badge label="Cancelada" color="bg-gray-100 text-gray-500" />}
                  </td>
                  {canEdit() && (
                    <td className="table-cell">
                      {a.activo && (
                        <button onClick={() => setCancelId(a.id)} className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50" title="Cancelar asignación">
                          <XCircleIcon className="h-4 w-4" />
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

      {/* Modal nueva asignación */}
      <Modal open={modal} onClose={() => setModal(false)} title="Nueva Asignación" size="xl">
        <div className="space-y-5">
          {/* Tipo */}
          <div>
            <label className="label">Asignar a</label>
            <div className="flex gap-3">
              {['empleado', 'sucursal'].map(t => (
                <button key={t} type="button"
                  onClick={() => changeTipo(t)}
                  className={`flex-1 py-2.5 rounded-lg border-2 text-sm font-medium capitalize transition-colors ${tipoAsignacion === t ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                >
                  {t === 'empleado' ? 'Empleado' : 'Sucursal'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5">
            {/* Dispositivos */}
            <div>
              <label className="label">Seleccionar dispositivos en stock ({selectedDevices.length} seleccionados)</label>
              <input className="input mb-2" placeholder="Buscar..." value={searchDev} onChange={e => setSearchDev(e.target.value)} />
              <div className="border border-gray-200 rounded-lg overflow-y-auto max-h-64">
                {loadingDev ? <div className="p-4 text-center text-gray-400 text-sm">Cargando...</div> :
                  filteredDevs.length === 0 ? <div className="p-4 text-center text-gray-400 text-sm">No hay dispositivos disponibles</div> :
                  filteredDevs.map(d => (
                    <label key={d.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0">
                      <input type="checkbox" className="rounded border-gray-300"
                        checked={selectedDevices.includes(d.id)}
                        onChange={e => setSelectedDevices(prev => e.target.checked ? [...prev, d.id] : prev.filter(x => x !== d.id))}
                      />
                      <div>
                        <div className="text-sm font-medium">{d.tipo} — {d.marca}</div>
                        <div className="text-xs text-gray-400 font-mono">{d.serie}</div>
                      </div>
                    </label>
                  ))
                }
              </div>
            </div>

            {/* Destinatario */}
            <div>
              <label className="label">{tipoAsignacion === 'empleado' ? 'Empleado' : 'Sucursal'}</label>
              <input className="input mb-2" placeholder="Buscar..." value={searchDest} onChange={e => setSearchDest(e.target.value)} />
              <div className="border border-gray-200 rounded-lg overflow-y-auto max-h-64">
                {filteredDest.map(d => (
                  <label key={d.id} className={`flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0 ${selectedDest === d.id ? 'bg-primary-50' : ''}`}>
                    <input type="radio" name="dest" value={d.id}
                      checked={selectedDest === d.id}
                      onChange={() => setSelectedDest(d.id)}
                    />
                    <div>
                      <div className="text-sm font-medium">{d.nombre_completo || d.nombre}</div>
                      <div className="text-xs text-gray-400">{d.num_empleado || d.estado || ''}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="label">Observaciones</label>
            <textarea className="input" rows={2} value={observaciones} onChange={e => setObservaciones(e.target.value)} />
          </div>

          <div className="flex justify-end gap-3">
            <button className="btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
            <button className="btn-primary" onClick={handleSave} disabled={saving || !selectedDevices.length || !selectedDest}>
              {saving ? 'Asignando...' : `Asignar ${selectedDevices.length > 1 ? `${selectedDevices.length} dispositivos` : 'dispositivo'}`}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!cancelId} onClose={() => setCancelId(null)} onConfirm={() => handleCancel(cancelId)} title="Cancelar asignación" message="El dispositivo regresará al almacén. ¿Confirmar?" />
    </div>
  )
}
