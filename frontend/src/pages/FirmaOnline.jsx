/**
 * FirmaOnline.jsx — Página pública de firma en línea para el receptor.
 * Accesible sin autenticación en: /firmar/:token
 * El receptor dibuja su firma, se genera el PDF y se envía al backend.
 */
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import SignatureCanvas from 'react-signature-canvas'
import jsPDF from 'jspdf'
import { firmaOnlineAPI } from '../utils/api'

// ── Tipos de documento (mismos que en Documentos.jsx) ────────────────────────
const DOC_TITLES = {
  entrada:   'ACTA DE ENTREGA DE EQUIPO DE CÓMPUTO',
  salida:    'ACTA DE DEVOLUCIÓN DE EQUIPO DE CÓMPUTO',
  responsiva: 'RESPONSIVA DE RESGUARDO DE EQUIPO',
}
const DOC_CODES = {
  entrada:    'TI-ENT-001',
  salida:     'TI-SAL-001',
  responsiva: 'TI-RESP-001',
}

// ── Generador PDF (versión standalone sin dependencias de estado global) ─────
async function generarPDF(doc, firmaAgenteImg, firmaReceptorImg) {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const W  = pdf.internal.pageSize.getWidth()
  const H  = pdf.internal.pageSize.getHeight()
  const ml = 14, mt = 14, mb = 20
  const cw = W - ml * 2
  let y = mt

  const checkPage = (needed) => {
    if (y + needed > H - mb) { pdf.addPage(); y = mt }
  }
  const addImg = (src, x, yy, w, h) => {
    if (!src) return
    try {
      const fmt = src.startsWith('data:image/png') ? 'PNG' : 'JPEG'
      pdf.addImage(src, fmt, x, yy, w, h, '', 'FAST')
    } catch (_) {}
  }

  // ── HEADER ──────────────────────────────────────────────────────────────
  const hH = 24
  const c1 = cw * 0.27, c2 = cw * 0.46, c3 = cw * 0.27
  pdf.setDrawColor(180, 188, 198); pdf.setLineWidth(0.5)
  pdf.rect(ml, y, c1, hH)
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7); pdf.setTextColor(160, 160, 160)
  pdf.text('AthenaSys TI', ml + c1 / 2, y + hH / 2, { align: 'center', baseline: 'middle' })
  pdf.rect(ml + c1, y, c2, hH)
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11); pdf.setTextColor(17, 24, 39)
  const titleLines = pdf.splitTextToSize(DOC_TITLES[doc.tipo] || doc.tipo?.toUpperCase() || '', c2 - 6)
  pdf.text(titleLines, ml + c1 + c2 / 2, y + hH / 2, { align: 'center', baseline: 'middle' })
  pdf.rect(ml + c1 + c2, y, c3, hH / 2)
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8); pdf.setTextColor(79, 70, 229)
  pdf.text(DOC_CODES[doc.tipo] || '', ml + c1 + c2 + c3 / 2, y + hH / 4, { align: 'center', baseline: 'middle' })
  pdf.rect(ml + c1 + c2, y + hH / 2, c3, hH / 2)
  pdf.setFont('helvetica', 'normal'); pdf.setTextColor(234, 88, 12)
  pdf.text('Interna', ml + c1 + c2 + c3 / 2, y + hH * 3 / 4, { align: 'center', baseline: 'middle' })
  y += hH + 5

  // ── FOLIO & FECHA ────────────────────────────────────────────────────────
  pdf.setFillColor(241, 245, 249); pdf.setDrawColor(203, 213, 225); pdf.setLineWidth(0.3)
  pdf.roundedRect(ml, y, cw, 8, 1, 1, 'FD')
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7.5); pdf.setTextColor(71, 85, 105)
  pdf.text('FOLIO:', ml + 3, y + 5.4)
  pdf.setFont('courier', 'bold'); pdf.setFontSize(8); pdf.setTextColor(15, 23, 42)
  pdf.text(doc.folio || '', ml + 19, y + 5.4)
  const dateStr = doc.created_at
    ? new Date(doc.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
    : '—'
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5); pdf.setTextColor(71, 85, 105)
  pdf.text(`Fecha: ${dateStr}`, ml + cw - 2, y + 5.4, { align: 'right' })
  y += 13

  // ── INFO GRID ────────────────────────────────────────────────────────────
  const infoRows = [
    ['Entidad / Receptor', doc.entidad_nombre || '—', 'Tipo', doc.entidad_tipo === 'empleado' ? 'Empleado' : 'Sucursal'],
    ['Agente TI', doc.agente_nombre || '—', doc.receptor_nombre ? 'Recibe' : '', doc.receptor_nombre || ''],
  ]
  const infoH = infoRows.length * 8 + 5
  pdf.setFillColor(241, 245, 249); pdf.setDrawColor(203, 213, 225); pdf.setLineWidth(0.3)
  pdf.roundedRect(ml, y, cw, infoH, 1, 1, 'FD')
  infoRows.forEach((row, ri) => {
    const ry = y + 7 + ri * 8
    const hw = cw / 2
    const renderCell = (lbl, val, ox) => {
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7); pdf.setTextColor(100, 116, 139)
      pdf.text(`${lbl}:`, ml + ox + 3, ry)
      pdf.setFont('helvetica', 'normal'); pdf.setTextColor(15, 23, 42)
      const v = pdf.splitTextToSize(val, hw - 28)[0] || ''
      pdf.text(v, ml + ox + 3 + (pdf.getStringUnitWidth(`${lbl}:`) * 7 / pdf.internal.scaleFactor) + 2, ry)
    }
    renderCell(row[0], row[1], 0)
    if (row[2]) renderCell(row[2], row[3], hw)
  })
  y += infoH + 8

  // ── TABLA DISPOSITIVOS ───────────────────────────────────────────────────
  checkPage(22)
  pdf.setFillColor(30, 41, 59); pdf.setDrawColor(30, 41, 59)
  pdf.roundedRect(ml, y, cw, 7, 1, 1, 'F')
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7.5); pdf.setTextColor(255, 255, 255)
  pdf.text('EQUIPOS / DISPOSITIVOS', ml + 4, y + 4.8)
  y += 7

  const isResp = doc.tipo === 'responsiva'
  const cols = isResp
    ? [{ h: 'Tipo', w: cw * 0.16 }, { h: 'Marca / Modelo', w: cw * 0.22 }, { h: 'No. Serie', w: cw * 0.20 }, { h: 'Características', w: cw * 0.28 }, { h: 'Costo', w: cw * 0.14 }]
    : [{ h: 'Tipo', w: cw * 0.18 }, { h: 'Marca / Modelo', w: cw * 0.25 }, { h: 'No. Serie', w: cw * 0.22 }, { h: 'Características', w: cw * 0.35 }]

  let xc = ml
  pdf.setLineWidth(0.2)
  cols.forEach(col => {
    pdf.setFillColor(226, 232, 240); pdf.setDrawColor(203, 213, 225)
    pdf.rect(xc, y, col.w, 7, 'FD')
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7); pdf.setTextColor(51, 65, 85)
    pdf.text(col.h, xc + 2, y + 4.8)
    xc += col.w
  })
  y += 7

  const devices = doc.dispositivos || []
  devices.forEach((d, idx) => {
    checkPage(7)
    const even = idx % 2 === 0
    xc = ml
    const cells = isResp
      ? [d.tipo, `${d.marca || ''} ${d.modelo || ''}`.trim(), d.serie || '—', d.caracteristicas || '', d.costo != null ? `$${Number(d.costo).toFixed(2)}` : '—']
      : [d.tipo, `${d.marca || ''} ${d.modelo || ''}`.trim(), d.serie || '—', d.caracteristicas || '']
    cols.forEach((col, ci) => {
      pdf.setFillColor(even ? 255 : 248, even ? 255 : 250, even ? 255 : 252)
      pdf.setDrawColor(226, 232, 240); pdf.setLineWidth(0.2)
      pdf.rect(xc, y, col.w, 7, 'FD')
      pdf.setFont(ci === 2 ? 'courier' : 'helvetica', 'normal')
      pdf.setFontSize(7); pdf.setTextColor(17, 24, 39)
      const ct = pdf.splitTextToSize(String(cells[ci] || ''), col.w - 4)[0] || ''
      pdf.text(ct, xc + 2, y + 4.8)
      xc += col.w
    })
    y += 7
  })
  y += 8

  // ── OBSERVACIONES ────────────────────────────────────────────────────────
  if (doc.observaciones) {
    checkPage(18)
    pdf.setFillColor(255, 251, 235); pdf.setDrawColor(251, 191, 36); pdf.setLineWidth(0.4)
    pdf.roundedRect(ml, y, cw, 14, 1, 1, 'FD')
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7.5); pdf.setTextColor(146, 64, 14)
    pdf.text('Observaciones:', ml + 3, y + 5.5)
    pdf.setFont('helvetica', 'normal'); pdf.setTextColor(30, 20, 5)
    const obsLines = pdf.splitTextToSize(doc.observaciones, cw - 42)
    pdf.text(obsLines[0] || '', ml + 38, y + 5.5)
    if (obsLines.length > 1) pdf.text(obsLines.slice(1).join('\n'), ml + 3, y + 10)
    y += 18
  }

  // ── FIRMAS ───────────────────────────────────────────────────────────────
  const sigH = 44
  checkPage(sigH + 14)
  pdf.setFillColor(30, 41, 59)
  pdf.roundedRect(ml, y, cw, 7, 1, 1, 'F')
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7.5); pdf.setTextColor(255, 255, 255)
  pdf.text('FIRMAS', ml + 4, y + 4.8)
  y += 11

  const bw = cw / 2 - 8
  const bx2 = ml + cw / 2 + 8
  pdf.setFillColor(250, 251, 253); pdf.setDrawColor(203, 213, 225); pdf.setLineWidth(0.3)
  pdf.roundedRect(ml, y, bw, sigH, 1, 1, 'FD')
  pdf.roundedRect(bx2, y, bw, sigH, 1, 1, 'FD')
  addImg(firmaAgenteImg, ml + bw / 2 - 24, y + 4, 48, 26)
  addImg(firmaReceptorImg, bx2 + bw / 2 - 24, y + 4, 48, 26)
  pdf.setDrawColor(148, 163, 184); pdf.setLineWidth(0.4)
  pdf.line(ml + 5, y + sigH - 14, ml + bw - 5, y + sigH - 14)
  pdf.line(bx2 + 5, y + sigH - 14, bx2 + bw - 5, y + sigH - 14)
  const nameStyle = (name, x, cy) => {
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7.5); pdf.setTextColor(15, 23, 42)
    pdf.text(pdf.splitTextToSize(name || '—', bw - 10)[0], x, cy, { align: 'center' })
  }
  nameStyle(doc.agente_nombre, ml + bw / 2, y + sigH - 8)
  nameStyle(doc.receptor_nombre || doc.entidad_nombre, bx2 + bw / 2, y + sigH - 8)
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7); pdf.setTextColor(100, 116, 139)
  pdf.text('Agente de Soporte TI', ml + bw / 2, y + sigH - 3, { align: 'center' })
  pdf.text('Receptor', bx2 + bw / 2, y + sigH - 3, { align: 'center' })
  y += sigH + 4
  pdf.setFontSize(6.5); pdf.setTextColor(148, 163, 184)
  const fechaFirma = new Date().toLocaleString('es-MX')
  pdf.text(`Firmado electrónicamente: ${fechaFirma}`, ml + cw / 2, y, { align: 'center' })

  // ── FOOTER ───────────────────────────────────────────────────────────────
  const nPages = pdf.internal.getNumberOfPages()
  for (let p = 1; p <= nPages; p++) {
    pdf.setPage(p)
    pdf.setDrawColor(203, 213, 225); pdf.setLineWidth(0.3)
    pdf.line(ml, H - mb + 5, ml + cw, H - mb + 5)
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(6.5); pdf.setTextColor(148, 163, 184)
    pdf.text('Generado por AthenaSys Inventario TI  ·  Confidencial', ml, H - mb + 9)
    pdf.text(`${p} / ${nPages}`, ml + cw, H - mb + 9, { align: 'right' })
  }

  return pdf
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function FirmaOnline() {
  const { token } = useParams()
  const sigRef    = useRef(null)

  const [estado,   setEstado]   = useState('cargando')  // cargando | pendiente | firmado | expirado | error
  const [docInfo,  setDocInfo]  = useState(null)
  const [mensaje,  setMensaje]  = useState('')
  const [enviando, setEnviando] = useState(false)
  const [firmado,  setFirmado]  = useState(false)
  const [canvasVacio, setCanvasVacio] = useState(true)

  useEffect(() => {
    firmaOnlineAPI.getDocumento(token)
      .then(data => {
        if (data.estado === 'firmado') {
          setEstado('firmado')
          setMensaje(data.message || 'Este documento ya fue firmado.')
        } else {
          setDocInfo(data.documento)
          setEstado('pendiente')
        }
      })
      .catch(err => {
        const msg = err?.message || 'Link no válido o expirado'
        const est = err?.estado || 'error'
        setEstado(est === 'expirado' ? 'expirado' : 'error')
        setMensaje(msg)
      })
  }, [token])

  const limpiarFirma = () => {
    sigRef.current?.clear()
    setCanvasVacio(true)
  }

  const handleFirmar = async () => {
    if (!sigRef.current || sigRef.current.isEmpty()) {
      setMensaje('Por favor dibuja tu firma antes de continuar.')
      return
    }
    setEnviando(true)
    setMensaje('')
    try {
      const firmaReceptor = sigRef.current.getTrimmedCanvas().toDataURL('image/png')
      const firmaAgente   = docInfo.firma_agente || null

      // Generar PDF con ambas firmas
      let pdf_base64 = null
      try {
        const pdf = await generarPDF(docInfo, firmaAgente, firmaReceptor)
        pdf_base64 = pdf.output('datauristring')
      } catch (pdfErr) {
        console.warn('[FirmaOnline] No se pudo generar el PDF:', pdfErr.message)
      }

      await firmaOnlineAPI.firmar(token, { firma_receptor: firmaReceptor, pdf_base64 })
      setFirmado(true)
      setEstado('firmado')
    } catch (err) {
      setMensaje(err?.message || 'Error al enviar la firma. Intenta de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  // ── Pantallas de estado ─────────────────────────────────────────────────
  if (estado === 'cargando') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Cargando documento...</p>
        </div>
      </div>
    )
  }

  if (estado === 'expirado') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <div className="text-5xl mb-4">⏰</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Link expirado</h2>
          <p className="text-gray-500 text-sm">{mensaje || 'Este enlace de firma ya no es válido. Solicita uno nuevo al agente de TI.'}</p>
        </div>
      </div>
    )
  }

  if (estado === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <div className="text-5xl mb-4">❌</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Link no válido</h2>
          <p className="text-gray-500 text-sm">{mensaje || 'Este enlace no existe o ya fue cancelado.'}</p>
        </div>
      </div>
    )
  }

  if (estado === 'firmado') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">
            {firmado ? '¡Documento firmado!' : 'Ya firmado'}
          </h2>
          <p className="text-gray-500 text-sm">
            {firmado
              ? 'Tu firma fue registrada correctamente. Puedes cerrar esta página.'
              : (mensaje || 'Este documento ya fue firmado anteriormente.')}
          </p>
          {firmado && (
            <div className="mt-6 bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="text-green-700 text-xs font-medium">
                El documento ha sido registrado en el sistema AthenaSys TI.
              </p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Pantalla principal de firma ──────────────────────────────────────────
  const tipoLabel = { entrada: 'Entrega de equipo', salida: 'Devolución de equipo', responsiva: 'Responsiva de resguardo' }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-indigo-700 text-white px-4 py-4 shadow-lg">
        <div className="max-w-lg mx-auto">
          <p className="text-indigo-200 text-xs uppercase tracking-wide mb-0.5">AthenaSys Inventario TI</p>
          <h1 className="text-lg font-bold leading-tight">Firma de documento</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">

        {/* Resumen del documento */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 text-xl">
              {docInfo?.tipo === 'entrada' ? '📥' : docInfo?.tipo === 'salida' ? '📤' : '📋'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-indigo-600 font-semibold uppercase tracking-wide">
                {tipoLabel[docInfo?.tipo] || docInfo?.tipo}
              </p>
              <p className="font-bold text-gray-900 text-base">{docInfo?.folio}</p>
            </div>
          </div>

          <div className="mt-4 space-y-2 divide-y divide-gray-100">
            <div className="flex justify-between py-2 text-sm">
              <span className="text-gray-500">Receptor</span>
              <span className="font-medium text-gray-800">{docInfo?.entidad_nombre}</span>
            </div>
            <div className="flex justify-between py-2 text-sm">
              <span className="text-gray-500">Agente TI</span>
              <span className="font-medium text-gray-800">{docInfo?.agente_nombre}</span>
            </div>
            {docInfo?.dispositivos?.length > 0 && (
              <div className="py-2 text-sm">
                <p className="text-gray-500 mb-2">Equipos ({docInfo.dispositivos.length})</p>
                <div className="space-y-1">
                  {docInfo.dispositivos.map((d, i) => (
                    <div key={i} className="bg-gray-50 rounded-lg px-3 py-2 text-xs">
                      <span className="font-medium text-gray-700">{d.tipo}</span>
                      {d.marca && <span className="text-gray-500"> · {d.marca} {d.modelo}</span>}
                      {d.serie && <span className="font-mono text-gray-400 ml-1">#{d.serie}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {docInfo?.observaciones && (
              <div className="py-2 text-sm">
                <p className="text-gray-500 text-xs mb-1">Observaciones</p>
                <p className="text-gray-700 text-xs">{docInfo.observaciones}</p>
              </div>
            )}
          </div>
        </div>

        {/* Área de firma */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-1">Tu firma</h2>
          <p className="text-xs text-gray-400 mb-3">Dibuja tu firma en el recuadro de abajo con tu dedo o ratón</p>

          <div className="border-2 border-dashed border-gray-200 rounded-xl overflow-hidden bg-gray-50 relative"
               style={{ touchAction: 'none' }}>
            <SignatureCanvas
              ref={sigRef}
              penColor="#1e293b"
              canvasProps={{
                className: 'w-full',
                style: { width: '100%', height: '180px', display: 'block' },
              }}
              onEnd={() => setCanvasVacio(false)}
            />
            {canvasVacio && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-gray-300 text-sm">✍️ Firma aquí</p>
              </div>
            )}
          </div>

          <div className="flex justify-end mt-2">
            <button
              type="button"
              onClick={limpiarFirma}
              className="text-xs text-gray-400 hover:text-red-400 underline transition-colors"
            >
              Limpiar firma
            </button>
          </div>
        </div>

        {/* Mensaje de error */}
        {mensaje && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
            {mensaje}
          </div>
        )}

        {/* Botón firmar */}
        <button
          onClick={handleFirmar}
          disabled={enviando || canvasVacio}
          className={`w-full py-4 rounded-2xl text-white font-bold text-base shadow-lg transition-all
            ${(enviando || canvasVacio)
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-700 active:scale-98'}`}
        >
          {enviando
            ? <span className="flex items-center justify-center gap-2">
                <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                Enviando firma...
              </span>
            : '✅ Firmar documento'}
        </button>

        <p className="text-center text-xs text-gray-400 pb-4">
          Al firmar confirmas haber recibido / entregado los equipos listados.<br />
          Tu firma quedará registrada junto con la fecha y hora.
        </p>
      </div>
    </div>
  )
}
