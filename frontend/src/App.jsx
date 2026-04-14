import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { NotificationProvider } from './context/NotificationContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Dispositivos from './pages/Dispositivos'
import Empleados from './pages/Empleados'
import Sucursales from './pages/Sucursales'
import Asignaciones from './pages/Asignaciones'
import Documentos from './pages/Documentos'
import Plantillas from './pages/Plantillas'
import Expedientes from './pages/Expedientes'
import Cambios from './pages/Cambios'
import Cotizaciones from './pages/Cotizaciones'
import MapaInteractivo from './pages/MapaInteractivo'
import UsuariosSistema from './pages/UsuariosSistema'
import Auditoria from './pages/Auditoria'
import Proveedores from './pages/Proveedores'
import Licencias from './pages/Licencias'
import CentrosCosto from './pages/CentrosCosto'
import Finanzas from './pages/Finanzas'
import Tarifas from './pages/Tarifas'
import Reportes from './pages/Reportes'
import Catalogos from './pages/Catalogos'
import FirmaOnline from './pages/FirmaOnline'

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
        <Route path="proveedores" element={<Proveedores />} />
        <Route path="licencias" element={<Licencias />} />
        <Route path="centros-costo" element={<CentrosCosto />} />
        <Route path="finanzas" element={<Finanzas />} />
        <Route path="tarifas" element={<Tarifas />} />
        <Route path="reportes" element={<Reportes />} />
        <Route path="catalogos" element={<ProtectedRoute roles={['super_admin','agente_soporte']}><Catalogos /></ProtectedRoute>} />
        <Route path="usuarios-sistema" element={<ProtectedRoute roles={['super_admin', 'agente_soporte']}><UsuariosSistema /></ProtectedRoute>} />
        <Route path="auditoria" element={<ProtectedRoute roles={['super_admin']}><Auditoria /></ProtectedRoute>} />
      </Route>
      {/* Ruta pública — sin autenticación requerida */}
      <Route path="/firmar/:token" element={<FirmaOnline />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
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
