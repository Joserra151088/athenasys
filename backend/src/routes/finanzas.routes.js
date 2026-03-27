/**
 * Módulo Financiero — Análisis de gastos TI
 * Calcula costos de renta de equipos (por día) y licencias (mensual),
 * agrupados por centro de costo, sucursal, empleado o tipo de dispositivo.
 *
 * Lógica de paquete CPU:
 *   Cuando un CPU está asignado a un empleado, ese paquete cubre también
 *   Monitor, Teclado y Mouse del mismo empleado (no se cobran por separado).
 */
const express = require('express')
const router = express.Router()
const db = require('../data/db')
const { authMiddleware } = require('../middleware/auth.middleware')
const { differenceInDays, parseISO, startOfMonth, endOfMonth, format, isWithinInterval } = require('date-fns')

router.use(authMiddleware)

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Construye el mapa tipo → tarifa_dia */
function getTarifasMap() {
  const tarifas = db.get('tarifas_equipo').filter({ activo: true }).value()
  const map = {}
  for (const t of tarifas) {
    map[t.tipo] = t.costo_dia
    if (t.es_paquete && t.incluye) {
      for (const tipo of t.incluye) {
        if (tipo !== 'CPU') map[`_in_paquete_${tipo}`] = true
      }
    }
  }
  return map
}

/**
 * Calcula el costo de renta de las asignaciones activas en un período dado.
 * Aplica lógica de paquete CPU.
 */
function calcularGastosEquipos(fechaInicio, fechaFin) {
  const tarifas = db.get('tarifas_equipo').filter({ activo: true }).value()
  const tarifaMap = {}
  const paqueteCPU = tarifas.find(t => t.es_paquete && t.tipo === 'CPU')
  const paqueteIncluye = paqueteCPU?.incluye || ['CPU', 'Monitor', 'Teclado', 'Mouse']

  for (const t of tarifas) tarifaMap[t.tipo] = t

  const asignaciones = db.get('asignaciones').filter({ activo: true }).value()
  const dispositivos = db.get('dispositivos').value()
  const empleados = db.get('empleados').value()
  const sucursales = db.get('sucursales').value()

  // Detectar qué empleados tienen CPU asignado (para excluir monitor/teclado/mouse)
  const empleadosConCPU = new Set()
  for (const a of asignaciones) {
    const dev = dispositivos.find(d => d.id === a.dispositivo_id)
    if (dev?.tipo === 'CPU' && a.tipo_asignacion === 'empleado') {
      empleadosConCPU.add(a.asignado_a_id)
    }
  }

  const resultados = []
  const fi = parseISO(fechaInicio)
  const ff = parseISO(fechaFin)
  const diasPeriodo = differenceInDays(ff, fi) + 1

  for (const a of asignaciones) {
    const dev = dispositivos.find(d => d.id === a.dispositivo_id)
    if (!dev || !dev.activo) continue

    const tipoDisp = dev.tipo
    const tarifa = tarifaMap[tipoDisp]
    if (!tarifa) continue

    // Si es Monitor/Teclado/Mouse y el empleado tiene CPU → skip (ya incluido en paquete)
    if (
      a.tipo_asignacion === 'empleado' &&
      paqueteIncluye.includes(tipoDisp) &&
      tipoDisp !== 'CPU' &&
      empleadosConCPU.has(a.asignado_a_id)
    ) continue

    // Días efectivos dentro del período
    const inicioAsig = a.fecha_asignacion ? parseISO(a.fecha_asignacion) : fi
    const diasEfectivos = Math.min(
      differenceInDays(ff, inicioAsig < fi ? fi : inicioAsig) + 1,
      diasPeriodo
    )
    if (diasEfectivos <= 0) continue

    const costoDia = tarifa.costo_dia
    const costoTotal = costoDia * diasEfectivos

    // Obtener centro de costo
    let centro_costo_id = null
    let centro_costo_nombre = null
    if (a.tipo_asignacion === 'empleado') {
      const emp = empleados.find(e => e.id === a.asignado_a_id)
      centro_costo_id = emp?.centro_costo_id || null
      centro_costo_nombre = emp?.centro_costo_nombre || emp?.centro_costos || null
    } else if (a.tipo_asignacion === 'sucursal') {
      const suc = sucursales.find(s => s.id === a.asignado_a_id)
      centro_costo_id = suc?.centro_costo_id || null
      centro_costo_nombre = suc?.centro_costo_nombre || null
    }

    resultados.push({
      tipo: 'equipo',
      dispositivo_id: dev.id,
      dispositivo_tipo: tarifa.es_paquete ? `${tipoDisp} (Paquete)` : tipoDisp,
      dispositivo_serie: dev.serie,
      asignacion_tipo: a.tipo_asignacion,
      asignado_a_id: a.asignado_a_id,
      asignado_a_nombre: a.asignado_a_nombre,
      centro_costo_id,
      centro_costo_nombre,
      costo_dia: costoDia,
      dias: diasEfectivos,
      costo_total: parseFloat(costoTotal.toFixed(2)),
      moneda: tarifa.moneda || 'MXN'
    })
  }

  return resultados
}

