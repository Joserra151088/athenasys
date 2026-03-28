const router = require('express').Router()
const { v4: uuidv4 } = require('uuid')
const db = require('../data/db')
const { authMiddleware, requireRoles } = require('../middleware/auth.middleware')

router.use(authMiddleware)

// ── Helper: sincronizar gasto_real en presupuesto_gastos_mes desde finanzas_detalle ──
function syncGastoReal(partida_id, mes, anio) {
  if (!partida_id) return
  mes = parseInt(mes); anio = parseInt(anio)
  const lines = db.get('finanzas_detalle').filter(d => d.partida_id === partida_id && d.mes === mes && d.anio === anio).value()
  const gasto_real = lines.reduce((s, d) => s + (parseFloat(d.total) || 0), 0)
  const existing = db.get('presupuesto_gastos_mes').find({ partida_id, mes, anio }).value()
  const now = new Date().toISOString()
  if (existing) {
    db.get('presupuesto_gastos_mes').find({ id: existing.id }).assign({ gasto_real, updated_at: now }).write()
  } else if (gasto_real > 0) {
    db.get('presupuesto_gastos_mes').push({
      id: uuidv4(), partida_id, mes, anio, gasto_real, factura_folio: '',
      ahorro_soporte: 0, ahorro_descripcion: '', created_at: now, updated_at: now
    }).write()
  }
}

// ── Agrupadores ──────────────────────────────────────────────────────────────
router.get('/agrupadores', (req, res) => {
  res.json(db.get('presupuesto_agrupadores').filter(x => x.activo).value())
})
router.post('/agrupadores', requireRoles('super_admin', 'agente_soporte'), (req, res) => {
  const { nombre } = req.body
  if (!nombre) return res.status(400).json({ message: 'Nombre requerido' })
  const item = { id: uuidv4(), nombre, activo: true, created_at: new Date().toISOString() }
  db.get('presupuesto_agrupadores').push(item).write()
  res.status(201).json(item)
})
router.put('/agrupadores/:id', requireRoles('super_admin', 'agente_soporte'), (req, res) => {
  const item = db.get('presupuesto_agrupadores').find({ id: req.params.id }).value()
  if (!item) return res.status(404).json({ message: 'No encontrado' })
  db.get('presupuesto_agrupadores').find({ id: req.params.id }).assign({ nombre: req.body.nombre, updated_at: new Date().toISOString() }).write()
  res.json(db.get('presupuesto_agrupadores').find({ id: req.params.id }).value())
})
router.delete('/agrupadores/:id', requireRoles('super_admin'), (req, res) => {
  db.get('presupuesto_agrupadores').find({ id: req.params.id }).assign({ activo: false }).write()
  res.json({ ok: true })
})

// ── Partidas ─────────────────────────────────────────────────────────────────
router.get('/partidas', (req, res) => {
  const { empresa, agrupador, anio } = req.query
  let items = db.get('presupuesto_partidas').filter(x => x.activo).value()
  if (empresa) items = items.filter(p => p.empresa === empresa)
  if (agrupador) items = items.filter(p => p.agrupador === agrupador)
  res.json(items)
})
router.post('/partidas', requireRoles('super_admin', 'agente_soporte'), (req, res) => {
  const { empresa, agrupador, proveedor, concepto, monto_mensual } = req.body
  if (!empresa || !agrupador || !concepto) return res.status(400).json({ message: 'Empresa, agrupador y concepto son requeridos' })
  const item = {
    id: uuidv4(), empresa, agrupador, proveedor: proveedor || '', concepto,
    monto_mensual: parseFloat(monto_mensual) || 0,
    montos_por_mes: req.body.montos_por_mes || null,
    activo: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString()
  }
  db.get('presupuesto_partidas').push(item).write()
  res.status(201).json(item)
})
router.put('/partidas/:id', requireRoles('super_admin', 'agente_soporte'), (req, res) => {
  const item = db.get('presupuesto_partidas').find({ id: req.params.id }).value()
  if (!item) return res.status(404).json({ message: 'No encontrada' })
  const { empresa, agrupador, proveedor, concepto, monto_mensual } = req.body
  db.get('presupuesto_partidas').find({ id: req.params.id }).assign({
    empresa: empresa || item.empresa, agrupador: agrupador || item.agrupador,
    proveedor: proveedor !== undefined ? proveedor : item.proveedor,
    concepto: concepto || item.concepto,
    monto_mensual: monto_mensual !== undefined ? parseFloat(monto_mensual) : item.monto_mensual,
    montos_por_mes: req.body.montos_por_mes !== undefined ? req.body.montos_por_mes : item.montos_por_mes,
    updated_at: new Date().toISOString()
  }).write()
  res.json(db.get('presupuesto_partidas').find({ id: req.params.id }).value())
})
router.delete('/partidas/:id', requireRoles('super_admin'), (req, res) => {
  db.get('presupuesto_partidas').find({ id: req.params.id }).assign({ activo: false, updated_at: new Date().toISOString() }).write()
  res.json({ ok: true })
})

