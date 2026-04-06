import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ShieldCheckIcon, ComputerDesktopIcon } from '@heroicons/react/24/outline'

export default function Login() {
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(form.username, form.password)
      navigate('/')
    } catch (err) {
      setError(err?.message || 'Credenciales incorrectas')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Panel izquierdo — decorativo */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #10204a 0%, #1a3471 40%, #2d5ab0 100%)' }}>
        {/* Círculos decorativos */}
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #7a9ad6, transparent)' }} />
        <div className="absolute -bottom-32 -right-20 w-[500px] h-[500px] rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #4d77c5, transparent)' }} />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full opacity-5"
          style={{ background: 'radial-gradient(circle, white, transparent)' }} />

        {/* Contenido */}
        <div className="relative z-10 flex flex-col justify-center px-16 text-white">
          <div className="flex items-center gap-3 mb-12">
            <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.12)' }}>
              <ShieldCheckIcon className="h-7 w-7 text-white" />
            </div>
            <span className="text-2xl font-bold tracking-wide">AthenaSys</span>
          </div>

          <h2 className="text-4xl font-bold leading-tight mb-4">
            Gestión inteligente<br />de activos TI
          </h2>
          <p className="text-blue-200 text-lg leading-relaxed mb-12">
            Control total de dispositivos, asignaciones y expedientes en un solo lugar.
          </p>

          {/* Feature badges */}
          <div className="space-y-3">
            {[
              { icon: '🖥️', text: 'Inventario de dispositivos en tiempo real' },
              { icon: '📄', text: 'Documentos y firmas digitales' },
              { icon: '📍', text: 'Trayectoria de equipos y usuarios' },
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.08)' }}>
                <span className="text-xl">{f.icon}</span>
                <span className="text-blue-100 text-sm">{f.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Panel derecho — formulario */}
      <div className="flex-1 flex flex-col justify-center items-center bg-gray-50 px-6 py-12">
        {/* Logo mobile */}
        <div className="lg:hidden flex items-center gap-3 mb-10">
          <div className="p-2.5 rounded-xl" style={{ background: '#1a3471' }}>
            <ComputerDesktopIcon className="h-6 w-6 text-white" />
          </div>
          <span className="text-2xl font-bold text-navy-900" style={{ color: '#10204a' }}>AthenaSys</span>
        </div>

        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
            {/* Encabezado */}
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-gray-900">Bienvenido de vuelta</h1>
              <p className="text-gray-500 text-sm mt-1">Ingresa tus credenciales para continuar</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Usuario</label>
                <input
                  type="text"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-all"
                  style={{ '--tw-ring-color': '#2d5ab0' }}
                  onFocus={e => e.target.style.boxShadow = '0 0 0 3px rgba(45,90,176,0.15)'}
                  onBlur={e => e.target.style.boxShadow = ''}
                  placeholder="nombre@empresa.com"
                  value={form.username}
                  onChange={e => setForm({ ...form, username: e.target.value })}
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Contraseña</label>
                <input
                  type="password"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none transition-all"
                  onFocus={e => e.target.style.boxShadow = '0 0 0 3px rgba(45,90,176,0.15)'}
                  onBlur={e => e.target.style.boxShadow = ''}
                  placeholder="••••••••••"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  required
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl border border-red-100">
                  <span className="text-red-400">⚠</span>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl text-white text-sm font-semibold transition-all duration-200 mt-2"
                style={{
                  background: loading ? '#7a9ad6' : 'linear-gradient(135deg, #1a3471, #2d5ab0)',
                  boxShadow: loading ? 'none' : '0 4px 15px rgba(45,90,176,0.35)',
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
                onMouseEnter={e => { if (!loading) e.target.style.transform = 'translateY(-1px)' }}
                onMouseLeave={e => { e.target.style.transform = '' }}
              >
                {loading ? (
                  <span className="flex items-center gap-2 justify-center">
                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Verificando...
                  </span>
                ) : 'Ingresar al sistema'}
              </button>
            </form>
          </div>

          <p className="text-center text-xs text-gray-400 mt-6">
            AthenaSys · Sistema de Gestión de Activos TI
          </p>
        </div>
      </div>
    </div>
  )
}
