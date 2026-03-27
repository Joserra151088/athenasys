import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { expedienteAPI, empleadoAPI, sucursalAPI } from '../utils/api'
import { DOCUMENT_TYPES, DEVICE_STATUS, LOCATION_TYPES } from '../utils/constants'
import Badge from '../components/Badge'
import Modal from '../components/Modal'
import { MagnifyingGlassIcon, FolderOpenIcon, UserIcon, BuildingOfficeIcon, ArrowLeftIcon } from '@heroicons/react/24/outline'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export default function Expedientes() {
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState('empleado')
  const [busqueda, setBusqueda] = useState('')
  const [lista, setLista] = useState([])
  const [expediente, setExpediente] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadingList, setLoadingList] = useState(false)
  const [activeTab, setActiveTab] = useState('activos')

  // Auto-abrir si viene de URL
  useEffect(() => {
    const tipo = searchParams.get('tipo')
    const id = searchParams.get('id')
    if (tipo && id) {
      setTab(tipo)
      loadExpediente(tipo, id)
    }
  }, [searchParams])

  useEffect(() => {
    setLoadingList(true)
    const params = { limit: 200 }
    if (busqueda) params.search = busqueda
    const api = tab === 'empleado' ? empleadoAPI.getAll(params) : sucursalAPI.getAll(params)
    api.then(d => setLista(d.data)).finally(() => setLoadingList(false))
  }, [tab, busqueda])

  const loadExpediente = async (tipo, id) => {
    setLoading(true)
    try {
      const data = tipo === 'empleado'
        ? await expedienteAPI.getEmpleado(id)
        : await expedienteAPI.getSucursal(id)
      setExpediente(data)
    } catch { setExpediente(null) }
    finally { setLoading(false) }
  }

  const selectItem = (item) => loadExpediente(tab, item.id)

  if (expediente) {
    const { entidad, resumen, dispositivos_activos, historial_asignaciones, documentos, cambios, licencias_activas = [] } = expediente
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => setExpediente(null)} className="btn-secondary py-1.5 px-3 text-sm">
            <ArrowLeftIcon className="h-4 w-4" /> Regresar
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Expediente — {entidad.nombre_completo || entidad.nombre}</h1>
            <p className="text-sm text-gray-500">{entidad.tipo === 'empleado' ? `${entidad.num_empleado} · ${entidad.puesto} · ${entidad.area}` : `${entidad.tipo} · ${entidad.estado}`}</p>
          </div>
        </div>

        {/* Resumen */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Dispositivos históricos', value: resumen.total_dispositivos_historicos },
            { label: 'Dispositivos activos', value: resumen.dispositivos_activos },
            { label: 'Licencias activas', value: resumen.licencias_activas ?? '—' },
            { label: 'Total documentos', value: resumen.total_documentos }
          ].map(s => (
            <div key={s.label} className="card text-center">
              <div className="text-2xl font-bold text-primary-600">{s.value}</div>
              <div className="text-xs text-gray-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="card p-0 overflow-hidden">
          <div className="border-b border-gray-200 px-4">
            <div className="flex gap-1">
              {[
                { key: 'activos', label: `Activos (${dispositivos_activos.length})` },
                { key: 'historial', label: `Historial (${historial_asignaciones.length})` },
                { key: 'licencias', label: `Licencias (${licencias_activas.length})` },
                { key: 'documentos', label: `Documentos (${documentos.length})` },
                { key: 'cambios', label: `Cambios (${cambios.length})` }
              ].map(t => (
                <button key={t.key} onClick={() => setActiveTab(t.key)}
                  className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === t.key ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4">
            {/* Activos */}
            {activeTab === 'activos' && (
              <div className="space-y-2">
                {dispositivos_activos.length === 0 ? <p className="text-gray-400 text-sm text-center py-8">Sin dispositivos activos</p> :
                  dispositivos_activos.map(a => (
                    <div key={a.id} className="flex items-center justify-between py-2.5 px-4 bg-emerald-50 border border-emerald-100 rounded-lg">
                      <div>
                        <span className="font-medium text-sm">{a.dispositivo?.tipo}</span>
                        <span className="text-gray-500 text-sm"> — {a.dispositivo?.marca} {a.dispositivo?.modelo}</span>
                        <span className="font-mono text-xs text-gray-400 ml-2">{a.dispositivo?.serie}</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        Asignado: {a.fecha_asignacion ? format(new Date(a.fecha_asignacion), 'dd/MM/yyyy') : '—'}
                      </div>
                    </div>
                  ))
                }
              </div>
            )}

            {/* Historial */}
            {activeTab === 'historial' && (
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-gray-500 uppercase border-b">
                  <th className="pb-2 pr-4">Dispositivo</th>
                  <th className="pb-2 pr-4">Serie</th>
                  <th className="pb-2 pr-4">Asignado por</th>
                  <th className="pb-2 pr-4">Asignación</th>
                  <th className="pb-2">Devolución</th>
                  <th className="pb-2">Estado</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {historial_asignaciones.map(a => (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="py-2 pr-4 font-medium">{a.dispositivo_tipo} {a.dispositivo_marca}</td>
                      <td className="py-2 pr-4 font-mono text-xs text-gray-500">{a.dispositivo_serie}</td>
                      <td className="py-2 pr-4 text-gray-500">{a.asignado_por_nombre}</td>
                      <td className="py-2 pr-4 text-xs">{a.fecha_asignacion ? format(new Date(a.fecha_asignacion), 'dd/MM/yyyy') : '—'}</td>
                      <td className="py-2 text-xs">{a.fecha_devolucion ? format(new Date(a.fecha_devolucion), 'dd/MM/yyyy') : '—'}</td>
                      <td className="py-2">{a.activo ? <Badge label="Activa" color="bg-emerald-100 text-emerald-700" /> : <Badge label="Devuelto" color="bg-gray-100 text-gray-600" />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Licencias */}
            {activeTab === 'licencias' && (
              <div className="space-y-2">
                {licencias_activas.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-8">Sin licencias asignadas</p>
                ) : licencias_activas.map(a => (
                  <div key={a.id} className="flex items-center justify-between py-2.5 px-4 bg-indigo-50 border border-indigo-100 rounded-lg">
                    <div>
                      <span className="font-medium text-sm">{a.licencia?.nombre}</span>
                      <span className="text-xs text-gray-500 ml-2">({a.licencia?.tipo})</span>
                      {a.licencia?.version && <span className="text-xs text-gray-400 ml-1">v{a.licencia.version}</span>}
                    </div>
                    <div className="text-xs text-gray-500">
                      Asignada: {a.fecha_asignacion ? format(new Date(a.fecha_asignacion), 'dd/MM/yyyy') : '—'}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Documentos */}
            {activeTab === 'documentos' && (
              <div className="space-y-2">
                {documentos.map(d => (
                  <div key={d.id} className="flex items-center justify-between py-2.5 px-4 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="flex items-center gap-3">
                      <Badge {...(DOCUMENT_TYPES[d.tipo] || { label: d.tipo, color: 'bg-gray-100 text-gray-600' })} />
                      <span className="font-mono text-xs text-gray-600">{d.folio}</span>
                      <span className="text-sm text-gray-600">{d.dispositivos?.length} dispositivo(s)</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      {d.firmado ? <Badge label="Firmado" color="bg-emerald-100 text-emerald-700" /> : <Badge label="Pendiente" color="bg-yellow-100 text-yellow-700" />}
                      <span>{d.created_at ? format(new Date(d.created_at), 'dd/MM/yyyy') : ''}</span>
                    </div>
                  </div>
                ))}
                {documentos.length === 0 && <p className="text-gray-400 text-sm text-center py-8">Sin documentos</p>}
              </div>
            )}

            {/* Cambios */}
            {activeTab === 'cambios' && (
              <div className="space-y-2">
                {cambios.map(c => (
                  <div key={c.id} className="py-2.5 px-4 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium text-sm">{c.dispositivo_tipo} — {c.dispositivo_serie}</span>
                        <span className="text-xs text-gray-500 ml-2">({c.tipo_cambio?.replace('_', ' ')})</span>
                      </div>
                      <span className="text-xs text-gray-500">{c.created_at ? format(new Date(c.created_at), 'dd/MM/yyyy') : ''}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{c.motivo} {c.proveedor_nombre ? `· ${c.proveedor_nombre}` : ''}</div>
                  </div>
                ))}
                {cambios.length === 0 && <p className="text-gray-400 text-sm text-center py-8">Sin cambios registrados</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Expedientes</h1>
        <p className="text-sm text-gray-500 mt-0.5">Historial completo por empleado o sucursal</p>
      </div>

      <div className="card space-y-4">
        <div className="flex gap-2">
          {[{ k: 'empleado', label: 'Empleados', icon: UserIcon }, { k: 'sucursal', label: 'Sucursales', icon: BuildingOfficeIcon }].map(t => (
            <button key={t.k} onClick={() => { setTab(t.k); setExpediente(null) }}
              className={`flex items-center gap-2 py-2 px-4 rounded-lg text-sm font-medium border-2 transition-colors ${tab === t.k ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600'}`}>
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input type="text" className="input pl-9" placeholder={`Buscar ${tab}...`} value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        </div>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {loadingList ? (
            <div className="text-center py-8"><div className="inline-block animate-spin rounded-full h-6 w-6 border-4 border-primary-600 border-t-transparent" /></div>
          ) : lista.map(item => (
            <button key={item.id} onClick={() => selectItem(item)}
              className="w-full text-left flex items-center justify-between px-4 py-3 rounded-lg border border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-colors group">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-semibold text-sm flex-shrink-0">
                  {(item.nombre_completo || item.nombre)?.charAt(0)}
                </div>
                <div>
                  <div className="font-medium text-sm">{item.nombre_completo || item.nombre}</div>
                  <div className="text-xs text-gray-400">{item.num_empleado || item.estado || ''} {item.puesto ? `· ${item.puesto}` : ''}</div>
                </div>
              </div>
              <FolderOpenIcon className="h-4 w-4 text-gray-300 group-hover:text-primary-500" />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