router.get('/proveedores-lista', (req, res) => {
  const partidas = db.get('presupuesto_partidas').filter(x => x.activo).value()
  const lista = partidas.map(p => ({
    partida_id: p.id,
    proveedor: p.proveedor,
    concepto: p.concepto,
    empresa: p.empresa,
    agrupador: p.agrupador,
    monto_mensual: p.monto_mensual || 0,
    montos_por_mes: p.montos_por_mes || null,
  }))
  res.json(lista)
})

// ── Gastos por mes ────────────────────────────────────────────────────────────
router.get('/gastos', (req, res) => {
  const { partida_id, mes, anio } = req.query
  let items = db.get('presupuesto_gastos_mes').value()
  if (partida_id) items = items.filter(g => g.partida_id === partida_id)
  if (mes) items = items.filter(g => g.mes === parseInt(mes))
  if (anio) items = items.filter(g => g.anio === parseInt(anio))
  res.json(items)
})
router.post('/gastos', requireRoles('super_admin', 'agente_soporte'), (req, res) => {
  const { partida_id, mes, anio, gasto_real, factura_folio, ahorro_soporte, ahorro_descripcion } = req.body
  if (!partida_id || !mes || !anio) return res.status(400).json({ message: 'partida_id, mes y anio son requeridos' })
  // Upsert: si ya existe para esta partida+mes+anio, actualizar
  const existing = db.get('presupuesto_gastos_mes').find({ partida_id, mes: parseInt(mes), anio: parseInt(anio) }).value()
  if (existing) {
    db.get('presupuesto_gastos_mes').find({ id: existing.id }).assign({
      gasto_real: parseFloat(gasto_real) || existing.gasto_real,
      factura_folio: factura_folio !== undefined ? factura_folio : existing.factura_folio,
      ahorro_soporte: parseFloat(ahorro_soporte) || existing.ahorro_soporte || 0,
      ahorro_descripcion: ahorro_descripcion !== undefined ? ahorro_descripcion : existing.ahorro_descripcion,
      updated_at: new Date().toISOString()
    }).write()
    return res.json(db.get('presupuesto_gastos_mes').find({ id: existing.id }).value())
  }
  const item = {
    id: uuidv4(), partida_id, mes: parseInt(mes), anio: parseInt(anio),
    gasto_real: parseFloat(gasto_real) || 0,
    factura_folio: factura_folio || '',
    ahorro_soporte: parseFloat(ahorro_soporte) || 0,
    ahorro_descripcion: ahorro_descripcion || '',
    created_at: new Date().toISOString(), updated_at: new Date().toISOString()
  }
  db.get('presupuesto_gastos_mes').push(item).write()
  res.status(201).json(item)
})

// ── Cambios al presupuesto ────────────────────────────────────────────────────
router.get('/cambios', (req, res) => {
  const { partida_id } = req.query
  let items = db.get('presupuesto_cambios').value()
  if (partida_id) items = items.filter(c => c.partida_id === partida_id)
  res.json(items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)))
})
router.post('/cambios', requireRoles('super_admin', 'agente_soporte'), (req, res) => {
  const { partida_id, mes, anio, monto_nuevo, nota } = req.body
  const partida = db.get('presupuesto_partidas').find({ id: partida_id }).value()
  if (!partida) return res.status(404).json({ message: 'Partida no encontrada' })
  const cambio = {
    id: uuidv4(), partida_id, mes: parseInt(mes) || null, anio: parseInt(anio) || new Date().getFullYear(),
    monto_anterior: partida.monto_mensual,
    monto_nuevo: parseFloat(monto_nuevo),
    nota: nota || '',
    creado_por: req.user.id,
    creado_por_nombre: req.user.nombre,
    created_at: new Date().toISOString()
  }
  db.get('presupuesto_cambios').push(cambio).write()
  // Actualizar monto de la partida
  db.get('presupuesto_partidas').find({ id: partida_id }).assign({ monto_mensual: parseFloat(monto_nuevo), updated_at: new Date().toISOString() }).write()
  res.status(201).json(cambio)
})

