const fs = require('fs')
const path = require('path')
const db = require('../data/db')

/**
 * Intenta guardar en la carpeta local los PDFs que fallaron en el primer intento.
 * Se ejecuta al iniciar el servidor y cada hora.
 */
function tryRetryPendingDocs() {
  const localCfg = db.get('configuracion').find({ clave: 'docs_local_path' }).value()
  const localDocsPath = (localCfg?.valor !== undefined && localCfg.valor !== '')
    ? localCfg.valor
    : (process.env.LOCAL_DOCS_PATH || '')

  if (!localDocsPath) return

  const pendingDocs = db.get('documentos')
    .filter(d => d.pdf_pendiente_path && !d.local_pdf_path && d.firmado)
    .value()

  if (pendingDocs.length === 0) return

  console.log(`[PDFRetry] 🔄 Reintentando ${pendingDocs.length} documento(s) pendiente(s)...`)
  let ok = 0, fail = 0

  for (const doc of pendingDocs) {
    try {
      if (!fs.existsSync(doc.pdf_pendiente_path)) {
        // Archivo temporal perdido, limpiar flag
        db.get('documentos').find({ id: doc.id }).assign({ pdf_pendiente_path: null, updated_at: new Date().toISOString() }).write()
        continue
      }

      const pdfBuffer = fs.readFileSync(doc.pdf_pendiente_path)
      const subfolder = path.join(localDocsPath, doc.tipo)
      if (!fs.existsSync(subfolder)) fs.mkdirSync(subfolder, { recursive: true })
      const safeName = `${doc.folio}_${doc.entidad_nombre.replace(/[\\/:*?"<>|]/g, '_')}.pdf`
      const fullPath = path.join(subfolder, safeName)
      fs.writeFileSync(fullPath, pdfBuffer)

      db.get('documentos').find({ id: doc.id }).assign({
        local_pdf_path: fullPath,
        pdf_pendiente_path: null,
        updated_at: new Date().toISOString()
      }).write()

      try { fs.unlinkSync(doc.pdf_pendiente_path) } catch (_) {}
      console.log(`[PDFRetry] ✓ ${doc.folio} → ${fullPath}`)
      ok++
    } catch (err) {
      console.warn(`[PDFRetry] ✗ ${doc.folio}: ${err.message}`)
      fail++
    }
  }
  if (ok > 0 || fail > 0) console.log(`[PDFRetry] Completado: ${ok} guardados, ${fail} fallidos.`)
}

module.exports = { tryRetryPendingDocs }
