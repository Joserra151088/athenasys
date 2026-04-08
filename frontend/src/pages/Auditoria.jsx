import { useState, useEffect, useCallback } from 'react'
import { auditoriaAPI } from '../utils/api'
import Pagination from '../components/Pagination'
import { MagnifyingGlassIcon, ShieldCheckIcon } from '@heroicons/react/24/outline'
import PageHeader from '../components/PageHeader'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const ACCION_COLORS = {
  crear: 'bg-emerald-100 text-emerald-700',
  actualizar: 'bg-blue-100 text-blue-700',
  eliminar: 'bg-red-100 text-red-700',
  asignar: 'bg-purple-100 text-purple-700',
  desasignar: 'bg-orange-100 text-orange-700',
  firmar: 'bg-teal-100 text-teal-700',
  login: 'bg-gray-100 text-gray-600'
}

export default function Auditoria() {
  const [logs, setLogs] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 50 })
  const [search, setSearch] = useState('')
  const [filterEntidad, setFilterEntidad] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback((page = 1) => {
    setLoading(true)
    const params = { page, limit: 50 }
    if (search) params.search = search
    if (filterEntidad) params.entidad = filterEntidad
    auditoriaAPI.getAll(params).then(d => {
      setLogs(d.data)
      setPagination({ page: d.page, pages: Math.ceil(d.total / 50), total: d.total, limit: 50 })
    }).finally(() => setLoading(false))
  }, [search, filterEntidad])

  useEffect(() => { load(1) }, [load])

  const entidades = ['dispositivo', 'empleado', 'sucursal', 'asignacion', 'documento', 'plantilla', 'cambio', 'cotizacion']

  return (
    <div className="space-y-5">
      <PageHeader title="Auditoría" subtitle="Registro completo de acciones en el sistema" />

      <div className="card p-4 flex gap-3">
        <div className="flex-1 relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input type="text" className="input pl-9" placeholder="Buscar por usuario, acción..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input w-44" value={filterEntidad} onChange={e => setFilterEntidad(e.target.value)}>
          <option value="">Todas las entidades</option>
          {entidades.map(e => <option key={e} value={e}>{e.charAt(0).toUpperCase() + e.slice(1)}</option>)}
        </select>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b text-xs text-gray-500">
          {pagination.total} registros encontrados
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="table-header">Fecha</th>
                <th className="table-header">Usuario</th>
                <th className="table-header">Acción</th>
                <th className="table-header">Entidad</th>
                <th className="table-header">Detalles</th>
                <th className="table-header">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={6} className="py-12 text-center"><div className="inline-block animate-spin rounded-full h-6 w-6 border-4 border-primary-600 border-t-transparent" /></td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={6} className="py-12 text-center text-gray-400">Sin registros</td></tr>
              ) : logs.map(log => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="table-cell text-xs text-gray-500 whitespace-nowrap">
                    {log.fecha ? format(new Date(log.fecha), 'dd/MM/yy HH:mm', { locale: es }) : '—'}
                  </td>
                  <td className="table-cell">
                    <div className="text-sm font-medium">{log.usuario_nombre}</div>
                  </td>
                  <td className="table-cell">
                    <span className={`badge ${ACCION_COLORS[log.accion] || 'bg-gray-100 text-gray-600'}`}>
                      {log.accion}
                    </span>
                  </td>
                  <td className="table-cell text-sm capitalize">{log.entidad}</td>
                  <td className="table-cell max-w-xs">
                    <p className="text-xs text-gray-500 truncate">{log.datos || '—'}</p>
                    {log.entidad_id && <p className="text-xs text-gray-300 font-mono truncate">{log.entidad_id}</p>}
                  </td>
                  <td className="table-cell text-xs font-mono text-gray-400">{log.ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination {...pagination} onPageChange={load} />
      </div>
    </div>
  )
}