// ── Desgloce (finanzas_detalle) ───────────────────────────────────────────────
router.get('/detalle', (req, res) => {
  const { mes, anio, proveedor, identificador } = req.query
  let items = db.get('finanzas_detalle').value()
  if (mes) items = items.filter(d => d.mes === parseInt(mes))
  if (anio) items = items.filter(d => d.anio === parseInt(anio))
  if (proveedor) items = items.filter(d => d.proveedor?.toLowerCase().includes(proveedor.toLowerCase()))
  if (identificador) items = items.filter(d => d.identificador === identificador)
  res.json({ data: items, total: items.length })
})
router.post('/detalle/clonar', requireRoles('super_admin', 'agente_soporte'), (req, res) => {
  const { mes_origen, anio_origen, mes_destino, anio_destino } = req.body
  const origen = db.get('finanzas_detalle').filter({ mes: parseInt(mes_origen), anio: parseInt(anio_origen) }).value()
  if (!origen.length) return res.status(404).json({ message: 'No hay registros en el mes origen' })
  const nuevos = origen.map(d => ({
    ...d, id: uuidv4(),
    mes: parseInt(mes_destino), anio: parseInt(anio_destino),
    factura_folio: '',
    created_at: new Date().toISOString(), updated_at: new Date().toISOString()
  }))
  for (const n of nuevos) db.get('finanzas_detalle').push(n).write()
  res.status(201).json({ clonados: nuevos.length, data: nuevos })
})
router.post('/detalle', requireRoles('super_admin', 'agente_soporte'), (req, res) => {
  const body = req.body
  // Calculate totals
  const modo_calculo = body.modo_calculo || 'dias'
  const tiene_vigencia = body.tiene_vigencia ? 1 : 0
  let subtotal
  if (modo_calculo === 'total') {
    subtotal = parseFloat(body.subtotal_directo || body.subtotal) || 0
  } else {
    subtotal = (parseFloat(body.dias_facturados) || 30) * (parseFloat(body.costo_dia) || 0)
  }
  const aplica_iva = body.aplica_iva !== false && body.aplica_iva !== 0
  const iva_monto = aplica_iva ? subtotal * 0.16 : 0
  const total = subtotal + iva_monto
  const item = {
    id: uuidv4(),
    mes: parseInt(body.mes) || new Date().getMonth() + 1,
    anio: parseInt(body.anio) || new Date().getFullYear(),
    nombre: body.nombre || '', email: body.email || '',
    telefono_serie: body.telefono_serie || '',
    departamento: body.departamento || '', subdepartamento: body.subdepartamento || '',
    puesto: body.puesto || '',
    contrato_vigencia: body.contrato_vigencia || '',
    proveedor: body.proveedor || '',
    factura_folio: body.factura_folio || '',
    tipo_servicio: body.tipo_servicio || '',
    moneda: body.moneda || 'MXN',
    tipo_cambio: parseFloat(body.tipo_cambio) || 1,
    dias_facturados: parseInt(body.dias_facturados) || 30,
    costo_dia: parseFloat(body.costo_dia) || 0,
    subtotal, aplica_iva: aplica_iva ? 1 : 0, iva_monto, total,
    modo_calculo,
    tiene_vigencia,
    identificador: body.identificador || 'Administrativo',
    centro_costo_codigo: body.centro_costo_codigo || '',
    centro_costo_nombre: body.centro_costo_nombre || '',
    dispositivo_id: body.dispositivo_id || null,
    partida_id: body.partida_id || null,
    empleado_id: body.empleado_id || null,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString()
  }
  db.get('finanzas_detalle').push(item).write()
  syncGastoReal(item.partida_id, item.mes, item.anio)
  res.status(201).json(item)
})
router.put('/detalle/:id', requireRoles('super_admin', 'agente_soporte'), (req, res) => {
  const item = db.get('finanzas_detalle').find({ id: req.params.id }).value()
  if (!item) return res.status(404).json({ message: 'No encontrado' })
  const body = req.body
  const modo = body.modo_calculo ?? item.modo_calculo ?? 'dias'
  const dias = parseFloat(body.dias_facturados ?? item.dias_facturados) || 30
  const costo = parseFloat(body.costo_dia ?? item.costo_dia) || 0
  let subtotal
  if (modo === 'total') {
    subtotal = parseFloat(body.subtotal_directo ?? body.subtotal ?? item.subtotal) || 0
  } else {
    subtotal = dias * costo
  }
  const aplica = body.aplica_iva !== undefined ? (body.aplica_iva !== false && body.aplica_iva !== 0) : !!item.aplica_iva
  const iva_monto = aplica ? subtotal * 0.16 : 0
  const updates = {
    ...body,
    dias_facturados: dias,
    costo_dia: costo,
    subtotal,
    aplica_iva: aplica ? 1 : 0,
    iva_monto,
    total: subtotal + iva_monto,
    modo_calculo: modo,
    tiene_vigencia: body.tiene_vigencia !== undefined ? (body.tiene_vigencia ? 1 : 0) : item.tiene_vigencia,
    updated_at: new Date().toISOString()
  }
  delete updates.subtotal_directo  // campo de cálculo, no existe en MySQL
  delete updates.ahorro_soporte    // pertenece a presupuesto_gastos_mes, no a finanzas_detalle
  delete updates.ahorro_descripcion
  db.get('finanzas_detalle').find({ id: req.params.id }).assign(updates).write()
  const updated = db.get('finanzas_detalle').find({ id: req.params.id }).value()
  syncGastoReal(updated.partida_id, updated.mes, updated.anio)
  res.json(updated)
})
router.delete('/detalle', requireRoles('super_admin', 'agente_soporte'), async (req, res) => {
  const { ids } = req.body
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: 'IDs requeridos' })
  let eliminados = 0
  for (const id of ids) {
    const item = db.get('finanzas_detalle').find({ id }).value()
    if (item) {
      db.get('finanzas_detalle').remove({ id }).write()
      syncGastoReal(item.partida_id, item.mes, item.anio)
      eliminados++
    }
  }
  res.json({ eliminados })
})
router.delete('/detalle/:id', requireRoles('super_admin', 'agente_soporte'), (req, res) => {
  const toDelete = db.get('finanzas_detalle').find({ id: req.params.id }).value()
  db.get('finanzas_detalle').remove({ id: req.params.id }).write()
  if (toDelete) syncGastoReal(toDelete.partida_id, toDelete.mes, toDelete.anio)
  res.json({ ok: true })
})

