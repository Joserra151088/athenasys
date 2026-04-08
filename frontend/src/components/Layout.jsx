import { useEffect, useMemo, useState } from 'react'
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { useAuth } from '../context/AuthContext'
import { USER_ROLES } from '../utils/constants'
import previtaLogo from '../assets/previta.png'

const navItems = [
  { path: '/', label: 'Dashboard', exact: true },
  { path: '/dispositivos', label: 'Dispositivos' },
  { path: '/asignaciones', label: 'Asignaciones' },
  {
    label: 'Registros',
    children: [
      { path: '/empleados', label: 'Empleados' },
      { path: '/sucursales', label: 'Sucursales' },
      { path: '/proveedores', label: 'Proveedores' },
    ],
  },
  { path: '/expedientes', label: 'Expedientes' },
  { path: '/documentos', label: 'Documentos' },
  { path: '/plantillas', label: 'Plantillas' },
  { path: '/cambios', label: 'Cambios de Equipo' },
  { path: '/licencias', label: 'Licencias' },
  { path: '/cotizaciones', label: 'Cotizaciones' },
  {
    label: 'Finanzas',
    children: [
      { path: '/finanzas', label: 'Presupuesto y Gastos' },
      { path: '/centros-costo', label: 'Centros de Costo' },
      { path: '/tarifas', label: 'Tarifas de Equipo' },
    ],
  },
  { path: '/reportes', label: 'Reportes' },
  { path: '/mapa', label: 'Mapa' },
  { path: '/catalogos', label: 'Catalogos', roles: ['super_admin', 'agente_soporte'] },
  { path: '/usuarios-sistema', label: 'Usuarios', roles: ['super_admin'] },
  { path: '/auditoria', label: 'Auditoria', roles: ['super_admin'] },
]

function getAbbreviation(label) {
  const words = label
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)

  return words.map(word => word[0]?.toUpperCase() || '').join('')
}

