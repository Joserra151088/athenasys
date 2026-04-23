import jsPDF from 'jspdf'

export const DOC_CODES = {
  responsiva: 'F-TI-39-V2',
  entrada: 'F-TI-84-V1',
  salida: 'F-TI-85-V1',
}

export const DOC_TITLES = {
  responsiva: 'CARTA RESPONSIVA',
  entrada: 'FORMATO DE ENTRADA DE EQUIPO',
  salida: 'FORMATO DE SALIDA DE EQUIPO',
}

function normalizeCamposExtra(camposExtra) {
  if (!camposExtra) return {}
  if (typeof camposExtra === 'string') {
    try {
      const parsed = JSON.parse(camposExtra)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
    } catch (_) {
      return {}
    }
  }
  return typeof camposExtra === 'object' && !Array.isArray(camposExtra) ? camposExtra : {}
}

function formatCampoLabel(key = '') {
  return String(key)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase())
}

export function getDeviceCharacteristicsText(device = {}) {
  const base = String(device.caracteristicas || '').trim()
  const extras = Object.entries(normalizeCamposExtra(device.campos_extra))
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '')
    .map(([key, value]) => `${formatCampoLabel(key)}: ${String(value).trim()}`)

  return [base, ...extras].filter(Boolean).join(' | ')
}

function getPlantillaTexto(doc) {
  const plantillaTexto = doc?.plantilla?.texto_legal || doc?.plantilla_texto || ''
  if (!plantillaTexto) return ''

  const fechaDoc = doc.created_at
    ? new Date(doc.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })

  const listaDispositivos = doc.dispositivos?.length
    ? `<table style="width:100%;border-collapse:collapse;font-size:11px;margin:8px 0">
        <thead><tr style="background:#f3f4f6">
          <th style="text-align:left;padding:4px 8px;border:1px solid #e5e7eb">Tipo</th>
          <th style="text-align:left;padding:4px 8px;border:1px solid #e5e7eb">Marca/Modelo</th>
          <th style="text-align:left;padding:4px 8px;border:1px solid #e5e7eb">No. Serie</th>
          <th style="text-align:left;padding:4px 8px;border:1px solid #e5e7eb">Caracteristicas</th>
        </tr></thead>
        <tbody>${doc.dispositivos.map(d =>
          `<tr>
            <td style="padding:4px 8px;border:1px solid #e5e7eb">${d.tipo || ''}</td>
            <td style="padding:4px 8px;border:1px solid #e5e7eb">${d.marca || ''} ${d.modelo || ''}</td>
            <td style="padding:4px 8px;border:1px solid #e5e7eb;font-family:monospace">${d.serie || ''}</td>
            <td style="padding:4px 8px;border:1px solid #e5e7eb;color:#6b7280">${getDeviceCharacteristicsText(d)}</td>
          </tr>`
        ).join('')}</tbody>
      </table>`
    : '(Sin dispositivos)'

  return plantillaTexto
    .replaceAll('{{receptor_nombre}}', doc.receptor_firmante_nombre || doc.receptor_nombre || doc.entidad_nombre || '')
    .replaceAll('{{receptor_num_empleado}}', doc.entidad_num_empleado || '')
    .replaceAll('{{receptor_area}}', doc.entidad_area || doc.entidad_departamento || '')
    .replaceAll('{{receptor_puesto}}', doc.entidad_puesto || '')
    .replaceAll('{{receptor_email}}', doc.entidad_email || '')
    .replaceAll('{{sucursal_nombre}}', doc.entidad_tipo === 'sucursal' ? doc.entidad_nombre : '')
    .replaceAll('{{sucursal_estado}}', doc.entidad_estado || '')
    .replaceAll('{{sucursal_tipo}}', doc.entidad_tipo === 'sucursal' ? 'Sucursal' : 'Corporativo')
    .replaceAll('{{agente_nombre}}', doc.agente_nombre || '')
    .replaceAll('{{origen_entrada}}', doc.entidad_nombre || '')
    .replaceAll('{{tipo_origen_entrada}}', doc.entrada_origen_tipo || doc.entidad_tipo || '')
    .replaceAll('{{referencia_entrada}}', doc.entrada_referencia || '')
    .replaceAll('{{recibido_por_nombre}}', doc.recibido_por_nombre || doc.agente_nombre || '')
    .replaceAll('{{fecha_documento}}', fechaDoc)
    .replaceAll('{{folio}}', doc.folio || '')
    .replaceAll('{{motivo_salida}}', doc.motivo_salida || doc.observaciones || '')
    .replaceAll('{{num_dispositivos}}', String(doc.dispositivos?.length || 0))
    .replaceAll('{{lista_dispositivos}}', listaDispositivos)
}

