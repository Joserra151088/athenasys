const router = require('express').Router()
const { v4: uuidv4 } = require('uuid')
const { execFile } = require('child_process')
const db = require('../data/db')
const { authMiddleware, requireRoles } = require('../middleware/auth.middleware')

router.use(authMiddleware)

// GET /api/config/logo
router.get('/logo', (req, res) => {
  const cfg = db.get('configuracion').find({ clave: 'logo_global' }).value()
  res.json({ logo: cfg?.valor || null })
})

// PUT /api/config/logo
router.put('/logo', requireRoles('super_admin', 'agente_soporte', 'administrador_general'), (req, res) => {
  const { logo } = req.body
  const existing = db.get('configuracion').find({ clave: 'logo_global' }).value()
  const now = new Date().toISOString()
  if (existing) {
    db.get('configuracion').find({ clave: 'logo_global' }).assign({ valor: logo || null, updated_at: now }).write()
  } else {
    db.get('configuracion').push({ id: uuidv4(), clave: 'logo_global', valor: logo || null, updated_at: now }).write()
  }
  res.json({ logo: logo || null })
})

// GET /api/config/docs-path
router.get('/docs-path', (req, res) => {
  const cfg = db.get('configuracion').find({ clave: 'docs_local_path' }).value()
  const defaultPath = process.env.LOCAL_DOCS_PATH || ''
  res.json({ path: cfg?.valor !== undefined ? cfg.valor : defaultPath })
})

// PUT /api/config/docs-path
router.put('/docs-path', requireRoles('super_admin', 'administrador_general'), (req, res) => {
  const { path: docPath } = req.body
  const existing = db.get('configuracion').find({ clave: 'docs_local_path' }).value()
  const now = new Date().toISOString()
  if (existing) {
    db.get('configuracion').find({ clave: 'docs_local_path' }).assign({ valor: docPath || '', updated_at: now }).write()
  } else {
    db.get('configuracion').push({ id: uuidv4(), clave: 'docs_local_path', valor: docPath || '', updated_at: now }).write()
  }
  res.json({ path: docPath || '' })
})

// GET /api/config/header
router.get('/header', (req, res) => {
  const cfg = db.get('configuracion').find({ clave: 'header_config' }).value()
  const logo = db.get('configuracion').find({ clave: 'logo_global' }).value()
  const defaults = { empresa: 'AthenaSys', subtitulo: 'Área de Tecnologías de la Información', color: '#1e293b' }
  const saved = cfg?.valor ? JSON.parse(cfg.valor) : {}
  res.json({ ...defaults, ...saved, logo: logo?.valor || null })
})

// PUT /api/config/header
router.put('/header', requireRoles('super_admin', 'agente_soporte', 'administrador_general'), async (req, res) => {
  try {
    const { empresa, subtitulo, color } = req.body
    const val = JSON.stringify({ empresa: empresa || '', subtitulo: subtitulo || '', color: color || '#1e293b' })
    const existing = db.get('configuracion').find({ clave: 'header_config' }).value()
    const now = new Date().toISOString()
    if (existing) {
      db.get('configuracion').find({ clave: 'header_config' }).assign({ valor: val, updated_at: now }).write()
    } else {
      if (!db.get('configuracion').value()) db.defaults({ configuracion: [] }).write()
      db.get('configuracion').push({ id: uuidv4(), clave: 'header_config', valor: val, updated_at: now }).write()
    }
    res.json({ empresa, subtitulo, color })
  } catch (err) {
    console.error('[config/header PUT]', err)
    res.status(500).json({ message: err.message || 'Error al guardar encabezado' })
  }
})

// POST /api/config/reload-db — recargar caché en memoria desde MySQL
// Útil cuando se hacen cambios directos en la BD y se necesita reflejarlos sin reiniciar
router.post('/reload-db', requireRoles('super_admin', 'administrador_general'), async (req, res) => {
  try {
    await db.reload()
    res.json({ ok: true, message: 'Caché recargado desde MySQL correctamente', timestamp: new Date().toISOString() })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// GET /api/config/browse-folder — abre diálogo nativo de selección de carpeta (Windows)
router.get('/browse-folder', requireRoles('super_admin', 'administrador_general'), (req, res) => {
  // -Sta es obligatorio para Windows Forms (STA thread model)
  // -NonInteractive NO debe usarse: impide mostrar ventanas GUI
  const psScript = [
    'Add-Type -AssemblyName System.Windows.Forms',
    '$dialog = New-Object System.Windows.Forms.FolderBrowserDialog',
    '$dialog.Description = "Selecciona la carpeta donde se guardarán los PDFs firmados"',
    '$dialog.ShowNewFolderButton = $true',
    '[void][System.Windows.Forms.Application]::EnableVisualStyles()',
    '$result = $dialog.ShowDialog()',
    'if ($result -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $dialog.SelectedPath } else { Write-Output "" }'
  ].join('; ')

  execFile('powershell.exe', ['-NoProfile', '-Sta', '-Command', psScript],
    { timeout: 60000, windowsHide: false },
    (err, stdout, stderr) => {
      if (err) {
        console.error('[browse-folder] PowerShell error:', err.message, stderr)
        return res.status(500).json({ message: 'No se pudo abrir el selector de carpetas: ' + (err.message || stderr) })
      }
      const selectedPath = stdout.trim()
      res.json({ path: selectedPath || null, cancelled: !selectedPath })
    }
  )
})

// POST /api/config/pdf-retry — trigger manual retry
router.post('/pdf-retry', requireRoles('super_admin', 'administrador_general'), (req, res) => {
  try {
    const { tryRetryPendingDocs } = require('../services/pdfRetry')
    tryRetryPendingDocs()
    const pendingCount = db.get('documentos').filter(d => d.pdf_pendiente_path && !d.local_pdf_path).size().value()
    res.json({ ok: true, pendingAfter: pendingCount })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

module.exports = router
