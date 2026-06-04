export async function loadJsPDF() {
  const module = await import('jspdf')
  return module.jsPDF || module.default
}

export async function loadHtml2Canvas() {
  const module = await import('html2canvas')
  return module.default
}

export async function loadWriteExcelFile() {
  const module = await import('write-excel-file/browser')
  return module.default || module
}
