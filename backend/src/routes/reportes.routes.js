/**
 * Módulo de Reportes — datos estructurados para exportación
 * Todos los endpoints devuelven listas planas aptas para PDF / Excel / CSV
 */
const express = require('express')
const router = express.Router()
const db = require('../data/db')
const { authMiddleware } = require('../middleware/auth.middleware')
const { format, startOfMonth, endOfMonth, parseISO } = require('date-fns')

router.use(authMiddleware)

const hoyStr = () => format(new Date(), 'yyyy-MM-dd')

// ── Reporte: Inventario de Dispositivos ──────────────────────────────────────
router.get('/inventario', (req, res) => {
  const { estado, tipo, ubicacion_tipo } = req.query
  let items = db.get('dispositivos').filter({ activo: true }).value()

  if (estado) items = items.filter(d => d.estado === estado)
  if (tipo) items = items.filter(d => d.tipo === tipo)
  if (ubicacion_tipo) items = items.filter(d => d.ubicacion_tipo === ubicacion_tipo)

  const data = items.map(d => ({
    serie: d.serie,
    tipo: d.tipo,
    marca: d.marca,
    modelo: d.modelo || '',
    estado: d.estado,
    ubicacion: d.ubicacion_tipo,
    asignado_a: d.ubicacion_nombre || '',
    proveedor: d.proveedor_nombre || '',
    caracteristicas: d.caracteristicas || '',
    fecha_alta: d.created_at ? String(d.created_at).split('T')[0] : ''
  }))

  res.json({ titulo: 'Inventario de Dispositivos', generado: hoyStr(), total: data.length, data })
})

// ── Reporte: Asignaciones activas ────────────────────────────────────────────
router.get('/asignaciones', (req, res) => {
  const { tipo_asignacion } = req.query
  let asigs = db.get('asignaciones').filter({ activo: true }).value()
  if (tipo_asignacion) asigs = asigs.filter(a => a.tipo_asignacion === tipo_asignacion)

  const dispositivos = db.get('dispositivos').value()
  const empleados = db.get('empleados').value()
  const sucursales = db.get('sucursales').value()

  const data = asigs.map(a => {
    const dev = dispositivos.find(d => d.id === a.dispositivo_id) || {}
    let cc = ''
    if (a.tipo_asignacion === 'empleado') {
      const emp = empleados.find(e => e.id === a.asignado_a_id)
      cc = emp?.centro_costo_nombre || emp?.centro_costos || ''
    } else {
      const suc = sucursales.find(s => s.id === a.asignado_a_id)
      cc = suc?.centro_costo_nombre || ''
    }
    return {
      serie: dev.serie || '',
      tipo: dev.tipo || '',
      marca: dev.marca || '',
      modelo: dev.modelo || '',
      tipo_asignacion: a.tipo_asignacion,
      asignado_a: a.asignado_a_nombre || '',
      centro_costo: cc,
      fecha_asignacion: a.fecha_asignacion ? String(a.fecha_asignacion).split('T')[0] : '',
      asignado_por: a.asignado_por_nombre || ''
    }
  })

  res.json({ titulo: 'Asignaciones Activas', generado: hoyStr(), total: data.length, data })
})

// ── Reporte: Licencias ────────────────────────────────────────────────────────
router.get('/licencias', (req, res) => {
  const licencias = db.get('licencias').filter({ activo: true }).value()
  const asignLic = db.get('asignaciones_licencias').filter({ activo: true }).value()

  const data = licencias.map(l => {
    const usados = asignLic.filter(a => a.licencia_id === l.id).length
    const tc = l.tipo_cambio || 17.15
    let mensualMXN = 0
    const costoMXN = l.moneda === 'USD' ? l.costo * tc : l.costo
    if (l.tipo_costo === 'mensual') mensualMXN = costoMXN
    else if (l.tipo_costo === 'anual') mensualMXN = costoMXN / 12

    return {
      nombre: l.nombre,
      tipo: l.tipo,
      proveedor: l.proveedor_nombre || '',
      version: l.version || '',
      costo: l.costo,
      moneda: l.moneda,
      tipo_costo: l.tipo_costo,
      costo_mensual_mxn: parseFloat(mensualMXN.toFixed(2)),
      total_asientos: l.total_asientos,
      asientos_usados: usados,
      asientos_libres: l.total_asientos - usados,
      fecha_inicio: l.fecha_inicio || '',
      fecha_vencimiento: l.fecha_vencimiento || '',
      estado: !l.fecha_vencimiento ? 'activa' :
        new Date(l.fecha_vencimiento) < new Date() ? 'vencida' :
        new Date(l.fecha_vencimiento) < new Date(Date.now() + 30*86400000) ? 'por_vencer' : 'activa'
    }
  })

  res.json({ titulo: 'Reporte de Licencias', generado: hoyStr(), total: data.length, data })
})

