const router = require('express').Router()
const { v4: uuidv4 } = require('uuid')
const fs = require('fs')
const path = require('path')
const db = require('../data/db')
const { authMiddleware, requireRoles } = require('../middleware/auth.middleware')
const { auditLog } = require('../middleware/audit.middleware')

// SharePoint — carga condicional: si no hay credenciales configuradas el módulo
// simplemente se deshabilita y los documentos se guardan solo localmente.
let sp = null
try {
  sp = require('../services/sharepoint.service')
  if (!process.env.SHAREPOINT_TENANT_ID) sp = null
} catch (_) { sp = null }

const SP_ENABLED = !!sp

router.use(authMiddleware)

const uploadsDir = path.join(__dirname, '../../uploads/firmas')
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })

router.get('/', (req, res) => {
  const { tipo, page = 1, limit = 20, search, entidad_tipo } = req.query
  let items = db.get('documentos').value()
  if (tipo) items = items.filter(d => d.tipo === tipo)
  if (entidad_tipo) items = items.filter(d => d.entidad_tipo === entidad_tipo)
  if (search) {
    const q = search.toLowerCase()
    items = items.filter(d =>
      d.entidad_nombre?.toLowerCase().includes(q) ||
      d.folio?.toLowerCase().includes(q) ||
      d.agente_nombre?.toLowerCase().includes(q)
    )
  }
  items = items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  const total = items.length
  const offset = (parseInt(page) - 1) * parseInt(limit)
  res.json({ data: items.slice(offset, offset + parseInt(limit)), total, page: parseInt(page), limit: parseInt(limit) })
})

router.get('/:id', (req, res) => {
  const item = db.get('documentos').find({ id: req.params.id }).value()
  if (!item) return res.status(404).json({ message: 'Documento no encontrado' })
  const plantilla = item.plantilla_id ? db.get('plantillas').find({ id: item.plantilla_id }).value() : null
  res.json({ ...item, plantilla })
})

router.post('/', requireRoles('super_admin', 'agente_soporte'), auditLog('crear', 'documento'), (req, res) => {
  const { tipo, plantilla_id, entidad_tipo, entidad_id, dispositivos, observaciones, receptor_id } = req.body
  if (!tipo || !entidad_tipo || !entidad_id || !dispositivos?.length) {
    const missing = { tipo: !tipo, entidad_tipo: !entidad_tipo, entidad_id: !entidad_id, dispositivos: !dispositivos?.length }
    console.log('[documento.routes] Validación fallida. Body recibido:', JSON.stringify(req.body), 'Campos faltantes:', JSON.stringify(missing))
    return res.status(400).json({ message: 'Tipo, entidad y dispositivos son requeridos', missing })
  }

  let entidad = null
  if (entidad_tipo === 'empleado') {
    entidad = db.get('empleados').filter(e => e.id === entidad_id && e.activo).value()[0]
  } else {
    entidad = db.get('sucursales').filter(s => s.id === entidad_id && s.activo).value()[0]
  }
  if (!entidad) return res.status(404).json({ message: 'Entidad no encontrada' })

  // dispositivos is array of {id, costo}
  const dispositivosEnriquecidos = dispositivos.map(({ id, costo }) => {
    const dev = db.get('dispositivos').find({ id }).value()
    if (!dev) return null
    return { id: dev.id, tipo: dev.tipo, marca: dev.marca, serie: dev.serie, modelo: dev.modelo, caracteristicas: dev.caracteristicas, costo: parseFloat(costo) || 0 }
  }).filter(Boolean)

  let receptor = null
  if (receptor_id) {
    receptor = db.get('empleados').filter(e => e.id === receptor_id && e.activo).value()[0]
  }

  const total = db.get('documentos').size().value()
  const folio = `${tipo.toUpperCase()}-${String(total + 1).padStart(6, '0')}`
  const now = new Date().toISOString()

  const doc = {
    id: uuidv4(), folio, tipo,
    plantilla_id: plantilla_id || null,
    entidad_tipo, entidad_id,
    entidad_nombre: entidad_tipo === 'empleado' ? entidad.nombre_completo : entidad.nombre,
    dispositivos: dispositivosEnriquecidos,
    agente_id: req.user.id, agente_nombre: req.user.nombre,
    firma_agente: null, firma_agente_path: null,
    receptor_id: receptor_id || null,
    receptor_nombre: receptor ? receptor.nombre_completo : (req.body.receptor_nombre || null),
    firma_receptor: null, firma_receptor_path: null,
    firmado: false, fecha_firma: null,
    observaciones: observaciones || '',
    created_by: req.user.id, created_by_nombre: req.user.nombre,
    created_at: now, updated_at: now
  }

  db.get('documentos').push(doc).write()
  res.status(201).json(doc)
})