/**
 * Calcula el costo mensual de licencias activas en el período.
 */
function calcularGastosLicencias(fechaInicio, fechaFin) {
  const licencias = db.get('licencias').filter({ activo: true }).value()
  const asignLic = db.get('asignaciones_licencias').filter({ activo: true }).value()
  const empleados = db.get('empleados').value()

  const fi = parseISO(fechaInicio)
  const ff = parseISO(fechaFin)
  const diasPeriodo = differenceInDays(ff, fi) + 1

  const resultados = []

  for (const lic of licencias) {
    // Convertir costo a MXN mensual
    let costoMensualMXN = 0
    const tc = lic.tipo_cambio || 17.15
    const costo = parseFloat(lic.costo) || 0
    const costoMXN = lic.moneda === 'USD' ? costo * tc : costo

    if (lic.tipo_costo === 'mensual') costoMensualMXN = costoMXN
    else if (lic.tipo_costo === 'anual') costoMensualMXN = costoMXN / 12
    else costoMensualMXN = 0 // único — amortización a criterio

    // Asignaciones de esta licencia en el período
    const asigs = asignLic.filter(a => a.licencia_id === lic.id)

    if (asigs.length === 0) {
      // Licencia sin asignaciones individuales — costo global
      const costoPeriodo = (costoMensualMXN / 30) * diasPeriodo
      resultados.push({
        tipo: 'licencia',
        licencia_id: lic.id,
        licencia_nombre: lic.nombre,
        licencia_tipo: lic.tipo,
        asignado_a_id: null,
        asignado_a_nombre: 'Sin asignar',
        centro_costo_id: null,
        centro_costo_nombre: null,
        asientos: lic.total_asientos,
        costo_mensual_mxn: parseFloat(costoMensualMXN.toFixed(2)),
        costo_total: parseFloat(costoPeriodo.toFixed(2)),
        moneda: 'MXN'
      })
    } else {
      for (const a of asigs) {
        const emp = empleados.find(e => e.id === a.empleado_id)
        const costoPorAsiento = asigs.length > 0 ? costoMensualMXN / (asigs.length || 1) : costoMensualMXN
        const costoPeriodo = (costoPorAsiento / 30) * diasPeriodo
        resultados.push({
          tipo: 'licencia',
          licencia_id: lic.id,
          licencia_nombre: lic.nombre,
          licencia_tipo: lic.tipo,
          asignado_a_id: a.empleado_id,
          asignado_a_nombre: emp?.nombre_completo || a.empleado_nombre || 'Desconocido',
          centro_costo_id: emp?.centro_costo_id || null,
          centro_costo_nombre: emp?.centro_costo_nombre || emp?.centro_costos || null,
          asientos: 1,
          costo_mensual_mxn: parseFloat(costoPorAsiento.toFixed(2)),
          costo_total: parseFloat(costoPeriodo.toFixed(2)),
          moneda: 'MXN'
        })
      }
    }
  }

  return resultados
}

// ─── Endpoints ─────────────────────────────────────────────────────────────────

/**
 * GET /api/finanzas/resumen
 * Resumen financiero del período actual (mes en curso por defecto)
 */
router.get('/resumen', (req, res) => {
  const hoy = new Date()
  const fechaInicio = req.query.fecha_inicio || format(startOfMonth(hoy), 'yyyy-MM-dd')
  const fechaFin = req.query.fecha_fin || format(endOfMonth(hoy), 'yyyy-MM-dd')

  const gastosEquipo = calcularGastosEquipos(fechaInicio, fechaFin)
  const gastosLicencias = calcularGastosLicencias(fechaInicio, fechaFin)
  const todos = [...gastosEquipo, ...gastosLicencias]

  const totalEquipos = gastosEquipo.reduce((s, g) => s + g.costo_total, 0)
  const totalLicencias = gastosLicencias.reduce((s, g) => s + g.costo_total, 0)
  const totalGeneral = totalEquipos + totalLicencias

  // Agrupado por tipo de dispositivo
  const porTipo = {}
  for (const g of gastosEquipo) {
    if (!porTipo[g.dispositivo_tipo]) porTipo[g.dispositivo_tipo] = 0
    porTipo[g.dispositivo_tipo] += g.costo_total
  }

  // Agrupado por centro de costo
  const porCC = {}
  for (const g of todos) {
    const cc = g.centro_costo_nombre || 'Sin centro de costo'
    if (!porCC[cc]) porCC[cc] = { nombre: cc, id: g.centro_costo_id, total: 0, equipos: 0, licencias: 0 }
    porCC[cc].total += g.costo_total
    if (g.tipo === 'equipo') porCC[cc].equipos += g.costo_total
    else porCC[cc].licencias += g.costo_total
  }

  res.json({
    periodo: { fecha_inicio: fechaInicio, fecha_fin: fechaFin },
    resumen: {
      total_general: parseFloat(totalGeneral.toFixed(2)),
      total_equipos: parseFloat(totalEquipos.toFixed(2)),
      total_licencias: parseFloat(totalLicencias.toFixed(2)),
      num_asignaciones: gastosEquipo.length,
      num_licencias: gastosLicencias.length
    },
    por_tipo_equipo: Object.entries(porTipo).map(([tipo, total]) => ({
      tipo, total: parseFloat(total.toFixed(2))
    })).sort((a, b) => b.total - a.total),
    por_centro_costo: Object.values(porCC).map(cc => ({
      ...cc,
      total: parseFloat(cc.total.toFixed(2)),
      equipos: parseFloat(cc.equipos.toFixed(2)),
      licencias: parseFloat(cc.licencias.toFixed(2))
    })).sort((a, b) => b.total - a.total)
  })
})

