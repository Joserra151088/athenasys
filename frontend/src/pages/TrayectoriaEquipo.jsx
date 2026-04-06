import { useState, useRef, useCallback, useEffect } from 'react'
import { deviceAPI, empleadoAPI } from '../utils/api'
import { MagnifyingGlassIcon, ComputerDesktopIcon, ArrowPathIcon, ClockIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

// ─── Colores y etiquetas por tipo de nodo ────────────────────────────────────
const NODE_CONFIG = {
  ingreso:   { bg: 'bg-blue-100',   border: 'border-blue-400',   text: 'text-blue-800',   label: 'Ingreso',   dot: '#3b82f6' },
  asignacion:{ bg: 'bg-green-100',  border: 'border-green-400',  text: 'text-green-800',  label: 'Asignación',dot: '#22c55e' },
  retorno:   { bg: 'bg-gray-100',   border: 'border-gray-400',   text: 'text-gray-700',   label: 'Retorno',   dot: '#6b7280' },
  pendiente: { bg: 'bg-yellow-100', border: 'border-yellow-400', text: 'text-yellow-800', label: 'Pendiente', dot: '#eab308' },
}

// ─── Icono SVG de monitor de computadora ─────────────────────────────────────
function IconoPC({ color = '#4b5563' }) {
  return (
    <svg viewBox="0 0 64 64" className="w-12 h-12 mx-auto" fill="none">
      <rect x="6" y="8" width="52" height="36" rx="3" fill={color} opacity="0.15" stroke={color} strokeWidth="2.5"/>
      <line x1="32" y1="44" x2="32" y2="54" stroke={color} strokeWidth="2.5"/>
      <line x1="20" y1="54" x2="44" y2="54" stroke={color} strokeWidth="2.5"/>
      <circle cx="32" cy="26" r="2" fill={color}/>
    </svg>
  )
}

// ─── Nodo individual arrastrable ─────────────────────────────────────────────
function Nodo({ nodo, pos, onDragStart, index }) {
  const cfg = NODE_CONFIG[nodo.tipo] || NODE_CONFIG.asignacion
  const fecha = nodo.fecha ? format(new Date(nodo.fecha), 'dd/MM/yyyy', { locale: es }) : ''

  return (
    <div
      className="absolute select-none cursor-grab active:cursor-grabbing"
      style={{ left: pos.x, top: pos.y, width: 160, transform: 'translate(-50%, -50%)' }}
      onMouseDown={(e) => onDragStart(e, index)}
    >
      {/* Etiqueta superior */}
      <div className={`text-center text-xs font-medium mb-1 leading-tight px-1 py-0.5 rounded ${cfg.bg} ${cfg.text} border ${cfg.border} shadow-sm`}>
        <div className="font-semibold">{nodo.titulo}</div>
        {nodo.descripcion && <div className="opacity-80 mt-0.5">{nodo.descripcion}</div>}
        {fecha && <div className="font-mono mt-0.5">{fecha}</div>}
      </div>
      {/* Icono PC */}
      <IconoPC color={cfg.dot} />
    </div>
  )
}

// ─── Flecha SVG entre dos puntos ─────────────────────────────────────────────
function Flecha({ from, to }) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len < 2) return null

  // Offset para que la flecha salga del borde del nodo (aprox 30px)
  const ox = (dx / len) * 30
  const oy = (dy / len) * 30
  const x1 = from.x + ox
  const y1 = from.y + oy
  const x2 = to.x - ox
  const y2 = to.y - oy

  return (
    <line
      x1={x1} y1={y1} x2={x2} y2={y2}
      stroke="#9ca3af" strokeWidth="1.5"
      markerEnd="url(#arrowhead)"
    />
  )
}

