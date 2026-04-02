import { useState, useEffect, useCallback, useRef } from 'react'
import { documentoAPI, plantillaAPI, empleadoAPI, sucursalAPI, deviceAPI, usuarioSistemaAPI, configAPI, firmaOnlineAPI } from '../utils/api'
import { DOCUMENT_TYPES } from '../utils/constants'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import Pagination from '../components/Pagination'
import FirmaCanvas from '../components/FirmaCanvas'
import { PlusIcon, MagnifyingGlassIcon, EyeIcon, PencilSquareIcon, PrinterIcon, DocumentIcon, ClockIcon, PaperAirplaneIcon, QrCodeIcon } from '@heroicons/react/24/outline'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import jsPDF from 'jspdf'
import { useNotification } from '../context/NotificationContext'
import { QRCodeSVG } from 'qrcode.react'

const DOC_CODES = { responsiva: 'F-TI-39-V2', entrada: 'F-TI-84-V1', salida: 'F-TI-85-V1' }
const DOC_TITLES = { responsiva: 'CARTA RESPONSIVA', entrada: 'FORMATO DE ENTRADA DE EQUIPO', salida: 'FORMATO DE SALIDA DE EQUIPO' }

function DocumentHeader({ tipo, logo = null }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
      <tbody><tr>
        <td style={{ border: '1.5px solid #9ca3af', width: '28%', padding: 8, textAlign: 'center', verticalAlign: 'middle' }}>
          {logo ? (
            <img src={logo} alt="Logo" style={{ maxHeight: 64, maxWidth: 160, objectFit: 'contain', display: 'block', margin: '0 auto' }} />
          ) : (
            <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 11 }}>LOGO</div>
          )}
        </td>
        <td style={{ border: '1.5px solid #9ca3af', width: '44%', padding: 12, textAlign: 'center', verticalAlign: 'middle', fontWeight: 'bold', fontSize: 13, letterSpacing: 1 }}>
          {DOC_TITLES[tipo] || tipo?.toUpperCase()}
        </td>
        <td style={{ border: '1.5px solid #9ca3af', width: '28%', padding: 0, verticalAlign: 'middle' }}>
          <div style={{ padding: '8px 10px', borderBottom: '1.5px solid #9ca3af', textAlign: 'center', fontSize: 12, color: '#6366f1', fontWeight: 700 }}>
            {DOC_CODES[tipo] || ''}
          </div>
          <div style={{ padding: '8px 10px', textAlign: 'center', fontSize: 12, color: '#f97316', fontWeight: 500 }}>
            Interna
          </div>
        </td>
      </tr></tbody>
    </table>
  )
}