// ── Reporte: Centros de Costo con gastos ─────────────────────────────────────
router.get('/centros-costo', (req, res) => {
  const hoy = new Date()
  const fechaInicio = req.query.fecha_inicio || format(startOfMonth(hoy), 'yyyy-MM-dd')
  const fechaFin = req.query.fecha_fin || format(endOfMonth(hoy), 'yyyy-MM-dd')

  const empleados = db.get('empleados').filter({ activo: true }).value()
  const sucursales = db.get('sucursales').filter({ activo: true }).value()
  const asignaciones = db.get('asignaciones').filter({ activo: true }).value()
  const dispositivos = db.get('dispositivos').value()

  // Agrupar dispositivos asignados por centro de costo
  const ccMap = {}

  const procesarEntidad = (entidad, tipo) => {
    const cc_id = entidad.centro_costo_id || entidad.centro_costos || null
    const cc_nombre = entidad.centro_costo_nombre || entidad.centro_costos || 'Sin asignar'
    if (!ccMap[cc_nombre]) ccMap[cc_nombre] = { codigo: cc_id, nombre: cc_nombre, empleados: 0, sucursales: 0, dispositivos: 0 }
    if (tipo === 'empleado') ccMap[cc_nombre].empleados++
    if (tipo === 'sucursal') ccMap[cc_nombre].sucursales++
  }

  for (const e of empleados) procesarEntidad(e, 'empleado')
  for (const s of sucursales) procesarEntidad(s, 'sucursal')

  for (const a of asignaciones) {
    const dev = dispositivos.find(d => d.id === a.dispositivo_id)
    if (!dev) continue
    let cc_nombre = 'Sin asignar'
    if (a.tipo_asignacion === 'empleado') {
      const emp = empleados.find(e => e.id === a.asignado_a_id)
      cc_nombre = emp?.centro_costo_nombre || emp?.centro_costos || 'Sin asignar'
    } else {
      const suc = sucursales.find(s => s.id === a.asignado_a_id)
      cc_nombre = suc?.centro_costo_nombre || 'Sin asignar'
    }
    if (ccMap[cc_nombre]) ccMap[cc_nombre].dispositivos++
  }

  const data = Object.values(ccMap).sort((a, b) => b.dispositivos - a.dispositivos)
  res.json({ titulo: 'Centros de Costo', generado: hoyStr(), periodo: { fecha_inicio: fechaInicio, fecha_fin: fechaFin }, total: data.length, data })
})

