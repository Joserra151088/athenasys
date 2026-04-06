import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { deviceAPI, licenciaAPI } from '../utils/api'
import { DEVICE_STATUS, LOCATION_TYPES, DEVICE_TYPES } from '../utils/constants'
import Badge from '../components/Badge'
import Pagination from '../components/Pagination'
import {
  ComputerDesktopIcon,
  ExclamationTriangleIcon,
  ArchiveBoxIcon,
  CheckCircleIcon,
  KeyIcon,
  ClockIcon,
  ArrowTrendingUpIcon,
  BuildingOfficeIcon,
} from '@heroicons/react/24/outline'

// ─── KPI Card ────────────────────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, iconBg, iconColor, to, trend, trendLabel }) {
  const content = (
    <div
      className="bg-white rounded-2xl border border-gray-100 p-5 flex items-start gap-4 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 cursor-default"
      style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
    >
      <div
        className="h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: iconBg }}
      >
        <Icon className="h-6 w-6" style={{ color: iconColor }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-2xl font-bold text-gray-900 leading-none mb-1">
          {value ?? <span className="text-gray-300">—</span>}
        </div>
        <div className="text-xs text-gray-500 font-medium leading-tight">{label}</div>
        {trend !== undefined && (
          <div className="flex items-center gap-1 mt-1.5">
            <ArrowTrendingUpIcon className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-xs text-emerald-600 font-medium">{trendLabel}</span>
          </div>
        )}
      </div>
    </div>
  )
  return to ? (
    <Link to={to} className="block">
      {content}
    </Link>
  ) : (
    content
  )
}