// ── Re-sync masivo gasto_real desde finanzas_detalle (ruta de mantenimiento) ──
router.post('/sync-gastos', requireRoles('super_admin'), (req, res) => {
  const all = db.get('finanzas_detalle').filter(d => d.partida_id).value()
  const keys = new Set(all.map(d => `${d.partida_id}|${d.mes}|${d.anio}`))
  let synced = 0
  for (const k of keys) {
    const [partida_id, mes, anio] = k.split('|')
    syncGastoReal(partida_id, parseInt(mes), parseInt(anio))
    synced++
  }
  res.json({ ok: true, synced })
})

// ── Buscar dispositivo por serie ──────────────────────────────────────────────
router.get('/dispositivo-por-serie', (req, res) => {
  const { serie } = req.query
  if (!serie) return res.json(null)
  const dev = db.get('dispositivos').filter(d => d.serie && d.serie.toLowerCase() === serie.toLowerCase()).value()[0]
  if (!dev) return res.json(null)
  res.json({ id: dev.id, tipo: dev.tipo, marca: dev.marca, modelo: dev.modelo, costo_dia: dev.costo_dia })
})

// ── Dashboard data ────────────────────────────────────────────────────────────
router.get('/dashboard', (req, res) => {
  const { anio = new Date().getFullYear(), empresa, agrupador, proveedor } = req.query
  const yr = parseInt(anio)

  let partidas = db.get('presupuesto_partidas').filter(x => x.activo).value()
  if (empresa) partidas = partidas.filter(p => p.empresa === empresa)
  if (agrupador) partidas = partidas.filter(p => p.agrupador === agrupador)
  if (proveedor) partidas = partidas.filter(p => p.proveedor?.toLowerCase().includes(proveedor.toLowerCase()))

  const partidaIds = partidas.map(p => p.id)
  const gastos = db.get('presupuesto_gastos_mes').filter(g => g.anio === yr && partidaIds.includes(g.partida_id)).value()

  // Build monthly data (12 months)
  const meses = []
  for (let m = 1; m <= 12; m++) {
    const presupuesto = partidas.reduce((s, p) => {
      // Use montos_por_mes[m-1] if available, else monto_mensual
      const mpm = Array.isArray(p.montos_por_mes) ? p.montos_por_mes : null
      return s + (mpm ? (mpm[m-1] || 0) : (p.monto_mensual || 0))
    }, 0)
    const gastosMes = gastos.filter(g => g.mes === m)
    const gasto_real = gastosMes.reduce((s, g) => s + (g.gasto_real || 0), 0)
    const ahorro_soporte = gastosMes.reduce((s, g) => s + (g.ahorro_soporte || 0), 0)
    // Solo mostrar no_ejercido si hay algún registro de actividad en ese mes
    const tieneActividad = gasto_real > 0 || ahorro_soporte > 0
    const no_ejercido = tieneActividad ? Math.max(0, presupuesto - gasto_real - ahorro_soporte) : 0
    meses.push({ mes: m, presupuesto, gasto_real, ahorro_soporte, no_ejercido })
  }

  // Solo contabilizar hasta el mes actual (no el año completo para KPIs)
  const nowYear = new Date().getFullYear()
  const nowMonth = new Date().getMonth() + 1
  const mesActual = parseInt(req.query.mes_actual) ||
    (yr < nowYear ? 12 : (yr > nowYear ? 0 : nowMonth))

  const mesesHoy = meses.filter(m => m.mes <= mesActual)
  const totalPresupuesto = mesesHoy.reduce((s, m) => s + m.presupuesto, 0)
  const totalReal = mesesHoy.reduce((s, m) => s + m.gasto_real, 0)
  const totalAhorro = mesesHoy.reduce((s, m) => s + m.ahorro_soporte, 0)

  res.json({
    kpis: {
      presupuesto: totalPresupuesto,
      gasto_real: totalReal,
      ahorro_soporte: totalAhorro,
      porcentaje_ejercido: totalPresupuesto > 0 ? (totalReal / totalPresupuesto) * 100 : 0,
      mes_actual: mesActual
    },
    meses,
    partidas: partidas.map(p => {
      const pg = gastos.filter(g => g.partida_id === p.id && g.mes <= mesActual)
      const mpm = Array.isArray(p.montos_por_mes) ? p.montos_por_mes : null
      const presupuesto_hasta_hoy = mpm
        ? mpm.slice(0, mesActual).reduce((s, v) => s + (v || 0), 0)
        : (p.monto_mensual || 0) * mesActual
      const presupuesto_anual = mpm ? mpm.reduce((s, v) => s + (v || 0), 0) : (p.monto_mensual || 0) * 12
      // Per-month breakdown for period-aware frontend calculations
      const allPg = gastos.filter(g => g.partida_id === p.id)
      const gastos_por_mes = Array.from({length: 12}, (_, i) => {
        const g = allPg.find(g => g.mes === i + 1)
        return g?.gasto_real || 0
      })
      const ahorro_por_mes = Array.from({length: 12}, (_, i) => {
        const g = allPg.find(g => g.mes === i + 1)
        return g?.ahorro_soporte || 0
      })
      return {
        ...p,
        gasto_real_total: pg.reduce((s, g) => s + (g.gasto_real || 0), 0),
        ahorro_total: pg.reduce((s, g) => s + (g.ahorro_soporte || 0), 0),
        presupuesto_hasta_hoy,
        presupuesto_anual,
        gastos_por_mes,
        ahorro_por_mes
      }
    })
  })
})

