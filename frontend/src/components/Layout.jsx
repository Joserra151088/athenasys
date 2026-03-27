import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  HomeIcon, ComputerDesktopIcon, UsersIcon, BuildingOfficeIcon,
  ArrowsRightLeftIcon, DocumentTextIcon, ClipboardDocumentListIcon,
  FolderOpenIcon, WrenchScrewdriverIcon, CalculatorIcon, MapIcon,
  UserCircleIcon, ShieldCheckIcon, TruckIcon, Bars3Icon, XMarkIcon,
  ChevronDownIcon, ArrowRightOnRectangleIcon, KeyIcon,
  CurrencyDollarIcon, ChartBarIcon, TagIcon, BookOpenIcon
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

function NavItem({ item, onClick }) {
  const [open, setOpen] = useState(false)
  const { hasRole } = useAuth()

  if (item.roles && !hasRole(...item.roles)) return null

  if (item.children) {
    return (
      <div>
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
        >
          <span className="flex items-center gap-3">
            <item.icon className="h-5 w-5 flex-shrink-0" />
            {item.label}
          </span>
          <ChevronDownIcon className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <div className="ml-4 mt-1 space-y-1 border-l-2 border-gray-200 pl-3">
            {item.children.map(child => (
              <NavItem key={child.path} item={child} onClick={onClick} />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <NavLink
      to={item.path}
      end={item.exact}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
          isActive
            ? 'bg-primary-50 text-primary-700 font-medium'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`
      }
    >
      <item.icon className="h-5 w-5 flex-shrink-0" />
      {item.label}
    </NavLink>
  )
}

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-gray-200">
        <div className="h-9 w-9 bg-primary-600 rounded-lg flex items-center justify-center">
          <ComputerDesktopIcon className="h-5 w-5 text-white" />
        </div>
        <div>
          <div className="font-bold text-gray-900 text-sm">AthenaSys</div>
          <div className="text-xs text-gray-500">Inventario de Dispositivos</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map((item, i) => (
          <NavItem key={item.path || i} item={item} onClick={() => setSidebarOpen(false)} />
        ))}
      </nav>

      {/* User */}
      <div className="border-t border-gray-200 px-3 py-4">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-50">
          <div className="h-8 w-8 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-semibold text-sm">
            {user?.nombre?.charAt(0)?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900 truncate">{user?.nombre}</div>
            <div className="text-xs text-gray-500">{USER_ROLES[user?.rol]?.label}</div>
          </div>
          <button onClick={handleLogout} title="Cerrar sesión" className="text-gray-400 hover:text-red-500 transition-colors">
            <ArrowRightOnRectangleIcon className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-gray-200 flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* Sidebar mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="relative z-50 flex flex-col w-64 h-full bg-white">
            <div className="absolute top-4 right-4">
              <button onClick={() => setSidebarOpen(false)} className="p-1 rounded text-gray-500 hover:text-gray-700">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar mobile */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200">
          <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100">
            <Bars3Icon className="h-5 w-5" />
          </button>
          <div className="font-bold text-gray-900">AthenaSys</div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
