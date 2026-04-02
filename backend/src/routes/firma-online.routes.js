/**
 * firma-online.routes.js
 * Endpoints para el flujo de firma en línea del receptor.
 * Los endpoints GET/:token y POST/:token/firmar son PÚBLICOS (sin auth).
 * Solo POST /solicitar y GET /estado/:id requieren autenticación.
 *
 * IMPORTANTE: las rutas específicas (/solicitar, /estado/:id) van ANTES
 * de la ruta comodín (/:token) para que Express no las intercepte.
 */
const router   = require('express').Router()
const crypto   = require('crypto')
const fs       = require('fs')
const path     = require('path')
const os       = require('os')
const { v4: uuidv4 } = require('uuid')
const db       = require('../data/db')
const { authMiddleware } = require('../middleware/auth.middleware')

// ── Helpers ───────────────────────────────────────────────────────────────────
const EXPIRY_HOURS = 72

function generateToken() {
  return crypto.randomBytes(32).toString('hex')   // 64 chars hex
}

function getExpiryDate() {
  const d = new Date()
  d.setHours(d.getHours() + EXPIRY_HOURS)
  return d.toISOString()
}

/** Devuelve la IP local del servidor (primera IPv4 no-loopback) */
function getLocalIP() {
  const ifaces = os.networkInterfaces()
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address
    }
  }
  return '127.0.0.1'
}

// ── POST /api/firma-online/solicitar  (requiere auth) ────────────────────────
router.post('/solicitar', authMiddleware, (req, res) => {
  try {
    const { documento_id } = req.body
    if (!documento_id) return res.status(400).json({ message: 'documento_id requerido' })

    const doc = db.get('documentos').find({ id: documento_id }).value()
    if (!doc) return res.status(404).json({ message: 'Documento no encontrado' })
    if (doc.firmado) return res.status(400).json({ message: 'El documento ya está completamente firmado' })

    // Cancelar token anterior pendiente si existe
    const tokenAnterior = db.get('firma_tokens').find({ documento_id, estado: 'pendiente' }).value()
    if (tokenAnterior) {
      db.get('firma_tokens').find({ id: tokenAnterior.id }).assign({ estado: 'cancelado' }).write()
    }

    const token      = generateToken()
    const expires_at = getExpiryDate()
    const now        = new Date().toISOString()

    const nuevoToken = {
      id:             uuidv4(),
      token,
      documento_id,
      estado:         'pendiente',
      expires_at,
      firma_receptor: null,
      firmado_at:     null,
      ip_firmante:    null,
      created_at:     now,
      created_by:     req.user.id,
    }
    db.get('firma_tokens').push(nuevoToken).write()

    // Marcar documento con estado firma_online_estado = 'pendiente'
    db.get('documentos').find({ id: documento_id }).assign({
      firma_online_estado: 'pendiente',
      firma_online_token:  token,
    }).write()

    const localIP   = getLocalIP()
    const frontPort = process.env.FRONT_PORT || 5174
    const baseURL   = process.env.PUBLIC_URL || `http://${localIP}:${frontPort}`
    const signingURL = `${baseURL}/firmar/${token}`

    res.json({ token, url: signingURL, expires_at, local_ip: localIP })
  } catch (e) {
    console.error('[FirmaOnline] Error en /solicitar:', e.message)
    res.status(500).json({ message: 'Error generando token de firma: ' + e.message })
  }
})

// ── GET /api/firma-online/estado/:documento_id  (requiere auth) ───────────────
// IMPORTANTE: esta ruta debe ir ANTES de GET /:token para evitar que "estado"
// sea interpretado como un token.
router.get('/estado/:documento_id', authMiddleware, (req, res) => {
  try {
    const { documento_id } = req.params
    const tokens = db.get('firma_tokens').filter({ documento_id }).value()
    const ft = tokens.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]

    if (!ft) return res.json({ tiene_solicitud: false })

    res.json({
      tiene_solicitud: true,
      estado:          ft.estado,
      expires_at:      ft.expires_at,
      firmado_at:      ft.firmado_at,
      token:           ft.token,
    })
  } catch (e) {
    res.status(500).json({ message: 'Error consultando estado' })
  }
})

