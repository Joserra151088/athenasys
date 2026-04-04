import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  HomeIcon, ComputerDesktopIcon, UsersIcon, BuildingOfficeIcon,
  ArrowsRightLeftIcon, DocumentTextIcon, ClipboardDocumentListIcon,
  FolderOpenIcon, WrenchScrewdriverIcon, CalculatorIcon, MapIcon,
  UserCircleIcon, ShieldCheckIcon, TruckIcon, Bars3Icon, XMarkIcon,
  ChevronDownIcon, ArrowRightOnRectangleIcon, KeyIcon,
  CurrencyDollarIcon, ChartBarIcon, TagIcon, BookOpenIcon,
  ChevronLeftIcon, ChevronRightIcon
} from '@heroicons/react/24/outline'
import { USER_ROLES } from '../utils/constants'

const navItems = [
  { path: '/', label: 'Dashboard', icon: HomeIcon, exact: true },
  { path: '/dispositivos', label: 'Dispositivos', icon: ComputerDesktopIcon },
  { path: '/asignaciones', label: 'Asignaciones', icon: ArrowsRightLeftIcon },
  {
    label: 'Registros', icon: UsersIcon, children: [
      { path: '/empleados', label: 'Empleados', icon: UsersIcon },
      { path: '/sucursales', label: 'Sucursales', icon: BuildingOfficeIcon },
      { path: '/proveedores', label: 'Proveedores', icon: TruckIcon }
    ]
  },
  { path: '/expedientes', label: 'Expedientes', icon: FolderOpenIcon },
  { path: '/documentos', label: 'Documentos', icon: DocumentTextIcon },
  { path: '/plantillas', label: 'Plantillas', icon: ClipboardDocumentListIcon },
  { path: '/cambios', label: 'Cambios de Equipo', icon: WrenchScrewdriverIcon },
  { path: '/licencias', label: 'Licencias', icon: KeyIcon },
  { path: '/cotizaciones', label: 'Cotizaciones', icon: CalculatorIcon },
  {
    label: 'Finanzas', icon: CurrencyDollarIcon, children: [
      { path: '/finanzas', label: 'Presupuesto & Gastos', icon: CurrencyDollarIcon },
      { path: '/centros-costo', label: 'Centros de Costo', icon: TagIcon },
      { path: '/tarifas', label: 'Tarifas de Equipo', icon: CalculatorIcon },
    ]
  },
  { path: '/reportes', label: 'Reportes', icon: ChartBarIcon },
  { path: '/mapa', label: 'Mapa', icon: MapIcon },
  { path: '/catalogos', label: 'Catálogos', icon: BookOpenIcon, roles: ['super_admin', 'agente_soporte'] },
  { path: '/usuarios-sistema', label: 'Usuarios', icon: UserCircleIcon, roles: ['super_admin'] },
  { path: '/auditoria', label: 'Auditoría', icon: ShieldCheckIcon, roles: ['super_admin'] }
]