// Firmar documento
router.post('/:id/firmar', requireRoles('super_admin', 'agente_soporte'), auditLog('firmar', 'documento'), async (req, res) => {
  const doc = db.get('documentos').find({ id: req.params.id }).value()
  if (!doc) return res.status(404).json({ message: 'Documento no encontrado' })
  if (doc.firmado) return res.status(409).json({ message: 'El documento ya fue firmado' })

  const { firma_agente, firma_receptor } = req.body
  if (!firma_receptor) return res.status(400).json({ message: 'Se requiere la firma del receptor' })

  // Usar firma almacenada del agente si no viene en el body
  const agentUser = db.get('usuarios_sistema').find({ id: req.user.id }).value()
  const firmaAgenteData = firma_agente || agentUser?.firma_base64
  if (!firmaAgenteData) return res.status(400).json({ message: 'Se requiere la firma del agente (sube tu firma en tu perfil de usuario)' })

  // Guardar firmas como archivos
  const agentePath = path.join(uploadsDir, `${doc.id}_agente.png`)
  const receptorPath = path.join(uploadsDir, `${doc.id}_receptor.png`)
  const base64Agente = firmaAgenteData.replace(/^data:image\/\w+;base64,/, '')
  const base64Receptor = firma_receptor.replace(/^data:image\/\w+;base64,/, '')
  fs.writeFileSync(agentePath, Buffer.from(base64Agente, 'base64'))
  fs.writeFileSync(receptorPath, Buffer.from(base64Receptor, 'base64'))

  const now = new Date().toISOString()
  const updated = {
    ...doc,
    firma_agente: firmaAgenteData,
    firma_agente_path: `/uploads/firmas/${doc.id}_agente.png`,
    firma_receptor,
    firma_receptor_path: `/uploads/firmas/${doc.id}_receptor.png`,
    firmado: true, fecha_firma: now, updated_at: now,
    // SharePoint — se rellenan abajo si el servicio está activo
    sharepoint_item_id:      null,
    sharepoint_url:          null,
    sharepoint_uploaded_at:  null,
  }

  // ── Subir PDF a SharePoint (si viene en el body y SP está configurado) ──────
  if (SP_ENABLED && req.body.pdf_base64) {
    try {
      const pdfBuffer = Buffer.from(
        req.body.pdf_base64.replace(/^data:application\/pdf;base64,/, ''),
        'base64'
      )
      const safeName = `${doc.folio}_${doc.entidad_nombre.replace(/\s+/g, '_')}.pdf`
      const subfolder = doc.tipo  // 'entrada' | 'salida' | 'responsiva'

      const spFile = await sp.uploadFile(pdfBuffer, safeName, subfolder)

      updated.sharepoint_item_id     = spFile.id
      updated.sharepoint_url         = spFile.webUrl
      updated.sharepoint_uploaded_at = now

      console.log(`[SharePoint] ✓ Documento subido: ${spFile.webUrl}`)
    } catch (spErr) {
      // No bloquear la firma si SP falla — solo registrar
      console.error('[SharePoint] Error al subir documento:', spErr.message)
    }
  }

  db.get('documentos').find({ id: req.params.id }).assign(updated).write()

  // ── Auto-asignaciones al firmar ────────────────────────────────────────────
  if (['salida', 'responsiva'].includes(doc.tipo)) {
    for (const devInfo of (doc.dispositivos || [])) {
      const dispositivo = db.get('dispositivos').find({ id: devInfo.id, activo: true }).value()
      if (!dispositivo) continue
      const asigActiva = db.get('asignaciones').find({ dispositivo_id: devInfo.id, activo: true }).value()
      if (asigActiva) continue  // ya asignado

      let destinatario = null, lat = null, lng = null
      if (doc.entidad_tipo === 'empleado') {
        destinatario = db.get('empleados').find({ id: doc.entidad_id, activo: true }).value()
        if (destinatario?.sucursal_id) {
          const suc = db.get('sucursales').find({ id: destinatario.sucursal_id }).value()
          lat = suc?.lat || null; lng = suc?.lng || null
        }
      } else {
        destinatario = db.get('sucursales').find({ id: doc.entidad_id, activo: true }).value()
        lat = destinatario?.lat || null; lng = destinatario?.lng || null
      }
      if (!destinatario) continue

      const asig = {
        id: uuidv4(),
        dispositivo_id: devInfo.id, dispositivo_tipo: dispositivo.tipo,
        dispositivo_serie: dispositivo.serie, dispositivo_marca: dispositivo.marca,
        dispositivo_modelo: dispositivo.modelo,
        tipo_asignacion: doc.entidad_tipo, asignado_a_id: doc.entidad_id,
        asignado_a_nombre: doc.entidad_tipo === 'empleado' ? destinatario.nombre_completo : destinatario.nombre,
        asignado_por_id: req.user.id, asignado_por_nombre: req.user.nombre,
        observaciones: `Auto-asignado por documento ${doc.folio}`,
        fecha_asignacion: now, fecha_devolucion: null, activo: true, created_at: now
      }
      db.get('asignaciones').push(asig).write()
      db.get('dispositivos').find({ id: devInfo.id }).assign({
        estado: 'activo', ubicacion_tipo: doc.entidad_tipo,
        ubicacion_id: doc.entidad_id,
        ubicacion_nombre: doc.entidad_tipo === 'empleado' ? destinatario.nombre_completo : destinatario.nombre,
        lat, lng, updated_at: now
      }).write()
    }
  }

  // Entrada: devolver equipos al almacén
  if (doc.tipo === 'entrada') {
    for (const devInfo of (doc.dispositivos || [])) {
      const asigActiva = db.get('asignaciones').find({ dispositivo_id: devInfo.id, activo: true }).value()
      if (asigActiva) {
        db.get('asignaciones').find({ id: asigActiva.id }).assign({ activo: false, fecha_devolucion: now }).write()
        db.get('dispositivos').find({ id: devInfo.id }).assign({
          estado: 'stock', ubicacion_tipo: 'almacen',
          ubicacion_id: null, ubicacion_nombre: 'Almacén Central',
          lat: null, lng: null, updated_at: now
        }).write()
      }
    }
  }

  res.json(updated)
})

