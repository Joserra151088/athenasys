import { useState, useEffect, useCallback, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  PlusIcon,
  MagnifyingGlassIcon,
  XCircleIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  PencilIcon,
} from '@heroicons/react/24/outline'
import { asignacionAPI, deviceAPI, empleadoAPI, sucursalAPI, documentoAPI, plantillaAPI } from '../utils/api'
import { useAuth } from '../context/AuthContext'
import { useNotification } from '../context/NotificationContext'
import Modal from '../components/Modal'
import Pagination from '../components/Pagination'
import ConfirmDialog from '../components/ConfirmDialog'
import Badge from '../components/Badge'
import PageHeader from '../components/PageHeader'
import TrayectoriaEquipo from './TrayectoriaEquipo'
import { LOCATION_TYPES } from '../utils/constants'

function DestinatariosList({
  items,
  loading,
  selectedId,
  onSelect,
  emptyLabel = 'Sin resultados',
}) {
  if (loading) {
    return <div className="p-4 text-center text-sm text-gray-400">Cargando...</div>
  }

  if (!items.length) {
    return <div className="p-4 text-center text-sm text-gray-400">{emptyLabel}</div>
  }

  return items.map(item => (
    <label
      key={item.id}
      className={`flex cursor-pointer items-center gap-3 border-b border-gray-100 px-3 py-2.5 last:border-0 hover:bg-gray-50 ${
        selectedId === item.id ? 'bg-primary-50' : ''
      }`}
    >
      <input
        type="radio"
        name="destinatario"
        value={item.id}
        checked={selectedId === item.id}
        onChange={() => onSelect(item.id)}
      />
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-gray-800">{item.nombre_completo || item.nombre}</div>
        <div className="truncate text-xs text-gray-400">{item.num_empleado || item.estado || ''}</div>
      </div>
    </label>
  ))
}

