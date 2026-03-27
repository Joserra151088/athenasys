import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from 'react-leaflet'
import { sucursalAPI, deviceAPI, empleadoAPI } from '../utils/api'
import { LOCATION_TYPES } from '../utils/constants'
import Badge from '../components/Badge'
import { BuildingOfficeIcon, UserIcon, ComputerDesktopIcon, XMarkIcon } from '@heroicons/react/24/outline'
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
const SUC_ICON = createIcon('#14b8a6')
const EMP_ICON = createIcon('#f97316')

export default function MapaInteractivo() {
  const [sucursales, setSucursales] = useState([])
  const [empleados, setEmpleados] = useState([])
  const [dispositivos, setDispositivos] = useState([])
  const [selected, setSelected] = useState(null)
  const [selectedType, setSelectedType] = useState(null)
  const [filtro, setFiltro] = useState('all')
  const [loading, setLoading] = useState(true)

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

  const selectSucursal = (s) => { setSelected(s); setSelectedType('sucursal') }
  const selectEmpleado = (e) => { setSelected(e); setSelectedType('empleado') }

  const sucursalesConCoords = sucursales.filter(s => s.lat && s.lng)
  const empleadosConCoords = empleados.filter(e => {
    const suc = sucursales.find(s => s.id === e.sucursal_id)
    return suc?.lat && suc?.lng
  })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mapa Interactivo</h1>
          <p className="text-sm text-gray-500 mt-0.5">Distribución de dispositivos en la República Mexicana</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-indigo-500 inline-block" />Corporativo</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-teal-500 inline-block" />Sucursal</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-orange-500 inline-block" />Empleado</span>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2">
        {[
          { k: 'all', label: 'Todo' },
          { k: 'sucursal', label: `Sucursales (${sucursalesConCoords.length})` },
          { k: 'empleado', label: `Empleados` }
        ].map(f => (
          <button key={f.k} onClick={() => setFiltro(f.k)}
            className={`py-1.5 px-3 rounded-lg text-sm font-medium border transition-colors ${filtro === f.k ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
            {f.label}
          </button>
        ))}
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

              {/* Sucursales y Corporativo */}
              {(filtro === 'all' || filtro === 'sucursal') && sucursalesConCoords.map(s => (
                <Marker
                  key={s.id}
                  position={[s.lat, s.lng]}
                  icon={s.tipo === 'corporativo' ? CORP_ICON : SUC_ICON}
                  eventHandlers={{ click: () => selectSucursal(s) }}
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
                    center={[suc.lat + offset, suc.lng + offset * 0.5]}
                    radius={6}
                    color="#f97316"
                    fillColor="#f97316"
                    fillOpacity={0.8}
                    eventHandlers={{ click: () => selectEmpleado(e) }}
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
          {selected ? (
            <div className="card space-y-3 flex-shrink-0">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {selectedType === 'sucursal' ? <BuildingOfficeIcon className="h-5 w-5 text-teal-500" /> : <UserIcon className="h-5 w-5 text-orange-500" />}
                  <div>
                    <div className="font-semibold text-sm">{selected.nombre_completo || selected.nombre}</div>
                    <div className="text-xs text-gray-500">{selectedType === 'sucursal' ? `${selected.tipo} · ${selected.estado}` : `${selected.puesto} · ${selected.area}`}</div>
                  </div>
                </div>
                <button onClick={() => setSelected(null)} className="text-gray-300 hover:text-gray-500"><XMarkIcon className="h-4 w-4" /></button>
              </div>

              {selectedType === 'sucursal' && (
                <>
                  <div className="text-xs text-gray-500">{selected.direccion}</div>
                  <div>
                    <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Dispositivos ({getDispositivosDeSucursal(selected.id).length})</div>
                    {getDispositivosDeSucursal(selected.id).slice(0, 8).map(d => (
                      <div key={d.id} className="flex justify-between py-1.5 border-b border-gray-100 last:border-0 text-xs">
                        <span>{d.tipo} — {d.marca}</span>
                        <span className="font-mono text-gray-400">{d.serie?.substring(0, 12)}...</span>
                      </div>
                    ))}
                    {getDispositivosDeSucursal(selected.id).length === 0 && <div className="text-gray-400 text-xs">Sin dispositivos asignados</div>}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Empleados ({getEmpleadosDeSucursal(selected.id).length})</div>
                    {getEmpleadosDeSucursal(selected.id).slice(0, 5).map(e => (
                      <div key={e.id} className="flex items-center gap-2 py-1.5 border-b border-gray-100 last:border-0">
                        <div className="h-5 w-5 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 text-xs font-semibold flex-shrink-0">{e.nombre_completo?.charAt(0)}</div>
                        <div>
                          <div className="text-xs font-medium">{e.nombre_completo}</div>
                          <div className="text-xs text-gray-400">{e.puesto}</div>
                        </div>
                      </div>
                    ))}
                    {getEmpleadosDeSucursal(selected.id).length === 0 && <div className="text-gray-400 text-xs">Sin empleados registrados</div>}
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
                    <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Dispositivos activos ({getDispositivosDeEmpleado(selected.id).length})</div>
                    {getDispositivosDeEmpleado(selected.id).map(d => (
                      <div key={d.id} className="flex justify-between py-1.5 border-b border-gray-100 last:border-0 text-xs">
                        <span>{d.tipo} — {d.marca}</span>
                        <span className="font-mono text-gray-400 truncate ml-2">{d.serie}</span>
                      </div>
                    ))}
                    {getDispositivosDeEmpleado(selected.id).length === 0 && <div className="text-gray-400 text-xs">Sin dispositivos activos</div>}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="card text-center text-gray-400 text-sm py-8 flex-shrink-0">
              <BuildingOfficeIcon className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              Selecciona una ubicación en el mapa
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