// ── Eliminar documento (y archivo de SharePoint si aplica) ───────────────────
router.delete('/:id', requireRoles('super_admin'), auditLog('eliminar', 'documento'), async (req, res) => {
  const doc = db.get('documentos').find({ id: req.params.id }).value()
  if (!doc) return res.status(404).json({ message: 'Documento no encontrado' })

  let sharepointDeleted = false
  let sharepointError   = null

  // Eliminar de SharePoint si tiene referencia
  if (SP_ENABLED && doc.sharepoint_item_id) {
    try {
      await sp.deleteFile(doc.sharepoint_item_id)
      sharepointDeleted = true
      console.log(`[SharePoint] ✓ Archivo eliminado: ${doc.sharepoint_item_id}`)
    } catch (spErr) {
      sharepointError = spErr.message
      console.error('[SharePoint] Error al eliminar archivo:', spErr.message)
    }
  }

  // Eliminar firmas locales
  const agentePath   = path.join(uploadsDir, `${doc.id}_agente.png`)
  const receptorPath = path.join(uploadsDir, `${doc.id}_receptor.png`)
  if (fs.existsSync(agentePath))   fs.unlinkSync(agentePath)
  if (fs.existsSync(receptorPath)) fs.unlinkSync(receptorPath)

  // Soft-delete del registro
  db.get('documentos').find({ id: req.params.id }).assign({
    activo: false, updated_at: new Date().toISOString()
  }).write()

  res.json({
    message: 'Documento eliminado',
    sharepoint: SP_ENABLED
      ? { deleted: sharepointDeleted, error: sharepointError }
      : { deleted: false, reason: 'SharePoint no configurado' }
  })
})

// ── Status de conexión con SharePoint ────────────────────────────────────────
router.get('/sharepoint/status', requireRoles('super_admin'), async (req, res) => {
  if (!SP_ENABLED) {
    return res.json({ enabled: false, message: 'SharePoint no configurado (faltan variables de entorno)' })
  }
  try {
    const info = await sp.testConnection()
    res.json({ enabled: true, ...info })
  } catch (err) {
    res.status(500).json({ enabled: true, ok: false, error: err.message })
  }
})

module.exports = router
