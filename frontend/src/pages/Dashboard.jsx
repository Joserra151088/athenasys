import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { deviceAPI, licenciaAPI } from '../utils/api'
import { DEVICE_STATUS, LOCATION_TYPES, DEVICE_TYPES } from '../utils/constants'
import {
  ComputerDesktopIcon,
  ExclamationTriangleIcon,
  ArchiveBoxIcon,
  CheckCircleIcon,
  KeyIcon,
  ClockIcon,
  BuildingOfficeIcon,
  WrenchScrewdriverIcon,
  UsersIcon,
  MapPinIcon,
  DocumentTextIcon,
  ArrowRightIcon,
  BellAlertIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline'

// ─── KPI Card ────────────────────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, gradient, iconColor, textColor, to }) {
  const content = (
    <div
      className="rounded-2xl p-5 flex flex-col justify-between transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-default relative overflow-hidden min-h-[120px]"
      style={{ background: gradient, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
    >
      {/* Watermark icon */}
      <div className="absolute -right-3 -bottom-3 opacity-[0.13] pointer-events-none">
        <Icon className="h-28 w-28" style={{ color: iconColor }} />
      </div>
      {/* Icon chip */}
      <div
        className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 self-start"
        style={{ background: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(4px)' }}
      >
        <Icon className="h-5 w-5" style={{ color: iconColor }} />
      </div>
      {/* Value + label */}
      <div className="relative z-10 mt-3">
        <div
          className="text-4xl font-black leading-none mb-1 tracking-tight"
          style={{ color: textColor || iconColor }}
        >
          {value ?? <span style={{ color: iconColor, opacity: 0.3 }}>—</span>}
        </div>
        <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: iconColor, opacity: 0.65 }}>
          {label}
        </div>
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

// ─── Donut Chart (SVG puro, con animación de crecimiento) ────────────────────
function DonutChart({ segments }) {
  const r = 35
  const cx = 50
  const cy = 50
  const circumference = 2 * Math.PI * r // ≈ 219.9
  const total = segments.reduce((s, seg) => s + seg.value, 0)
  const [animated, setAnimated] = useState(false)

  useEffect(() => {
    // Small delay so the browser paints the initial state (dash=0) before transitioning
    const t = setTimeout(() => setAnimated(true), 120)
    return () => clearTimeout(t)
  }, [])

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
              strokeDasharray={
                animated
                  ? `${arc.dash} ${arc.gap}`
                  : `0 ${circumference}`
              }
              strokeDashoffset={0}
              strokeLinecap="butt"
              transform={`rotate(${arc.rotation} ${cx} ${cy})`}
              style={{
                transition: `stroke-dasharray 0.85s cubic-bezier(0.4,0,0.2,1)`,
                transitionDelay: `${i * 110}ms`,
              }}
            />
          ) : null
        )}
        {/* Center label — fades in */}
        <text
          x={cx} y={cy - 4} textAnchor="middle" fontSize="13" fontWeight="700" fill="#1a3471"
          style={{ opacity: animated ? 1 : 0, transition: 'opacity 0.5s ease 0.4s' }}
        >
          {total}
        </text>
        <text
          x={cx} y={cy + 9} textAnchor="middle" fontSize="6" fill="#94a3b8"
          style={{ opacity: animated ? 1 : 0, transition: 'opacity 0.5s ease 0.5s' }}
        >
          total
        </text>
      </svg>
      <div className="space-y-2">
        {arcs.map((arc, i) => (
          <div
            key={i}
            className="flex items-center gap-2"
            style={{
              opacity: animated ? 1 : 0,
              transform: animated ? 'translateX(0)' : 'translateX(-8px)',
              transition: `opacity 0.4s ease, transform 0.4s ease`,
              transitionDelay: `${0.3 + i * 0.08}s`,
            }}
          >
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
      licenciaAPI.getStats(),
    ]).then(([s, ls]) => {
      setStats(s)
      setLicStats(ls)
    }).finally(() => setLoading(false))
  }, [])

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
        className="rounded-2xl px-7 py-7 text-white relative overflow-hidden"
        style={{
          background: 'linear-gradient(120deg, #0d1b3e 0%, #1a3471 50%, #2d5ab0 100%)',
          boxShadow: '0 6px 30px rgba(26,52,113,0.22)',
        }}
      >
        {/* Subtle decorative circles */}
        <div className="absolute -top-10 -right-10 w-56 h-56 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #7ab4ff, transparent)' }} />
        <div className="absolute -bottom-14 right-1/3 w-40 h-40 rounded-full opacity-8"
          style={{ background: 'radial-gradient(circle, #4d77c5, transparent)' }} />

        <div className="relative z-10">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <p className="text-blue-300 text-xs font-semibold uppercase tracking-widest mb-1">Resumen del sistema</p>
              <h1 className="text-3xl font-bold tracking-tight">Panel de Control</h1>
              <p className="text-blue-200 text-sm mt-1 capitalize">{today}</p>
            </div>
            {/* System status indicator */}
            <div className="flex items-center gap-2 bg-emerald-500/20 border border-emerald-400/30 rounded-xl px-4 py-2.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-sm text-emerald-300 font-semibold">Sistema operativo</span>
            </div>
          </div>

          {/* Inline quick stats */}
          <div className="flex flex-wrap gap-3 mt-5">
            <div className="flex items-center gap-2 bg-white/10 rounded-xl px-4 py-2">
              <ComputerDesktopIcon className="h-4 w-4 text-blue-300" />
              <span className="text-lg font-bold text-white">{stats?.total ?? '—'}</span>
              <span className="text-xs text-blue-300">dispositivos</span>
            </div>
            <div className="flex items-center gap-2 bg-emerald-500/15 rounded-xl px-4 py-2">
              <CheckCircleIcon className="h-4 w-4 text-emerald-400" />
              <span className="text-lg font-bold text-white">{stats?.por_estado?.activo ?? '—'}</span>
              <span className="text-xs text-emerald-300">activos</span>
            </div>
            <div className="flex items-center gap-2 bg-amber-500/15 rounded-xl px-4 py-2">
              <WrenchScrewdriverIcon className="h-4 w-4 text-amber-400" />
              <span className="text-lg font-bold text-white">{stats?.por_estado?.en_reparacion ?? '—'}</span>
              <span className="text-xs text-amber-300">en reparación</span>
            </div>
            <div className="flex items-center gap-2 bg-purple-500/15 rounded-xl px-4 py-2">
              <KeyIcon className="h-4 w-4 text-purple-300" />
              <span className="text-lg font-bold text-white">{licStats?.total ?? '—'}</span>
              <span className="text-xs text-purple-300">licencias</span>
            </div>
            {(licStats?.por_vencer ?? 0) > 0 && (
              <div className="flex items-center gap-2 bg-orange-500/20 border border-orange-400/30 rounded-xl px-4 py-2">
                <ClockIcon className="h-4 w-4 text-orange-300" />
                <span className="text-lg font-bold text-white">{licStats.por_vencer}</span>
                <span className="text-xs text-orange-300">lic. por vencer</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* KPI Row 1 — Dispositivos */}
      <div>
        <div className="flex items-center gap-2 mb-3 px-0.5">
          <div className="w-1 h-4 rounded-full" style={{ background: '#1a3471' }} />
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Dispositivos</h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            icon={ComputerDesktopIcon}
            label="Total Dispositivos"
            value={stats?.total}
            gradient="linear-gradient(135deg, #dbeafe 0%, #eff6ff 100%)"
            iconColor="#1d4ed8"
            to="/dispositivos"
          />
          <KpiCard
            icon={CheckCircleIcon}
            label="Activos"
            value={stats?.por_estado?.activo || 0}
            gradient="linear-gradient(135deg, #d1fae5 0%, #ecfdf5 100%)"
            iconColor="#059669"
          />
          <KpiCard
            icon={ArchiveBoxIcon}
            label="En Stock"
            value={stats?.por_estado?.stock || 0}
            gradient="linear-gradient(135deg, #e2e8f0 0%, #f1f5f9 100%)"
            iconColor="#475569"
          />
          <KpiCard
            icon={ExclamationTriangleIcon}
            label="En Reparación"
            value={stats?.por_estado?.en_reparacion || 0}
            gradient="linear-gradient(135deg, #fef3c7 0%, #fffbeb 100%)"
            iconColor="#d97706"
          />
        </div>
      </div>

      {/* KPI Row 2 — Licencias */}
      <div>
        <div className="flex items-center gap-2 mb-3 px-0.5">
          <div className="w-1 h-4 rounded-full" style={{ background: '#4f46e5' }} />
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Licencias de Software</h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            icon={KeyIcon}
            label="Total Licencias"
            value={licStats?.total}
            gradient="linear-gradient(135deg, #ede9fe 0%, #f5f3ff 100%)"
            iconColor="#6d28d9"
            to="/licencias"
          />
          <KpiCard
            icon={CheckCircleIcon}
            label="Licencias Activas"
            value={licStats?.activas || 0}
            gradient="linear-gradient(135deg, #ccfbf1 0%, #f0fdfa 100%)"
            iconColor="#0d9488"
          />
          <KpiCard
            icon={ClockIcon}
            label="Por Vencer (30d)"
            value={licStats?.por_vencer || 0}
            gradient="linear-gradient(135deg, #fed7aa 0%, #fff7ed 100%)"
            iconColor="#c2410c"
          />
          <KpiCard
            icon={KeyIcon}
            label="Asientos Usados"
            value={licStats ? `${licStats.asientos_usados}/${licStats.total_asientos}` : '—'}
            gradient="linear-gradient(135deg, #fce7f3 0%, #fdf2f8 100%)"
            iconColor="#9d174d"
          />
        </div>
      </div>

      {/* Distribución: Ubicación + Tipos + Dona */}
      <div>
        <div className="flex items-center gap-2 mb-3 px-0.5">
          <div className="w-1 h-4 rounded-full" style={{ background: '#0d9488' }} />
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Distribución y Análisis</h2>
        </div>
      </div>
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

      {/* Bottom row: Alertas + Accesos Rápidos */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* ── Alertas del Sistema (2/5) ── */}
        <div
          className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-6"
          style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}
        >
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <BellAlertIcon className="h-4 w-4 text-gray-400" />
            Alertas del Sistema
          </h3>

          <div className="space-y-3">
            {/* Licencias por vencer */}
            {(licStats?.por_vencer ?? 0) > 0 ? (
              <Link to="/licencias" className="flex items-center gap-3 p-3 rounded-xl transition-all hover:scale-[1.01]"
                style={{ background: 'linear-gradient(135deg, #fef3c7, #fffbeb)', border: '1px solid #fde68a' }}>
                <div className="h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-amber-100">
                  <ClockIcon className="h-4 w-4 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-amber-800">Licencias por vencer</div>
                  <div className="text-xs text-amber-600 mt-0.5">{licStats.por_vencer} licencia{licStats.por_vencer !== 1 ? 's' : ''} vence{licStats.por_vencer !== 1 ? 'n' : ''} en 30 días</div>
                </div>
                <ArrowRightIcon className="h-4 w-4 text-amber-500 flex-shrink-0" />
              </Link>
            ) : (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                <div className="h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-gray-100">
                  <ClockIcon className="h-4 w-4 text-gray-400" />
                </div>
                <div className="text-sm text-gray-400">Sin licencias por vencer</div>
              </div>
            )}

            {/* Dispositivos en reparación */}
            {(stats?.por_estado?.en_reparacion ?? 0) > 0 ? (
              <Link to="/dispositivos" className="flex items-center gap-3 p-3 rounded-xl transition-all hover:scale-[1.01]"
                style={{ background: 'linear-gradient(135deg, #fef9c3, #fefce8)', border: '1px solid #fef08a' }}>
                <div className="h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-yellow-100">
                  <WrenchScrewdriverIcon className="h-4 w-4 text-yellow-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-yellow-800">Equipos en reparación</div>
                  <div className="text-xs text-yellow-600 mt-0.5">{stats.por_estado.en_reparacion} dispositivo{stats.por_estado.en_reparacion !== 1 ? 's' : ''} en servicio</div>
                </div>
                <ArrowRightIcon className="h-4 w-4 text-yellow-500 flex-shrink-0" />
              </Link>
            ) : (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                <div className="h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-gray-100">
                  <WrenchScrewdriverIcon className="h-4 w-4 text-gray-400" />
                </div>
                <div className="text-sm text-gray-400">Sin equipos en reparación</div>
              </div>
            )}

            {/* Dispositivos pendientes */}
            {(stats?.por_estado?.pendiente ?? 0) > 0 ? (
              <Link to="/dispositivos" className="flex items-center gap-3 p-3 rounded-xl transition-all hover:scale-[1.01]"
                style={{ background: 'linear-gradient(135deg, #fee2e2, #fef2f2)', border: '1px solid #fecaca' }}>
                <div className="h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-red-100">
                  <ExclamationTriangleIcon className="h-4 w-4 text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-red-800">Dispositivos pendientes</div>
                  <div className="text-xs text-red-600 mt-0.5">{stats.por_estado.pendiente} requieren atención</div>
                </div>
                <ArrowRightIcon className="h-4 w-4 text-red-400 flex-shrink-0" />
              </Link>
            ) : (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                <div className="h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-gray-100">
                  <ExclamationTriangleIcon className="h-4 w-4 text-gray-400" />
                </div>
                <div className="text-sm text-gray-400">Sin dispositivos pendientes</div>
              </div>
            )}

            {/* Sin alertas */}
            {!(licStats?.por_vencer) && !(stats?.por_estado?.en_reparacion) && !(stats?.por_estado?.pendiente) && (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <div className="h-12 w-12 rounded-full bg-emerald-50 flex items-center justify-center mb-3">
                  <SparklesIcon className="h-6 w-6 text-emerald-500" />
                </div>
                <div className="text-sm font-semibold text-emerald-700">Todo en orden</div>
                <div className="text-xs text-gray-400 mt-1">Sin alertas activas en el sistema</div>
              </div>
            )}
          </div>
        </div>

        {/* ── Accesos Rápidos (3/5) ── */}
        <div
          className="lg:col-span-3 bg-white rounded-2xl border border-gray-100 p-6"
          style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}
        >
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <SparklesIcon className="h-4 w-4 text-gray-400" />
            Accesos Rápidos
          </h3>
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                label: 'Dispositivos', to: '/dispositivos', Icon: ComputerDesktopIcon,
                count: stats?.total, countLabel: 'registrados',
                gradient: 'linear-gradient(135deg, #dbeafe, #eff6ff)', color: '#1d4ed8',
              },
              {
                label: 'Empleados', to: '/empleados', Icon: UsersIcon,
                count: null, countLabel: 'activos',
                gradient: 'linear-gradient(135deg, #d1fae5, #ecfdf5)', color: '#059669',
              },
              {
                label: 'Sucursales', to: '/sucursales', Icon: BuildingOfficeIcon,
                count: null, countLabel: 'registradas',
                gradient: 'linear-gradient(135deg, #ede9fe, #f5f3ff)', color: '#6d28d9',
              },
              {
                label: 'Licencias', to: '/licencias', Icon: KeyIcon,
                count: licStats?.total, countLabel: 'totales',
                gradient: 'linear-gradient(135deg, #fce7f3, #fdf2f8)', color: '#9d174d',
              },
              {
                label: 'Documentos', to: '/documentos', Icon: DocumentTextIcon,
                count: null, countLabel: 'expedientes',
                gradient: 'linear-gradient(135deg, #ccfbf1, #f0fdfa)', color: '#0d9488',
              },
              {
                label: 'Mapa', to: '/mapa', Icon: MapPinIcon,
                count: null, countLabel: 'ubicaciones',
                gradient: 'linear-gradient(135deg, #fee2e2, #fef2f2)', color: '#dc2626',
              },
            ].map(({ label, to, Icon, count, countLabel, gradient, color }) => (
              <Link
                key={to}
                to={to}
                className="flex flex-col items-center gap-2.5 p-4 rounded-xl transition-all duration-200 hover:scale-[1.04] hover:shadow-md text-center"
                style={{ background: gradient }}
              >
                <div
                  className="h-11 w-11 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.7)' }}
                >
                  <Icon className="h-5 w-5" style={{ color }} />
                </div>
                <div>
                  <div className="text-sm font-bold text-gray-800">{label}</div>
                  {count != null && (
                    <div className="text-xs font-semibold mt-0.5" style={{ color }}>
                      {count} {countLabel}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