router.post('/seed-excel', requireRoles('super_admin'), (req, res) => {
  // Check if already seeded
  const existing = db.get('presupuesto_partidas').filter(x => x.activo).value()
  if (existing.length >= 10) {
    return res.status(400).json({ message: 'Ya existen partidas cargadas. Limpia primero si deseas reimportar.' })
  }

  const AGRUPADORES = ['TI Nube','TI Licencias','Telefonía e Internet','Renta de Equipos de Computo','TI Desarrollo','TI Infraestructura']
  const now = new Date().toISOString()

  // Create agrupadores
  for (const nombre of AGRUPADORES) {
    const existe = db.get('presupuesto_agrupadores').find({ nombre }).value()
    if (!existe) {
      db.get('presupuesto_agrupadores').push({ id: uuidv4(), nombre, activo: true, created_at: now }).write()
    }
  }

  const PARTIDAS = [
    { empresa:'Previta', agrupador:'TI Nube', proveedor:'Microsoft Azure EHT', concepto:'Renta de servicios en la nube para EHT', monto_mensual:38134, montos:[38134,38134,38134,38134,38134,38134,38134,38134,38134,38134,38134,38134], reales:{1:37090.96,2:37111,3:31109.1} },
    { empresa:'Previta', agrupador:'TI Nube', proveedor:'Microsoft Azure PREVITA', concepto:'Renta de servicios en la nube para Previta', monto_mensual:45634, montos:[45634,45634,45634,45634,45634,45634,45634,45634,45634,45634,45634,45634], reales:{1:34027.06,2:24461,3:20468.09} },
    { empresa:'EHT', agrupador:'TI Nube', proveedor:'Amazon Web Services Inc. EHT', concepto:'Renta de servicios en la nube para EHT', monto_mensual:33799.8, montos:[33799.8,33799.8,33799.8,33799.8,33799.8,33799.8,33799.8,33799.8,33799.8,33799.8,33799.8,33799.8], reales:{1:28402,2:29417.08,3:30171.48} },
    { empresa:'Previta', agrupador:'TI Licencias', proveedor:'SWON Software ONE', concepto:'Licenciamiento Microsoft 365 Oficinas', monto_mensual:24000, montos:[24000,24000,24000,24000,24000,24000,24000,24000,24000,24000,24000,24000], reales:{1:29153,2:24982.1,3:0} },
    { empresa:'Previta', agrupador:'Telefonía e Internet', proveedor:'Telcel', concepto:'Lineas de telefono movil y servicios de internet para consultorios', monto_mensual:54138, montos:[54138,54138,54138,54138,54138,54138,54138,54138,54138,54138,54138,54138], reales:{1:55652.35,2:55652.35,3:0} },
    { empresa:'Previta', agrupador:'Renta de Equipos de Computo', proveedor:'Epsilon', concepto:'Renta de Equipos de Computo', monto_mensual:14527.84, montos:[14527.84,14527.84,11527.84,11527.84,5527.84,5527.84,5527.84,3527.84,3527.84,2000,2000,2000], reales:{1:14527.84,2:10962,3:0} },
    { empresa:'Previta', agrupador:'TI Nube', proveedor:'AWS Previta', concepto:'Servicios en la nube AWS cuenta de Previta', monto_mensual:28306.2, montos:[28306.2,28306.2,28306.2,28306.2,28306.2,28306.2,28306.2,28306.2,28306.2,28306.2,28306.2,28306.2], reales:{1:8132,2:8991,3:9047.98} },
    { empresa:'Previta', agrupador:'TI Licencias', proveedor:'Atlassian Pty Ltd', concepto:'Licencias JIRA', monto_mensual:13472.68, montos:[13472.68,13472.68,13472.68,13472.68,13472.68,13472.68,13472.68,13472.68,13472.68,13472.68,13472.68,13472.68], reales:{1:2177.60,2:2560.61,3:9667.15} },
    { empresa:'Previta', agrupador:'TI Licencias', proveedor:'B1 Consulting SC', concepto:'Mantenimiento 16 licencias SAP', monto_mensual:32622.28, montos:[32622.28,32622.28,32622.28,0,0,0,0,0,0,0,0,0], reales:{1:32622.28,2:32622.28,3:0} },
    { empresa:'Previta', agrupador:'TI Licencias', proveedor:'Mailchimp', concepto:'Envío de correos y comunicación de campañas', monto_mensual:7000, montos:[7000,7000,7000,7000,7000,7000,7000,7000,7000,7000,7000,7000], reales:{1:6293,2:2748.57,3:2800} },
    { empresa:'Previta', agrupador:'TI Nube', proveedor:'Amazon Web Services Inc. CLUB', concepto:'Renta de servicios en la nube para Club de Salud', monto_mensual:7580, montos:[7580,7580,7580,7580,7580,7580,7580,7580,7580,7580,7580,7580], reales:{1:12.42,2:15,3:14.53} },
    { empresa:'Previta', agrupador:'Renta de Equipos de Computo', proveedor:'CyDCOM', concepto:'Renta de Equipos de Computo', monto_mensual:90151.72, montos:[90151.72,90151.72,90151.72,90151.72,90151.72,90151.72,90151.72,90151.72,90151.72,90151.72,90151.72,90151.72], reales:{1:94556.82,2:85942.08,3:0} },
    { empresa:'Previta', agrupador:'Renta de Equipos de Computo', proveedor:'RIKET 333 SA DE CV', concepto:'Renta de MACBOOK', monto_mensual:1790.09, montos:[1790.09,1790.09,1790.09,1790.09,1790.09,1790.09,1790.09,1790.09,1790.09,1790.09,1790.09,1790.09], reales:{1:1790.09,2:1790.09,3:1790.09} },
    { empresa:'Previta', agrupador:'TI Licencias', proveedor:'Signnow', concepto:'Plataforma para firmas electrónicas', monto_mensual:1310.4, montos:[1310.4,1310.4,1310.4,1310.4,1310.4,1310.4,1310.4,1310.4,1310.4,1310.4,1310.4,1310.4], reales:{1:139,2:139,3:0} },
    { empresa:'Previta', agrupador:'TI Licencias', proveedor:'MICROSOFT', concepto:'30 Licencias de Office', monto_mensual:1310.4, montos:[1310.4,1310.4,1310.4,1310.4,1310.4,1310.4,1310.4,1310.4,1310.4,1310.4,1310.4,1310.4], reales:{1:0,2:0,3:0} },
    { empresa:'Medclub', agrupador:'TI Licencias', proveedor:'Mailchimp', concepto:'Envío de correos automáticos (Medclub)', monto_mensual:800, montos:[800,800,800,800,800,800,800,800,800,800,800,800], reales:{1:720,2:216.2,3:0} },
    { empresa:'Previta', agrupador:'TI Licencias', proveedor:'Microsoft 365 - Quiosco', concepto:'227 Licencias para CAF y Administración (no usuarios)', monto_mensual:9472, montos:[9472,9472,9472,9472,9472,9472,9472,9472,9472,9472,9472,9472], reales:{1:9534,2:9534,3:0} },
    { empresa:'Previta', agrupador:'TI Licencias', proveedor:'Google LLC', concepto:'Cuenta de G Suite', monto_mensual:667.71, montos:[667.71,667.71,667.71,667.71,667.71,667.71,667.71,667.71,667.71,667.71,667.71,667.71], reales:{1:590,2:588.46,3:0} },
    { empresa:'Previta', agrupador:'TI Licencias', proveedor:'GoDaddy', concepto:'Gestor de 9 dominios', monto_mensual:935.98, montos:[935.98,935.98,935.98,935.98,935.98,935.98,935.98,935.98,935.98,935.98,935.98,935.98], reales:{1:454,2:2240.91,3:0} },
    { empresa:'Previta', agrupador:'TI Licencias', proveedor:'WIX', concepto:'WIX - Plataforma web', monto_mensual:410.8, montos:[410.8,410.8,410.8,410.8,410.8,410.8,410.8,410.8,410.8,410.8,410.8,410.8], reales:{1:415,2:415,3:0} },
    { empresa:'Previta', agrupador:'TI Licencias', proveedor:'Signeasy', concepto:'Herramienta para firma digital en campañas', monto_mensual:335.4, montos:[335.4,335.4,335.4,335.4,335.4,335.4,335.4,335.4,335.4,335.4,335.4,335.4], reales:{1:260,2:266.61,3:0} },
    { empresa:'Previta', agrupador:'TI Nube', proveedor:'MONGODBCLOUD PREVITA', concepto:'Base de datos para cuestionarios dinámicos', monto_mensual:147.3, montos:[147.3,147.3,147.3,147.3,147.3,147.3,147.3,147.3,147.3,147.3,147.3,147.3], reales:{1:149.04,2:143.88,3:0} },
    { empresa:'Previta', agrupador:'TI Desarrollo', proveedor:'APPLE OPERATIONS MEXICO', concepto:'Anualidad para desarrollos en iOS', monto_mensual:0, montos:[0,0,1818.96,0,0,0,0,0,0,0,0,0], reales:{1:0,2:0,3:1749} },
    { empresa:'Previta', agrupador:'TI Infraestructura', proveedor:'AirTable', concepto:'Inteligencia Artificial - AirTable', monto_mensual:454.72, montos:[454.72,454.72,454.72,454.72,454.72,454.72,454.72,454.72,454.72,454.72,454.72,454.72], reales:{1:431.58,2:424.96,3:0} },
    { empresa:'Previta', agrupador:'TI Licencias', proveedor:'Amazon Prime', concepto:'Suscripciones Amazon Prime', monto_mensual:99, montos:[99,99,99,99,99,99,99,99,99,99,99,99], reales:{1:99,2:0,3:0} },
    { empresa:'Previta', agrupador:'TI Licencias', proveedor:'CCleaner', concepto:'Seguridad de la información - CCleaner', monto_mensual:0, montos:[0,0,0,0,0,0,0,0,0,716.56,0,0], reales:{1:0,2:0,3:0} },
    { empresa:'Previta', agrupador:'TI Licencias', proveedor:'Claude', concepto:'Licenciamiento Inteligencia Artificial - Claude', monto_mensual:1895.92, montos:[1895.92,1895.92,1895.92,1895.92,1895.92,1895.92,1895.92,1895.92,1895.92,1895.92,1895.92,1895.92], reales:{1:3663.4,2:3571.27,3:0} },
    { empresa:'Previta', agrupador:'TI Licencias', proveedor:'File Request', concepto:'Inteligencia Artificial - File Request', monto_mensual:1308.12, montos:[1308.12,1308.12,1308.12,1308.12,1308.12,1308.12,1308.12,1308.12,1308.12,1308.12,1308.12,1308.12], reales:{1:1267.76,2:1213.58,3:0} },
    { empresa:'Previta', agrupador:'TI Infraestructura', proveedor:'FloNetworks 1 y 2', concepto:'Telecomunicaciones - FloNetworks', monto_mensual:21300, montos:[21300,21300,21300,21300,21300,21300,21300,21300,21300,21300,21300,21300], reales:{1:19880.21,2:19105.5,3:0} },
    { empresa:'Previta', agrupador:'TI Infraestructura', proveedor:'GoToMeeting', concepto:'Telecomunicaciones - GoToMeeting', monto_mensual:30800, montos:[0,30800,30800,30800,30800,30800,30800,30800,30800,30800,30800,30800], reales:{1:0,2:37681.06,3:0} },
    { empresa:'Previta', agrupador:'Renta de Equipos de Computo', proveedor:'KC Rentas', concepto:'Renta de Equipos de Computo - KC Rentas', monto_mensual:22749.8, montos:[22749.8,22749.8,22749.8,22749.8,22749.8,22749.8,22749.8,22749.8,22749.8,22749.8,22749.8,22749.8], reales:{1:24141.8,2:24072.2,3:0} },
    { empresa:'Previta', agrupador:'TI Licencias', proveedor:'Fortinet', concepto:'Licenciamiento Fortinet', monto_mensual:0, montos:[0,0,0,0,0,0,0,0,0,0,28762.13,0], reales:{1:0,2:0,3:0} },
    { empresa:'Previta', agrupador:'TI Licencias', proveedor:'N8N', concepto:'Inteligencia Artificial - N8N', monto_mensual:1550.52, montos:[1550.52,1550.52,1550.52,1550.52,1550.52,1550.52,1550.52,1550.52,1550.52,1550.52,1550.52,1550.52], reales:{1:1508.17,2:1472.76,3:0} },
    { empresa:'Previta', agrupador:'TI Licencias', proveedor:'Open IA', concepto:'Inteligencia Artificial - OpenAI', monto_mensual:377.96, montos:[377.96,377.96,377.96,377.96,377.96,377.96,377.96,377.96,377.96,377.96,377.96,377.96], reales:{1:370.4,2:356.36,3:0} },
    { empresa:'Previta', agrupador:'TI Infraestructura', proveedor:'Renovación Firewall Fortinet', concepto:'Renovación Firewall Fortinet', monto_mensual:0, montos:[0,0,0,0,0,0,0,200000,0,0,0,0], reales:{1:0,2:0,3:0} },
    { empresa:'Previta', agrupador:'Telefonía e Internet', proveedor:'Telmex', concepto:'Telecomunicaciones - Telmex', monto_mensual:30691.62, montos:[30691.62,30691.62,30691.62,30691.62,30691.62,30691.62,30691.62,30691.62,30691.62,30691.62,30691.62,30691.62], reales:{1:22094.43,2:21529.68,3:0} },
    { empresa:'Previta', agrupador:'TI Licencias', proveedor:'WATI', concepto:'Inteligencia Artificial - WATI', monto_mensual:11627.36, montos:[11627.36,11627.36,11627.36,11627.36,11627.36,11627.36,11627.36,11627.36,11627.36,11627.36,11627.36,11627.36], reales:{1:5686.78,2:5456.61,3:0} },
    { empresa:'Previta', agrupador:'TI Licencias', proveedor:'INNOVIT', concepto:'Seguridad de computadoras - INNOVIT', monto_mensual:0, montos:[0,0,0,0,0,0,0,0,0,0,50000,0], reales:{1:0,2:0,3:0} },
  ]

  const createdPartidas = []
  for (const p of PARTIDAS) {
    const partida = {
      id: uuidv4(), empresa: p.empresa, agrupador: p.agrupador, proveedor: p.proveedor,
      concepto: p.concepto, monto_mensual: p.monto_mensual,
      montos_por_mes: p.montos,
      activo: true, created_at: now, updated_at: now
    }
    db.get('presupuesto_partidas').push(partida).write()
    createdPartidas.push(partida)

    // Create gastos reales for months 1, 2, 3 of 2026
    for (const [mesStr, gasto] of Object.entries(p.reales)) {
      if (gasto > 0) {
        const gastoItem = {
          id: uuidv4(), partida_id: partida.id, mes: parseInt(mesStr), anio: 2026,
          gasto_real: gasto, factura_folio: '', ahorro_soporte: 0, ahorro_descripcion: '',
          created_at: now, updated_at: now
        }
        db.get('presupuesto_gastos_mes').push(gastoItem).write()
      }
    }
  }

  res.json({
    ok: true,
    agrupadores_creados: AGRUPADORES.length,
    partidas_creadas: createdPartidas.length,
    mensaje: `Importados ${createdPartidas.length} partidas y gastos reales de Ene-Mar 2026`
  })
})

module.exports = router
