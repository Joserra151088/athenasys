import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

/**
 * Exporta datos a Excel (.xlsx)
 * @param {Array} data - Array de objetos
 * @param {string} fileName - Nombre del archivo (sin extensión)
 * @param {Array} columns - [{ key, label }]
 */
export function exportToExcel(data, fileName, columns) {
  const rows = data.map(item =>
    Object.fromEntries(columns.map(c => [c.label, item[c.key] ?? '']))
  )
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Datos')

  // Ajustar ancho de columnas
  const colWidths = columns.map(c => ({ wch: Math.max(c.label.length + 2, 14) }))
  ws['!cols'] = colWidths

  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  saveAs(blob, `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`)
}

/**
 * Exporta datos a CSV
 * @param {Array} data
 * @param {string} fileName
 * @param {Array} columns - [{ key, label }]
 */
export function exportToCSV(data, fileName, columns) {
  const header = columns.map(c => `"${c.label}"`).join(',')
  const rows = data.map(item =>
    columns.map(c => {
      const v = item[c.key] ?? ''
      return `"${String(v).replace(/"/g, '""')}"`
    }).join(',')
  )
  const csvContent = [header, ...rows].join('\n')
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  saveAs(blob, `${fileName}_${new Date().toISOString().split('T')[0]}.csv`)
}

/**
 * Exporta un elemento del DOM a PDF usando html2canvas + jsPDF
 * @param {string} elementId - ID del elemento a capturar
 * @param {string} title - Título del PDF
 */
export async function exportToPDF(elementId, title) {
  const el = document.getElementById(elementId)
  if (!el) {
    console.error(`Elemento #${elementId} no encontrado`)
    return
  }

  try {
    const canvas = await html2canvas(el, { scale: 1.5, useCORS: true, logging: false })
    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    const pageW = pdf.internal.pageSize.getWidth()
    const pageH = pdf.internal.pageSize.getHeight()
    const imgW = pageW - 20
    const imgH = (canvas.height * imgW) / canvas.width
    let posY = 10

    // Título
    pdf.setFontSize(14)
    pdf.setFont('helvetica', 'bold')
    pdf.text(title, 10, posY)
    posY += 6

    pdf.setFontSize(9)
    pdf.setFont('helvetica', 'normal')
    pdf.text(`Generado: ${new Date().toLocaleDateString('es-MX')}`, 10, posY)
    posY += 6

    // Imagen en páginas múltiples si es necesario
    const pageImgH = pageH - posY - 10
    if (imgH <= pageImgH) {
      pdf.addImage(imgData, 'PNG', 10, posY, imgW, imgH)
    } else {
      let remainingH = imgH
      let srcY = 0
      let firstPage = true
      while (remainingH > 0) {
        const drawH = Math.min(firstPage ? pageImgH : pageH - 20, remainingH)
        const sliceCanvas = document.createElement('canvas')
        sliceCanvas.width = canvas.width
        sliceCanvas.height = (drawH / imgH) * canvas.height
        const ctx = sliceCanvas.getContext('2d')
        ctx.drawImage(canvas, 0, srcY, canvas.width, sliceCanvas.height, 0, 0, canvas.width, sliceCanvas.height)
        if (!firstPage) { pdf.addPage(); posY = 10 }
        pdf.addImage(sliceCanvas.toDataURL('image/png'), 'PNG', 10, posY, imgW, drawH)
        srcY += sliceCanvas.height
        remainingH -= drawH
        firstPage = false
      }
    }

    pdf.save(`${title.replace(/[^a-zA-Z0-9_\-]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`)
  } catch (err) {
    console.error('Error exportando PDF:', err)
  }
}