/**
 * GET /api/finanzas/detalle
 * Detalle de todos los gastos del período (para tabla con filtros y exportación)
 */
router.get('/detalle', (req, res) => {
  const hoy = new Date()
  const fechaInicio = req.query.fecha_inicio || format(startOfMonth(hoy), 'yyyy-MM-dd')
  const fechaFin = req.query.fecha_fin || format(endOfMonth(hoy), 'yyyy-MM-dd')
  const { tipo, centro_costo_id, centro_costo_nombre } = req.query

  let gastosEquipo = calcularGastosEquipos(fechaInicio, fechaFin)
  let gastosLicencias = calcularGastosLicencias(fechaInicio, fechaFin)
  let todos = [...gastosEquipo, ...gastosLicencias]

  if (tipo === 'equipo') todos = gastosEquipo
  if (tipo === 'licencia') todos = gastosLicencias
  if (centro_costo_id) todos = todos.filter(g => g.centro_costo_id === centro_costo_id)
  if (centro_costo_nombre) {
    const search = centro_costo_nombre.toLowerCase()
    todos = todos.filter(g => g.centro_costo_nombre?.toLowerCase().includes(search))
  }

  const total = todos.reduce((s, g) => s + g.costo_total, 0)
  res.json({
    periodo: { fecha_inicio: fechaInicio, fecha_fin: fechaFin },
    total: parseFloat(total.toFixed(2)),
    items: todos
  })
})

/**
 * GET /api/finanzas/historico
 * Resumen mes a mes de los últimos N meses
 */
router.get('/historico', (req, res) => {
  const meses = parseInt(req.query.meses || 6)
  const resultado = []
  const hoy = new Date()

  for (let i = meses - 1; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1)
    const inicio = format(startOfMonth(d), 'yyyy-MM-dd')
    const fin = format(endOfMonth(d), 'yyyy-MM-dd')

    const gastosEq = calcularGastosEquipos(inicio, fin)
    const gastosLic = calcularGastosLicencias(inicio, fin)

    resultado.push({
      mes: format(d, 'yyyy-MM'),
      etiqueta: format(d, 'MMM yyyy'),
      equipos: parseFloat(gastosEq.reduce((s, g) => s + g.costo_total, 0).toFixed(2)),
      licencias: parseFloat(gastosLic.reduce((s, g) => s + g.costo_total, 0).toFixed(2)),
      total: parseFloat([...gastosEq, ...gastosLic].reduce((s, g) => s + g.costo_total, 0).toFixed(2))
    })
  }

  res.json(resultado)
})

/**
 * GET /api/finanzas/por-centro-costo/:codigo
 * Gastos detallados de un centro de costo específico
 */
router.get('/por-centro-costo/:codigo', (req, res) => {
  const hoy = new Date()
  const fechaInicio = req.query.fecha_inicio || format(startOfMonth(hoy), 'yyyy-MM-dd')
  const fechaFin = req.query.fecha_fin || format(endOfMonth(hoy), 'yyyy-MM-dd')
  const codigo = req.params.codigo

  const gastosEquipo = calcularGastosEquipos(fechaInicio, fechaFin)
  const gastosLicencias = calcularGastosLicencias(fechaInicio, fechaFin)
  const todos = [...gastosEquipo, ...gastosLicencias].filter(g =>
    g.centro_costo_id === codigo || g.centro_costo_nombre === codigo
  )

  const total = todos.reduce((s, g) => s + g.costo_total, 0)
  res.json({
    codigo,
    periodo: { fecha_inicio: fechaInicio, fecha_fin: fechaFin },
    total: parseFloat(total.toFixed(2)),
    items: todos
  })
})

module.exports = router