// ── Reporte: Gastos Financieros ───────────────────────────────────────────────
router.get('/gastos', (req, res) => {
  // Re-usa la lógica de finanzas — devuelve datos planos para exportar
  const hoy = new Date()
  const fechaInicio = req.query.fecha_inicio || format(startOfMonth(hoy), 'yyyy-MM-dd')
  const fechaFin = req.query.fecha_fin || format(endOfMonth(hoy), 'yyyy-MM-dd')

  const tarifas = db.get('tarifas_equipo').filter({ activo: true }).value()
  const tarifaMap = {}
  const paqueteCPU = tarifas.find(t => t.es_paquete && t.tipo === 'CPU')
  const paqueteIncluye = paqueteCPU?.incluye || ['CPU','Monitor','Teclado','Mouse']
  for (const t of tarifas) tarifaMap[t.tipo] = t

  const asignaciones = db.get('asignaciones').filter({ activo: true }).value()
  const dispositivos = db.get('dispositivos').value()
  const empleados = db.get('empleados').value()
  const sucursales = db.get('sucursales').value()
  const licencias = db.get('licencias').filter({ activo: true }).value()
  const asignLic = db.get('asignaciones_licencias').filter({ activo: true }).value()

  const empleadosConCPU = new Set()
  for (const a of asignaciones) {
    const dev = dispositivos.find(d => d.id === a.dispositivo_id)
    if (dev?.tipo === 'CPU' && a.tipo_asignacion === 'empleado') empleadosConCPU.add(a.asignado_a_id)
  }

  const { differenceInDays, parseISO } = require('date-fns')
  const fi = parseISO(fechaInicio)
  const ff = parseISO(fechaFin)
  const diasPeriodo = differenceInDays(ff, fi) + 1

  const data = []

  // Equipos
  for (const a of asignaciones) {
    const dev = dispositivos.find(d => d.id === a.dispositivo_id)
    if (!dev) continue
    const tarifa = tarifaMap[dev.tipo]
    if (!tarifa) continue

    if (a.tipo_asignacion === 'empleado' && paqueteIncluye.includes(dev.tipo) && dev.tipo !== 'CPU' && empleadosConCPU.has(a.asignado_a_id)) continue

    const inicioAsig = a.fecha_asignacion ? parseISO(a.fecha_asignacion) : fi
    const dias = Math.min(differenceInDays(ff, inicioAsig < fi ? fi : inicioAsig) + 1, diasPeriodo)
    if (dias <= 0) continue

    let cc_nombre = 'Sin asignar', cc_id = null
    if (a.tipo_asignacion === 'empleado') {
      const emp = empleados.find(e => e.id === a.asignado_a_id)
      cc_id = emp?.centro_costo_id || null; cc_nombre = emp?.centro_costo_nombre || emp?.centro_costos || 'Sin asignar'
    } else {
      const suc = sucursales.find(s => s.id === a.asignado_a_id)
      cc_id = suc?.centro_costo_id || null; cc_nombre = suc?.centro_costo_nombre || 'Sin asignar'
    }

    data.push({
      categoria: 'Equipo',
      descripcion: tarifa.es_paquete ? `${dev.tipo} (Paquete)` : dev.tipo,
      serie_licencia: dev.serie,
      asignado_a: a.asignado_a_nombre,
      tipo_asignacion: a.tipo_asignacion,
      centro_costo: cc_nombre,
      costo_unitario: tarifa.costo_dia,
      unidad: 'día',
      cantidad: dias,
      total_mxn: parseFloat((tarifa.costo_dia * dias).toFixed(2))
    })
  }

  // Licencias
  for (const lic of licencias) {
    const tc = lic.tipo_cambio || 17.15
    const costoMXN = lic.moneda === 'USD' ? lic.costo * tc : lic.costo
    let mensualMXN = lic.tipo_costo === 'mensual' ? costoMXN : lic.tipo_costo === 'anual' ? costoMXN / 12 : 0
    const costoPeriodo = (mensualMXN / 30) * diasPeriodo
    const asigs = asignLic.filter(a => a.licencia_id === lic.id)

    data.push({
      categoria: 'Licencia',
      descripcion: lic.nombre,
      serie_licencia: lic.clave_licencia || '',
      asignado_a: asigs.length > 0 ? `${asigs.length} usuario(s)` : 'Sin asignar',
      tipo_asignacion: 'licencia',
      centro_costo: '',
      costo_unitario: parseFloat(mensualMXN.toFixed(2)),
      unidad: 'mes',
      cantidad: parseFloat((diasPeriodo / 30).toFixed(2)),
      total_mxn: parseFloat(costoPeriodo.toFixed(2))
    })
  }

  const total = data.reduce((s, g) => s + g.total_mxn, 0)
  res.json({
    titulo: 'Reporte de Gastos TI',
    generado: hoyStr(),
    periodo: { fecha_inicio: fechaInicio, fecha_fin: fechaFin },
    total_mxn: parseFloat(total.toFixed(2)),
    total: data.length,
    data
  })
})

module.exports = router