// ── GET /api/firma-online/:token  (PÚBLICO) ───────────────────────────────────
router.get('/:token', (req, res) => {
  try {
    const { token } = req.params

    // Rechazar si parece una ruta de sistema (prevención de colisiones)
    if (token === 'solicitar' || token === 'estado') {
      return res.status(404).json({ message: 'Ruta no válida' })
    }

    const ft = db.get('firma_tokens').find({ token }).value()
    if (!ft) return res.status(404).json({ message: 'Link de firma no válido o expirado' })

    if (ft.estado === 'expirado' || ft.estado === 'cancelado') {
      return res.status(410).json({ message: 'Este link de firma ha expirado o fue cancelado', estado: ft.estado })
    }
    if (ft.estado === 'firmado') {
      return res.status(200).json({ estado: 'firmado', message: 'Este documento ya fue firmado' })
    }
    if (new Date(ft.expires_at) < new Date()) {
      db.get('firma_tokens').find({ id: ft.id }).assign({ estado: 'expirado' }).write()
      return res.status(410).json({ message: 'Este link de firma ha expirado', estado: 'expirado' })
    }

    const doc = db.get('documentos').find({ id: ft.documento_id }).value()
    if (!doc) return res.status(404).json({ message: 'Documento no encontrado' })

    res.json({
      estado: 'pendiente',
      expires_at: ft.expires_at,
      documento: {
        id:              doc.id,
        folio:           doc.folio,
        tipo:            doc.tipo,
        entidad_nombre:  doc.entidad_nombre,
        entidad_tipo:    doc.entidad_tipo,
        agente_nombre:   doc.agente_nombre,
        receptor_nombre: doc.receptor_nombre,
        dispositivos:    doc.dispositivos || [],
        observaciones:   doc.observaciones || '',
        created_at:      doc.created_at,
        firma_agente:    doc.firma_agente || null,
      },
    })
  } catch (e) {
    console.error('[FirmaOnline] Error en GET /:token:', e.message)
    res.status(500).json({ message: 'Error obteniendo datos del documento' })
  }
})

// ── POST /api/firma-online/:token/firmar  (PÚBLICO) ──────────────────────────
router.post('/:token/firmar', (req, res) => {
  try {
    const { token } = req.params
    const { firma_receptor, pdf_base64 } = req.body

    if (!firma_receptor) return res.status(400).json({ message: 'Se requiere la firma del receptor' })

    const ft = db.get('firma_tokens').find({ token }).value()
    if (!ft) return res.status(404).json({ message: 'Link de firma no válido' })

    if (ft.estado !== 'pendiente') {
      return res.status(400).json({ message: ft.estado === 'firmado' ? 'Este documento ya fue firmado' : 'Link expirado o cancelado' })
    }
    if (new Date(ft.expires_at) < new Date()) {
      db.get('firma_tokens').find({ id: ft.id }).assign({ estado: 'expirado' }).write()
      return res.status(410).json({ message: 'Este link de firma ha expirado' })
    }

    const doc = db.get('documentos').find({ id: ft.documento_id }).value()
    if (!doc) return res.status(404).json({ message: 'Documento no encontrado' })

    const now        = new Date().toISOString()
    const ipFirmante = req.headers['x-forwarded-for'] || req.socket.remoteAddress || ''

    db.get('firma_tokens').find({ id: ft.id }).assign({
      estado: 'firmado', firma_receptor, firmado_at: now, ip_firmante: ipFirmante,
    }).write()

    const docUpdates = {
      firma_receptor,
      firmado:             true,
      fecha_firma:         now,
      firma_online_estado: 'firmado',
      updated_at:          now,
    }

    let pdfSaveInfo = { success: false, path: null }
    if (pdf_base64) {
      try {
        const localCfg      = db.get('configuracion').find({ clave: 'docs_local_path' }).value()
        const localDocsPath = (localCfg?.valor || process.env.LOCAL_DOCS_PATH || '').trim()
        if (localDocsPath) {
          const rawBase64 = pdf_base64.replace(/^data:[^,]+,/, '')
          const pdfBuffer = Buffer.from(rawBase64, 'base64')
          const subfolder = path.join(path.normalize(localDocsPath), doc.tipo)
          if (!fs.existsSync(subfolder)) fs.mkdirSync(subfolder, { recursive: true })
          const safeName  = `${doc.folio}_${(doc.entidad_nombre || 'doc').replace(/[\\/:*?"<>|]/g, '_')}.pdf`
          const fullPath  = path.normalize(path.join(subfolder, safeName))
          fs.writeFileSync(fullPath, pdfBuffer)
          if (fs.existsSync(fullPath)) {
            docUpdates.local_pdf_path = fullPath
            pdfSaveInfo = { success: true, path: fullPath }
          }
        }
      } catch (pdfErr) {
        console.error('[FirmaOnline] Error guardando PDF:', pdfErr.message)
      }
    }

    db.get('documentos').find({ id: ft.documento_id }).assign(docUpdates).write()
    res.json({ success: true, message: 'Documento firmado correctamente', pdf_guardado: pdfSaveInfo.success })
  } catch (e) {
    console.error('[FirmaOnline] Error en POST /:token/firmar:', e.message)
    res.status(500).json({ message: 'Error procesando la firma: ' + e.message })
  }
})

module.exports = router
