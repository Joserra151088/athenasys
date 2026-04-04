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

const normalize = (str) => (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

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

// ── Reporte: Gastos Financieros (solo finanzas_detalle) ───────────────────────
router.get('/gastos', (req, res) => {
  try {
    const hoy = new Date()
    const fechaInicio = req.query.fecha_inicio || format(startOfMonth(hoy), 'yyyy-MM-dd')
    const fechaFin    = req.query.fecha_fin    || format(endOfMonth(hoy),   'yyyy-MM-dd')

    // ID-based filter params
    const filtroEmpleadoId = (req.query.empleado_id          || '').trim()
    const filtroSucursalId = (req.query.sucursal_id          || '').trim()
    const filtroCCCodigo   = normalize(req.query.centro_costo_codigo || '')
    const filtroArea       = normalize(req.query.area               || '')
    const hayFiltroActivo  = !!(filtroEmpleadoId || filtroSucursalId || filtroCCCodigo || filtroArea)
    console.log('[reportes/gastos] filtros:', { filtroEmpleadoId, filtroSucursalId, filtroCCCodigo, filtroArea, hayFiltroActivo })

    const empleados  = db.get('empleados').value()
    const sucursales = db.get('sucursales').value()

    // ── Helper: construye un Set con todos los tokens CC normalizados de un objeto ─
    const collectCC = (obj) => {
      if (!obj) return []
      return [obj.centro_costo_codigo, obj.centro_costos, obj.centro_costo_nombre]
        .filter(v => v && String(v).trim())
        .map(v => normalize(String(v)))
    }

    // ── Pre-compute filter sets ──────────────────────────────────────────────
    let empIds = null   // null = sin filtro activo
    let ccSet  = null   // Set de tokens a comparar contra _cc_full de cada fila

    if (filtroEmpleadoId) {
      empIds = new Set([filtroEmpleadoId])
      ccSet  = new Set()

    } else if (filtroSucursalId) {
      const suc = sucursales.find(s => s.id === filtroSucursalId)
      const empsDeSuc = empleados.filter(e => e.sucursal_id === filtroSucursalId)
      empIds = new Set(empsDeSuc.map(e => e.id))

      const tokens = new Set()

      // 1) Campos CC directos del record de sucursal (fuente ideal)
      collectCC(suc).forEach(t => { if (t) tokens.add(t) })

      // 2) CC de empleados asignados a esa sucursal
      empsDeSuc.forEach(e => collectCC(e).forEach(t => { if (t) tokens.add(t) }))

      // 3) Fallback cuando no hay CC configurado ni empleados:
      //    extraer palabras significativas (≥4 chars) del nombre de la sucursal
      //    ignorando palabras genéricas de formato
      if (tokens.size === 0 && suc?.nombre) {
        const STOP_WORDS = new Set(['super','center','centre','bodega','aurrera',
          'walmart','express','tienda','sucursal','corporativo','plaza','centro',
          'norte','sur','este','oeste','city','club','store'])
        normalize(suc.nombre)
          .split(/[\s,\.\-\"\']+/)
          .filter(w => w.length >= 4 && !STOP_WORDS.has(w))
          .forEach(w => tokens.add(w))
      }

      ccSet = tokens
      console.log('[reportes/gastos] sucursal:', suc?.nombre,
        '| empIds:', empIds.size, '| ccTokens:', [...ccSet])

    } else if (filtroCCCodigo) {
      empIds = new Set(empleados.filter(e =>
        normalize(e.centro_costos      || '').includes(filtroCCCodigo) ||
        normalize(e.centro_costo_codigo|| '').includes(filtroCCCodigo) ||
        normalize(e.centro_costo_nombre|| '').includes(filtroCCCodigo)
      ).map(e => e.id))
      ccSet = new Set([filtroCCCodigo])

    } else if (filtroArea) {
      empIds = new Set(empleados.filter(e => normalize(e.area || '').includes(filtroArea)).map(e => e.id))
      ccSet  = new Set()
    }

    const { parseISO } = require('date-fns')
    const fi         = parseISO(fechaInicio)
    const mesFiltro  = fi.getMonth() + 1
    const anioFiltro = fi.getFullYear()

    // Única fuente de datos: registros del módulo de Finanzas
    const detalleItems = db.get('finanzas_detalle')
      .filter(d => d.mes === mesFiltro && d.anio === anioFiltro)
      .value()

    const data = detalleItems.map(d => {
      const totalMXN = d.total_mxn != null
        ? parseFloat(d.total_mxn) || 0
        : (d.moneda === 'USD'
          ? (parseFloat(d.total) || 0) * (parseFloat(d.tipo_cambio) || 1)
          : parseFloat(d.total) || 0)
      const empDet = d.empleado_id ? empleados.find(e => e.id === d.empleado_id) : null
      // _cc_full: concatena código + nombre para poder hacer substring en cualquier dirección
      const ccFull = normalize(
        [d.centro_costo_codigo, d.centro_costo_nombre].filter(Boolean).join(' ')
      )
      return {
        descripcion:  d.nombre          || '',
        servicio:     d.tipo_servicio   || '',
        proveedor:    d.proveedor       || '',
        folio:        d.telefono_serie  || d.factura_folio || '',
        asignado_a:   d.empleado_nombre || '',
        area:         empDet?.area      || d.departamento || '',
        centro_costo: d.centro_costo_nombre || d.centro_costo_codigo || '',
        tipo:         d.es_gasto_usuario ? 'Usuario' : 'Servicio',
        total_mxn:    parseFloat(totalMXN.toFixed(2)),
        _emp_id:      d.empleado_id || null,
        _cc_codigo:   normalize(d.centro_costo_codigo || d.centro_costo_nombre || ''),
        _cc_full:     ccFull,
      }
    })

    // ── Aplicar filtros ──────────────────────────────────────────────────────
    // Reglas de inclusión:
    //   (a) Tiene empleado_id en empIds  →  gasto personal vinculado a esa entidad
    //   (b) Sin empleado_id + _cc_full coincide con algún token del ccSet
    //       (substring en cualquier dirección: token⊆cc ó cc⊆token)
    let filtered = data
    if (hayFiltroActivo) {
      filtered = data.filter(row => {
        if (empIds === null) return false

        // (a) Gasto con empleado asignado
        if (row._emp_id) return empIds.has(row._emp_id)

        // (b) Gasto de servicio sin empleado → coincidir si algún token aparece
        //     dentro del cc_full (código + nombre normalizados juntos)
        if (ccSet && ccSet.size > 0 && row._cc_full) {
          for (const token of ccSet) {
            if (token && row._cc_full.includes(token)) return true
          }
        }
        return false
      })
    }

    const total = filtered.reduce((s, g) => s + g.total_mxn, 0)
    res.json({
      titulo:     'Reporte de Gastos TI',
      generado:   hoyStr(),
      periodo:    { fecha_inicio: fechaInicio, fecha_fin: fechaFin },
      total_mxn:  parseFloat(total.toFixed(2)),
      total:      filtered.length,
      data:       filtered
    })
  } catch (err) {
    console.error('[reportes/gastos] error:', err)
    res.status(500).json({ message: err.message || 'Error al generar reporte de gastos' })
  }
})

router.get('/gastos-historico', (req, res) => {
  const numMeses = Math.min(parseInt(req.query.meses || 12), 24)
  const filtroEmpleadoId = req.query.empleado_id || ''
  const filtroSucursalId = req.query.sucursal_id || ''
  const filtroCCCodigo   = normalize(req.query.centro_costo_codigo || '')
  const filtroArea       = normalize(req.query.area || '')

  const MESES_ABREV = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  const now = new Date()
  const empleados = db.get('empleados').value()
  const sucursales = db.get('sucursales').value()

  // Pre-compute filter sets — mismo modelo que /gastos
  let empIds = null
  let ccSet  = null

  if (filtroEmpleadoId) {
    empIds = new Set([filtroEmpleadoId])
    ccSet  = new Set()
  } else if (filtroSucursalId) {
    const suc = sucursales.find(s => s.id === filtroSucursalId)
    const empsDeSuc = empleados.filter(e => e.sucursal_id === filtroSucursalId)
    empIds = new Set(empsDeSuc.map(e => e.id))
    const tokens = new Set()
    // CC directo de la sucursal
    ;[suc?.centro_costo_codigo, suc?.centro_costos, suc?.centro_costo_nombre]
      .filter(v => v?.trim()).forEach(v => tokens.add(normalize(v)))
    // CC de empleados de la sucursal
    empsDeSuc.forEach(e =>
      [e.centro_costo_codigo, e.centro_costos, e.centro_costo_nombre]
        .filter(v => v?.trim()).forEach(v => tokens.add(normalize(v)))
    )
    // Fallback: palabras significativas del nombre de la sucursal
    if (tokens.size === 0 && suc?.nombre) {
      const STOP = new Set(['super','center','centre','bodega','aurrera',
        'walmart','express','tienda','sucursal','corporativo','plaza','centro',
        'norte','sur','este','oeste','city','club','store'])
      normalize(suc.nombre).split(/[\s,\.\-\"\']+/)
        .filter(w => w.length >= 4 && !STOP.has(w))
        .forEach(w => tokens.add(w))
    }
    ccSet = tokens
  } else if (filtroCCCodigo) {
    empIds = new Set(empleados.filter(e =>
      normalize(e.centro_costos      || '').includes(filtroCCCodigo) ||
      normalize(e.centro_costo_codigo|| '').includes(filtroCCCodigo) ||
      normalize(e.centro_costo_nombre|| '').includes(filtroCCCodigo)
    ).map(e => e.id))
    ccSet = new Set([filtroCCCodigo])
  } else if (filtroArea) {
    empIds = new Set(empleados.filter(e => normalize(e.area || '').includes(filtroArea)).map(e => e.id))
    ccSet  = new Set()
  }

  const meses = []
  for (let i = numMeses - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    meses.push({ mes: d.getMonth() + 1, anio: d.getFullYear() })
  }

  const result = meses.map(({ mes, anio }) => {
    let items = db.get('finanzas_detalle').filter(d => d.mes === mes && d.anio === anio).value()

    if (empIds !== null) {
      items = items.filter(d => {
        if (d.empleado_id) return empIds.has(d.empleado_id)
        // Sin empleado_id → coincidir si algún token aparece en el CC del registro
        if (ccSet && ccSet.size > 0) {
          const dCC = normalize([d.centro_costo_codigo, d.centro_costo_nombre].filter(Boolean).join(' '))
          for (const token of ccSet) {
            if (token && dCC.includes(token)) return true
          }
        }
        return false
      })
    }

    const servicios = items.reduce((s, d) => s + (d.total_mxn != null ? parseFloat(d.total_mxn)||0 : parseFloat(d.total)||0), 0)

    return {
      mes, anio,
      label: `${MESES_ABREV[mes-1]} ${String(anio).slice(2)}`,
      servicios: parseFloat(servicios.toFixed(2)),
      total: parseFloat(servicios.toFixed(2))
    }
  })

  res.json(result)
})

module.exports = router
