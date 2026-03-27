import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { deviceAPI, licenciaAPI } from '../utils/api'
import { DEVICE_STATUS, LOCATION_TYPES, DEVICE_TYPES } from '../utils/constants'
import Badge from '../components/Badge'
import Pagination from '../components/Pagination'
import {
  ComputerDesktopIcon, ExclamationTriangleIcon, ArchiveBoxIcon,
  CheckCircleIcon, KeyIcon, ClockIcon
} from '@heroicons/react/24/outline'

function StatCard({ icon: Icon, label, value, color, to }) {
  const content = (
    <div className="card flex items-center gap-4 hover:shadow-md transition-shadow">
      <div className={`h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <div className="text-2xl font-bold text-gray-900">{value ?? '—'}</div>
        <div className="text-sm text-gray-500">{label}</div>
      </div>
    </div>
  )
  return to ? <Link to={to}>{content}</Link> : content
}

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [licStats, setLicStats] = useState(null)
  const [dispositivos, setDispositivos] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 15 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      deviceAPI.getStats(),
      deviceAPI.getAll({ page: 1, limit: 15 }),
      licenciaAPI.getStats()
    ]).then(([s, d, ls]) => {
      setStats(s)
      setLicStats(ls)
      setDispositivos(d.data)
      setPagination({ page: d.page, pages: d.pages, total: d.total, limit: d.limit })
    }).finally(() => setLoading(false))
  }, [])

  const loadPage = (page) => {
    deviceAPI.getAll({ page, limit: 15 }).then(d => {
      setDispositivos(d.data)
      setPagination({ page: d.page, pages: d.pages, total: d.total, limit: d.limit })
    })
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-600 border-t-transparent" />
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Resumen general del inventario de dispositivos TI</p>
      </div>

      {/* Stats dispositivos */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={ComputerDesktopIcon} label="Total Dispositivos" value={stats?.total} color="bg-blue-100 text-blue-600" to="/dispositivos" />
        <StatCard icon={CheckCircleIcon} label="Activos" value={stats?.por_estado?.activo || 0} color="bg-emerald-100 text-emerald-600" />
        <StatCard icon={ArchiveBoxIcon} label="En Stock" value={stats?.por_estado?.stock || 0} color="bg-gray-100 text-gray-600" />
        <StatCard icon={ExclamationTriangleIcon} label="En Reparación" value={stats?.por_estado?.en_reparacion || 0} color="bg-yellow-100 text-yellow-600" />
      </div>

      {/* Stats licencias */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={KeyIcon} label="Total Licencias" value={licStats?.total} color="bg-indigo-100 text-indigo-600" to="/licencias" />
        <StatCard icon={CheckCircleIcon} label="Licencias Activas" value={licStats?.activas || 0} color="bg-teal-100 text-teal-600" />
        <StatCard icon={ClockIcon} label="Por Vencer (30d)" value={licStats?.por_vencer || 0} color="bg-orange-100 text-orange-600" />
        <StatCard icon={KeyIcon} label="Asientos Usados" value={licStats ? `${licStats.asientos_usados}/${licStats.total_asientos}` : '—'} color="bg-purple-100 text-purple-600" />
      </div>

      {/* Distribución por ubicación */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card col-span-1">
          <h3 className="font-semibold text-gray-800 mb-4">Por Ubicación</h3>
          <div className="space-y-3">
            {Object.entries(LOCATION_TYPES).map(([key, val]) => {
              const count = stats?.por_ubicacion?.[key] || 0
              const pct = stats?.total ? Math.round((count / stats.total) * 100) : 0
              return (
                <div key={key}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">{val.label}</span>
                    <span className="font-medium text-gray-900">{count}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-primary-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="card col-span-2">
          <h3 className="font-semibold text-gray-800 mb-4">Por Tipo de Dispositivo</h3>
          <div className="grid grid-cols-2 gap-2">
            {DEVICE_TYPES.map(tipo => {
              const count = stats?.por_tipo?.[tipo] || 0
              return (
                <div key={tipo} className="flex items-center justify-between py-1.5 px-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-600 truncate">{tipo}</span>
                  <span className="text-sm font-semibold text-gray-900 ml-2 flex-shrink-0">{count}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Tabla paginada */}
      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Todos los Dispositivos</h3>
          <Link to="/dispositivos" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
            Ver todos →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="table-header">Tipo</th>
                <th className="table-header">Marca / Modelo</th>
                <th className="table-header">Serie</th>
                <th className="table-header">Estado</th>
                <th className="table-header">Ubicación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {dispositivos.map(d => (
                <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                  <td className="table-cell">
                    <span className="font-medium text-gray-900">{d.tipo}</span>
                  </td>
                  <td className="table-cell">
                    <div>{d.marca}</div>
                    <div className="text-xs text-gray-400">{d.modelo}</div>
                  </td>
                  <td className="table-cell font-mono text-xs text-gray-500">{d.serie}</td>
                  <td className="table-cell">
                    <Badge {...(DEVICE_STATUS[d.estado] || { label: d.estado, color: 'bg-gray-100 text-gray-600' })} />
                  </td>
                  <td className="table-cell">
                    <Badge {...(LOCATION_TYPES[d.ubicacion_tipo] || { label: d.ubicacion_tipo, color: 'bg-gray-100 text-gray-600' })} />
                    <div className="text-xs text-gray-400 mt-0.5 truncate max-w-32">{d.ubicacion_nombre}</div>
                  </td>
                </tr>
              ))}
              {dispositivos.length === 0 && (
                <tr><td colSpan={5} className="text-center py-12 text-gray-400">No hay dispositivos registrados</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination {...pagination} onPageChange={loadPage} />
      </div>
    </div>
  )
}