export default function Asignaciones() {
  const { canEdit } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const { showError, showSuccess } = useNotification()
  const canManage = canEdit()

  const [tab, setTab] = useState('lista')
  const [trayectoriaRequest, setTrayectoriaRequest] = useState({ serie: '', key: 0 })

  const [asignaciones, setAsignaciones] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 20 })
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [cancelId, setCancelId] = useState(null)

  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [tipoAsignacion, setTipoAsignacion] = useState('empleado')
  const [dispositivosDisponibles, setDispositivosDisponibles] = useState([])
  const [destinatarios, setDestinatarios] = useState([])
  const [selectedDevices, setSelectedDevices] = useState([])
  const [selectedDeviceCosts, setSelectedDeviceCosts] = useState({})
  const [selectedDest, setSelectedDest] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [loadingDev, setLoadingDev] = useState(false)
  const [searchDev, setSearchDev] = useState('')
  const [searchDest, setSearchDest] = useState('')
  const [loadingDest, setLoadingDest] = useState(false)
  const searchDestTimer = useRef(null)

  const [editModal, setEditModal] = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const [editingAsignacion, setEditingAsignacion] = useState(null)
  const [editTipoAsignacion, setEditTipoAsignacion] = useState('empleado')
  const [editDestinatarios, setEditDestinatarios] = useState([])
  const [editSelectedDest, setEditSelectedDest] = useState('')
  const [editObservaciones, setEditObservaciones] = useState('')
  const [editSearchDest, setEditSearchDest] = useState('')
  const [editLoadingDest, setEditLoadingDest] = useState(false)
  const editSearchDestTimer = useRef(null)

  const [crearDoc, setCrearDoc] = useState(false)
  const [plantillas, setPlantillas] = useState([])
  const [plantillaId, setPlantillaId] = useState('')
  const [docCreado, setDocCreado] = useState(null)

  const totalColumns = canManage ? 8 : 7

  const load = useCallback((page = 1) => {
    setLoading(true)
    const params = { page, limit: 20 }
    if (search) params.search = search

    asignacionAPI
      .getAll(params)
      .then(result => {
        setAsignaciones(result.data)
        setPagination({
          page: result.page,
          pages: Math.max(1, Math.ceil(result.total / 20)),
          total: result.total,
          limit: 20,
        })
      })
      .finally(() => setLoading(false))
  }, [search])

  useEffect(() => {
    load(1)
  }, [load])

  useEffect(() => {
    return () => {
      if (searchDestTimer.current) clearTimeout(searchDestTimer.current)
      if (editSearchDestTimer.current) clearTimeout(editSearchDestTimer.current)
    }
  }, [])

  useEffect(() => {
    const serie = location.state?.trayectoriaSerie
    if (!serie) return

    setTab('trayectoria')
    setTrayectoriaRequest({
      serie,
      key: location.state?.trayectoriaNonce || Date.now(),
    })
    navigate(location.pathname, { replace: true, state: null })
  }, [location.pathname, location.state, navigate])

  const getDestinatarios = useCallback(async (tipo, searchValue = '') => {
    const params = { limit: 9999 }
    if (searchValue) params.search = searchValue

    const result = tipo === 'empleado'
      ? await empleadoAPI.getAll(params)
      : await sucursalAPI.getAll(params)

    return result.data || []
  }, [])

  const fetchDestinatarios = useCallback(async (tipo, searchValue = '') => {
    setLoadingDest(true)
    try {
      const items = await getDestinatarios(tipo, searchValue)
      setDestinatarios(items)
    } finally {
      setLoadingDest(false)
    }
  }, [getDestinatarios])

  const fetchEditDestinatarios = useCallback(async (tipo, searchValue = '') => {
    setEditLoadingDest(true)
    try {
      const items = await getDestinatarios(tipo, searchValue)
      setEditDestinatarios(items)
    } finally {
      setEditLoadingDest(false)
    }
  }, [getDestinatarios])

  const resetCreateModal = useCallback(() => {
    setTipoAsignacion('empleado')
    setSelectedDevices([])
    setSelectedDeviceCosts({})
    setSelectedDest('')
    setObservaciones('')
    setSearchDev('')
    setSearchDest('')
    setCrearDoc(false)
    setPlantillaId('')
    setDocCreado(null)
  }, [])

  const openModal = async () => {
    resetCreateModal()
    setLoadingDev(true)

    try {
      const [devs, plants, targets] = await Promise.all([
        deviceAPI.getAll({ ubicacion_tipo: 'almacen', estado: 'stock', limit: 100 }),
        plantillaAPI.getAll(),
        getDestinatarios('empleado'),
      ])
      setDispositivosDisponibles(devs.data || [])
      setPlantillas(plants || [])
      setDestinatarios(targets)
      setModal(true)
    } finally {
      setLoadingDev(false)
    }
  }

  const changeTipo = async tipo => {
    setTipoAsignacion(tipo)
    setSelectedDest('')
    setSearchDest('')
    await fetchDestinatarios(tipo)
  }

  const handleSearchDest = value => {
    setSearchDest(value)
    if (searchDestTimer.current) clearTimeout(searchDestTimer.current)
    searchDestTimer.current = setTimeout(() => {
      fetchDestinatarios(tipoAsignacion, value)
    }, 300)
  }

  const openEditModal = async asignacion => {
    setEditingAsignacion(asignacion)
    setEditTipoAsignacion(asignacion.tipo_asignacion)
    setEditSelectedDest(asignacion.asignado_a_id)
    setEditObservaciones(asignacion.observaciones || '')
    setEditSearchDest('')
    await fetchEditDestinatarios(asignacion.tipo_asignacion)
    setEditModal(true)
  }

  const closeEditModal = () => {
    setEditModal(false)
    setEditingAsignacion(null)
    setEditSelectedDest('')
    setEditObservaciones('')
    setEditSearchDest('')
    setEditDestinatarios([])
    setEditTipoAsignacion('empleado')
  }

  const changeEditTipo = async tipo => {
    setEditTipoAsignacion(tipo)
    setEditSelectedDest('')
    setEditSearchDest('')
    await fetchEditDestinatarios(tipo)
  }

  const handleEditSearchDest = value => {
    setEditSearchDest(value)
    if (editSearchDestTimer.current) clearTimeout(editSearchDestTimer.current)
    editSearchDestTimer.current = setTimeout(() => {
      fetchEditDestinatarios(editTipoAsignacion, value)
    }, 300)
  }

  const handleSave = async () => {
    if (!selectedDevices.length || !selectedDest) return
    if (crearDoc && !plantillaId) {
      showError('Selecciona una plantilla para el documento')
      return
    }

    setSaving(true)
    try {
      if (crearDoc) {
        const dispositivos = selectedDevices.map(id => {
          const rawCost = Number(selectedDeviceCosts[id])
          return {
            id,
            costo: Number.isFinite(rawCost) && rawCost >= 0 ? rawCost : 0,
          }
        })
        const result = await documentoAPI.create({
          tipo: 'responsiva',
          plantilla_id: plantillaId,
          entidad_tipo: tipoAsignacion,
          entidad_id: selectedDest,
          dispositivos,
          observaciones,
          receptor_id: tipoAsignacion === 'empleado' ? selectedDest : null,
          desde_asignacion: true,
        })
        setDocCreado(result)
      } else {
        for (const deviceId of selectedDevices) {
          await asignacionAPI.asignar({
            dispositivo_id: deviceId,
            tipo_asignacion: tipoAsignacion,
            asignado_a_id: selectedDest,
            observaciones,
          })
        }
        setModal(false)
        load(1)
        showSuccess('Asignacion creada correctamente')
      }
    } catch (error) {
      showError(error?.message || 'Error al procesar la solicitud')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateAsignacion = async () => {
    if (!editingAsignacion || !editSelectedDest) return

    setEditSaving(true)
    try {
      await asignacionAPI.update(editingAsignacion.id, {
        tipo_asignacion: editTipoAsignacion,
        asignado_a_id: editSelectedDest,
        observaciones: editObservaciones,
      })
      closeEditModal()
      load(pagination.page)
      showSuccess('Asignacion actualizada correctamente')
    } catch (error) {
      showError(error?.message || 'Error al actualizar la asignacion')
    } finally {
      setEditSaving(false)
    }
  }

  const handleCancel = async id => {
    try {
      await asignacionAPI.desasignar(id)
      setCancelId(null)
      load(pagination.page)
      showSuccess('Asignacion cancelada correctamente')
    } catch (error) {
      showError(error?.message || 'Error al cancelar la asignacion')
    }
  }

  const filteredDevs = dispositivosDisponibles.filter(device =>
    !searchDev ||
    device.tipo?.toLowerCase().includes(searchDev.toLowerCase()) ||
    device.serie?.toLowerCase().includes(searchDev.toLowerCase()) ||
    device.marca?.toLowerCase().includes(searchDev.toLowerCase())
  )

  const selectedDeviceItems = selectedDevices
    .map(id => dispositivosDisponibles.find(device => device.id === id))
    .filter(Boolean)

  return (
    <div className="space-y-5">
      <PageHeader title="Asignaciones" subtitle="Dispositivos asignados a empleados y sucursales">
        {canManage && tab === 'lista' && (
          <button className="btn-primary" onClick={openModal}>
            <PlusIcon className="h-4 w-4" /> Nueva asignacion
          </button>
        )}
      </PageHeader>

      <div className="rounded-[28px] border border-slate-200/80 bg-white/80 p-2 shadow-[0_18px_40px_rgba(148,163,184,0.14)] backdrop-blur-xl">
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            onClick={() => setTab('lista')}
            className={`flex-1 rounded-[20px] px-5 py-3 text-sm font-semibold transition-all duration-300 ${
              tab === 'lista'
                ? 'bg-slate-900 text-white shadow-[0_16px_28px_rgba(15,23,42,0.16)]'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            Lista de asignaciones
          </button>
          <button
            onClick={() => setTab('trayectoria')}
            className={`flex-1 rounded-[20px] px-5 py-3 text-sm font-semibold transition-all duration-300 ${
              tab === 'trayectoria'
                ? 'bg-slate-900 text-white shadow-[0_16px_28px_rgba(15,23,42,0.16)]'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            Trayectoria de equipos
          </button>
        </div>
      </div>

      {tab === 'trayectoria' && (
        <div style={{ minHeight: 520 }}>
          <TrayectoriaEquipo
            initialSerie={trayectoriaRequest.serie}
            initialRequestKey={trayectoriaRequest.key}
          />
        </div>
      )}

      {tab === 'lista' && (
        <>
          <div className="card p-4">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                className="input pl-9"
                placeholder="Buscar por dispositivo, destinatario..."
                value={search}
                onChange={event => setSearch(event.target.value)}
              />
            </div>
          </div>

          <div className="card overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="table-header">Dispositivo</th>
                    <th className="table-header">Serie</th>
                    <th className="table-header">Tipo asignacion</th>
                    <th className="table-header">Asignado a</th>
                    <th className="table-header">Asignado por</th>
                    <th className="table-header">Fecha</th>
                    <th className="table-header">Estado</th>
                    {canManage && <th className="table-header">Acciones</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr>
                      <td colSpan={totalColumns} className="py-12 text-center">
                        <div className="inline-block h-6 w-6 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
                      </td>
                    </tr>
                  ) : asignaciones.length === 0 ? (
                    <tr>
                      <td colSpan={totalColumns} className="py-12 text-center text-gray-400">
                        No hay asignaciones activas
                      </td>
                    </tr>
                  ) : (
                    asignaciones.map(asignacion => (
                      <tr key={asignacion.id} className="hover:bg-gray-50">
                        <td className="table-cell">
                          <div className="font-medium text-slate-800">{asignacion.dispositivo_tipo}</div>
                          <div className="text-xs text-gray-400">
                            {asignacion.dispositivo_marca} {asignacion.dispositivo_modelo}
                          </div>
                        </td>
                        <td className="table-cell font-mono text-xs">{asignacion.dispositivo_serie}</td>
                        <td className="table-cell">
                          <Badge
                            {...(LOCATION_TYPES[asignacion.tipo_asignacion] || {
                              label: asignacion.tipo_asignacion,
                              color: 'bg-gray-100 text-gray-600',
                            })}
                          />
                        </td>
                        <td className="table-cell">
                          <div className="max-w-[260px] whitespace-normal break-words text-sm font-medium text-slate-800">
                            {asignacion.asignado_a_nombre}
                          </div>
                          {asignacion.observaciones && (
                            <div className="mt-1 max-w-[260px] whitespace-normal break-words text-xs text-gray-400">
                              {asignacion.observaciones}
                            </div>
                          )}
                        </td>
                        <td className="table-cell text-sm text-gray-500">
                          <div className="font-medium text-slate-700">{asignacion.asignado_por_nombre}</div>
                          {asignacion.ajustado_por_nombre && (
                            <div className="mt-1 text-xs text-amber-600">
                              Ajustado por {asignacion.ajustado_por_nombre}
                            </div>
                          )}
                        </td>
                        <td className="table-cell text-xs text-gray-500">
                          <div>
                            {asignacion.fecha_asignacion
                              ? format(new Date(asignacion.fecha_asignacion), 'dd/MM/yyyy', { locale: es })
                              : '-'}
                          </div>
                          {asignacion.fecha_ajuste && (
                            <div className="mt-1 text-[11px] text-gray-400">
                              Ajuste {format(new Date(asignacion.fecha_ajuste), 'dd/MM/yyyy', { locale: es })}
                            </div>
                          )}
                        </td>
                        <td className="table-cell">
                          {asignacion.activo ? (
                            <Badge label="Activa" color="bg-emerald-100 text-emerald-700" />
                          ) : (
                            <Badge label="Cancelada" color="bg-gray-100 text-gray-500" />
                          )}
                        </td>
                        {canManage && (
                          <td className="table-cell">
                            <div className="flex items-center gap-1">
                              {asignacion.activo && (
                                <button
                                  onClick={() => openEditModal(asignacion)}
                                  className="rounded p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600"
                                  title="Editar asignacion"
                                >
                                  <PencilIcon className="h-4 w-4" />
                                </button>
                              )}
                              {asignacion.activo && (
                                <button
                                  onClick={() => setCancelId(asignacion.id)}
                                  className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                                  title="Cancelar asignacion"
                                >
                                  <XCircleIcon className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <Pagination {...pagination} onPageChange={load} />
          </div>
        </>
      )}

      <Modal
        open={modal}
        onClose={() => {
          setModal(false)
          setDocCreado(null)
        }}
        title="Nueva asignacion"
        size="xl"
      >
        {docCreado ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <CheckCircleIcon className="h-16 w-16 text-green-500" />
            <div>
              <p className="text-lg font-semibold text-gray-800">Documento creado exitosamente</p>
              <p className="mt-1 text-sm text-gray-500">
                Folio: <span className="font-mono font-medium">{docCreado.folio}</span>
              </p>
            </div>
            <div className="max-w-md rounded-lg border border-yellow-200 bg-yellow-50 px-5 py-3 text-sm text-yellow-800">
              <strong>Pendiente de firma.</strong> Los dispositivos seleccionados quedaran reservados y se
              actualizara el inventario automaticamente cuando el documento sea firmado.
            </div>
            <div className="mt-2 flex gap-3">
              <button
                className="btn-secondary"
                onClick={() => {
                  setModal(false)
                  setDocCreado(null)
                  load(1)
                }}
              >
                Cerrar
              </button>
              <button
                className="btn-primary"
                onClick={() => {
                  setModal(false)
                  setDocCreado(null)
                  load(1)
                  window.location.href = '/documentos'
                }}
              >
                Ir a documentos
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <label className="label">Asignar a</label>
              <div className="flex gap-3">
                {['empleado', 'sucursal'].map(tipo => (
                  <button
                    key={tipo}
                    type="button"
                    onClick={() => changeTipo(tipo)}
                    className={`flex-1 rounded-lg border-2 py-2.5 text-sm font-medium capitalize transition-colors ${
                      tipoAsignacion === tipo
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {tipo === 'empleado' ? 'Empleado' : 'Sucursal'}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-5">
              <div>
                <label className="label">
                  Seleccionar dispositivos en stock ({selectedDevices.length} seleccionados)
                </label>
                <input
                  className="input mb-2"
                  placeholder="Buscar..."
                  value={searchDev}
                  onChange={event => setSearchDev(event.target.value)}
                />
                <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-200">
                  {loadingDev ? (
                    <div className="p-4 text-center text-sm text-gray-400">Cargando...</div>
                  ) : filteredDevs.length === 0 ? (
                    <div className="p-4 text-center text-sm text-gray-400">No hay dispositivos disponibles</div>
                  ) : (
                    filteredDevs.map(device => (
                      <label
                        key={device.id}
                        className="flex cursor-pointer items-center gap-3 border-b border-gray-100 px-3 py-2.5 last:border-0 hover:bg-gray-50"
                      >
                        <input
                          type="checkbox"
                          className="rounded border-gray-300"
                          checked={selectedDevices.includes(device.id)}
                          onChange={event => {
                            const baseCost = Number(device.costo_dia)
                            const initialCost = Number.isFinite(baseCost) && baseCost >= 0 ? baseCost : 0

                            setSelectedDevices(previous =>
                              event.target.checked
                                ? [...previous, device.id]
                                : previous.filter(id => id !== device.id)
                            )

                            setSelectedDeviceCosts(previous => {
                              if (event.target.checked) {
                                return previous[device.id] != null
                                  ? previous
                                  : { ...previous, [device.id]: initialCost }
                              }

                              const next = { ...previous }
                              delete next[device.id]
                              return next
                            })
                          }}
                        />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-gray-800">
                            {device.tipo} - {device.marca}
                          </div>
                          <div className="truncate text-xs font-mono text-gray-400">{device.serie}</div>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div>
                <label className="label">{tipoAsignacion === 'empleado' ? 'Empleado' : 'Sucursal'}</label>
                <input
                  className="input mb-2"
                  placeholder="Buscar..."
                  value={searchDest}
                  onChange={event => handleSearchDest(event.target.value)}
                />
                <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-200">
                  <DestinatariosList
                    items={destinatarios}
                    loading={loadingDest}
                    selectedId={selectedDest}
                    onSelect={setSelectedDest}
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="label">Observaciones</label>
              <textarea
                className="input"
                rows={2}
                value={observaciones}
                onChange={event => setObservaciones(event.target.value)}
              />
            </div>

            <div
              className={`rounded-lg border-2 p-4 transition-colors ${
                crearDoc ? 'border-primary-400 bg-primary-50' : 'border-gray-200 bg-gray-50'
              }`}
            >
              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300"
                  checked={crearDoc}
                  onChange={event => {
                    setCrearDoc(event.target.checked)
                    if (!event.target.checked) setPlantillaId('')
                  }}
                />
                <div className="flex items-center gap-2">
                  <DocumentTextIcon className="h-5 w-5 text-primary-600" />
                  <span className="text-sm font-medium text-gray-700">Crear documento de asignacion</span>
                </div>
              </label>

              {crearDoc && (
                <div className="mt-3 pl-7">
                  <p className="mb-3 rounded border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-700">
                    El inventario se actualizara solo cuando el documento sea firmado. Hasta entonces los
                    equipos quedaran en estado <strong>Pendiente</strong>.
                  </p>
                  <label className="label">Plantilla del documento</label>
                  <select
                    className="input"
                    value={plantillaId}
                    onChange={event => setPlantillaId(event.target.value)}
                  >
                    <option value="">Seleccionar plantilla...</option>
                    {plantillas.map(plantilla => (
                      <option key={plantilla.id} value={plantilla.id}>
                        {plantilla.nombre}
                      </option>
                    ))}
                  </select>

                  {selectedDeviceItems.length > 0 && (
                    <div className="mt-4 rounded-2xl border border-emerald-200 bg-white/90 p-4 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">Costo por dispositivo</p>
                          <p className="text-xs text-slate-500">
                            Estos importes se guardaran en la responsiva firmada.
                          </p>
                        </div>
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                          Responsiva
                        </span>
                      </div>

                      <div className="mt-4 space-y-3">
                        {selectedDeviceItems.map(device => (
                          <div
                            key={device.id}
                            className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-slate-800">
                                {device.tipo} - {device.marca} {device.modelo}
                              </p>
                              <p className="mt-1 truncate text-xs font-mono text-slate-400">
                                {device.serie || 'Sin serie'}
                              </p>
                            </div>

                            <label className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-2 shadow-sm">
                              <span className="text-xs font-semibold text-slate-500">MXN</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                className="w-28 bg-transparent text-right text-sm font-semibold text-slate-800 outline-none"
                                value={selectedDeviceCosts[device.id] ?? 0}
                                onChange={event => {
                                  const nextValue = event.target.value
                                  setSelectedDeviceCosts(previous => ({
                                    ...previous,
                                    [device.id]: nextValue === '' ? '' : Math.max(0, Number(nextValue)),
                                  }))
                                }}
                              />
                              <span className="text-xs text-slate-400">/ equipo</span>
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <button className="btn-secondary" onClick={() => setModal(false)}>
                Cancelar
              </button>
              <button
                className="btn-primary"
                onClick={handleSave}
                disabled={saving || !selectedDevices.length || !selectedDest}
              >
                {saving
                  ? crearDoc
                    ? 'Creando documento...'
                    : 'Asignando...'
                  : crearDoc
                    ? 'Crear documento'
                    : `Asignar ${selectedDevices.length > 1 ? `${selectedDevices.length} dispositivos` : 'dispositivo'}`}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={editModal} onClose={closeEditModal} title="Editar asignacion" size="lg">
        {editingAsignacion && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Dispositivo actual</p>
              <div className="mt-3">
                <div className="text-base font-semibold text-slate-900">{editingAsignacion.dispositivo_tipo}</div>
                <div className="text-sm text-slate-500">
                  {editingAsignacion.dispositivo_marca} {editingAsignacion.dispositivo_modelo}
                </div>
                <div className="mt-1 text-xs font-mono text-slate-400">{editingAsignacion.dispositivo_serie}</div>
              </div>
              {editingAsignacion.ajustado_por_nombre && (
                <div className="mt-3 text-xs text-amber-700">
                  Ultimo ajuste por {editingAsignacion.ajustado_por_nombre}
                </div>
              )}
            </div>
            <div>
              <label className="label">Reasignar a</label>
              <div className="flex gap-3">
                {['empleado', 'sucursal'].map(tipo => (
                  <button
                    key={tipo}
                    type="button"
                    onClick={() => changeEditTipo(tipo)}
                    className={`flex-1 rounded-lg border-2 py-2.5 text-sm font-medium capitalize transition-colors ${
                      editTipoAsignacion === tipo
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {tipo === 'empleado' ? 'Empleado' : 'Sucursal'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">{editTipoAsignacion === 'empleado' ? 'Empleado' : 'Sucursal'}</label>
              <input
                className="input mb-2"
                placeholder="Buscar..."
                value={editSearchDest}
                onChange={event => handleEditSearchDest(event.target.value)}
              />
              <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-200">
                <DestinatariosList
                  items={editDestinatarios}
                  loading={editLoadingDest}
                  selectedId={editSelectedDest}
                  onSelect={setEditSelectedDest}
                />
              </div>
            </div>

            <div>
              <label className="label">Observaciones</label>
              <textarea
                className="input"
                rows={3}
                value={editObservaciones}
                onChange={event => setEditObservaciones(event.target.value)}
              />
            </div>

            <div className="flex justify-end gap-3">
              <button className="btn-secondary" onClick={closeEditModal}>
                Cancelar
              </button>
              <button
                className="btn-primary"
                onClick={handleUpdateAsignacion}
                disabled={editSaving || !editSelectedDest}
              >
                {editSaving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!cancelId}
        onClose={() => setCancelId(null)}
        onConfirm={() => handleCancel(cancelId)}
        title="Cancelar asignacion"
        message="El dispositivo regresara al almacen. Quieres continuar?"
      />
    </div>
  )
}