function htmlToPlainText(rawHTML) {
  if (!rawHTML || !rawHTML.trim()) return ''

  return rawHTML
    .replace(/<table[\s\S]*?<\/table>/gi, '\n[Ver tabla de dispositivos abajo]\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n').replace(/<p[^>]*>/gi, '')
    .replace(/<\/div>/gi, '\n').replace(/<div[^>]*>/gi, '')
    .replace(/<\/h[1-6]>/gi, '\n').replace(/<h[1-6][^>]*>/gi, '')
    .replace(/<\/li>/gi, '\n').replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/ul>/gi, '\n').replace(/<ul[^>]*>/gi, '')
    .replace(/<\/ol>/gi, '\n').replace(/<ol[^>]*>/gi, '')
    .replace(/<\/tr>/gi, '\n').replace(/<td[^>]*>/gi, ' | ').replace(/<th[^>]*>/gi, ' | ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export async function generateDocumentPDF(doc, options = {}) {
  const {
    logo = null,
    firmaAgenteImg = null,
    firmaLogisticaImg = null,
    firmaReceptorImg = null,
  } = options

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const W = pdf.internal.pageSize.getWidth()
  const H = pdf.internal.pageSize.getHeight()
  const ml = 14
  const mt = 14
  const mb = 20
  const cw = W - ml * 2
  let y = mt

  const checkPage = needed => {
    if (y + needed > H - mb) {
      pdf.addPage()
      y = mt
    }
  }

  const addImg = (src, x, yy, w, h) => {
    if (!src) return
    try {
      const fmt = src.startsWith('data:image/png') ? 'PNG' : 'JPEG'
      pdf.addImage(src, fmt, x, yy, w, h, '', 'FAST')
    } catch (_) {}
  }

  const hH = 24
  const c1 = cw * 0.27
  const c2 = cw * 0.46
  const c3 = cw * 0.27

  pdf.setDrawColor(180, 188, 198)
  pdf.setLineWidth(0.5)

  pdf.rect(ml, y, c1, hH)
  if (logo) addImg(logo, ml + 2, y + 2, c1 - 4, hH - 4)
  else {
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7)
    pdf.setTextColor(160, 160, 160)
    pdf.text('AthenaSys TI', ml + c1 / 2, y + hH / 2, { align: 'center', baseline: 'middle' })
  }

  pdf.rect(ml + c1, y, c2, hH)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(11)
  pdf.setTextColor(17, 24, 39)
  const titleLines = pdf.splitTextToSize(DOC_TITLES[doc.tipo] || doc.tipo?.toUpperCase() || '', c2 - 6)
  pdf.text(titleLines, ml + c1 + c2 / 2, y + hH / 2, { align: 'center', baseline: 'middle' })

  pdf.rect(ml + c1 + c2, y, c3, hH / 2)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(8)
  pdf.setTextColor(79, 70, 229)
  pdf.text(DOC_CODES[doc.tipo] || '', ml + c1 + c2 + c3 / 2, y + hH / 4, { align: 'center', baseline: 'middle' })

  pdf.rect(ml + c1 + c2, y + hH / 2, c3, hH / 2)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(234, 88, 12)
  pdf.text('Interna', ml + c1 + c2 + c3 / 2, y + (hH * 3) / 4, { align: 'center', baseline: 'middle' })
  y += hH + 5

  pdf.setFillColor(241, 245, 249)
  pdf.setDrawColor(203, 213, 225)
  pdf.setLineWidth(0.3)
  pdf.roundedRect(ml, y, cw, 8, 1, 1, 'FD')
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(7.5)
  pdf.setTextColor(71, 85, 105)
  pdf.text('FOLIO:', ml + 3, y + 5.4)
  pdf.setFont('courier', 'bold')
  pdf.setFontSize(8)
  pdf.setTextColor(15, 23, 42)
  pdf.text(doc.folio || '', ml + 19, y + 5.4)
  const dateStr = doc.created_at
    ? new Date(doc.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
    : '-'
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(7.5)
  pdf.setTextColor(71, 85, 105)
  pdf.text(`Fecha: ${dateStr}`, ml + cw - 2, y + 5.4, { align: 'right' })
  y += 13

  const tipoEntidad = doc.entidad_tipo === 'empleado' ? 'Empleado' : doc.entidad_tipo === 'proveedor' ? 'Proveedor' : 'Sucursal'
  const infoRows = doc.tipo === 'entrada'
    ? [
        ['Origen', doc.entidad_nombre || '-', 'Tipo', tipoEntidad],
        ['Recibido por', doc.recibido_por_nombre || doc.agente_nombre || '-', doc.entrada_referencia ? 'Referencia' : '', doc.entrada_referencia || ''],
      ]
    : [
        ['Entidad / Receptor', doc.entidad_nombre || '-', 'Tipo', tipoEntidad],
        ['Agente TI', doc.agente_nombre || '-', doc.receptor_nombre ? 'Recibe' : '', doc.receptor_nombre || ''],
      ]
  const infoH = infoRows.length * 8 + 5
  pdf.setFillColor(241, 245, 249)
  pdf.setDrawColor(203, 213, 225)
  pdf.setLineWidth(0.3)
  pdf.roundedRect(ml, y, cw, infoH, 1, 1, 'FD')
  infoRows.forEach((row, index) => {
    const ry = y + 7 + index * 8
    const hw = cw / 2
    const renderCell = (label, value, offsetX) => {
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(7)
      pdf.setTextColor(100, 116, 139)
      pdf.text(`${label}:`, ml + offsetX + 3, ry)
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(15, 23, 42)
      const safeValue = pdf.splitTextToSize(value || '', hw - 28)[0] || ''
      pdf.text(safeValue, ml + offsetX + 3 + (pdf.getStringUnitWidth(`${label}:`) * 7 / pdf.internal.scaleFactor) + 2, ry)
    }
    renderCell(row[0], row[1], 0)
    if (row[2]) renderCell(row[2], row[3], hw)
  })
  y += infoH + 8

  const plainTemplate = htmlToPlainText(getPlantillaTexto(doc))
  if (plainTemplate) {
    pdf.setFont('times', 'normal')
    pdf.setFontSize(9)
    pdf.setTextColor(31, 41, 55)
    const paragraphs = plainTemplate.split('\n').filter(paragraph => paragraph.trim())
    for (const paragraph of paragraphs) {
      const lines = pdf.splitTextToSize(paragraph.trim(), cw)
      if (!lines.length) continue
      checkPage(lines.length * 5.5 + 4)
      pdf.text(lines, ml, y, { lineHeightFactor: 1.5 })
      y += lines.length * 5.5 + 4
    }
    y += 4
  }

  checkPage(22)
  pdf.setFillColor(30, 41, 59)
  pdf.setDrawColor(30, 41, 59)
  pdf.roundedRect(ml, y, cw, 7, 1, 1, 'F')
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(7.5)
  pdf.setTextColor(255, 255, 255)
  pdf.text('EQUIPOS / DISPOSITIVOS', ml + 4, y + 4.8)
  y += 7

  const isResponsiva = doc.tipo === 'responsiva'
  const cols = isResponsiva
    ? [
        { h: 'Tipo', w: cw * 0.14 },
        { h: 'Marca / Modelo', w: cw * 0.20 },
        { h: 'No. Serie', w: cw * 0.28 },
        { h: 'Caracteristicas', w: cw * 0.25 },
        { h: 'Costo', w: cw * 0.13 },
      ]
    : [
        { h: 'Tipo', w: cw * 0.15 },
        { h: 'Marca / Modelo', w: cw * 0.22 },
        { h: 'No. Serie', w: cw * 0.30 },
        { h: 'Caracteristicas', w: cw * 0.33 },
      ]

  let xc = ml
  pdf.setLineWidth(0.2)
  cols.forEach(col => {
    pdf.setFillColor(226, 232, 240)
    pdf.setDrawColor(203, 213, 225)
    pdf.rect(xc, y, col.w, 7, 'FD')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(7)
    pdf.setTextColor(51, 65, 85)
    pdf.text(col.h, xc + 2, y + 4.8)
    xc += col.w
  })
  y += 7

  const devices = doc.dispositivos || []
  devices.forEach((device, index) => {
    const even = index % 2 === 0
    const cells = isResponsiva
      ? [
          device.tipo,
          `${device.marca || ''} ${device.modelo || ''}`.trim(),
          device.serie || '-',
          getDeviceCharacteristicsText(device),
          device.costo != null ? `$${Number(device.costo).toFixed(2)}` : '-',
        ]
      : [
          device.tipo,
          `${device.marca || ''} ${device.modelo || ''}`.trim(),
          device.serie || '-',
          getDeviceCharacteristicsText(device),
        ]

    const cellLines = cells.map((cell, colIndex) => {
      pdf.setFont(colIndex === 2 ? 'courier' : 'helvetica', 'normal')
      pdf.setFontSize(colIndex === 2 ? 6.5 : 7)
      return pdf.splitTextToSize(String(cell || ''), cols[colIndex].w - 4)
    })
    const lineHeight = 3.8
    const rowH = Math.max(7, 4 + Math.max(...cellLines.map(lines => lines.length || 1)) * lineHeight)
    checkPage(rowH)

    xc = ml
    cols.forEach((col, colIndex) => {
      pdf.setFillColor(even ? 255 : 248, even ? 255 : 250, even ? 255 : 252)
      pdf.setDrawColor(226, 232, 240)
      pdf.setLineWidth(0.2)
      pdf.rect(xc, y, col.w, rowH, 'FD')
      pdf.setFont(colIndex === 2 ? 'courier' : 'helvetica', 'normal')
      pdf.setFontSize(colIndex === 2 ? 6.5 : 7)
      pdf.setTextColor(17, 24, 39)
      pdf.text(cellLines[colIndex], xc + 2, y + 4.8, { lineHeightFactor: 1.15 })
      xc += col.w
    })
    y += rowH
  })
  y += 8

  const renderObservationBlock = (title, value) => {
    const text = String(value || '').trim()
    if (!text) return

    const lines = pdf.splitTextToSize(text, cw - 8)
    const lineHeight = 4
    const blockH = Math.max(18, 13 + lines.length * lineHeight)
    checkPage(blockH + 4)

    pdf.setFillColor(255, 251, 235)
    pdf.setDrawColor(251, 191, 36)
    pdf.setLineWidth(0.4)
    pdf.roundedRect(ml, y, cw, blockH, 1, 1, 'FD')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(7.5)
    pdf.setTextColor(146, 64, 14)
    pdf.text(`${title}:`, ml + 3, y + 5.5)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7.2)
    pdf.setTextColor(30, 20, 5)
    pdf.text(lines, ml + 3, y + 11, { lineHeightFactor: 1.35 })
    y += blockH + 5
  }

  renderObservationBlock('Observaciones', doc.observaciones)
  renderObservationBlock('Observaciones del receptor', doc.receptor_observaciones)

  const sigH = 44
  checkPage(sigH + 14)
  pdf.setFillColor(30, 41, 59)
  pdf.roundedRect(ml, y, cw, 7, 1, 1, 'F')
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(7.5)
  pdf.setTextColor(255, 255, 255)
  pdf.text('FIRMAS', ml + 4, y + 4.8)
  y += 11

  const firmaA = firmaAgenteImg || doc.firma_agente || null
  const firmaL = firmaLogisticaImg || doc.firma_logistica || null
  const firmaR = firmaReceptorImg || doc.firma_receptor || null
  const isSalida = doc.tipo === 'salida'
  const gap = isSalida ? 5 : 16
  const bw = isSalida ? (cw - gap * 2) / 3 : cw / 2 - 8
  const boxes = isSalida
    ? [
        { x: ml, img: firmaA, name: doc.agente_nombre, role: 'Agente de Soporte TI' },
        { x: ml + bw + gap, img: firmaL, name: doc.logistica_nombre, role: doc.logistica_area || 'Logística / Almacén' },
        { x: ml + (bw + gap) * 2, img: firmaR, name: doc.receptor_firmante_nombre || doc.receptor_nombre || doc.entidad_nombre, role: 'Receptor' },
      ]
    : [
        { x: ml, img: firmaA, name: doc.agente_nombre, role: 'Agente de Soporte TI' },
        { x: ml + cw / 2 + 8, img: firmaR, name: doc.receptor_firmante_nombre || doc.receptor_nombre || doc.entidad_nombre, role: 'Receptor' },
      ]

  const writeName = (name, x, cy) => {
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(7.5)
    pdf.setTextColor(15, 23, 42)
    pdf.text(pdf.splitTextToSize(name || '-', bw - 10)[0], x, cy, { align: 'center' })
  }

  boxes.forEach(box => {
    pdf.setFillColor(250, 251, 253)
    pdf.setDrawColor(203, 213, 225)
    pdf.setLineWidth(0.3)
    pdf.roundedRect(box.x, y, bw, sigH, 1, 1, 'FD')
    addImg(box.img, box.x + bw / 2 - 22, y + 4, 44, 25)

    pdf.setDrawColor(148, 163, 184)
    pdf.setLineWidth(0.4)
    pdf.line(box.x + 5, y + sigH - 14, box.x + bw - 5, y + sigH - 14)

    writeName(box.name, box.x + bw / 2, y + sigH - 8)

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7)
    pdf.setTextColor(100, 116, 139)
    pdf.text(pdf.splitTextToSize(box.role || '', bw - 10)[0] || '', box.x + bw / 2, y + sigH - 3, { align: 'center' })
  })

  y += sigH + 4
  pdf.setFontSize(6.5)
  pdf.setTextColor(148, 163, 184)
  const fechaFirma = doc.fecha_firma
    ? new Date(doc.fecha_firma).toLocaleString('es-MX')
    : new Date().toLocaleString('es-MX')
  pdf.text(`Firmado electronicamente: ${fechaFirma}`, ml + cw / 2, y, { align: 'center' })

  const totalPages = pdf.internal.getNumberOfPages()
  for (let page = 1; page <= totalPages; page += 1) {
    pdf.setPage(page)
    pdf.setDrawColor(203, 213, 225)
    pdf.setLineWidth(0.3)
    pdf.line(ml, H - mb + 5, ml + cw, H - mb + 5)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(6.5)
    pdf.setTextColor(148, 163, 184)
    pdf.text('Generado por AthenaSys Inventario TI · Confidencial', ml, H - mb + 9)
    pdf.text(`${page} / ${totalPages}`, ml + cw, H - mb + 9, { align: 'right' })
  }

  return pdf
}