// ─── Donut Chart (SVG puro) ───────────────────────────────────────────────────
function DonutChart({ segments }) {
  const r = 35
  const cx = 50
  const cy = 50
  const circumference = 2 * Math.PI * r // ≈ 219.9
  const total = segments.reduce((s, seg) => s + seg.value, 0)

  let offset = 0
  const arcs = segments.map(seg => {
    const pct = total > 0 ? seg.value / total : 0
    const dash = pct * circumference
    const gap = circumference - dash
    const rotation = (offset / (total || 1)) * 360 - 90
    offset += seg.value
    return { ...seg, dash, gap, rotation, pct }
  })

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 100 100" className="w-32 h-32 flex-shrink-0">
        {/* Track */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth="10" />
        {arcs.map((arc, i) =>
          arc.value > 0 ? (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={arc.color}
              strokeWidth="10"
              strokeDasharray={`${arc.dash} ${arc.gap}`}
              strokeDashoffset={0}
              strokeLinecap="butt"
              transform={`rotate(${arc.rotation} ${cx} ${cy})`}
              style={{ transition: 'stroke-dasharray 0.6s ease' }}
            />
          ) : null
        )}
        {/* Center label */}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="13" fontWeight="700" fill="#1a3471">
          {total}
        </text>
        <text x={cx} y={cy + 9} textAnchor="middle" fontSize="6" fill="#94a3b8">
          total
        </text>
      </svg>
      <div className="space-y-2">
        {arcs.map((arc, i) => (
          <div key={i} className="flex items-center gap-2">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ background: arc.color }}
            />
            <span className="text-xs text-gray-600 leading-none">{arc.label}</span>
            <span className="text-xs font-semibold text-gray-800 ml-auto pl-2">{arc.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [licStats, setLicStats] = useState(null)
  const [dispositivos, setDispositivos] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 15 })
  const [loading, setLoading] = useState(true)

  const today = new Date().toLocaleDateString('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  useEffect(() => {
    Promise.all([
      deviceAPI.getStats(),
      deviceAPI.getAll({ page: 1, limit: 15 }),
      licenciaAPI.getStats(),
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div
          className="animate-spin rounded-full h-9 w-9 border-4 border-t-transparent"
          style={{ borderColor: '#1a3471', borderTopColor: 'transparent' }}
        />
      </div>
    )
  }

  // Datos para el donut chart
  const donutSegments = [
    { label: 'Activos', value: stats?.por_estado?.activo || 0, color: '#10b981' },
    { label: 'En Stock', value: stats?.por_estado?.stock || 0, color: '#94a3b8' },
    { label: 'En Reparación', value: stats?.por_estado?.en_reparacion || 0, color: '#f59e0b' },
    { label: 'Pendiente', value: stats?.por_estado?.pendiente || 0, color: '#6366f1' },
  ]

  // Tipos ordenados por conteo descendente
  const sortedTypes = DEVICE_TYPES
    .map(tipo => ({ tipo, count: stats?.por_tipo?.[tipo] || 0 }))
    .sort((a, b) => b.count - a.count)

  return (
    <div className="space-y-6">
      {/* Header banner */}
      <div
        className="rounded-2xl px-7 py-6 text-white"
        style={{
          background: 'linear-gradient(120deg, #10204a 0%, #1a3471 55%, #2d5ab0 100%)',
          boxShadow: '0 4px 24px rgba(26,52,113,0.18)',
        }}
      >
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Panel de Control</h1>
            <p className="text-blue-200 text-sm mt-1 capitalize">{today}</p>
          </div>
          <div className="flex items-center gap-2 bg-white/10 rounded-xl px-4 py-2">
            <BuildingOfficeIcon className="h-5 w-5 text-blue-200" />
            <span className="text-sm text-blue-100 font-medium">Previta · Salud Empresarial</span>
          </div>
        </div>
      </div>

      {/* KPI Row 1 — Dispositivos */}
      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3 px-0.5">
          Dispositivos
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            icon={ComputerDesktopIcon}
            label="Total Dispositivos"
            value={stats?.total}
            iconBg="rgba(26,52,113,0.10)"
            iconColor="#1a3471"
            to="/dispositivos"
          />
          <KpiCard
            icon={CheckCircleIcon}
            label="Activos"
            value={stats?.por_estado?.activo || 0}
            iconBg="rgba(16,185,129,0.12)"
            iconColor="#059669"
          />
          <KpiCard
            icon={ArchiveBoxIcon}
            label="En Stock"
            value={stats?.por_estado?.stock || 0}
            iconBg="rgba(100,116,139,0.12)"
            iconColor="#475569"
          />
          <KpiCard
            icon={ExclamationTriangleIcon}
            label="En Reparación"
            value={stats?.por_estado?.en_reparacion || 0}
            iconBg="rgba(245,158,11,0.12)"
            iconColor="#d97706"
          />
        </div>
      </div>

      {/* KPI Row 2 — Licencias */}
      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3 px-0.5">
          Licencias de Software
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            icon={KeyIcon}
            label="Total Licencias"
            value={licStats?.total}
            iconBg="rgba(99,102,241,0.12)"
            iconColor="#4f46e5"
            to="/licencias"
          />
          <KpiCard
            icon={CheckCircleIcon}
            label="Licencias Activas"
            value={licStats?.activas || 0}
            iconBg="rgba(20,184,166,0.12)"
            iconColor="#0d9488"
          />
          <KpiCard
            icon={ClockIcon}
            label="Por Vencer (30d)"
            value={licStats?.por_vencer || 0}
            iconBg="rgba(249,115,22,0.12)"
            iconColor="#ea580c"
          />
          <KpiCard
            icon={KeyIcon}
            label="Asientos Usados"
            value={licStats ? `${licStats.asientos_usados}/${licStats.total_asientos}` : '—'}
            iconBg="rgba(168,85,247,0.12)"
            iconColor="#9333ea"
          />
        </div>
      </div>

      {/* Distribución: Ubicación + Tipos + Dona */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Ubicación — barras */}
        <div
          className="bg-white rounded-2xl border border-gray-100 p-6"
          style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        >
          <h3 className="font-semibold text-gray-800 mb-5 flex items-center gap-2">
            <BuildingOfficeIcon className="h-4 w-4 text-gray-400" />
            Distribución por Ubicación
          </h3>
          <div className="space-y-4">
            {Object.entries(LOCATION_TYPES).map(([key, val]) => {
              const count = stats?.por_ubicacion?.[key] || 0
              const pct = stats?.total ? Math.round((count / stats.total) * 100) : 0
              return (
                <div key={key}>
                  <div className="flex justify-between items-center text-sm mb-1.5">
                    <span className="text-gray-600 font-medium">{val.label}</span>
                    <span className="text-gray-900 font-semibold">
                      {count}
                      <span className="text-gray-400 font-normal ml-1 text-xs">({pct}%)</span>
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        background: 'linear-gradient(90deg, #1a3471, #4d77c5)',
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Tipos de dispositivo */}
        <div
          className="bg-white rounded-2xl border border-gray-100 p-6"
          style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        >
          <h3 className="font-semibold text-gray-800 mb-5 flex items-center gap-2">
            <ComputerDesktopIcon className="h-4 w-4 text-gray-400" />
            Por Tipo de Dispositivo
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {sortedTypes.map(({ tipo, count }) => (
              <div
                key={tipo}
                className="flex items-center justify-between py-2 px-3 rounded-xl transition-colors"
                style={{ background: '#f8fafc' }}
              >
                <span className="text-xs text-gray-600 truncate leading-tight">{tipo}</span>
                <span
                  className="text-xs font-bold ml-2 flex-shrink-0 px-2 py-0.5 rounded-full"
                  style={{
                    background: count > 0 ? 'rgba(26,52,113,0.10)' : '#f1f5f9',
                    color: count > 0 ? '#1a3471' : '#94a3b8',
                  }}
                >
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Dona de estados */}
        <div
          className="bg-white rounded-2xl border border-gray-100 p-6"
          style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        >
          <h3 className="font-semibold text-gray-800 mb-5 flex items-center gap-2">
            <CheckCircleIcon className="h-4 w-4 text-gray-400" />
            Distribución de Estados
          </h3>
          <DonutChart segments={donutSegments} />
        </div>
      </div>

      {/* Tabla de dispositivos */}
      <div
        className="bg-white rounded-2xl border border-gray-100 overflow-hidden"
        style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
      >
        {/* Header tabla */}
        <div
          className="px-6 py-4 flex items-center justify-between border-b border-gray-100"
          style={{ background: 'linear-gradient(90deg, rgba(26,52,113,0.04) 0%, rgba(255,255,255,0) 100%)' }}
        >
          <div className="flex items-center gap-2">
            <ComputerDesktopIcon className="h-5 w-5 text-gray-400" />
            <h3 className="font-semibold text-gray-800">Todos los Dispositivos</h3>
            <span
              className="ml-1 text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(26,52,113,0.08)', color: '#1a3471' }}
            >
              {pagination.total}
            </span>
          </div>
          <Link
            to="/dispositivos"
            className="text-sm font-medium transition-colors"
            style={{ color: '#1a3471' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#2d5ab0')}
            onMouseLeave={e => (e.currentTarget.style.color = '#1a3471')}
          >
            Ver todos →
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ background: 'rgba(26,52,113,0.03)' }}>
                <th className="table-header">Tipo</th>
                <th className="table-header">Marca / Modelo</th>
                <th className="table-header">Serie</th>
                <th className="table-header">Estado</th>
                <th className="table-header">Ubicación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {dispositivos.map(d => (
                <tr
                  key={d.id}
                  className="transition-colors duration-150"
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(26,52,113,0.025)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >
                  <td className="table-cell">
                    <span className="font-semibold text-gray-800 text-sm">{d.tipo}</span>
                  </td>
                  <td className="table-cell">
                    <div className="font-medium text-gray-800 text-sm">{d.marca}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{d.modelo}</div>
                  </td>
                  <td className="table-cell font-mono text-xs text-gray-500">{d.serie}</td>
                  <td className="table-cell">
                    <Badge
                      {...(DEVICE_STATUS[d.estado] || { label: d.estado, color: 'bg-gray-100 text-gray-600' })}
                    />
                  </td>
                  <td className="table-cell">
                    <Badge
                      {...(LOCATION_TYPES[d.ubicacion_tipo] || {
                        label: d.ubicacion_tipo,
                        color: 'bg-gray-100 text-gray-600',
                      })}
                    />
                    <div className="text-xs text-gray-400 mt-0.5 truncate max-w-32">
                      {d.ubicacion_nombre}
                    </div>
                  </td>
                </tr>
              ))}
              {dispositivos.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-14 text-gray-400">
                    <ComputerDesktopIcon className="h-10 w-10 mx-auto mb-3 text-gray-200" />
                    No hay dispositivos registrados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination {...pagination} onPageChange={loadPage} />
      </div>
    </div>
  )
}
