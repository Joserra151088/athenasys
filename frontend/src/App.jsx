import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { NotificationProvider } from './context/NotificationContext'
import Layout from './components/Layout'

const Login = lazy(() => import('./pages/Login'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Dispositivos = lazy(() => import('./pages/Dispositivos'))
const Empleados = lazy(() => import('./pages/Empleados'))
const Sucursales = lazy(() => import('./pages/Sucursales'))
const Asignaciones = lazy(() => import('./pages/Asignaciones'))
const Documentos = lazy(() => import('./pages/Documentos'))
const Plantillas = lazy(() => import('./pages/Plantillas'))
const Expedientes = lazy(() => import('./pages/Expedientes'))
const Cambios = lazy(() => import('./pages/Cambios'))
const Cotizaciones = lazy(() => import('./pages/Cotizaciones'))
const MapaInteractivo = lazy(() => import('./pages/MapaInteractivo'))
const PlanoOficina = lazy(() => import('./pages/PlanoOficina'))
const UsuariosSistema = lazy(() => import('./pages/UsuariosSistema'))
const Auditoria = lazy(() => import('./pages/Auditoria'))
const Proveedores = lazy(() => import('./pages/Proveedores'))
const Licencias = lazy(() => import('./pages/Licencias'))
const Dominios = lazy(() => import('./pages/Dominios'))
const CentrosCosto = lazy(() => import('./pages/CentrosCosto'))
const Finanzas = lazy(() => import('./pages/Finanzas'))
const Tarifas = lazy(() => import('./pages/Tarifas'))
const Reportes = lazy(() => import('./pages/Reportes'))
const Catalogos = lazy(() => import('./pages/Catalogos'))
const FirmaOnline = lazy(() => import('./pages/FirmaOnline'))

function RouteLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-slate-600 shadow-sm">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
        <span className="text-sm font-medium">Cargando modulo...</span>
      </div>
    </div>
  )
}

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary-600 border-t-transparent" />
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.rol)) return <Navigate to="/" replace />
  return children
}

function AppRoutes() {
  const { user } = useAuth()
  return (
    <Suspense fallback={<RouteLoader />}>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="dispositivos" element={<Dispositivos />} />
          <Route path="empleados" element={<Empleados />} />
          <Route path="sucursales" element={<Sucursales />} />
          <Route path="asignaciones" element={<Asignaciones />} />
          <Route path="documentos" element={<Documentos />} />
          <Route path="plantillas" element={<ProtectedRoute roles={['super_admin', 'agente_soporte']}><Plantillas /></ProtectedRoute>} />
          <Route path="expedientes" element={<Expedientes />} />
          <Route path="cambios" element={<Cambios />} />
          <Route path="cotizaciones" element={<Cotizaciones />} />
          <Route path="mapa" element={<MapaInteractivo />} />
          <Route path="plano-oficina" element={<PlanoOficina />} />
          <Route path="proveedores" element={<Proveedores />} />
          <Route path="licencias" element={<Licencias />} />
          <Route path="dominios" element={<Dominios />} />
          <Route path="centros-costo" element={<CentrosCosto />} />
          <Route path="finanzas" element={<Finanzas />} />
          <Route path="tarifas" element={<Tarifas />} />
          <Route path="reportes" element={<Reportes />} />
          <Route path="catalogos" element={<ProtectedRoute roles={['super_admin','agente_soporte']}><Catalogos /></ProtectedRoute>} />
          <Route path="usuarios-sistema" element={<ProtectedRoute roles={['super_admin', 'agente_soporte']}><UsuariosSistema /></ProtectedRoute>} />
          <Route path="auditoria" element={<ProtectedRoute roles={['super_admin']}><Auditoria /></ProtectedRoute>} />
        </Route>
        <Route path="/firmar/:token" element={<FirmaOnline />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </NotificationProvider>
    </AuthProvider>
  )
}