export default function Documentos() {
  const { canEdit, user } = useAuth()
  const { showError } = useNotification()
  const [documentos, setDocumentos] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 20 })
  const [search, setSearch] = useState('')
  const [filterTipo, setFilterTipo] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // 'create' | 'sign' | 'preview'
  const [selected, setSelected] = useState(null)
  const [saving, setSaving] = useState(false)
  const previewRef = useRef(null)
  const firmaAgenteRef = useRef(null)
  const firmaReceptorRef = useRef(null)

  // Agent firma pre-loaded
  const [agenteFirma, setAgenteFirma] = useState(null)

  // Logo global (mismo que Plantillas — cargado desde configAPI)
  const [globalLogo, setGlobalLogo] = useState(null)
  useEffect(() => {
    configAPI.getLogo().then(r => setGlobalLogo(r.logo || null)).catch(() => {})
  }, [])

  // PDF local saving
  const [docsPath, setDocsPath] = useState('')
  const [toast, setToast] = useState(null)
  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 6000)
  }

  // ── Firma online (envío de link al receptor) ─────────────────────────────
  const [firmaLink, setFirmaLink]     = useState(null)  // { url, expires_at, token }
  const [enviandoLink, setEnviandoLink] = useState(false)
  const [linkCopiado, setLinkCopiado] = useState(false)

  const handleEnviarFirma = async (doc) => {
    setEnviandoLink(true)
    try {
      const result = await firmaOnlineAPI.solicitar(doc.id)
      setFirmaLink({ url: result.url, expires_at: result.expires_at, token: result.token, doc })
      setModal('firmaLink')
    } catch (err) {
      showError(err?.message || 'Error generando link de firma')
    } finally {
      setEnviandoLink(false)
    }
  }

  const copiarLink = () => {
    if (!firmaLink?.url) return
    navigator.clipboard.writeText(firmaLink.url).then(() => {
      setLinkCopiado(true)
      setTimeout(() => setLinkCopiado(false), 2500)
    })
  }

  // Create form
  const [form, setForm] = useState({ tipo: 'responsiva', plantilla_id: '', entidad_tipo: 'empleado', entidad_id: '', dispositivos: [], receptor_id: '', observaciones: '' })
  const [plantillas, setPlantillas] = useState([])
  const [entidades, setEntidades] = useState([])
  const [empleados, setEmpleados] = useState([])
  const [dispositivos, setDispositivos] = useState([])
  const [entidadSearch, setEntidadSearch] = useState('')
  const [showEntidadDrop, setShowEntidadDrop] = useState(false)

  const load = useCallback((page = 1) => {
    setLoading(true)
    const params = { page, limit: 20 }
    if (search) params.search = search
    if (filterTipo) params.tipo = filterTipo
    documentoAPI.getAll(params).then(d => {
      setDocumentos(d.data)
      setPagination({ page: d.page, pages: Math.ceil(d.total / 20), total: d.total, limit: 20 })
    }).finally(() => setLoading(false))
  }, [search, filterTipo])

  useEffect(() => { load(1) }, [load])

  const openCreate = async () => {
    const [pl, emp, suc, devs] = await Promise.all([
      plantillaAPI.getAll(),
      empleadoAPI.getAll({ limit: 200 }),
      sucursalAPI.getAll({ limit: 300 }),
      deviceAPI.getAll({ limit: 200 })
    ])
    const empSorted = [...emp.data].sort((a, b) => (a.nombre_completo || '').localeCompare(b.nombre_completo || '', 'es'))
    setPlantillas(pl)
    setEmpleados(empSorted)
    setEntidades(empSorted)
    setEntidadSearch('')
    setDispositivos(devs.data)
    setForm({ tipo: 'responsiva', plantilla_id: pl.find(p => p.tipo === 'responsiva')?.id || '', entidad_tipo: 'empleado', entidad_id: '', dispositivos: [], receptor_id: '', observaciones: '' })
    setModal('create')
  }

  const handleEntidadTipo = async (tipo) => {
    if (tipo === 'empleado') {
      setEntidades(empleados)
    } else {
      const res = await sucursalAPI.getAll({ limit: 300 })
      setEntidades(res.data)
    }
    setForm(f => ({ ...f, entidad_tipo: tipo, entidad_id: '' }))
    setEntidadSearch('')
    setShowEntidadDrop(false)
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await documentoAPI.create(form)
      setModal(null)
      load(1)
    } catch (err) { showError(err?.message || 'Error') }
    finally { setSaving(false) }
  }

  const openSign = async (doc) => {
    const full = await documentoAPI.getById(doc.id)
    setSelected(full)
    // Load agent's firma
    try {
      const firmaData = await usuarioSistemaAPI.getMyFirma()
      setAgenteFirma(firmaData.firma_base64 || null)
    } catch (_) { setAgenteFirma(null) }
    // Load local docs save path
    try {
      const pathData = await configAPI.getDocsPath()
      setDocsPath(pathData.path || '')
    } catch (_) { setDocsPath('') }
    setModal('sign')
  }

  const openPreview = async (doc) => {
    const full = await documentoAPI.getById(doc.id)
    setSelected(full)
    setModal('preview')
  }

  const handleSign = async () => {
    if (!selected) return
    const firmaAgente = firmaAgenteRef.current?.getDataURL()
    const firmaReceptor = firmaReceptorRef.current?.getDataURL()
    if (!firmaReceptor) { showError('La firma del receptor es requerida', 'Campo requerido'); return }
    if (!firmaAgente) { showError('La firma del agente es requerida. Sube tu firma en tu perfil de usuario o dibuja una en el campo de firma.', 'Firma del agente'); return }
    setSaving(true)

    let pdf_base64 = null
    try {
      const pdf = await generateDocumentPDF(selected, firmaAgente, firmaReceptor)
      pdf_base64 = pdf.output('datauristring')
    } catch (pdfErr) {
      console.error('[PDF] Error generando PDF:', pdfErr)
      showError(`Error generando PDF: ${pdfErr.message}. El documento se firmará sin PDF adjunto.`, 'Advertencia PDF')
    }

    try {
      const result = await documentoAPI.sign(selected.id, { firma_agente: firmaAgente, firma_receptor: firmaReceptor, pdf_base64 })
      setModal(null)
      load(1)
      const pdfInfo = result?.pdf_save_info
      if (result?.local_pdf_path) {
        const subfolder = pdfInfo?.subfolder || ''
        showToast(`📄 PDF guardado correctamente.\nCarpeta: ${subfolder || result.local_pdf_path}\nArchivo: ${result.local_pdf_path.split(/[\\/]/).pop()}`)
      } else if (pdfInfo?.reason) {
        showToast(`⚠️ Documento firmado, pero: ${pdfInfo.reason}`, 'info')
      } else if (pdfInfo?.error) {
        showToast(`⚠️ Documento firmado, pero error al guardar PDF: ${pdfInfo.error}`, 'info')
      } else if (!pdf_base64) {
        showToast('✅ Documento firmado correctamente.', 'success')
      }
    } catch (err) {
      showError(err?.message || 'Error al firmar el documento')
    } finally { setSaving(false) }
  }

  const exportPDF = async () => {
    if (!selected) return
    try {
      const pdf = await generateDocumentPDF(selected)
      pdf.save(`${selected.folio || 'documento'}.pdf`)
    } catch (err) {
      showError('Error al exportar PDF: ' + err.message)
    }
  }

  const getPlantillaTexto = (doc) => {
    if (!doc?.plantilla?.texto_legal) return ''

    // Fecha con formato largo en español
    const fechaDoc = doc.created_at
      ? new Date(doc.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
      : new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })

    // Tabla HTML de dispositivos para {{lista_dispositivos}}
    const listaDispositivos = doc.dispositivos?.length
      ? `<table style="width:100%;border-collapse:collapse;font-size:11px;margin:8px 0">
          <thead><tr style="background:#f3f4f6">
            <th style="text-align:left;padding:4px 8px;border:1px solid #e5e7eb">Tipo</th>
            <th style="text-align:left;padding:4px 8px;border:1px solid #e5e7eb">Marca/Modelo</th>
            <th style="text-align:left;padding:4px 8px;border:1px solid #e5e7eb">No. Serie</th>
            <th style="text-align:left;padding:4px 8px;border:1px solid #e5e7eb">Características</th>
          </tr></thead>
          <tbody>${doc.dispositivos.map(d =>
            `<tr>
              <td style="padding:4px 8px;border:1px solid #e5e7eb">${d.tipo || ''}</td>
              <td style="padding:4px 8px;border:1px solid #e5e7eb">${d.marca || ''} ${d.modelo || ''}</td>
              <td style="padding:4px 8px;border:1px solid #e5e7eb;font-family:monospace">${d.serie || ''}</td>
              <td style="padding:4px 8px;border:1px solid #e5e7eb;color:#6b7280">${d.caracteristicas || ''}</td>
            </tr>`
          ).join('')}</tbody>
        </table>`
      : '(Sin dispositivos)'

    return doc.plantilla.texto_legal
      // Receptor / Empleado
      .replaceAll('{{receptor_nombre}}',       doc.receptor_nombre || doc.entidad_nombre || '')
      .replaceAll('{{receptor_num_empleado}}', doc.entidad_num_empleado || '')
      .replaceAll('{{receptor_area}}',         doc.entidad_area || doc.entidad_departamento || '')
      .replaceAll('{{receptor_puesto}}',       doc.entidad_puesto || '')
      .replaceAll('{{receptor_email}}',        doc.entidad_email || '')
      // Sucursal
      .replaceAll('{{sucursal_nombre}}',       doc.entidad_tipo === 'sucursal' ? doc.entidad_nombre : '')
      .replaceAll('{{sucursal_estado}}',       '')
      .replaceAll('{{sucursal_tipo}}',         doc.entidad_tipo === 'sucursal' ? 'Sucursal' : 'Corporativo')
      // Agente TI
      .replaceAll('{{agente_nombre}}',         doc.agente_nombre || '')
      // Documento
      .replaceAll('{{fecha_documento}}',       fechaDoc)
      .replaceAll('{{folio}}',                 doc.folio || '')
      .replaceAll('{{motivo_salida}}',         doc.observaciones || '')
      // Dispositivos
      .replaceAll('{{num_dispositivos}}',      String(doc.dispositivos?.length || 0))
      .replaceAll('{{lista_dispositivos}}',    listaDispositivos)
  }

  const renderPlantillaHTML = (doc) => {
    const text = getPlantillaTexto(doc)
    if (!text) return 'Sin texto legal configurado.'
    if (/<[a-z][\s\S]*>/i.test(text)) return text
    return text.replace(/\n/g, '<br/>')
  }

  // ─── Generador PDF programático (jsPDF directo — sin html2canvas) ──────────
  const generateDocumentPDF = async (doc, firmaAgenteImg = null, firmaReceptorImg = null) => {
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
    const W = pdf.internal.pageSize.getWidth()
    const H = pdf.internal.pageSize.getHeight()
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

    // Logo box
    pdf.rect(ml, y, c1, hH)
    if (globalLogo) addImg(globalLogo, ml + 2, y + 2, c1 - 4, hH - 4)
    else {
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7); pdf.setTextColor(160, 160, 160)
      pdf.text('LOGO', ml + c1 / 2, y + hH / 2, { align: 'center', baseline: 'middle' })
    }

    // Title box
    pdf.rect(ml + c1, y, c2, hH)
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11); pdf.setTextColor(17, 24, 39)
    const titleLines = pdf.splitTextToSize(DOC_TITLES[doc.tipo] || doc.tipo?.toUpperCase() || '', c2 - 6)
    pdf.text(titleLines, ml + c1 + c2 / 2, y + hH / 2, { align: 'center', baseline: 'middle' })

    // Code box (top) + type box (bottom)
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
    const infoData = [
      ['Entidad / Receptor', doc.entidad_nombre || '—', 'Tipo', doc.entidad_tipo === 'empleado' ? 'Empleado' : 'Sucursal'],
      ['Agente TI', doc.agente_nombre || '—', doc.receptor_nombre ? 'Recibe' : '', doc.receptor_nombre || ''],
    ]
    const infoH = infoData.length * 8 + 5
    pdf.setFillColor(241, 245, 249); pdf.setDrawColor(203, 213, 225); pdf.setLineWidth(0.3)
    pdf.roundedRect(ml, y, cw, infoH, 1, 1, 'FD')
    infoData.forEach((row, ri) => {
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

    // ── PLANTILLA TEXT ───────────────────────────────────────────────────────
    const rawHTML = getPlantillaTexto(doc)
    if (rawHTML && rawHTML.trim()) {
      const plain = rawHTML
        .replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<\/div>/gi, '\n')
        .replace(/<li[^>]*>/gi, '• ').replace(/<\/li>/gi, '\n')
        .replace(/<\/tr>/gi, '\n').replace(/<td[^>]*>/gi, ' ').replace(/<th[^>]*>/gi, ' ')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
        .trim()
      if (plain) {
        pdf.setFont('times', 'normal'); pdf.setFontSize(9); pdf.setTextColor(31, 41, 55)
        const paragraphs = plain.split('\n').filter(p => p.trim())
        for (const para of paragraphs) {
          const lines = pdf.splitTextToSize(para.trim(), cw)
          checkPage(lines.length * 5.5 + 3)
          pdf.text(lines, ml, y, { lineHeightFactor: 1.5 })
          y += lines.length * 5.5 + 3
        }
        y += 4
      }
    }

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

    // Header row — reset fill/draw before EACH rect (setTextColor bleeds into fill state)
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
        // Resetear fill/draw ANTES de cada celda para evitar sangrado de setTextColor
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

    const firmaA = firmaAgenteImg || doc.firma_agente || null
    const firmaR = firmaReceptorImg || doc.firma_receptor || null
    const bw = cw / 2 - 8
    const bx2 = ml + cw / 2 + 8

    // Boxes
    pdf.setFillColor(250, 251, 253); pdf.setDrawColor(203, 213, 225); pdf.setLineWidth(0.3)
    pdf.roundedRect(ml, y, bw, sigH, 1, 1, 'FD')
    pdf.roundedRect(bx2, y, bw, sigH, 1, 1, 'FD')

    // Signature images
    addImg(firmaA, ml + bw / 2 - 24, y + 4, 48, 26)
    addImg(firmaR, bx2 + bw / 2 - 24, y + 4, 48, 26)

    // Name lines
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

    if (doc.fecha_firma) {
      y += sigH + 4
      pdf.setFontSize(6.5); pdf.setTextColor(148, 163, 184)
      pdf.text(`Firmado electrónicamente: ${new Date(doc.fecha_firma).toLocaleString('es-MX')}`, ml + cw / 2, y, { align: 'center' })
    }

    // ── FOOTER ───────────────────────────────────────────────────────────────
    const nPages = pdf.internal.getNumberOfPages()
    for (let p = 1; p <= nPages; p++) {
      pdf.setPage(p)
      pdf.setDrawColor(203, 213, 225); pdf.setLineWidth(0.3)
      pdf.line(ml, H - mb + 5, ml + cw, H - mb + 5)
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(6.5); pdf.setTextColor(148, 163, 184)
      pdf.text(`Generado por AthenaSys Inventario TI  ·  Confidencial`, ml, H - mb + 9)
      pdf.text(`${p} / ${nPages}`, ml + cw, H - mb + 9, { align: 'right' })
    }

    return pdf
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documentos</h1>
          <p className="text-sm text-gray-500 mt-0.5">Entradas, salidas y responsivas con firma digital</p>
        </div>
        {canEdit() && <button className="btn-primary" onClick={openCreate}><PlusIcon className="h-4 w-4" /> Nuevo Documento</button>}
      </div>

      <div className="card p-4 flex gap-3">
        <div className="flex-1 relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input type="text" className="input pl-9" placeholder="Buscar por folio, entidad..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input w-44" value={filterTipo} onChange={e => setFilterTipo(e.target.value)}>
          <option value="">Todos los tipos</option>
          {Object.entries(DOCUMENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="table-header">Folio</th>
                <th className="table-header">Tipo</th>
                <th className="table-header">Entidad</th>
                <th className="table-header">Agente</th>
                <th className="table-header">Dispositivos</th>
                <th className="table-header">Firmado</th>
                <th className="table-header">Fecha</th>
                <th className="table-header">Archivo local</th>
                <th className="table-header">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={9} className="py-12 text-center"><div className="inline-block animate-spin rounded-full h-6 w-6 border-4 border-primary-600 border-t-transparent" /></td></tr>
              ) : documentos.length === 0 ? (
                <tr><td colSpan={9} className="py-12 text-center text-gray-400">No hay documentos</td></tr>
              ) : documentos.map(d => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="table-cell font-mono text-xs font-semibold text-gray-700">{d.folio}</td>
                  <td className="table-cell">
                    <Badge {...(DOCUMENT_TYPES[d.tipo] || { label: d.tipo, color: 'bg-gray-100 text-gray-600' })} />
                  </td>
                  <td className="table-cell">
                    <div className="text-sm font-medium">{d.entidad_nombre}</div>
                    <div className="text-xs text-gray-400 capitalize">{d.entidad_tipo}</div>
                  </td>
                  <td className="table-cell text-sm">{d.agente_nombre}</td>
                  <td className="table-cell text-sm">{d.dispositivos?.length || 0} dispositivo(s)</td>
                  <td className="table-cell">
                    {d.firmado ? <Badge label="Firmado" color="bg-emerald-100 text-emerald-700" /> : <Badge label="Pendiente" color="bg-yellow-100 text-yellow-700" />}
                  </td>
                  <td className="table-cell text-xs text-gray-500">
                    {d.created_at ? format(new Date(d.created_at), 'dd/MM/yyyy', { locale: es }) : '—'}
                  </td>
                  <td className="table-cell">
                    {d.local_pdf_path ? (
                      <div className="flex items-center gap-1.5" title={d.local_pdf_path}>
                        <DocumentIcon className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                        <span className="text-xs text-emerald-700 font-mono truncate max-w-[140px]">
                          …{d.local_pdf_path.slice(-35)}
                        </span>
                      </div>
                    ) : d.pdf_pendiente_path ? (
                      <div className="flex items-center gap-1 text-yellow-600" title="PDF en cola de reintento">
                        <ClockIcon className="h-4 w-4 flex-shrink-0" />
                        <span className="text-xs font-medium">En cola</span>
                      </div>
                    ) : d.firmado ? (
                      <span className="text-xs text-gray-400">Sin archivo</span>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>
                  <td className="table-cell">
                    <div className="flex gap-1">
                      <button onClick={() => openPreview(d)} className="p-1.5 rounded text-gray-400 hover:text-primary-600 hover:bg-primary-50" title="Vista previa">
                        <EyeIcon className="h-4 w-4" />
                      </button>
                      {canEdit() && !d.firmado && (
                        <button onClick={() => openSign(d)} className="p-1.5 rounded text-gray-400 hover:text-emerald-600 hover:bg-emerald-50" title="Firmar en plataforma">
                          <PencilSquareIcon className="h-4 w-4" />
                        </button>
                      )}
                      {canEdit() && !d.firmado && (
                        <button onClick={() => handleEnviarFirma(d)} disabled={enviandoLink}
                          className="p-1.5 rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50" title="Enviar link de firma al receptor">
                          <PaperAirplaneIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination {...pagination} onPageChange={load} />
      </div>

      {/* Modal crear documento */}
      <Modal open={modal === 'create'} onClose={() => setModal(null)} title="Nuevo Documento" size="xl">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Tipo de documento *</label>
              <select className="input" required value={form.tipo} onChange={e => {
                const t = e.target.value
                setForm(f => ({ ...f, tipo: t, plantilla_id: plantillas.find(p => p.tipo === t)?.id || '' }))
              }}>
                {Object.entries(DOCUMENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Plantilla</label>
              <select className="input" value={form.plantilla_id} onChange={e => setForm(f => ({ ...f, plantilla_id: e.target.value }))}>
                <option value="">Sin plantilla</option>
                {plantillas.filter(p => p.tipo === form.tipo).map(p => <option key={p.id} value={p.id}>{p.nombre} (v{p.version})</option>)}
              </select>
            </div>
            <div>
              <label className="label">Asignar a</label>
              <div className="flex gap-2">
                {['empleado', 'sucursal'].map(t => (
                  <button key={t} type="button" onClick={() => handleEntidadTipo(t)}
                    className={`flex-1 py-2 rounded-lg border-2 text-sm capitalize transition-colors ${form.entidad_tipo === t ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600'}`}>
                    {t === 'empleado' ? 'Empleado' : 'Sucursal'}
                  </button>
                ))}
              </div>
            </div>
            <div className="relative">
              <label className="label">{form.entidad_tipo === 'empleado' ? 'Empleado' : 'Sucursal'} *</label>
              {/* Campo oculto para validación HTML required */}
              <input type="hidden" required value={form.entidad_id} onChange={() => {}} />
              {(() => {
                const selectedE = entidades.find(e => e.id === form.entidad_id)
                const filteredE = entidades
                  .filter(e => {
                    if (!entidadSearch) return true
                    const q = entidadSearch.toLowerCase()
                    return (e.nombre_completo || e.nombre || '').toLowerCase().includes(q) || (e.num_empleado || '').toLowerCase().includes(q)
                  })
                  .sort((a, b) => (a.nombre_completo || a.nombre || '').localeCompare(b.nombre_completo || b.nombre || '', 'es'))
                return (
                  <div className="relative">
                    <input
                      type="text"
                      className={`input pr-8 ${!form.entidad_id ? '' : 'border-primary-400 bg-primary-50'}`}
                      placeholder={`Buscar ${form.entidad_tipo === 'empleado' ? 'empleado por nombre o número' : 'sucursal'}...`}
                      value={entidadSearch || (selectedE ? (selectedE.nombre_completo || selectedE.nombre) : '')}
                      onChange={e => {
                        setEntidadSearch(e.target.value)
                        setShowEntidadDrop(true)
                        if (form.entidad_id) setForm(f => ({ ...f, entidad_id: '' }))
                      }}
                      onFocus={() => { setEntidadSearch(''); setShowEntidadDrop(true) }}
                      onBlur={() => setTimeout(() => setShowEntidadDrop(false), 180)}
                    />
                    {form.entidad_id && (
                      <button type="button" onClick={() => { setForm(f => ({ ...f, entidad_id: '' })); setEntidadSearch('') }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
                    )}
                    {showEntidadDrop && filteredE.length > 0 && (
                      <div className="absolute z-50 w-full bg-white border border-gray-200 rounded-lg shadow-xl max-h-52 overflow-y-auto mt-1 text-sm">
                        {filteredE.map(e => (
                          <div key={e.id}
                            className={`px-3 py-2 cursor-pointer flex items-center justify-between hover:bg-primary-50 ${form.entidad_id === e.id ? 'bg-primary-50 font-semibold' : ''}`}
                            onMouseDown={() => {
                              setForm(f => ({ ...f, entidad_id: e.id }))
                              setEntidadSearch('')
                              setShowEntidadDrop(false)
                            }}
                          >
                            <span className="text-gray-800">{e.nombre_completo || e.nombre}</span>
                            {e.num_empleado && <span className="ml-2 text-xs text-gray-400 font-mono flex-shrink-0">{e.num_empleado}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                    {showEntidadDrop && filteredE.length === 0 && (
                      <div className="absolute z-50 w-full bg-white border border-gray-200 rounded-lg shadow-xl mt-1 px-3 py-3 text-sm text-gray-400">
                        No se encontraron resultados
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
            {form.tipo === 'responsiva' && (
              <div className="col-span-2">
                <label className="label">Persona que recibe *</label>
                <select className="input" value={form.receptor_id} onChange={e => setForm(f => ({ ...f, receptor_id: e.target.value }))}>
                  <option value="">Seleccionar empleado receptor...</option>
                  {[...empleados].sort((a, b) => (a.nombre_completo || '').localeCompare(b.nombre_completo || '', 'es')).map(e => (
                    <option key={e.id} value={e.id}>{e.nombre_completo} — {e.num_empleado}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="label mb-0">Dispositivos a incluir *</label>
              {form.dispositivos.length > 0 && (
                <span className="text-xs text-primary-600 font-medium">{form.dispositivos.length} seleccionado(s)</span>
              )}
            </div>
            <div className="border border-gray-200 rounded-xl overflow-y-auto max-h-52 divide-y divide-gray-100">
              {dispositivos.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-6">No hay dispositivos disponibles</p>
              ) : dispositivos.map(d => {
                const sel = form.dispositivos.find(x => x.id === d.id)
                const toggleDevice = () => {
                  if (sel) setForm(f => ({ ...f, dispositivos: f.dispositivos.filter(x => x.id !== d.id) }))
                  else setForm(f => ({ ...f, dispositivos: [...f.dispositivos, { id: d.id, costo: 0 }] }))
                }
                return (
                  <div key={d.id} className={`flex items-center gap-3 px-3 py-2.5 transition-colors ${sel ? 'bg-primary-50' : 'hover:bg-gray-50'}`}>
                    <input
                      type="checkbox"
                      checked={!!sel}
                      onChange={toggleDevice}
                      className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={toggleDevice}>
                      <span className="text-sm font-medium text-gray-800">{d.tipo}</span>
                      <span className="text-sm text-gray-500"> — {d.marca}{d.modelo ? ` ${d.modelo}` : ''}</span>
                      {d.serie && <span className="text-gray-400 font-mono text-xs ml-1.5">{d.serie}</span>}
                    </div>
                    {sel && form.tipo === 'responsiva' && (
                      <div className="flex items-center gap-1.5 bg-white border border-primary-200 rounded-lg px-2.5 py-1.5 shadow-sm flex-shrink-0">
                        <span className="text-xs text-gray-400 font-medium select-none">$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="w-20 text-xs text-right bg-transparent border-none outline-none font-mono text-gray-700 placeholder-gray-300"
                          placeholder="0.00"
                          value={sel.costo === 0 ? '' : sel.costo}
                          onClick={e => e.stopPropagation()}
                          onChange={e => {
                            e.stopPropagation()
                            const val = parseFloat(e.target.value)
                            setForm(f => ({ ...f, dispositivos: f.dispositivos.map(x => x.id === d.id ? { ...x, costo: isNaN(val) ? 0 : val } : x) }))
                          }}
                        />
                        <span className="text-xs text-gray-400 select-none">MXN</span>
                      </div>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${d.ubicacion_tipo === 'almacen' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                      {d.ubicacion_tipo === 'almacen' ? 'Stock' : d.ubicacion_nombre}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          <div>
            <label className="label">Observaciones</label>
            <textarea className="input" rows={2} value={form.observaciones} onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))} />
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={saving || !form.entidad_id || !form.dispositivos.length}>
              {saving ? 'Creando...' : 'Crear Documento'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal firmar */}
      <Modal open={modal === 'sign'} onClose={() => setModal(null)} title={`Firmar Documento — ${selected?.folio}`} size="xl">
        {selected && (
          <div className="space-y-5">
            <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1">
              <div><span className="font-medium">Tipo:</span> {DOCUMENT_TYPES[selected.tipo]?.label}</div>
              <div><span className="font-medium">Entidad:</span> {selected.entidad_nombre}</div>
              <div><span className="font-medium">Dispositivos:</span> {selected.dispositivos?.map(d => `${d.tipo} ${d.serie}`).join(', ')}</div>
            </div>
            {docsPath && (
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-xs text-blue-700">
                <span>📁</span>
                <span>El PDF se guardará automáticamente en <span className="font-mono font-semibold">{docsPath}\{selected.tipo}\</span></span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-5">
              <div>
                <FirmaCanvas ref={firmaAgenteRef} label={`Firma del Agente — ${selected.agente_nombre}`} existingSignature={agenteFirma} />
                {agenteFirma && (
                  <p className="mt-1 text-xs text-emerald-600 flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                    Tu firma está pre-cargada desde tu perfil
                  </p>
                )}
              </div>
              <FirmaCanvas ref={firmaReceptorRef} label={`Firma del Receptor — ${selected.receptor_nombre || selected.entidad_nombre}`} existingSignature={null} />
            </div>
            <div className="flex justify-end gap-3">
              <button className="btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn-success" onClick={handleSign} disabled={saving}>
                {saving ? 'Generando PDF...' : 'Firmar y guardar'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Toast de guardado local */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          background: toast.type === 'info' ? '#3b82f6' : '#10b981', color: '#fff',
          padding: '14px 20px', borderRadius: 10,
          boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
          fontSize: 13, maxWidth: 480,
          display: 'flex', alignItems: 'flex-start', gap: 10,
          animation: 'fadeIn .25s ease'
        }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>{toast.type === 'info' ? 'ℹ️' : '✅'}</span>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 2 }}>
              {toast.type === 'info' ? 'Aviso' : 'Documento firmado'}
            </div>
            <div style={{ opacity: 0.92, wordBreak: 'break-all' }}>{toast.msg}</div>
          </div>
          <button
            onClick={() => setToast(null)}
            style={{ marginLeft: 12, background: 'rgba(255,255,255,.25)', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', padding: '2px 8px', fontSize: 14, flexShrink: 0 }}
          >✕</button>
        </div>
      )}

      {/* Modal — Enviar link de firma al receptor */}
      <Modal open={modal === 'firmaLink'} onClose={() => { setModal(null); setFirmaLink(null) }} title="Enviar para firma en línea" size="md">
        {firmaLink && (
          <div className="space-y-5">
            {/* Info del documento */}
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 text-sm">
              <p className="text-indigo-700 font-semibold">{firmaLink.doc?.folio}</p>
              <p className="text-indigo-500 text-xs mt-0.5">
                Receptor: <span className="font-medium">{firmaLink.doc?.entidad_nombre}</span>
              </p>
            </div>

            {/* QR Code */}
            <div className="flex flex-col items-center gap-3">
              <p className="text-sm text-gray-600 font-medium">El receptor puede escanear este código QR con su celular:</p>
              <div className="bg-white border-2 border-gray-200 rounded-2xl p-4 shadow-sm">
                <QRCodeSVG value={firmaLink.url} size={200} level="M" includeMargin={false} />
              </div>
              <p className="text-xs text-gray-400">
                Válido por 72 horas · Expira: {new Date(firmaLink.expires_at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
              </p>
            </div>

            {/* Link copiable */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">O comparte este enlace:</label>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={firmaLink.url}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono bg-gray-50 text-gray-600 select-all"
                  onClick={e => e.target.select()}
                />
                <button
                  onClick={copiarLink}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors flex-shrink-0 ${linkCopiado ? 'bg-green-100 text-green-700' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                >
                  {linkCopiado ? '✓ Copiado' : 'Copiar'}
                </button>
              </div>
            </div>

            {/* WhatsApp */}
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Hola, por favor firma el documento ${firmaLink.doc?.folio} en este enlace:\n${firmaLink.url}\n\nVálido por 72 horas.`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl font-semibold text-sm transition-colors"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.555 4.116 1.529 5.843L.057 23.5l5.797-1.522A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.886 0-3.652-.51-5.17-1.398l-.37-.22-3.438.902.917-3.352-.242-.386A9.933 9.933 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
              Compartir por WhatsApp
            </a>

            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700">
              <strong>📱 Instrucción:</strong> El receptor abre el link en su celular o computadora, ve el resumen del documento y dibuja su firma. No requiere crear cuenta.
            </div>

            <div className="flex justify-end">
              <button onClick={() => { setModal(null); setFirmaLink(null) }} className="btn-secondary">Cerrar</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal vista previa */}
      <Modal open={modal === 'preview'} onClose={() => setModal(null)} title={`Documento — ${selected?.folio}`} size="2xl">
        {selected && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button className="btn-secondary" onClick={exportPDF}><PrinterIcon className="h-4 w-4" /> Exportar PDF</button>
            </div>
            {/* Vista previa del documento */}
            <div ref={previewRef} className="bg-white border border-gray-200 rounded-xl p-8 text-sm space-y-6 font-serif">
              {/* Encabezado institucional */}
              <DocumentHeader tipo={selected.tipo} logo={globalLogo} />

              {/* Folio y fecha */}
              <div className="flex justify-between text-xs text-gray-500 -mt-2">
                <span>Folio: <span className="font-mono font-semibold text-gray-700">{selected.folio}</span></span>
                <span>Fecha: {selected.created_at ? format(new Date(selected.created_at), "dd 'de' MMMM 'de' yyyy", { locale: es }) : '—'}</span>
              </div>

              {/* Datos */}
              <div className="grid grid-cols-2 gap-4 text-xs bg-gray-50 rounded-lg p-4">
                <div><span className="font-semibold">Entidad:</span> {selected.entidad_nombre}</div>
                <div><span className="font-semibold">Tipo:</span> {selected.entidad_tipo === 'empleado' ? 'Empleado' : 'Sucursal'}</div>
                <div><span className="font-semibold">Agente TI:</span> {selected.agente_nombre}</div>
                {selected.receptor_nombre && <div><span className="font-semibold">Receptor:</span> {selected.receptor_nombre}</div>}
              </div>

              {/* Texto legal */}
              <div
                className="text-gray-700 text-xs leading-relaxed"
                dangerouslySetInnerHTML={{ __html: renderPlantillaHTML(selected) }}
              />

              {/* Dispositivos */}
              <div>
                <div className="font-semibold text-gray-900 mb-2 text-xs uppercase tracking-wide">Dispositivos</div>
                <table className="w-full text-xs border border-gray-200 rounded">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="text-left px-3 py-1.5">Tipo</th>
                      <th className="text-left px-3 py-1.5">Marca/Modelo</th>
                      <th className="text-left px-3 py-1.5">Serie</th>
                      <th className="text-left px-3 py-1.5">Características</th>
                      {selected.tipo === 'responsiva' && <th className="text-right px-3 py-1.5">Costo</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {selected.dispositivos?.map((d, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="px-3 py-1.5">{d.tipo}</td>
                        <td className="px-3 py-1.5">{d.marca} {d.modelo}</td>
                        <td className="px-3 py-1.5 font-mono">{d.serie}</td>
                        <td className="px-3 py-1.5 text-gray-500">{d.caracteristicas}</td>
                        {selected.tipo === 'responsiva' && (
                          <td className="px-3 py-1.5 text-right font-mono">{d.costo != null ? `$${Number(d.costo).toFixed(2)}` : '—'}</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Observaciones */}
              {selected.observaciones && (
                <div className="text-xs text-gray-600">
                  <span className="font-semibold">Observaciones: </span>{selected.observaciones}
                </div>
              )}

              {/* Firmas */}
              <div className="grid grid-cols-2 gap-8 pt-6 border-t border-gray-200">
                <div className="text-center">
                  {selected.firma_agente ? (
                    <img src={selected.firma_agente} alt="Firma agente" className="h-16 mx-auto mb-2 object-contain" />
                  ) : (
                    <div className="h-16 border-b border-gray-400 mb-2" />
                  )}
                  <div className="text-xs font-semibold text-gray-700">{selected.agente_nombre}</div>
                  <div className="text-xs text-gray-500">Agente de Soporte TI</div>
                  {selected.fecha_firma && <div className="text-xs text-gray-400 mt-0.5">{format(new Date(selected.fecha_firma), 'dd/MM/yyyy HH:mm')}</div>}
                </div>
                <div className="text-center">
                  {selected.firma_receptor ? (
                    <img src={selected.firma_receptor} alt="Firma receptor" className="h-16 mx-auto mb-2 object-contain" />
                  ) : (
                    <div className="h-16 border-b border-gray-400 mb-2" />
                  )}
                  <div className="text-xs font-semibold text-gray-700">{selected.receptor_nombre || selected.entidad_nombre}</div>
                  <div className="text-xs text-gray-500">Receptor</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