// ─── Canvas con rejilla y flechas ─────────────────────────────────────────────
function Canvas({ nodos, posiciones, onDragStart }) {
  const canvasRef = useRef(null)
  const [size, setSize] = useState({ w: 1200, h: 600 })

  useEffect(() => {
    if (!canvasRef.current) return
    const { offsetWidth, offsetHeight } = canvasRef.current
    setSize({ w: offsetWidth, h: offsetHeight })
  }, [nodos])

  return (
    <div ref={canvasRef} className="relative w-full h-full overflow-hidden bg-white"
      style={{ backgroundImage: 'radial-gradient(circle, #d1d5db 1px, transparent 1px)', backgroundSize: '28px 28px' }}>
      {/* SVG de flechas */}
      <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%">
        <defs>
          <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#9ca3af" />
          </marker>
        </defs>
        {posiciones.map((pos, i) => {
          if (i === 0) return null
          const prev = posiciones[i - 1]
          return <Flecha key={i} from={prev} to={pos} />
        })}
      </svg>

      {/* Nodos */}
      {nodos.map((nodo, i) => (
        <Nodo key={i} index={i} nodo={nodo} pos={posiciones[i]} onDragStart={onDragStart} />
      ))}
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function TrayectoriaEquipo() {
  const [modo, setModo] = useState('serie') // 'serie' | 'empleado'
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Para modo serie: un solo resultado
  const [dispositivo, setDispositivo] = useState(null)
  const [nodos, setNodos] = useState([])

  // Para modo empleado: múltiples empleados
  const [resultadosEmpleado, setResultadosEmpleado] = useState([])
  const [empleadoSeleccionado, setEmpleadoSeleccionado] = useState(null)

  // Posiciones de los nodos en el canvas
  const [posiciones, setPosiciones] = useState([])

  // Drag state
  const dragging = useRef(null)
  const canvasRef = useRef(null)

  // ─── Calcular posiciones iniciales en cascada horizontal ──────────────────
  const calcularPosiciones = useCallback((cantidad) => {
    const startX = 140
    const stepX = 200
    const baseY = 280
    const altY = 160
    return Array.from({ length: cantidad }, (_, i) => ({
      x: startX + i * stepX,
      y: i % 2 === 0 ? baseY : altY
    }))
  }, [])

  // ─── Búsqueda ──────────────────────────────────────────────────────────────
  const buscar = async () => {
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    setNodos([])
    setDispositivo(null)
    setResultadosEmpleado([])
    setEmpleadoSeleccionado(null)

    try {
      if (modo === 'serie') {
        const res = await deviceAPI.getTrayectoria(query.trim())
        setDispositivo(res.dispositivo)
        setNodos(res.nodos)
        setPosiciones(calcularPosiciones(res.nodos.length))
      } else {
        const res = await empleadoAPI.getTrayectoria(query.trim())
        setResultadosEmpleado(res)
        if (res.length === 1) {
          setEmpleadoSeleccionado(res[0])
          setNodos(res[0].nodos)
          setPosiciones(calcularPosiciones(res[0].nodos.length))
        }
      }
    } catch (err) {
      setError(err?.message || 'No se encontraron resultados')
    } finally {
      setLoading(false)
    }
  }

  const seleccionarEmpleado = (resultado) => {
    setEmpleadoSeleccionado(resultado)
    setNodos(resultado.nodos)
    setPosiciones(calcularPosiciones(resultado.nodos.length))
  }

  // ─── Drag & Drop de nodos ──────────────────────────────────────────────────
  const onDragStart = useCallback((e, index) => {
    e.preventDefault()
    dragging.current = { index, startX: e.clientX, startY: e.clientY, origPos: { ...posiciones[index] } }

    const onMouseMove = (ev) => {
      if (!dragging.current) return
      const { index: idx, startX, startY, origPos } = dragging.current
      setPosiciones(prev => {
        const next = [...prev]
        next[idx] = { x: origPos.x + ev.clientX - startX, y: origPos.y + ev.clientY - startY }
        return next
      })
    }

    const onMouseUp = () => {
      dragging.current = null
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }, [posiciones])

  const resetPosiciones = () => setPosiciones(calcularPosiciones(nodos.length))

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full gap-4">
      {/* Barra de búsqueda */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          {/* Toggle modo */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden shrink-0">
            <button
              onClick={() => { setModo('serie'); setQuery(''); setNodos([]); setResultadosEmpleado([]) }}
              className={`px-4 py-2 text-sm font-medium transition-colors ${modo === 'serie' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              Por número de serie
            </button>
            <button
              onClick={() => { setModo('empleado'); setQuery(''); setNodos([]); setDispositivo(null) }}
              className={`px-4 py-2 text-sm font-medium transition-colors ${modo === 'empleado' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              Por empleado
            </button>
          </div>

          {/* Input */}
          <div className="flex flex-1 gap-2 w-full">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                className="input pl-9 w-full"
                placeholder={modo === 'serie' ? 'Ingresa el número de serie del equipo...' : 'Nombre o número de empleado...'}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && buscar()}
              />
            </div>
            <button className="btn-primary px-5" onClick={buscar} disabled={loading}>
              {loading ? 'Buscando...' : 'Buscar'}
            </button>
            {nodos.length > 0 && (
              <button className="btn-secondary px-3" onClick={resetPosiciones} title="Restablecer posiciones">
                <ArrowPathIcon className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Info del dispositivo encontrado */}
        {dispositivo && (
          <div className="mt-3 flex flex-wrap gap-4 text-sm bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
            <span><span className="font-medium text-blue-700">Tipo:</span> {dispositivo.tipo} — {dispositivo.marca}</span>
            <span><span className="font-medium text-blue-700">Modelo:</span> {dispositivo.modelo}</span>
            <span><span className="font-medium text-blue-700">Serie:</span> <span className="font-mono">{dispositivo.serie}</span></span>
            <span><span className="font-medium text-blue-700">Estado actual:</span>
              <span className={`ml-1 font-semibold ${dispositivo.estado === 'activo' ? 'text-green-600' : dispositivo.estado === 'pendiente' ? 'text-yellow-600' : 'text-gray-600'}`}>
                {dispositivo.estado}
              </span>
            </span>
          </div>
        )}

        {/* Selector de empleado si hay múltiples resultados */}
        {resultadosEmpleado.length > 1 && (
          <div className="mt-3">
            <p className="text-sm text-gray-500 mb-2">Se encontraron {resultadosEmpleado.length} empleados. Selecciona uno:</p>
            <div className="flex flex-wrap gap-2">
              {resultadosEmpleado.map((r, i) => (
                <button key={i}
                  onClick={() => seleccionarEmpleado(r)}
                  className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${empleadoSeleccionado?.empleado?.id === r.empleado.id ? 'bg-primary-600 text-white border-primary-600' : 'bg-white border-gray-200 hover:border-primary-400'}`}
                >
                  {r.empleado.nombre_completo} <span className="opacity-60">({r.empleado.num_empleado})</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Info del empleado seleccionado */}
        {empleadoSeleccionado && (
          <div className="mt-3 flex flex-wrap gap-4 text-sm bg-green-50 border border-green-200 rounded-lg px-4 py-2">
            <span><span className="font-medium text-green-700">Empleado:</span> {empleadoSeleccionado.empleado.nombre_completo}</span>
            <span><span className="font-medium text-green-700">Núm:</span> {empleadoSeleccionado.empleado.num_empleado}</span>
            <span><span className="font-medium text-green-700">Área:</span> {empleadoSeleccionado.empleado.area || '—'}</span>
            <span><span className="font-medium text-green-700">Equipos registrados:</span> {nodos.filter(n => n.tipo === 'asignacion').length}</span>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="card p-4 flex items-center gap-3 text-red-600 bg-red-50 border border-red-200">
          <ExclamationTriangleIcon className="h-5 w-5 shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Canvas */}
      {nodos.length > 0 && (
        <div className="card flex-1 overflow-hidden p-0" style={{ minHeight: 420 }}>
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <ClockIcon className="h-4 w-4" />
              <span>{nodos.length} eventos · Arrastra los nodos para reorganizar</span>
            </div>
            {/* Leyenda */}
            <div className="flex items-center gap-3">
              {Object.entries(NODE_CONFIG).map(([tipo, cfg]) => (
                <div key={tipo} className="flex items-center gap-1 text-xs text-gray-500">
                  <div className={`w-3 h-3 rounded-full border-2`} style={{ borderColor: cfg.dot, backgroundColor: cfg.dot + '33' }} />
                  {cfg.label}
                </div>
              ))}
            </div>
          </div>
          <div ref={canvasRef} className="w-full" style={{ height: 480 }}>
            <Canvas nodos={nodos} posiciones={posiciones} onDragStart={onDragStart} />
          </div>
        </div>
      )}

      {/* Estado vacío */}
      {!loading && nodos.length === 0 && !error && (
        <div className="card flex-1 flex flex-col items-center justify-center text-gray-400 gap-3" style={{ minHeight: 300 }}>
          <ComputerDesktopIcon className="h-16 w-16 opacity-30" />
          <p className="text-sm">Busca un número de serie o nombre de empleado para ver su trayectoria</p>
        </div>
      )}
    </div>
  )
}