function NavItem({ item, onClick, collapsed }) {
  const [open, setOpen] = useState(false)
  const { hasRole } = useAuth()
  const location = useLocation()

  const isChildActive = item.children?.some(c => location.pathname.startsWith(c.path))

  useEffect(() => {
    if (isChildActive) setOpen(true)
  }, [isChildActive])

  if (item.roles && !hasRole(...item.roles)) return null

  if (item.children) {
    if (collapsed) {
      return (
        <div className="relative group">
          <div className={`flex items-center justify-center w-10 h-10 mx-auto rounded-lg cursor-pointer transition-all duration-200
            ${isChildActive ? 'bg-primary-50 text-primary-700' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}>
            <item.icon className="h-5 w-5 flex-shrink-0" />
          </div>
          {/* Tooltip con hijos */}
          <div className="absolute left-full top-0 ml-2 z-50 hidden group-hover:block">
            <div className="bg-white border border-gray-200 rounded-xl shadow-xl py-2 min-w-[180px]">
              <p className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">{item.label}</p>
              {item.children.map(child => (
                <NavLink
                  key={child.path}
                  to={child.path}
                  onClick={onClick}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                      isActive ? 'text-primary-700 font-medium bg-primary-50' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`
                  }
                >
                  <child.icon className="h-4 w-4" />
                  {child.label}
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      )
    }

    return (
      <div>
        <button
          onClick={() => setOpen(!open)}
          className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200
            ${isChildActive ? 'text-primary-700 bg-primary-50' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
        >
          <span className="flex items-center gap-3">
            <item.icon className="h-5 w-5 flex-shrink-0" />
            <span className="transition-opacity duration-200">{item.label}</span>
          </span>
          <ChevronDownIcon className={`h-4 w-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </button>
        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${open ? 'max-h-60 opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="ml-4 mt-1 space-y-0.5 border-l-2 border-gray-200 pl-3 pb-1">
            {item.children.map(child => (
              <NavItem key={child.path} item={child} onClick={onClick} collapsed={false} />
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
            `flex items-center justify-center w-10 h-10 mx-auto rounded-lg transition-all duration-200 ${
              isActive ? 'bg-primary-50 text-primary-700' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
            }`
          }
        >
          <item.icon className="h-5 w-5 flex-shrink-0" />
        </NavLink>
        {/* Tooltip */}
        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50 hidden group-hover:block pointer-events-none">
          <div className="bg-gray-900 text-white text-xs rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-lg">
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
        `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
          isActive
            ? 'bg-primary-50 text-primary-700 font-medium shadow-sm'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`
      }
    >
      <item.icon className="h-5 w-5 flex-shrink-0" />
      <span className="transition-opacity duration-200">{item.label}</span>
    </NavLink>
  )
}

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const SidebarContent = ({ isMobile = false }) => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={`flex items-center border-b border-gray-200 transition-all duration-300
        ${collapsed && !isMobile ? 'justify-center px-2 py-5' : 'gap-3 px-4 py-5'}`}>
        <div className="h-9 w-9 bg-primary-600 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
          <ComputerDesktopIcon className="h-5 w-5 text-white" />
        </div>
        {(!collapsed || isMobile) && (
          <div className="overflow-hidden transition-all duration-300">
            <div className="font-bold text-gray-900 text-sm whitespace-nowrap">AthenaSys</div>
            <div className="text-xs text-gray-500 whitespace-nowrap">Inventario de Dispositivos</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className={`flex-1 overflow-y-auto py-4 space-y-0.5 transition-all duration-300
        ${collapsed && !isMobile ? 'px-1' : 'px-3'}`}>
        {navItems.map((item, i) => (
          <NavItem
            key={item.path || i}
            item={item}
            onClick={() => setSidebarOpen(false)}
            collapsed={collapsed && !isMobile}
          />
        ))}
      </nav>

      {/* User */}
      <div className="border-t border-gray-200 py-3 transition-all duration-300">
        {collapsed && !isMobile ? (
          <div className="flex flex-col items-center gap-2 px-1">
            <div className="h-8 w-8 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-semibold text-sm">
              {user?.nombre?.charAt(0)?.toUpperCase()}
            </div>
            <button onClick={handleLogout} title="Cerrar sesión" className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded-lg hover:bg-red-50">
              <ArrowRightOnRectangleIcon className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="px-3">
            <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="h-8 w-8 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-semibold text-sm flex-shrink-0">
                {user?.nombre?.charAt(0)?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">{user?.nombre}</div>
                <div className="text-xs text-gray-500">{USER_ROLES[user?.rol]?.label}</div>
              </div>
              <button onClick={handleLogout} title="Cerrar sesión" className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded-lg hover:bg-red-50">
                <ArrowRightOnRectangleIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">

      {/* Sidebar desktop */}
      <aside className={`hidden lg:flex flex-col bg-white border-r border-gray-200 flex-shrink-0 relative
        transition-all duration-300 ease-in-out ${collapsed ? 'w-16' : 'w-64'}`}>
        <SidebarContent />
        {/* Botón colapsar */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 z-10 h-6 w-6 rounded-full bg-white border border-gray-200 shadow-md
            flex items-center justify-center text-gray-500 hover:text-primary-600 hover:border-primary-300
            transition-all duration-200 hover:scale-110"
          title={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
        >
          {collapsed
            ? <ChevronRightIcon className="h-3.5 w-3.5" />
            : <ChevronLeftIcon className="h-3.5 w-3.5" />
          }
        </button>
      </aside>

      {/* Sidebar mobile overlay */}
      <div className={`fixed inset-0 z-40 lg:hidden transition-all duration-300 ${sidebarOpen ? 'visible' : 'invisible'}`}>
        <div
          className={`absolute inset-0 bg-black transition-opacity duration-300 ${sidebarOpen ? 'opacity-50' : 'opacity-0'}`}
          onClick={() => setSidebarOpen(false)}
        />
        <aside className={`relative z-50 flex flex-col w-64 h-full bg-white shadow-2xl
          transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="absolute top-4 right-4">
            <button onClick={() => setSidebarOpen(false)} className="p-1.5 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors">
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
          <SidebarContent isMobile={true} />
        </aside>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar mobile */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 shadow-sm">
          <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors">
            <Bars3Icon className="h-5 w-5" />
          </button>
          <div className="font-bold text-gray-900">AthenaSys</div>
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
