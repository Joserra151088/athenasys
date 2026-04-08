import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { differenceInCalendarDays, format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  ArrowPathIcon,
  ArrowTrendingUpIcon,
  BuildingOffice2Icon,
  ClockIcon,
  ComputerDesktopIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  SparklesIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline'
import { deviceAPI, empleadoAPI } from '../utils/api'

const NODE_CONFIG = {
  ingreso: {
    label: 'Ingreso',
    accent: '#2563eb',
    glow: 'rgba(37, 99, 235, 0.18)',
    chip: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
    panel: 'from-blue-100/80 via-white to-slate-50',
    iconBg: 'bg-blue-100 text-blue-700',
    Icon: ArrowTrendingUpIcon,
  },
  asignacion: {
    label: 'Asignacion',
    accent: '#0f766e',
    glow: 'rgba(15, 118, 110, 0.18)',
    chip: 'bg-teal-50 text-teal-700 ring-1 ring-teal-200',
    panel: 'from-teal-100/80 via-white to-slate-50',
    iconBg: 'bg-teal-100 text-teal-700',
    Icon: UserCircleIcon,
  },
  retorno: {
    label: 'Retorno',
    accent: '#475569',
    glow: 'rgba(71, 85, 105, 0.18)',
    chip: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200',
    panel: 'from-slate-100/90 via-white to-slate-50',
    iconBg: 'bg-slate-200 text-slate-700',
    Icon: BuildingOffice2Icon,
  },
  pendiente: {
    label: 'Pendiente',
    accent: '#d97706',
    glow: 'rgba(217, 119, 6, 0.18)',
    chip: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
    panel: 'from-amber-100/80 via-white to-orange-50',
    iconBg: 'bg-amber-100 text-amber-700',
    Icon: ClockIcon,
  },
}

function formatDate(value) {
  if (!value) return ''
  return format(new Date(value), 'dd MMM yyyy', { locale: es })
}

function getDurationMeta(tipo, startDate, endDate) {
  if (!startDate) return null

  const start = new Date(startDate)
  const end = endDate ? new Date(endDate) : new Date()

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null

  const days = Math.max(0, differenceInCalendarDays(end, start))
  const durationText = days === 0 ? 'Menos de 1 dia' : `${days} ${days === 1 ? 'dia' : 'dias'}`

  const stateLabel = {
    ingreso: 'En stock',
    asignacion: 'Asignado',
    retorno: 'En almacen',
    pendiente: 'Pendiente',
  }[tipo] || 'Tiempo activo'

  return {
    label: stateLabel,
    durationText,
    caption: endDate ? `Hasta ${formatDate(endDate)}` : 'Hasta hoy',
  }
}

function EventCard({ nodo, pos, onDragStart, index, duration }) {
  const config = NODE_CONFIG[nodo.tipo] || NODE_CONFIG.asignacion
  const Icon = config.Icon
  const date = formatDate(nodo.fecha)

  return (
    <div
      className="absolute select-none"
      style={{ left: pos.x, top: pos.y, width: 230, transform: 'translate(-50%, -50%)' }}
      onMouseDown={event => onDragStart(event, index)}
    >
      <div
        className="group relative cursor-grab rounded-[28px] border border-white/70 bg-white/88 p-3 shadow-[0_24px_50px_rgba(15,23,42,0.12)] backdrop-blur active:cursor-grabbing"
        style={{ boxShadow: `0 24px 50px ${config.glow}` }}
      >
        <div className={`absolute inset-0 rounded-[28px] bg-gradient-to-br ${config.panel} opacity-90`} />
        <div className="absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent" />

        <div className="relative space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${config.iconBg} shadow-sm`}>
              <Icon className="h-5 w-5" />
            </div>
            <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${config.chip}`}>
              {config.label}
            </span>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-semibold leading-5 text-slate-900">{nodo.titulo}</p>
            <p className="min-h-[36px] text-xs leading-5 text-slate-500">{nodo.descripcion || 'Sin detalles adicionales registrados.'}</p>
          </div>

          {duration && (
            <div className="rounded-[22px] bg-slate-950 px-3.5 py-3 text-white shadow-[0_14px_28px_rgba(15,23,42,0.18)]">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-300">{duration.label}</span>
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/85">
                  {duration.caption}
                </span>
              </div>
              <div className="mt-2 flex items-end justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold tracking-tight">{duration.durationText}</p>
                  <p className="text-[11px] text-slate-300">Tiempo transcurrido en esta etapa</p>
                </div>
                <ClockIcon className="h-5 w-5 text-slate-300" />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between rounded-2xl bg-white/80 px-3 py-2 text-xs text-slate-500 ring-1 ring-slate-200/80">
            <span className="font-medium text-slate-600">Evento {index + 1}</span>
            <span className="font-semibold text-slate-800">{date || 'Sin fecha'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function Connector({ from, to, color }) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.sqrt(dx * dx + dy * dy)

  if (length < 2) return null

  const offsetX = (dx / length) * 92
  const offsetY = (dy / length) * 46
  const startX = from.x + offsetX
  const startY = from.y + offsetY
  const endX = to.x - offsetX
  const endY = to.y - offsetY
  const midX = (startX + endX) / 2

  return (
    <path
      d={`M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`}
      fill="none"
      stroke={color}
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeDasharray="7 10"
      opacity="0.58"
      markerEnd="url(#trajectory-arrow)"
    />
  )
}

function TrajectoryCanvas({ nodos, posiciones, onDragStart, durations }) {
  const canvasRef = useRef(null)
  const [, setSize] = useState({ w: 1200, h: 560 })

  useEffect(() => {
    if (!canvasRef.current) return
    const { offsetWidth, offsetHeight } = canvasRef.current
    setSize({ w: offsetWidth, h: offsetHeight })
  }, [nodos.length, posiciones.length])

  return (
    <div
      ref={canvasRef}
      className="relative h-full w-full overflow-hidden rounded-[30px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(241,245,249,0.9))] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]"
      style={{
        backgroundImage:
          'radial-gradient(circle at 1px 1px, rgba(148,163,184,0.22) 1.2px, transparent 0), linear-gradient(180deg, rgba(255,255,255,0.92), rgba(241,245,249,0.9))',
        backgroundSize: '28px 28px, 100% 100%',
      }}
    >
      <div className="pointer-events-none absolute inset-x-10 top-6 h-28 rounded-full bg-gradient-to-r from-blue-200/30 via-teal-100/15 to-transparent blur-3xl" />

      <svg className="pointer-events-none absolute inset-0 h-full w-full" width="100%" height="100%">
        <defs>
          <marker id="trajectory-arrow" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto">
            <path d="M0,0 L12,6 L0,12 Z" fill="#94a3b8" opacity="0.8" />
          </marker>
        </defs>

        {posiciones.map((position, index) => {
          if (index === 0) return null
          const previous = posiciones[index - 1]
          const currentConfig = NODE_CONFIG[nodos[index]?.tipo] || NODE_CONFIG.asignacion
          return <Connector key={`connector-${index}`} from={previous} to={position} color={currentConfig.accent} />
        })}
      </svg>

      {nodos.map((nodo, index) => (
        <EventCard
          key={`${nodo.tipo}-${nodo.fecha || index}-${index}`}
          duration={durations[index]}
          index={index}
          nodo={nodo}
          onDragStart={onDragStart}
          pos={posiciones[index]}
        />
      ))}
    </div>
  )
}

export default function TrayectoriaEquipo({ initialSerie = '', initialRequestKey = '' }) {
  const [modo, setModo] = useState('serie')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [dispositivo, setDispositivo] = useState(null)
  const [nodos, setNodos] = useState([])
  const [resultadosEmpleado, setResultadosEmpleado] = useState([])
  const [empleadoSeleccionado, setEmpleadoSeleccionado] = useState(null)
  const [posiciones, setPosiciones] = useState([])

  const dragging = useRef(null)

  const calcularPosiciones = useCallback(cantidad => {
    const startX = 170
    const stepX = 250
    const rows = [350, 200, 390, 240]

    return Array.from({ length: cantidad }, (_, index) => ({
      x: startX + index * stepX,
      y: rows[index % rows.length],
    }))
  }, [])

  const limpiarResultados = useCallback(() => {
    setNodos([])
    setDispositivo(null)
    setResultadosEmpleado([])
    setEmpleadoSeleccionado(null)
    setPosiciones([])
  }, [])

  const executeSearch = useCallback(async (searchMode, rawQuery) => {
    const normalizedQuery = rawQuery.trim()
    if (!normalizedQuery) return

    setLoading(true)
    setError(null)
    limpiarResultados()

    try {
      if (searchMode === 'serie') {
        const result = await deviceAPI.getTrayectoria(normalizedQuery)
        setDispositivo(result.dispositivo)
        setNodos(result.nodos)
        setPosiciones(calcularPosiciones(result.nodos.length))
      } else {
        const result = await empleadoAPI.getTrayectoria(normalizedQuery)
        setResultadosEmpleado(result)

        if (result.length === 1) {
          setEmpleadoSeleccionado(result[0])
          setNodos(result[0].nodos)
          setPosiciones(calcularPosiciones(result[0].nodos.length))
        }
      }
    } catch (err) {
      setError(err?.message || 'No se encontraron resultados para la trayectoria solicitada.')
    } finally {
      setLoading(false)
    }
  }, [calcularPosiciones, limpiarResultados])

  const buscar = useCallback(() => {
    executeSearch(modo, query)
  }, [executeSearch, modo, query])

  useEffect(() => {
    if (!initialSerie.trim()) return
    setModo('serie')
    setQuery(initialSerie)
    executeSearch('serie', initialSerie)
  }, [executeSearch, initialSerie, initialRequestKey])

  const seleccionarEmpleado = resultado => {
    setEmpleadoSeleccionado(resultado)
    setNodos(resultado.nodos)
    setPosiciones(calcularPosiciones(resultado.nodos.length))
  }

  const onDragStart = useCallback(
    (event, index) => {
      event.preventDefault()
      dragging.current = {
        index,
        startX: event.clientX,
        startY: event.clientY,
        originalPosition: { ...posiciones[index] },
      }

      const onMouseMove = moveEvent => {
        if (!dragging.current) return

        const { index: activeIndex, originalPosition, startX, startY } = dragging.current

        setPosiciones(previous => {
          const next = [...previous]
          next[activeIndex] = {
            x: originalPosition.x + moveEvent.clientX - startX,
            y: originalPosition.y + moveEvent.clientY - startY,
          }
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
    },
    [posiciones]
  )

  const resetPosiciones = () => {
    setPosiciones(calcularPosiciones(nodos.length))
  }

  const resumen = useMemo(() => {
    const counts = nodos.reduce(
      (accumulator, nodo) => {
        accumulator[nodo.tipo] = (accumulator[nodo.tipo] || 0) + 1
        return accumulator
      },
      { ingreso: 0, asignacion: 0, retorno: 0, pendiente: 0 }
    )

    return [
      {
        label: 'Eventos',
        value: nodos.length || 0,
        tone: 'bg-slate-900 text-white shadow-[0_18px_30px_rgba(15,23,42,0.16)]',
      },
      {
        label: 'Asignaciones',
        value: counts.asignacion || 0,
        tone: 'bg-teal-50 text-teal-700 ring-1 ring-teal-200',
      },
      {
        label: 'Pendientes',
        value: counts.pendiente || 0,
        tone: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
      },
    ]
  }, [nodos])

  const durations = useMemo(
    () =>
      nodos.map((nodo, index) => {
        const nextNode = nodos[index + 1]
        return getDurationMeta(nodo.tipo, nodo.fecha, nextNode?.fecha)
      }),
    [nodos]
  )

  const infoSerie = dispositivo
    ? [
        { label: 'Tipo', value: `${dispositivo.tipo} - ${dispositivo.marca}` },
        { label: 'Modelo', value: dispositivo.modelo || 'Sin modelo' },
        { label: 'Serie', value: dispositivo.serie || '-' },
        { label: 'Estado', value: dispositivo.estado || 'Sin estado' },
      ]
    : []

  const infoEmpleado = empleadoSeleccionado
    ? [
        { label: 'Empleado', value: empleadoSeleccionado.empleado.nombre_completo },
        { label: 'Numero', value: empleadoSeleccionado.empleado.num_empleado || '-' },
        { label: 'Area', value: empleadoSeleccionado.empleado.area || 'Sin area' },
        { label: 'Equipos', value: `${nodos.filter(nodo => nodo.tipo === 'asignacion').length}` },
      ]
    : []

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-[32px] border border-white/70 bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(30,64,175,0.88)_55%,rgba(13,148,136,0.66))] p-6 text-white shadow-[0_30px_70px_rgba(30,41,59,0.24)]">
        <div className="absolute -right-10 top-0 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute left-10 top-8 h-24 w-24 rounded-full bg-cyan-200/10 blur-2xl" />

        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-100 backdrop-blur">
              <SparklesIcon className="h-4 w-4" />
              Trayectoria de equipos
            </div>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight sm:text-[2rem]">Lectura visual mas clara del historial de cada equipo</h2>
              <p className="mt-2 max-w-xl text-sm leading-7 text-blue-50/78">
                Busca por numero de serie o por colaborador y revisa el recorrido completo con una vista mas refinada, cronologica y facil de interpretar.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {resumen.map(item => (
              <div
                key={item.label}
                className={`min-w-[120px] rounded-[24px] px-4 py-4 text-center backdrop-blur ${item.tone}`}
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] opacity-75">{item.label}</div>
                <div className="mt-2 text-2xl font-semibold tracking-tight">{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[30px] border border-slate-200/80 bg-white/85 p-4 shadow-[0_20px_50px_rgba(148,163,184,0.16)] backdrop-blur-xl sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="inline-flex rounded-[22px] border border-slate-200 bg-slate-50 p-1.5 shadow-inner">
            <button
              onClick={() => {
                setModo('serie')
                setQuery('')
                setError(null)
                limpiarResultados()
              }}
              className={`rounded-[18px] px-4 py-2.5 text-sm font-semibold transition-all duration-300 ${
                modo === 'serie'
                  ? 'bg-slate-900 text-white shadow-[0_14px_24px_rgba(15,23,42,0.16)]'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Buscar por serie
            </button>
            <button
              onClick={() => {
                setModo('empleado')
                setQuery('')
                setError(null)
                limpiarResultados()
              }}
              className={`rounded-[18px] px-4 py-2.5 text-sm font-semibold transition-all duration-300 ${
                modo === 'empleado'
                  ? 'bg-slate-900 text-white shadow-[0_14px_24px_rgba(15,23,42,0.16)]'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Buscar por empleado
            </button>
          </div>

          <div className="flex flex-1 flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                className="w-full rounded-[20px] border border-slate-200 bg-slate-50/70 py-3.5 pl-12 pr-4 text-sm text-slate-700 outline-none transition-all duration-300 placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:shadow-[0_0_0_4px_rgba(59,130,246,0.08)]"
                placeholder={
                  modo === 'serie'
                    ? 'Ingresa el numero de serie del equipo'
                    : 'Busca por nombre o numero de empleado'
                }
                value={query}
                onChange={event => setQuery(event.target.value)}
                onKeyDown={event => event.key === 'Enter' && buscar()}
              />
            </div>

            <div className="flex gap-3">
              <button
                className="rounded-[20px] bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_24px_rgba(15,23,42,0.16)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                onClick={buscar}
                disabled={loading}
              >
                {loading ? 'Buscando...' : 'Buscar'}
              </button>

              <button
                className="flex h-[52px] w-[52px] items-center justify-center rounded-[20px] border border-slate-200 bg-white text-slate-500 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={resetPosiciones}
                title="Reordenar trayectoria"
                disabled={!nodos.length}
              >
                <ArrowPathIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {infoSerie.length > 0 && (
          <div className="mt-4 grid gap-3 rounded-[26px] border border-blue-100 bg-gradient-to-r from-blue-50 via-white to-cyan-50 p-4 sm:grid-cols-2 xl:grid-cols-4">
            {infoSerie.map(item => (
              <div key={item.label} className="rounded-[20px] bg-white/85 px-4 py-3 shadow-sm ring-1 ring-blue-100/80">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-500">{item.label}</p>
                <p className="mt-2 text-sm font-semibold text-slate-800">{item.value}</p>
              </div>
            ))}
          </div>
        )}

        {resultadosEmpleado.length > 1 && (
          <div className="mt-4 rounded-[26px] border border-slate-200 bg-slate-50/80 p-4">
            <p className="text-sm font-medium text-slate-700">Se encontraron {resultadosEmpleado.length} resultados. Elige el perfil correcto:</p>
            <div className="mt-3 flex flex-wrap gap-2.5">
              {resultadosEmpleado.map(resultado => {
                const isActive = empleadoSeleccionado?.empleado?.id === resultado.empleado.id
                return (
                  <button
                    key={resultado.empleado.id}
                    onClick={() => seleccionarEmpleado(resultado)}
                    className={`rounded-[20px] px-4 py-2.5 text-left text-sm transition-all duration-300 ${
                      isActive
                        ? 'bg-slate-900 text-white shadow-[0_14px_24px_rgba(15,23,42,0.16)]'
                        : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:-translate-y-0.5 hover:text-slate-900'
                    }`}
                  >
                    <span className="block font-semibold">{resultado.empleado.nombre_completo}</span>
                    <span className="mt-1 block text-xs opacity-70">{resultado.empleado.num_empleado}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {infoEmpleado.length > 0 && (
          <div className="mt-4 grid gap-3 rounded-[26px] border border-teal-100 bg-gradient-to-r from-teal-50 via-white to-emerald-50 p-4 sm:grid-cols-2 xl:grid-cols-4">
            {infoEmpleado.map(item => (
              <div key={item.label} className="rounded-[20px] bg-white/85 px-4 py-3 shadow-sm ring-1 ring-teal-100/80">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-teal-600">{item.label}</p>
                <p className="mt-2 text-sm font-semibold text-slate-800">{item.value}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {error && (
        <div className="flex items-center gap-3 rounded-[26px] border border-rose-200 bg-rose-50 px-5 py-4 text-rose-700 shadow-sm">
          <ExclamationTriangleIcon className="h-5 w-5 shrink-0" />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      {nodos.length > 0 && (
        <section className="overflow-hidden rounded-[32px] border border-slate-200/80 bg-white/88 shadow-[0_24px_60px_rgba(148,163,184,0.16)] backdrop-blur-xl">
          <div className="flex flex-col gap-4 border-b border-slate-200/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.95),rgba(255,255,255,0.92))] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg">
                <ClockIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Lienzo cronologico</p>
                <p className="text-xs leading-5 text-slate-500">Arrastra las tarjetas si quieres reorganizar visualmente el flujo.</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {Object.entries(NODE_CONFIG).map(([key, config]) => {
                const Icon = config.Icon
                return (
                  <div
                    key={key}
                    className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-medium text-slate-600 ring-1 ring-slate-200 shadow-sm"
                  >
                    <span className={`flex h-7 w-7 items-center justify-center rounded-full ${config.iconBg}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    {config.label}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="p-4" style={{ minHeight: 560 }}>
            <div className="h-[560px]">
              <TrajectoryCanvas nodos={nodos} posiciones={posiciones} onDragStart={onDragStart} durations={durations} />
            </div>
          </div>
        </section>
      )}

      {!loading && nodos.length === 0 && !error && (
        <section className="overflow-hidden rounded-[32px] border border-slate-200/80 bg-white/88 p-10 text-center shadow-[0_24px_60px_rgba(148,163,184,0.16)] backdrop-blur-xl">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[28px] bg-gradient-to-br from-slate-900 via-blue-800 to-teal-600 text-white shadow-[0_18px_36px_rgba(15,23,42,0.2)]">
            <ComputerDesktopIcon className="h-10 w-10" />
          </div>
          <h3 className="mt-5 text-xl font-semibold tracking-tight text-slate-900">Busca un equipo para desplegar su historia</h3>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-500">
            La vista mostrara asignaciones, ingresos, retornos y pendientes en una composicion mas limpia para que ubicar cada cambio sea mucho mas sencillo.
          </p>
        </section>
      )}
    </div>
  )
}