function NavItem({ item, onClick, collapsed }) {
  const [open, setOpen] = useState(false)
  const { hasRole } = useAuth()
  const location = useLocation()

  const isChildActive = item.children?.some(child => location.pathname.startsWith(child.path))

  useEffect(() => {
    if (isChildActive) setOpen(true)
  }, [isChildActive])

  if (item.roles && !hasRole(...item.roles)) return null

  if (item.children) {
    if (collapsed) {
      return (
        <div className="relative group">
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className={`mx-auto flex h-11 w-11 items-center justify-center rounded-2xl border text-[11px] font-semibold uppercase tracking-[0.22em] transition-all duration-300 ${
              isChildActive
                ? 'border-blue-300 bg-white text-blue-700 shadow-[0_14px_30px_rgba(37,99,235,0.16)]'
                : 'border-transparent bg-white/70 text-slate-500 hover:-translate-y-0.5 hover:border-slate-200 hover:bg-white hover:text-slate-900'
            }`}
            title={item.label}
          >
            {getAbbreviation(item.label)}
          </button>

          <div className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 hidden -translate-y-1/2 group-hover:block">
            <div className="rounded-2xl border border-slate-200 bg-white/95 px-3 py-2 text-xs font-medium text-slate-700 shadow-xl backdrop-blur">
              {item.label}
            </div>
          </div>

          <div
            className={`absolute left-full top-0 z-40 ml-3 overflow-hidden rounded-3xl border border-slate-200 bg-white/95 shadow-2xl backdrop-blur transition-all duration-300 ${
              open ? 'visible w-64 opacity-100' : 'invisible w-0 opacity-0'
            }`}
          >
            <div className="border-b border-slate-100 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">{item.label}</p>
            </div>
            <div className="space-y-1 p-3">
              {item.children.map(child => (
                <NavLink
                  key={child.path}
                  to={child.path}
                  onClick={onClick}
                  className={({ isActive }) =>
                    `block rounded-2xl px-3 py-2.5 text-sm font-medium transition-all duration-300 ${
                      isActive
                        ? 'bg-slate-900 text-white shadow-[0_10px_20px_rgba(15,23,42,0.18)]'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`
                  }
                >
                  {child.label}
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-medium transition-all duration-300 ${
            isChildActive
              ? 'bg-white text-slate-950 shadow-[0_16px_30px_rgba(15,23,42,0.08)] ring-1 ring-slate-200'
              : 'text-slate-600 hover:bg-white/80 hover:text-slate-900 hover:shadow-[0_10px_24px_rgba(15,23,42,0.06)]'
          }`}
        >
          <span className="tracking-[0.01em]">{item.label}</span>
          <ChevronDownIcon className={`h-4 w-4 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
        </button>

        <div
          className={`overflow-hidden pl-3 transition-all duration-300 ease-out ${
            open ? 'max-h-80 opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="space-y-1 border-l border-slate-200/80 pl-4">
            {item.children.map(child => (
              <NavLink
                key={child.path}
                to={child.path}
                onClick={onClick}
                className={({ isActive }) =>
                  `block rounded-2xl px-4 py-2.5 text-sm transition-all duration-300 ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-[0_12px_20px_rgba(15,23,42,0.16)]'
                      : 'text-slate-500 hover:bg-white hover:text-slate-900'
                  }`
                }
              >
                {child.label}
              </NavLink>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (collapsed) {
    return (
      <div className="relative group">
        <NavLink
          to={item.path}
          end={item.exact}
          onClick={onClick}
          className={({ isActive }) =>
            `mx-auto flex h-11 w-11 items-center justify-center rounded-2xl border text-[11px] font-semibold uppercase tracking-[0.22em] transition-all duration-300 ${
              isActive
                ? 'border-blue-300 bg-white text-blue-700 shadow-[0_14px_30px_rgba(37,99,235,0.16)]'
                : 'border-transparent bg-white/70 text-slate-500 hover:-translate-y-0.5 hover:border-slate-200 hover:bg-white hover:text-slate-900'
            }`
          }
        >
          {getAbbreviation(item.label)}
        </NavLink>

        <div className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 hidden -translate-y-1/2 group-hover:block">
          <div className="rounded-2xl border border-slate-200 bg-white/95 px-3 py-2 text-xs font-medium text-slate-700 shadow-xl backdrop-blur">
            {item.label}
          </div>
        </div>
      </div>
    )
  }

  return (
    <NavLink
      to={item.path}
      end={item.exact}
      onClick={onClick}
      className={({ isActive }) =>
        `block rounded-2xl px-4 py-3 text-sm font-medium tracking-[0.01em] transition-all duration-300 ${
          isActive
            ? 'bg-slate-900 text-white shadow-[0_18px_32px_rgba(15,23,42,0.18)]'
            : 'text-slate-600 hover:-translate-y-0.5 hover:bg-white hover:text-slate-900 hover:shadow-[0_12px_24px_rgba(15,23,42,0.08)]'
        }`
      }
    >
      {item.label}
    </NavLink>
  )
}

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const userInitials = useMemo(() => {
    const source = user?.nombre || 'A'
    return source
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0]?.toUpperCase() || '')
      .join('')
  }, [user?.nombre])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const SidebarContent = ({ isMobile = false }) => (
    <div className="relative flex h-full flex-col overflow-hidden">
      <div className="absolute inset-x-6 top-5 h-32 rounded-full bg-gradient-to-r from-blue-200/40 via-cyan-200/10 to-transparent blur-3xl" />

      <div
        className={`relative border-b border-white/60 pb-6 pt-6 transition-all duration-300 ${
          collapsed && !isMobile ? 'px-3' : 'px-5'
        }`}
      >
        <div
          className={`rounded-[28px] border border-white/70 bg-white/80 shadow-[0_20px_45px_rgba(148,163,184,0.18)] backdrop-blur-xl transition-all duration-300 ${
            collapsed && !isMobile ? 'px-2 py-4 text-center' : 'px-4 py-4'
          }`}
        >
          {collapsed && !isMobile ? (
            <div className="space-y-2">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-xs font-semibold uppercase tracking-[0.28em] text-white">
                AS
              </div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-400">Menu</p>
            </div>
          ) : (
            <div className="flex w-full flex-col items-center justify-center gap-4 text-center">
              <img src={previtaLogo} alt="Previta" className="h-14 w-full max-w-[220px] object-contain opacity-95" />
              <h1 className="text-[1.9rem] font-semibold tracking-[-0.05em] text-slate-950">AthenaSys</h1>
            </div>
          )}
        </div>
      </div>

      <nav
        className={`relative flex-1 space-y-2 overflow-y-auto py-6 transition-all duration-300 ${
          collapsed && !isMobile ? 'px-2' : 'px-4'
        }`}
      >
        {navItems.map((item, index) => (
          <div
            key={item.path || item.label || index}
            className="animate-fadeIn"
            style={{ animationDelay: `${index * 35}ms` }}
          >
            <NavItem item={item} onClick={() => setSidebarOpen(false)} collapsed={collapsed && !isMobile} />
          </div>
        ))}
      </nav>

      <div
        className={`relative border-t border-white/60 pb-5 pt-4 transition-all duration-300 ${
          collapsed && !isMobile ? 'px-2' : 'px-4'
        }`}
      >
        {collapsed && !isMobile ? (
          <div className="space-y-3 rounded-[24px] border border-white/70 bg-white/80 px-2 py-3 text-center shadow-[0_16px_40px_rgba(148,163,184,0.16)] backdrop-blur-xl">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-blue-700 text-sm font-semibold text-white shadow-lg">
              {userInitials}
            </div>
            <button
              onClick={handleLogout}
              title="Cerrar sesion"
              className="mx-auto flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 text-slate-500 transition-all duration-300 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
            >
              <ArrowRightOnRectangleIcon className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="rounded-[28px] border border-white/70 bg-white/85 p-4 shadow-[0_20px_45px_rgba(148,163,184,0.18)] backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-blue-700 text-sm font-semibold text-white shadow-lg">
                {userInitials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-950">{user?.nombre}</p>
                <p className="truncate text-xs uppercase tracking-[0.18em] text-slate-400">
                  {USER_ROLES[user?.rol]?.label || 'Usuario'}
                </p>
              </div>
              <button
                onClick={handleLogout}
                title="Cerrar sesion"
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 text-slate-500 transition-all duration-300 hover:-translate-y-0.5 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
              >
                <ArrowRightOnRectangleIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(191,219,254,0.32),_transparent_32%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)]">
      <aside
        className={`relative hidden flex-shrink-0 border-r border-white/60 bg-slate-50/75 backdrop-blur-xl transition-all duration-300 lg:flex ${
          collapsed ? 'w-[104px]' : 'w-[312px]'
        }`}
      >
        <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-white to-transparent" />
        <SidebarContent />
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-white/70 bg-white text-slate-500 shadow-[0_12px_28px_rgba(15,23,42,0.12)] transition-all duration-300 hover:-translate-y-0.5 hover:text-slate-900"
          title={collapsed ? 'Expandir menu' : 'Compactar menu'}
        >
          {collapsed ? <ChevronRightIcon className="h-4 w-4" /> : <ChevronLeftIcon className="h-4 w-4" />}
        </button>
      </aside>

      <div className={`fixed inset-0 z-40 transition-all duration-300 lg:hidden ${sidebarOpen ? 'visible' : 'invisible'}`}>
        <div
          className={`absolute inset-0 bg-slate-950/35 backdrop-blur-sm transition-opacity duration-300 ${
            sidebarOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={() => setSidebarOpen(false)}
        />
        <aside
          className={`relative z-50 flex h-full w-[min(86vw,320px)] flex-col bg-slate-50/95 shadow-2xl backdrop-blur-xl transition-transform duration-300 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <button
            onClick={() => setSidebarOpen(false)}
            className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-2xl border border-white/70 bg-white/80 text-slate-500 shadow-lg transition-colors hover:text-slate-900"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
          <SidebarContent isMobile={true} />
        </aside>
      </div>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="border-b border-white/60 bg-white/80 px-4 py-3 shadow-sm backdrop-blur-xl lg:hidden">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/70 bg-slate-50 text-slate-600 transition-colors hover:text-slate-950"
            >
              <Bars3Icon className="h-5 w-5" />
            </button>
            <div className="flex min-w-0 flex-col items-start gap-1">
              <img src={previtaLogo} alt="Previta" className="h-7 w-auto object-contain" />
              <p className="truncate text-base font-semibold tracking-tight text-slate-950">AthenaSys</p>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div key={location.pathname} className="p-6 animate-fadeIn">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
