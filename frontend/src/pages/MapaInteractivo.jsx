import { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMap } from 'react-leaflet'
import { useNavigate } from 'react-router-dom'
import { sucursalAPI, deviceAPI, empleadoAPI } from '../utils/api'
import { DEVICE_STATUS } from '../utils/constants'
import Badge from '../components/Badge'
import { BuildingOfficeIcon, UserIcon, ComputerDesktopIcon, XMarkIcon, MagnifyingGlassIcon, ArrowRightIcon } from '@heroicons/react/24/outline'
import PageHeader from '../components/PageHeader'
import L from 'leaflet'

// Fix Leaflet default icon
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const createIcon = (color) => L.divIcon({
  className: '',
  html: `<div style="background:${color};width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7]
})

const CORP_ICON = createIcon('#6366f1')
const SUC_ICON  = createIcon('#14b8a6')
const EMP_ICON  = createIcon('#f97316')

// ─── MapController: fly to coordinates ───────────────────────────────────────
function MapController({ flyTarget }) {
  const map = useMap()
  const prevTarget = useRef(null)

  useEffect(() => {
    if (!flyTarget) return
    if (prevTarget.current === flyTarget) return
    prevTarget.current = flyTarget
    map.flyTo(flyTarget.coords, flyTarget.zoom ?? 14, { duration: 1.4, easeLinearity: 0.5 })
  }, [flyTarget, map])

  return null
}

export default function MapaInteractivo() {
  const navigate = useNavigate()
  const [sucursales, setSucursales] = useState([])
  const [empleados, setEmpleados] = useState([])
  const [dispositivos, setDispositivos] = useState([])
  const [selected, setSelected] = useState(null)
  const [selectedType, setSelectedType] = useState(null)
  const [filtro, setFiltro] = useState('all')
  const [loading, setLoading] = useState(true)
  const [mapSearch, setMapSearch] = useState('')
  const [flyTarget, setFlyTarget] = useState(null)

  useEffect(() => {
    Promise.all([
      sucursalAPI.getAll({ limit: 300 }),
      empleadoAPI.getAll({ limit: 500 }),
      deviceAPI.getAll({ limit: 500 })
    ]).then(([s, e, d]) => {
      setSucursales(s.data)
      setEmpleados(e.data)
      setDispositivos(d.data)
    }).finally(() => setLoading(false))
  }, [])

  const getDispositivosDeSucursal = (sucId) =>
    dispositivos.filter(d => d.ubicacion_tipo === 'sucursal' && d.ubicacion_id === sucId)

  const getDispositivosDeEmpleado = (empId) =>
    dispositivos.filter(d => d.ubicacion_tipo === 'empleado' && d.ubicacion_id === empId)

  const getEmpleadosDeSucursal = (sucId) =>
    empleados.filter(e => e.sucursal_id === sucId)

  const sucursalesConCoords = sucursales.filter(s => s.lat && s.lng)
  const empleadosConCoords  = empleados.filter(e => {
    const suc = sucursales.find(s => s.id === e.sucursal_id)
    return suc?.lat && suc?.lng
  })

  // ─── Seleccionar y hacer fly-to ─────────────────────────────────────────────
  const selectSucursal = (s, fly = false) => {
    setSelected(s)
    setSelectedType('sucursal')
    if (fly && s.lat && s.lng) {
      setFlyTarget({ coords: [parseFloat(s.lat), parseFloat(s.lng)], zoom: 14, _key: s.id + Date.now() })
    }
  }

  const selectEmpleado = (e, fly = false) => {
    setSelected(e)
    setSelectedType('empleado')
    if (fly) {
      const suc = sucursales.find(s => s.id === e.sucursal_id)
      if (suc?.lat && suc?.lng) {
        setFlyTarget({ coords: [parseFloat(suc.lat), parseFloat(suc.lng)], zoom: 14, _key: e.id + Date.now() })
      }
    }
  }

  // ─── Búsqueda filtrada (incluye dispositivos) ────────────────────────────────
  const q = mapSearch.toLowerCase().trim()

  const sucursalesFiltradas = sucursalesConCoords.filter(s => {
    if (!q) return true
    if (s.nombre.toLowerCase().includes(q)) return true
    if (s.estado?.toLowerCase().includes(q)) return true
    if (s.tipo?.toLowerCase().includes(q)) return true
    // Dispositivos en esta sucursal
    return getDispositivosDeSucursal(s.id).some(d =>
      d.tipo?.toLowerCase().includes(q) ||
      d.marca?.toLowerCase().includes(q) ||
      d.modelo?.toLowerCase().includes(q) ||
      d.serie?.toLowerCase().includes(q)
    )
  })

  const empleadosFiltrados = empleadosConCoords.filter(e => {
    if (!q) return true
    const suc = sucursales.find(s => s.id === e.sucursal_id)
    if (e.nombre_completo.toLowerCase().includes(q)) return true
    if (e.puesto?.toLowerCase().includes(q)) return true
    if (suc?.nombre.toLowerCase().includes(q)) return true
    // Dispositivos del empleado
    return getDispositivosDeEmpleado(e.id).some(d =>
      d.tipo?.toLowerCase().includes(q) ||
      d.marca?.toLowerCase().includes(q) ||
      d.modelo?.toLowerCase().includes(q) ||
      d.serie?.toLowerCase().includes(q)
    )
  })

  // Buscar dispositivos que coincidan directamente (para mostrarlos en resultados)
  const dispositivosEncontrados = q
    ? dispositivos.filter(d =>
        d.tipo?.toLowerCase().includes(q) ||
        d.marca?.toLowerCase().includes(q) ||
        d.modelo?.toLowerCase().includes(q) ||
        d.serie?.toLowerCase().includes(q)
      ).slice(0, 5)
    : []

  const totalResultados = sucursalesFiltradas.length + empleadosFiltrados.length + dispositivosEncontrados.length

  return (
    <div className="space-y-5">
      <PageHeader title="Mapa Interactivo" subtitle="Distribución de dispositivos en la República Mexicana">
        <div className="flex items-center gap-3 text-xs text-white/80">
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-indigo-400 inline-block" />Corporativo</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-teal-400 inline-block" />Sucursal</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-orange-400 inline-block" />Empleado</span>
        </div>
      </PageHeader>

      {/* Filtros */}
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          {[
            { k: 'all', label: 'Todo' },
            { k: 'sucursal', label: `Sucursales (${sucursalesConCoords.length})` },
            { k: 'empleado', label: 'Empleados' }
          ].map(f => (
            <button key={f.k} onClick={() => setFiltro(f.k)}
              className={`py-1.5 px-3 rounded-lg text-sm font-medium border transition-colors ${filtro === f.k ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative max-w-sm">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input className="input pl-9 text-sm" placeholder="Buscar sucursal, empleado o dispositivo (serie, tipo, marca)..."
            value={mapSearch} onChange={e => setMapSearch(e.target.value)} />
          {mapSearch && (
            <button className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              onClick={() => setMapSearch('')}>
              <XMarkIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-5 h-[600px]">
        {/* Mapa */}
        <div className="flex-1 rounded-xl overflow-hidden shadow-sm border border-gray-200">
          {loading ? (
            <div className="h-full flex items-center justify-center bg-gray-100">
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-600 border-t-transparent" />
            </div>
          ) : (
            <MapContainer center={[23.6345, -102.5528]} zoom={5} className="h-full w-full">
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* Controlador de fly-to */}
              <MapController flyTarget={flyTarget} />

              {/* Sucursales y Corporativo */}
              {(filtro === 'all' || filtro === 'sucursal') && sucursalesConCoords.map(s => (
                <Marker
                  key={s.id}
                  position={[parseFloat(s.lat), parseFloat(s.lng)]}
                  icon={s.tipo === 'corporativo' ? CORP_ICON : SUC_ICON}
                  eventHandlers={{ click: () => selectSucursal(s, false) }}
                >
                  <Popup>
                    <div className="text-xs font-semibold">{s.nombre}</div>
                    <div className="text-xs text-gray-500">{s.tipo} · {s.estado}</div>
                    <div className="text-xs text-primary-600 mt-1">
                      {getDispositivosDeSucursal(s.id).length} dispositivos · {getEmpleadosDeSucursal(s.id).length} empleados
                    </div>
                  </Popup>
                </Marker>
              ))}

              {/* Empleados (agrupados en la coords de su sucursal con offset) */}
              {filtro === 'empleado' && empleadosConCoords.map((e, i) => {
                const suc = sucursales.find(s => s.id === e.sucursal_id)
                if (!suc) return null
                const offset = 0.02 * (i % 5)
                return (
                  <CircleMarker
                    key={e.id}
                    center={[parseFloat(suc.lat) + offset, parseFloat(suc.lng) + offset * 0.5]}
                    radius={6}
                    color="#f97316"
                    fillColor="#f97316"
                    fillOpacity={0.8}
                    eventHandlers={{ click: () => selectEmpleado(e, false) }}
                  >
                    <Popup>
                      <div className="text-xs font-semibold">{e.nombre_completo}</div>
                      <div className="text-xs text-gray-500">{e.puesto}</div>
                      <div className="text-xs text-primary-600 mt-1">{getDispositivosDeEmpleado(e.id).length} dispositivos</div>
                    </Popup>
                  </CircleMarker>
                )
              })}
            </MapContainer>
          )}
        </div>

        {/* Panel lateral */}
        <div className="w-80 flex flex-col space-y-3 overflow-y-auto">
          {!selected ? (
            <div className="card flex-shrink-0">
              {mapSearch ? (
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-gray-500 uppercase mb-2">
                    Resultados ({totalResultados})
                  </div>

                  {/* Sucursales con coincidencia */}
                  {sucursalesFiltradas.length > 0 && (
                    <div className="mb-2">
                      <div className="text-xs text-gray-400 uppercase tracking-wide mb-1 px-2">Sucursales</div>
                      {sucursalesFiltradas.slice(0, 5).map(s => (
                        <button key={s.id}
                          onClick={() => selectSucursal(s, true)}
                          className="w-full text-left px-2 py-1.5 hover:bg-blue-50 rounded-lg text-xs flex items-center gap-2 transition-colors">
                          <span className="h-2 w-2 rounded-full bg-teal-500 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-800 truncate">{s.nombre}</div>
                            <div className="text-gray-400">{s.estado} · {getDispositivosDeSucursal(s.id).length} disp.</div>
                          </div>
                          <span className="text-gray-300 text-xs">→</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Empleados con coincidencia */}
                  {empleadosFiltrados.length > 0 && (
                    <div className="mb-2">
                      <div className="text-xs text-gray-400 uppercase tracking-wide mb-1 px-2">Empleados</div>
                      {empleadosFiltrados.slice(0, 4).map(e => (
                        <button key={e.id}
                          onClick={() => selectEmpleado(e, true)}
                          className="w-full text-left px-2 py-1.5 hover:bg-orange-50 rounded-lg text-xs flex items-center gap-2 transition-colors">
                          <span className="h-2 w-2 rounded-full bg-orange-500 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-800 truncate">{e.nombre_completo}</div>
                            <div className="text-gray-400 truncate">{e.puesto}</div>
                          </div>
                          <span className="text-gray-300 text-xs">→</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Dispositivos encontrados */}
                  {dispositivosEncontrados.length > 0 && (
                    <div className="mb-2">
                      <div className="text-xs text-gray-400 uppercase tracking-wide mb-1 px-2">Dispositivos</div>
                      {dispositivosEncontrados.map(d => {
                        // Encontrar la ubicación del dispositivo
                        const suc = d.ubicacion_tipo === 'sucursal'
                          ? sucursales.find(s => s.id === d.ubicacion_id)
                          : null
                        const emp = d.ubicacion_tipo === 'empleado'
                          ? empleados.find(e => e.id === d.ubicacion_id)
                          : null
                        const parentSuc = emp ? sucursales.find(s => s.id === emp.sucursal_id) : null

                        const handleClick = () => {
                          if (suc) selectSucursal(suc, true)
                          else if (emp) selectEmpleado(emp, true)
                        }

                        const goToTrayectoria = (event) => {
                          event.stopPropagation()
                          if (!d.serie) return
                          navigate('/asignaciones', {
                            state: {
                              trayectoriaSerie: d.serie,
                              trayectoriaNonce: Date.now(),
                            },
                          })
                        }

                        return (
                          <button key={d.id}
                            onClick={handleClick}
                            disabled={!suc && !emp}
                            className="w-full text-left px-2 py-1.5 hover:bg-blue-50 rounded-lg text-xs flex items-center gap-2 transition-colors disabled:opacity-50">
                            <ComputerDesktopIcon className="h-3 w-3 text-blue-500 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-800 truncate">{d.tipo} — {d.marca}</div>
                              <div className="text-gray-400 font-mono truncate">{d.serie || 'Sin serie'}</div>
                              <div className="text-gray-400 truncate">
                                {suc?.nombre || emp?.nombre_completo || d.ubicacion_nombre || 'Sin ubicación'}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              {d.serie && (
                                <span
                                  role="button"
                                  tabIndex={0}
                                  onClick={goToTrayectoria}
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') goToTrayectoria(event)
                                  }}
                                  className="flex h-7 w-7 items-center justify-center rounded-full border border-blue-200 bg-white text-blue-600 transition-colors hover:bg-blue-50"
                                  title="Ver trayectoria"
                                >
                                  <ArrowRightIcon className="h-3.5 w-3.5" />
                                </span>
                              )}
                              {(suc || parentSuc) && <span className="text-gray-300 text-xs">→</span>}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {totalResultados === 0 && (
                    <div className="text-xs text-gray-400 py-4 text-center">
                      <MagnifyingGlassIcon className="h-6 w-6 mx-auto mb-2 text-gray-200" />
                      Sin resultados para "{mapSearch}"
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center text-gray-400 text-sm py-8">
                  <BuildingOfficeIcon className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  Selecciona una ubicación en el mapa<br/>
                  <span className="text-xs">o busca por nombre, tipo, serie...</span>
                </div>
              )}
            </div>
          ) : (
            <div className="card space-y-3 flex-shrink-0">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {selectedType === 'sucursal'
                    ? <BuildingOfficeIcon className="h-5 w-5 text-teal-500" />
                    : <UserIcon className="h-5 w-5 text-orange-500" />}
                  <div>
                    <div className="font-semibold text-sm">{selected.nombre_completo || selected.nombre}</div>
                    <div className="text-xs text-gray-500">
                      {selectedType === 'sucursal'
                        ? `${selected.tipo} · ${selected.estado}`
                        : `${selected.puesto} · ${selected.area}`}
                    </div>
                  </div>
                </div>
                <button onClick={() => setSelected(null)} className="text-gray-300 hover:text-gray-500">
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>

              {selectedType === 'sucursal' && (
                <>
                  <div className="text-xs text-gray-500">{selected.direccion}</div>
                  <div>
                    <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                      Dispositivos ({getDispositivosDeSucursal(selected.id).length})
                    </div>
                    {getDispositivosDeSucursal(selected.id).slice(0, 8).map(d => (
                      <div key={d.id} className="py-1.5 border-b border-gray-100 last:border-0">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium text-gray-700">{d.tipo} — {d.marca}</span>
                          <Badge {...(DEVICE_STATUS[d.estado] || { label: d.estado, color: 'bg-gray-100 text-gray-600' })} />
                        </div>
                        {d.serie
                          ? <div className="text-xs font-mono text-gray-400 mt-0.5">{d.serie}</div>
                          : <div className="text-xs text-gray-300 mt-0.5 italic">Sin serie</div>}
                      </div>
                    ))}
                    {getDispositivosDeSucursal(selected.id).length === 0 && (
                      <div className="text-gray-400 text-xs">Sin dispositivos asignados</div>
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                      Empleados ({getEmpleadosDeSucursal(selected.id).length})
                    </div>
                    {getEmpleadosDeSucursal(selected.id).slice(0, 5).map(e => (
                      <div key={e.id} className="flex items-center gap-2 py-1.5 border-b border-gray-100 last:border-0">
                        <div className="h-5 w-5 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 text-xs font-semibold flex-shrink-0">
                          {e.nombre_completo?.charAt(0)}
                        </div>
                        <div>
                          <div className="text-xs font-medium">{e.nombre_completo}</div>
                          <div className="text-xs text-gray-400">{e.puesto}</div>
                        </div>
                      </div>
                    ))}
                    {getEmpleadosDeSucursal(selected.id).length === 0 && (
                      <div className="text-gray-400 text-xs">Sin empleados registrados</div>
                    )}
                  </div>
                </>
              )}

              {selectedType === 'empleado' && (
                <>
                  <div className="text-xs space-y-1">
                    <div><span className="font-medium">No. empleado:</span> {selected.num_empleado}</div>
                    <div><span className="font-medium">Centro costos:</span> {selected.centro_costos}</div>
                    <div><span className="font-medium">Jefe:</span> {selected.jefe_nombre || '—'}</div>
                    <div><span className="font-medium">Sucursal:</span> {selected.sucursal_nombre}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                      Dispositivos activos ({getDispositivosDeEmpleado(selected.id).length})
                    </div>
                    {getDispositivosDeEmpleado(selected.id).map(d => (
                      <div key={d.id} className="py-1.5 border-b border-gray-100 last:border-0">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium text-gray-700">{d.tipo} — {d.marca}</span>
                          <Badge {...(DEVICE_STATUS[d.estado] || { label: d.estado, color: 'bg-gray-100 text-gray-600' })} />
                        </div>
                        {d.serie && <div className="text-xs font-mono text-gray-400 mt-0.5">{d.serie}</div>}
                      </div>
                    ))}
                    {getDispositivosDeEmpleado(selected.id).length === 0 && (
                      <div className="text-gray-400 text-xs">Sin dispositivos activos</div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Resumen rápido */}
          <div className="card flex-shrink-0">
            <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">Resumen</div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Sucursales con coords</span>
                <span className="font-medium">{sucursalesConCoords.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total sucursales</span>
                <span className="font-medium">{sucursales.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Empleados registrados</span>
                <span className="font-medium">{empleados.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Dispositivos en campo</span>
                <span className="font-medium">{dispositivos.filter(d => d.ubicacion_tipo !== 'almacen').length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

