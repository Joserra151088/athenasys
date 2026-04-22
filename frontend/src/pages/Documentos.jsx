import { useState, useEffect, useCallback, useRef } from 'react'
import { documentoAPI, plantillaAPI, empleadoAPI, sucursalAPI, deviceAPI, usuarioSistemaAPI, configAPI, firmaOnlineAPI, proveedorAPI } from '../utils/api'
import { DOCUMENT_TYPES, DEVICE_TYPES } from '../utils/constants'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import Pagination from '../components/Pagination'
import FirmaCanvas from '../components/FirmaCanvas'
import PageHeader from '../components/PageHeader'
import { PlusIcon, MagnifyingGlassIcon, EyeIcon, PencilSquareIcon, PrinterIcon, DocumentIcon, ClockIcon, PaperAirplaneIcon, QrCodeIcon, AdjustmentsHorizontalIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useNotification } from '../context/NotificationContext'
import { QRCodeSVG } from 'qrcode.react'
import { generateDocumentPDF as generateSharedDocumentPDF } from '../utils/documentPdf'

const DOC_CODES = { responsiva: 'F-TI-39-V2', entrada: 'F-TI-84-V1', salida: 'F-TI-85-V1' }

const COL_LABELS = {
  folio: 'Folio',
  tipo: 'Tipo',
  dispositivos: 'Dispositivos',
  receptor: 'Receptor',
  estado: 'Estado',
  fecha: 'Fecha'
}
const DOC_TITLES = { responsiva: 'CARTA RESPONSIVA', entrada: 'FORMATO DE ENTRADA DE EQUIPO', salida: 'FORMATO DE SALIDA DE EQUIPO' }

const SERIE_OPTIONS = {
  capturada: 'capturada',
  sin_numero: 'sin_numero',
  no_visible: 'no_visible',
}

const EMPTY_RECEIVED_DEVICE = {
  tipo: '',
  marca: '',
  modelo: '',
  serie_estado: SERIE_OPTIONS.sin_numero,
  serie: '',
  cantidad: 1,
  costo_dia: '',
  caracteristicas: '',
}

const normalizeText = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

async function fetchAllPaginated(getter, params = {}, pageSize = 500) {
  const first = await getter({ ...params, page: 1, limit: pageSize })
  const all = [...(first.data || [])]
  const totalPages = Number(first.pages || Math.ceil((first.total || all.length) / pageSize) || 1)

  for (let page = 2; page <= totalPages; page += 1) {
    const res = await getter({ ...params, page, limit: pageSize })
    all.push(...(res.data || []))
  }

  return all
}

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
  const [filterEstado, setFilterEstado] = useState('')
  const [loading, setLoading] = useState(true)

  // Sorting
  const [sortCol, setSortCol] = useState('')
  const [sortDir, setSortDir] = useState('asc')

  // Columnas visibles
  const colsMenuRef = useRef(null)
  const [colsMenuOpen, setColsMenuOpen] = useState(false)
  const [visibleCols, setVisibleCols] = useState({ folio: true, tipo: true, dispositivos: true, receptor: true, estado: true, fecha: true })

  // Resize columnas
  const resizingRef = useRef(null)
  const [colWidths, setColWidths] = useState({})
  const [modal, setModal] = useState(null) // 'create' | 'sign' | 'preview'
  const [selected, setSelected] = useState(null)
  const [saving, setSaving] = useState(false)
  const previewRef = useRef(null)
  const firmaAgenteRef = useRef(null)
  const firmaLogisticaRef = useRef(null)
  const firmaOnlineLogisticaRef = useRef(null)
  const firmaReceptorRef = useRef(null)
  const [logisticaNombre, setLogisticaNombre] = useState('')
  const [logisticaArea, setLogisticaArea] = useState('')
  const [logisticaSaving, setLogisticaSaving] = useState(false)

  // Agent firma pre-loaded
  const [agenteFirma, setAgenteFirma] = useState(null)

  useEffect(() => {
    const h = (e) => { if (colsMenuRef.current && !colsMenuRef.current.contains(e.target)) setColsMenuOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const startResize = (colKey, e) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = e.currentTarget.parentElement.offsetWidth
    resizingRef.current = { colKey, startX, startWidth }
    const onMove = (ev) => {
      if (!resizingRef.current) return
      const diff = ev.clientX - resizingRef.current.startX
      setColWidths(w => ({ ...w, [resizingRef.current.colKey]: Math.max(60, resizingRef.current.startWidth + diff) }))
    }
    const onUp = () => { resizingRef.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const sortIcon = (col) => sortCol === col ? (sortDir === 'asc' ? '▲' : '▼') : <span className="text-gray-300">⇅</span>

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
  const [onlineSalidaDoc, setOnlineSalidaDoc] = useState(null)
  const [onlineLogisticaNombre, setOnlineLogisticaNombre] = useState('')
  const [onlineLogisticaArea, setOnlineLogisticaArea] = useState('Logística / Almacén')

  const showFirmaOnlineError = (err) => {
    if (err?.response?.data?.code === 'SIN_FIRMA_AGENTE' || err?.message?.includes('firma digital')) {
      showError('Debes registrar tu firma digital antes de enviar documentos. Ve a Mi Firma y agrega tu firma.', 'Firma requerida')
    } else {
      showError(err?.message || 'Error generando link de firma')
    }
  }

  const solicitarFirmaOnline = async (doc, extra = {}) => {
    const result = await firmaOnlineAPI.solicitar(doc.id, extra)
    setFirmaLink({ url: result.url, expires_at: result.expires_at, expires_label: result.expires_label, token: result.token, doc, email_enviado: result.email_enviado, email_destino: result.email_destino })
    setModal('firmaLink')
  }

  const saveSalidaLogistica = async ({ doc, nombre, area, firma, firmaAgente }) => {
    const payload = {
      logistica_nombre: nombre.trim(),
      logistica_area: area.trim(),
    }
    if (firma) payload.firma_logistica = firma
    if (firmaAgente) payload.firma_agente = firmaAgente
    return documentoAPI.saveLogistica(doc.id, payload)
  }

  const handleSaveLogistica = async () => {
    if (!selected || selected.tipo !== 'salida') return
    const firmaAgente = firmaAgenteRef.current?.getDataURL() || selected.firma_agente || agenteFirma
    const firmaLogistica = firmaLogisticaRef.current?.getDataURL()
    if (!logisticaNombre.trim()) { showError('Captura el nombre de quien firma por logística o almacén.', 'Campo requerido'); return }
    if (!logisticaArea.trim()) { showError('Captura el área de quien firma por logística o almacén.', 'Campo requerido'); return }

    setLogisticaSaving(true)
    try {
      const updated = await saveSalidaLogistica({
        doc: selected,
        nombre: logisticaNombre,
        area: logisticaArea,
        firma: firmaLogistica,
        firmaAgente,
      })
      setSelected(updated)
      load(pagination.page || 1)
      if (updated.firma_agente && updated.firma_logistica) {
        showToast('Firmas internas guardadas. Ya puedes imprimir la salida con firma del agente y logística.')
      } else if (updated.firma_agente) {
        showToast('Firma del agente y datos de logística guardados. Falta la firma de logística para imprimir completo.', 'info')
      } else {
        showToast('Datos de logística guardados. Para imprimir con firmas, agrega firma del agente y logística y vuelve a guardar.', 'info')
      }
    } catch (err) {
      showError(err?.message || 'Error al guardar datos de logística')
    } finally {
      setLogisticaSaving(false)
    }
  }

  const handleEnviarFirma = async (doc) => {
    setEnviandoLink(true)
    try {
      if (doc.tipo === 'salida') {
        const full = await documentoAPI.getById(doc.id)
        setOnlineSalidaDoc(full)
        setOnlineLogisticaNombre(full.logistica_nombre || '')
        setOnlineLogisticaArea(full.logistica_area || 'Logística / Almacén')
        setModal('firmaOnlineSalida')
        return
      }
      await solicitarFirmaOnline(doc)
    } catch (err) {
      showFirmaOnlineError(err)
    } finally {
      setEnviandoLink(false)
    }
  }

  const confirmarFirmaOnlineSalida = async () => {
    if (!onlineSalidaDoc) return
    const firmaLogistica = firmaOnlineLogisticaRef.current?.getDataURL()
    if (!onlineLogisticaNombre.trim()) { showError('Captura el nombre de quien firma por logística o almacén.', 'Campo requerido'); return }
    if (!onlineLogisticaArea.trim()) { showError('Captura el área de quien firma por logística o almacén.', 'Campo requerido'); return }
    if (!firmaLogistica) { showError('La firma de logística o almacén es requerida para enviar una salida a firma en línea.', 'Campo requerido'); return }

    setEnviandoLink(true)
    try {
      const updated = await saveSalidaLogistica({
        doc: onlineSalidaDoc,
        nombre: onlineLogisticaNombre,
        area: onlineLogisticaArea,
        firma: firmaLogistica,
      })
      await solicitarFirmaOnline(updated, {
        logistica_nombre: onlineLogisticaNombre.trim(),
        logistica_area: onlineLogisticaArea.trim(),
        firma_logistica: firmaLogistica,
      })
      setOnlineSalidaDoc(null)
    } catch (err) {
      showFirmaOnlineError(err)
    } finally {
      setEnviandoLink(false)
    }
  }

  const handleSaveOnlineLogistica = async () => {
    if (!onlineSalidaDoc) return
    const firmaLogistica = firmaOnlineLogisticaRef.current?.getDataURL()
    if (!onlineLogisticaNombre.trim()) { showError('Captura el nombre de quien firma por logística o almacén.', 'Campo requerido'); return }
    if (!onlineLogisticaArea.trim()) { showError('Captura el área de quien firma por logística o almacén.', 'Campo requerido'); return }

    setLogisticaSaving(true)
    try {
      const updated = await saveSalidaLogistica({
        doc: onlineSalidaDoc,
        nombre: onlineLogisticaNombre,
        area: onlineLogisticaArea,
        firma: firmaLogistica,
      })
      setOnlineSalidaDoc(updated)
      load(pagination.page || 1)
      showToast(firmaLogistica ? 'Datos y firma de logística guardados.' : 'Datos de logística guardados. La firma puede agregarse después.')
    } catch (err) {
      showError(err?.message || 'Error al guardar datos de logística')
    } finally {
      setLogisticaSaving(false)
    }
  }

  const copiarLink = () => {
    if (!firmaLink?.url) return
    navigator.clipboard.writeText(firmaLink.url).then(() => {
      setLinkCopiado(true)
      setTimeout(() => setLinkCopiado(false), 2500)
    })
  }

  const firmaLinkVigencia = firmaLink?.expires_label || (firmaLink?.doc?.tipo === 'salida' ? '45 días' : '72 horas')

  // Create form
  const [form, setForm] = useState({ tipo: 'responsiva', plantilla_id: '', entidad_tipo: 'empleado', entidad_id: '', dispositivos: [], receptor_id: '', motivo_salida: '', entrada_referencia: '', recibido_por_id: '', dispositivos_recibidos: [], observaciones: '' })
  const [plantillas, setPlantillas] = useState([])
  const [entidades, setEntidades] = useState([])
  const [empleados, setEmpleados] = useState([])
  const [proveedores, setProveedores] = useState([])
  const [usuariosSistema, setUsuariosSistema] = useState([])
  const [dispositivos, setDispositivos] = useState([])
  const [receivedDevices, setReceivedDevices] = useState([{ ...EMPTY_RECEIVED_DEVICE }])
  const [entidadSearch, setEntidadSearch] = useState('')
  const [showEntidadDrop, setShowEntidadDrop] = useState(false)
  const [receptorSearch, setReceptorSearch] = useState('')
  const [showReceptorDrop, setShowReceptorDrop] = useState(false)
  const [deviceSearch, setDeviceSearch] = useState('')
  const [deviceTypeFilter, setDeviceTypeFilter] = useState('')
  const [deviceAssignFilter, setDeviceAssignFilter] = useState('todos')

  const load = useCallback((page = 1) => {
    setLoading(true)
    const params = { page, limit: 20 }
    if (search) params.search = search
    if (filterTipo) params.tipo = filterTipo
    if (filterEstado) params.estado = filterEstado
    documentoAPI.getAll(params).then(d => {
      setDocumentos(d.data)
      setPagination({ page: d.page, pages: Math.ceil(d.total / 20), total: d.total, limit: 20 })
    }).finally(() => setLoading(false))
  }, [search, filterTipo, filterEstado])

  useEffect(() => { load(1) }, [load])

  const openCreate = async () => {
    const [pl, emp, devs, provs] = await Promise.all([
      plantillaAPI.getAll(),
      fetchAllPaginated(empleadoAPI.getAll),
      deviceAPI.getAll({ limit: 1000 }),
      proveedorAPI.getAll(),
    ])
    let users = []
    try {
      users = await usuarioSistemaAPI.getAll()
    } catch (_) {
      users = user ? [user] : []
    }
    const empSorted = [...emp].sort((a, b) => (a.nombre_completo || '').localeCompare(b.nombre_completo || '', 'es'))
    const proveedorSorted = [...provs].filter(p => p.activo !== false).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'))
    setPlantillas(pl)
    setEmpleados(empSorted)
    setProveedores(proveedorSorted)
    setUsuariosSistema(users.filter(u => u.activo !== false && ['super_admin', 'agente_soporte'].includes(u.rol)))
    setEntidades(empSorted)
    setEntidadSearch('')
    setDispositivos(devs.data)
    setReceivedDevices([{ ...EMPTY_RECEIVED_DEVICE }])
    setDeviceSearch('')
    setDeviceTypeFilter('')
    setDeviceAssignFilter('todos')
    setForm({ tipo: 'responsiva', plantilla_id: pl.find(p => p.tipo === 'responsiva')?.id || '', entidad_tipo: 'empleado', entidad_id: '', dispositivos: [], receptor_id: '', motivo_salida: '', entrada_referencia: '', recibido_por_id: user?.id || '', dispositivos_recibidos: [], observaciones: '' })
    setModal('create')
  }

  const handleEntidadTipo = async (tipo) => {
    if (tipo === 'empleado') {
      setEntidades(empleados)
    } else if (tipo === 'sucursal') {
      const res = await fetchAllPaginated(sucursalAPI.getAll)
      setEntidades(res.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es')))
    } else {
      setEntidades(proveedores)
    }
    setForm(f => ({ ...f, entidad_tipo: tipo, entidad_id: '' }))
    setEntidadSearch('')
    setShowEntidadDrop(false)
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = { ...form }
      if (payload.tipo === 'entrada') {
        payload.entrada_origen_tipo = payload.entidad_tipo
      }
      if (payload.tipo === 'entrada' && payload.entidad_tipo === 'proveedor') {
        payload.dispositivos = []
        payload.dispositivos_recibidos = receivedDevices
          .map(line => ({
            ...line,
            cantidad: line.serie_estado === SERIE_OPTIONS.capturada ? 1 : Math.max(1, parseInt(line.cantidad || 1, 10) || 1),
            serie: line.serie_estado === SERIE_OPTIONS.capturada ? String(line.serie || '').trim() : '',
          }))
          .filter(line => line.tipo && line.marca)
      } else {
        payload.dispositivos_recibidos = []
      }
      await documentoAPI.create(payload)
      setModal(null)
      load(1)
    } catch (err) { showError(err?.message || 'Error') }
    finally { setSaving(false) }
  }

  const openSign = async (doc) => {
    const full = await documentoAPI.getById(doc.id)
    setSelected(full)
    setLogisticaNombre(full.logistica_nombre || '')
    setLogisticaArea(full.logistica_area || 'Logística / Almacén')
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
    const firmaLogistica = selected.tipo === 'salida' ? firmaLogisticaRef.current?.getDataURL() : null
    const firmaReceptor = firmaReceptorRef.current?.getDataURL()
    if (!firmaReceptor) { showError('La firma del receptor es requerida', 'Campo requerido'); return }
    if (!firmaAgente) { showError('La firma del agente es requerida. Sube tu firma en tu perfil de usuario o dibuja una en el campo de firma.', 'Firma del agente'); return }
    if (selected.tipo === 'salida') {
      if (!logisticaNombre.trim()) { showError('Captura el nombre de quien firma por logística o almacén.', 'Campo requerido'); return }
      if (!logisticaArea.trim()) { showError('Captura el área de quien firma por logística o almacén.', 'Campo requerido'); return }
      if (!firmaLogistica) { showError('La firma de logística o almacén es requerida para documentos de salida.', 'Campo requerido'); return }
    }
    setSaving(true)

    let pdf_base64 = null
    try {
      const pdf = await generateDocumentPDF(
        selected.tipo === 'salida'
          ? { ...selected, logistica_nombre: logisticaNombre.trim(), logistica_area: logisticaArea.trim() }
          : selected,
        firmaAgente,
        firmaReceptor,
        firmaLogistica
      )
      pdf_base64 = pdf.output('datauristring')
    } catch (pdfErr) {
      console.error('[PDF] Error generando PDF:', pdfErr)
      showError(`Error generando PDF: ${pdfErr.message}. El documento se firmará sin PDF adjunto.`, 'Advertencia PDF')
    }

    try {
      const result = await documentoAPI.sign(selected.id, {
        firma_agente: firmaAgente,
        firma_receptor: firmaReceptor,
        firma_logistica: firmaLogistica,
        logistica_nombre: logisticaNombre.trim(),
        logistica_area: logisticaArea.trim(),
        pdf_base64
      })
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
      const full = await documentoAPI.getById(selected.id)
      setSelected(full)
      const pdf = await generateDocumentPDF(full)
      pdf.save(`${full.folio || 'documento'}.pdf`)
    } catch (err) {
      showError('Error al exportar PDF: ' + err.message)
    }
  }

  const deviceTypes = [...new Set(dispositivos.map(d => d.tipo).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'es'))

  const filteredDocumentDevices = dispositivos.filter(device => {
    const q = deviceSearch.trim().toLowerCase()
    const isAssigned = device.ubicacion_tipo && device.ubicacion_tipo !== 'almacen'

    if (deviceTypeFilter && device.tipo !== deviceTypeFilter) return false
    if (deviceAssignFilter === 'disponibles' && isAssigned) return false
    if (deviceAssignFilter === 'asignados' && !isAssigned) return false
    if (!q) return true

    return [
      device.tipo,
      device.marca,
      device.modelo,
      device.serie,
      device.ubicacion_nombre,
    ].some(value => String(value || '').toLowerCase().includes(q))
  })

  const isEntradaProveedor = form.tipo === 'entrada' && form.entidad_tipo === 'proveedor'
  const receivedDeviceCount = receivedDevices.reduce((sum, line) => {
    if (!line.tipo || !line.marca) return sum
    return sum + (line.serie_estado === SERIE_OPTIONS.capturada ? 1 : Math.max(1, parseInt(line.cantidad || 1, 10) || 1))
  }, 0)

  const updateReceivedDevice = (index, changes) => {
    setReceivedDevices(lines => lines.map((line, i) => {
      if (i !== index) return line
      const next = { ...line, ...changes }
      if (changes.serie_estado === SERIE_OPTIONS.capturada) next.cantidad = 1
      if (changes.serie_estado && changes.serie_estado !== SERIE_OPTIONS.capturada) next.serie = ''
      return next
    }))
  }

  const addReceivedDeviceLine = () => {
    setReceivedDevices(lines => [...lines, { ...EMPTY_RECEIVED_DEVICE }])
  }

  const removeReceivedDeviceLine = (index) => {
    setReceivedDevices(lines => lines.length === 1 ? [{ ...EMPTY_RECEIVED_DEVICE }] : lines.filter((_, i) => i !== index))
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
      .replaceAll('{{origen_entrada}}',        doc.entidad_nombre || '')
      .replaceAll('{{tipo_origen_entrada}}',   doc.entrada_origen_tipo || doc.entidad_tipo || '')
      .replaceAll('{{referencia_entrada}}',    doc.entrada_referencia || '')
      .replaceAll('{{recibido_por_nombre}}',   doc.recibido_por_nombre || doc.agente_nombre || '')
      // Documento
      .replaceAll('{{fecha_documento}}',       fechaDoc)
      .replaceAll('{{folio}}',                 doc.folio || '')
      .replaceAll('{{motivo_salida}}',         doc.motivo_salida || doc.observaciones || '')
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
  const generateDocumentPDF = async (doc, firmaAgenteImg = null, firmaReceptorImg = null, firmaLogisticaImg = null) => {
    return generateSharedDocumentPDF(
      {
        ...doc,
        plantilla_texto: doc?.plantilla?.texto_legal || doc?.plantilla_texto || '',
      },
      {
        logo: globalLogo,
        firmaAgenteImg,
        firmaLogisticaImg,
        firmaReceptorImg,
      }
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Documentos" subtitle="Entradas, salidas y responsivas con firma digital">
        {canEdit() && <button className="btn-primary" onClick={openCreate}><PlusIcon className="h-4 w-4" /> Nuevo Documento</button>}
      </PageHeader>

      <div className="card p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input type="text" className="input pl-9" placeholder="Buscar por folio, receptor..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="input w-40" value={filterTipo} onChange={e => setFilterTipo(e.target.value)}>
            <option value="">Todos los tipos</option>
            {Object.entries(DOCUMENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select className="input w-40" value={filterEstado} onChange={e => setFilterEstado(e.target.value)}>
            <option value="">Todos los estados</option>
            <option value="pendiente">Pendiente firma</option>
            <option value="firmado">Firmado</option>
          </select>
          <div ref={colsMenuRef} className="relative">
            <button className="btn-secondary" onClick={() => setColsMenuOpen(o => !o)}>
              <AdjustmentsHorizontalIcon className="h-4 w-4" /> Columnas
            </button>
            {colsMenuOpen && (
              <div className="absolute right-0 mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-xl p-2 min-w-40">
                {Object.entries(COL_LABELS).map(([k, label]) => (
                  <label key={k} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded-lg cursor-pointer text-sm">
                    <input type="checkbox" checked={visibleCols[k]}
                      onChange={() => setVisibleCols(v => ({ ...v, [k]: !v[k] }))} className="rounded" />
                    {label}
                  </label>
                ))}
              </div>
            )}
          </div>
          {(filterTipo || filterEstado || search) && (
            <button className="btn-secondary text-xs py-1.5 text-red-500 border-red-200" onClick={() => { setFilterTipo(''); setFilterEstado(''); setSearch('') }}>
              <XMarkIcon className="h-4 w-4" /> Limpiar
            </button>
          )}
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {visibleCols.folio && (
                  <th className="table-header cursor-pointer select-none hover:bg-gray-100"
                    style={{ width: colWidths['folio'] || 'auto', position: 'relative', minWidth: 80 }}
                    onClick={() => handleSort('folio')}>
                    <div className="flex items-center gap-1">Folio {sortIcon('folio')}</div>
                    <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-blue-400 transition-colors" onMouseDown={e => startResize('folio', e)} />
                  </th>
                )}
                {visibleCols.tipo && (
                  <th className="table-header cursor-pointer select-none hover:bg-gray-100"
                    style={{ width: colWidths['tipo'] || 'auto', position: 'relative', minWidth: 80 }}
                    onClick={() => handleSort('tipo')}>
                    <div className="flex items-center gap-1">Tipo {sortIcon('tipo')}</div>
                    <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-blue-400 transition-colors" onMouseDown={e => startResize('tipo', e)} />
                  </th>
                )}
                <th className="table-header"
                  style={{ width: colWidths['entidad'] || 'auto', position: 'relative', minWidth: 100 }}>
                  Entidad
                  <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-blue-400 transition-colors" onMouseDown={e => startResize('entidad', e)} />
                </th>
                <th className="table-header"
                  style={{ width: colWidths['agente'] || 'auto', position: 'relative', minWidth: 80 }}>
                  Agente
                  <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-blue-400 transition-colors" onMouseDown={e => startResize('agente', e)} />
                </th>
                {visibleCols.dispositivos && (
                  <th className="table-header"
                    style={{ width: colWidths['dispositivos'] || 'auto', position: 'relative', minWidth: 80 }}>
                    Dispositivos
                    <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-blue-400 transition-colors" onMouseDown={e => startResize('dispositivos', e)} />
                  </th>
                )}
                {visibleCols.receptor && (
                  <th className="table-header cursor-pointer select-none hover:bg-gray-100"
                    style={{ width: colWidths['receptor'] || 'auto', position: 'relative', minWidth: 80 }}
                    onClick={() => handleSort('receptor_nombre')}>
                    <div className="flex items-center gap-1">Receptor {sortIcon('receptor_nombre')}</div>
                    <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-blue-400 transition-colors" onMouseDown={e => startResize('receptor', e)} />
                  </th>
                )}
                {visibleCols.estado && (
                  <th className="table-header cursor-pointer select-none hover:bg-gray-100"
                    style={{ width: colWidths['estado'] || 'auto', position: 'relative', minWidth: 80 }}
                    onClick={() => handleSort('estado')}>
                    <div className="flex items-center gap-1">Firmado {sortIcon('estado')}</div>
                    <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-blue-400 transition-colors" onMouseDown={e => startResize('estado', e)} />
                  </th>
                )}
                {visibleCols.fecha && (
                  <th className="table-header cursor-pointer select-none hover:bg-gray-100"
                    style={{ width: colWidths['fecha'] || 'auto', position: 'relative', minWidth: 80 }}
                    onClick={() => handleSort('fecha_documento')}>
                    <div className="flex items-center gap-1">Fecha {sortIcon('fecha_documento')}</div>
                    <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-blue-400 transition-colors" onMouseDown={e => startResize('fecha', e)} />
                  </th>
                )}
                <th className="table-header">Archivo local</th>
                <th className="table-header">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={9} className="py-12 text-center"><div className="inline-block animate-spin rounded-full h-6 w-6 border-4 border-primary-600 border-t-transparent" /></td></tr>
              ) : documentos.length === 0 ? (
                <tr><td colSpan={9} className="py-12 text-center text-gray-400">No hay documentos</td></tr>
              ) : [...documentos].sort((a, b) => {
                if (!sortCol) return 0
                const va = (a[sortCol] || '').toString().toLowerCase()
                const vb = (b[sortCol] || '').toString().toLowerCase()
                return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
              }).map(d => (
                <tr key={d.id} className="hover:bg-gray-50">
                  {visibleCols.folio && (
                    <td className="table-cell font-mono text-xs font-semibold text-gray-700">{d.folio}</td>
                  )}
                  {visibleCols.tipo && (
                    <td className="table-cell">
                      <Badge {...(DOCUMENT_TYPES[d.tipo] || { label: d.tipo, color: 'bg-gray-100 text-gray-600' })} />
                    </td>
                  )}
                  <td className="table-cell">
                    <div className="text-sm font-medium">{d.entidad_nombre}</div>
                    <div className="text-xs text-gray-400 capitalize">{d.entidad_tipo}</div>
                  </td>
                  <td className="table-cell text-sm">{d.agente_nombre}</td>
                  {visibleCols.dispositivos && (
                    <td className="table-cell text-sm">{d.dispositivos?.length || 0} dispositivo(s)</td>
                  )}
                  {visibleCols.receptor && (
                    <td className="table-cell text-sm">{d.receptor_nombre || <span className="text-gray-300">—</span>}</td>
                  )}
                  {visibleCols.estado && (
                    <td className="table-cell">
                      {d.firmado ? <Badge label="Firmado" color="bg-emerald-100 text-emerald-700" /> : <Badge label="Pendiente" color="bg-yellow-100 text-yellow-700" />}
                    </td>
                  )}
                  {visibleCols.fecha && (
                    <td className="table-cell text-xs text-gray-500">
                      {d.created_at ? format(new Date(d.created_at), 'dd/MM/yyyy', { locale: es }) : '—'}
                    </td>
                  )}
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
                setForm(f => {
                  const nextEntidadTipo = t === 'entrada' ? f.entidad_tipo : (f.entidad_tipo === 'proveedor' ? 'empleado' : f.entidad_tipo)
                  if (nextEntidadTipo === 'empleado') setEntidades(empleados)
                  return {
                    ...f,
                    tipo: t,
                    plantilla_id: plantillas.find(p => p.tipo === t)?.id || '',
                    entidad_tipo: nextEntidadTipo,
                    entidad_id: nextEntidadTipo === f.entidad_tipo ? f.entidad_id : '',
                    dispositivos: [],
                    motivo_salida: t === 'salida' ? f.motivo_salida : '',
                    entrada_referencia: t === 'entrada' ? f.entrada_referencia : '',
                  }
                })
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
              <label className="label">{form.tipo === 'entrada' ? 'Origen de entrada' : 'Asignar a'}</label>
              <div className="flex gap-2">
                {(form.tipo === 'entrada' ? ['empleado', 'sucursal', 'proveedor'] : ['empleado', 'sucursal']).map(t => (
                  <button key={t} type="button" onClick={() => handleEntidadTipo(t)}
                    className={`flex-1 py-2 rounded-lg border-2 text-sm capitalize transition-colors ${form.entidad_tipo === t ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600'}`}>
                    {t === 'empleado' ? 'Empleado' : t === 'sucursal' ? 'Sucursal' : 'Proveedor'}
                  </button>
                ))}
              </div>
            </div>
            <div className="relative">
              <label className="label">{form.entidad_tipo === 'empleado' ? 'Empleado' : form.entidad_tipo === 'sucursal' ? 'Sucursal' : 'Proveedor'} *</label>
              {/* Campo oculto para validación HTML required */}
              <input type="hidden" required value={form.entidad_id} onChange={() => {}} />
              {(() => {
                const selectedE = entidades.find(e => e.id === form.entidad_id)
                const filteredE = entidades
                  .filter(e => {
                    if (!entidadSearch) return true
                    const q = normalizeText(entidadSearch)
                    return [
                      e.nombre_completo,
                      e.nombre,
                      e.num_empleado,
                      e.email,
                      e.puesto,
                      e.area,
                      e.sucursal_nombre,
                    ].some(value => normalizeText(value).includes(q))
                  })
                  .sort((a, b) => (a.nombre_completo || a.nombre || '').localeCompare(b.nombre_completo || b.nombre || '', 'es'))
                return (
                  <div className="relative">
                    <input
                      type="text"
                      className={`input pr-8 ${!form.entidad_id ? '' : 'border-primary-400 bg-primary-50'}`}
                      placeholder={`Buscar ${form.entidad_tipo === 'empleado' ? 'empleado por nombre o número' : form.entidad_tipo === 'sucursal' ? 'sucursal' : 'proveedor'}...`}
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
            {form.tipo === 'responsiva' && (() => {
              const receptorSeleccionado = empleados.find(e => e.id === form.receptor_id)
              const qReceptor = normalizeText(receptorSearch)
              const filteredReceptores = empleados.filter(e => {
                if (!qReceptor) return true
                return [
                  e.nombre_completo,
                  e.num_empleado,
                  e.email,
                  e.puesto,
                  e.area,
                  e.sucursal_nombre,
                ].some(value => normalizeText(value).includes(qReceptor))
              })
              return (
                <div className="col-span-2">
                  <label className="label">Persona que recibe *</label>
                  <div className="relative">
                    <input
                      className="input w-full"
                      placeholder="Buscar empleado receptor..."
                      value={receptorSeleccionado ? `${receptorSeleccionado.nombre_completo} — ${receptorSeleccionado.num_empleado || ''}` : receptorSearch}
                      onChange={e => {
                        setReceptorSearch(e.target.value)
                        setForm(f => ({ ...f, receptor_id: '' }))
                        setShowReceptorDrop(true)
                      }}
                      onFocus={() => setShowReceptorDrop(true)}
                      onBlur={() => setTimeout(() => setShowReceptorDrop(false), 150)}
                    />
                    {showReceptorDrop && filteredReceptores.length > 0 && (
                      <div className="absolute z-50 w-full bg-white border border-gray-200 rounded-lg shadow-xl mt-1 max-h-48 overflow-y-auto">
                        {filteredReceptores.map(e => (
                          <div
                            key={e.id}
                            className="flex items-center justify-between px-3 py-2 hover:bg-primary-50 cursor-pointer text-sm"
                            onMouseDown={() => {
                              setForm(f => ({ ...f, receptor_id: e.id }))
                              setReceptorSearch('')
                              setShowReceptorDrop(false)
                            }}
                          >
                            <span className="text-gray-800">{e.nombre_completo}</span>
                            {e.num_empleado && <span className="ml-2 text-xs text-gray-400 font-mono">{e.num_empleado}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                    {showReceptorDrop && filteredReceptores.length === 0 && (
                      <div className="absolute z-50 w-full bg-white border border-gray-200 rounded-lg shadow-xl mt-1 px-3 py-3 text-sm text-gray-400">
                        No se encontraron resultados
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}
            {form.tipo === 'entrada' && (
              <>
                <div>
                  <label className="label">Agente que recibe</label>
                  <select
                    className="input"
                    value={form.recibido_por_id || user?.id || ''}
                    onChange={e => setForm(f => ({ ...f, recibido_por_id: e.target.value }))}
                  >
                    {(usuariosSistema.length ? usuariosSistema : [user]).filter(Boolean).map(u => (
                      <option key={u.id} value={u.id}>{u.nombre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Referencia</label>
                  <input
                    className="input"
                    value={form.entrada_referencia}
                    onChange={e => setForm(f => ({ ...f, entrada_referencia: e.target.value }))}
                    placeholder="Factura, remisión, guía u orden de compra..."
                  />
                </div>
              </>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="label mb-0">{isEntradaProveedor ? 'Dispositivos recibidos del proveedor *' : 'Dispositivos a incluir *'}</label>
              {isEntradaProveedor && receivedDeviceCount > 0 && (
                <span className="text-xs text-primary-600 font-medium">{receivedDeviceCount} dispositivo(s) por crear</span>
              )}
              {!isEntradaProveedor && form.dispositivos.length > 0 && (
                <span className="text-xs text-primary-600 font-medium">{form.dispositivos.length} seleccionado(s)</span>
              )}
            </div>
            {isEntradaProveedor ? (
              <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-3">
                <div className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs text-emerald-700">
                  Cada línea crea dispositivos nuevos en inventario con ubicación <strong>Almacén Central</strong>. Si capturas serie, registra una línea por dispositivo; si seleccionas “sin número” o “serie no visible”, puedes capturar cantidad y se generarán folios consecutivos.
                </div>
                {receivedDevices.map((line, index) => (
                  <div key={index} className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Línea {index + 1}</span>
                      <button type="button" className="text-xs text-red-500 hover:text-red-700" onClick={() => removeReceivedDeviceLine(index)}>
                        Quitar
                      </button>
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                      <div>
                        <label className="label">Tipo *</label>
                        <select className="input" value={line.tipo} onChange={e => updateReceivedDevice(index, { tipo: e.target.value })}>
                          <option value="">Seleccionar...</option>
                          {DEVICE_TYPES.map(tipo => <option key={tipo} value={tipo}>{tipo}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="label">Marca *</label>
                        <input className="input" value={line.marca} onChange={e => updateReceivedDevice(index, { marca: e.target.value })} placeholder="Logitech, Dell..." />
                      </div>
                      <div>
                        <label className="label">Modelo</label>
                        <input className="input" value={line.modelo} onChange={e => updateReceivedDevice(index, { modelo: e.target.value })} placeholder="H390, OptiPlex..." />
                      </div>
                      <div>
                        <label className="label">Costo/día</label>
                        <input type="number" min="0" step="0.01" className="input" value={line.costo_dia} onChange={e => updateReceivedDevice(index, { costo_dia: e.target.value })} placeholder="0.00" />
                      </div>
                      <div>
                        <label className="label">Número de serie *</label>
                        <select className="input" value={line.serie_estado} onChange={e => updateReceivedDevice(index, { serie_estado: e.target.value })}>
                          <option value={SERIE_OPTIONS.capturada}>Capturar número de serie</option>
                          <option value={SERIE_OPTIONS.sin_numero}>Sin número de serie</option>
                          <option value={SERIE_OPTIONS.no_visible}>Serie no visible</option>
                        </select>
                      </div>
                      <div>
                        <label className="label">Serie</label>
                        <input
                          className="input"
                          disabled={line.serie_estado !== SERIE_OPTIONS.capturada}
                          value={line.serie}
                          onChange={e => updateReceivedDevice(index, { serie: e.target.value })}
                          placeholder={line.serie_estado === SERIE_OPTIONS.capturada ? 'SN-XXXXX' : 'Se genera automáticamente'}
                        />
                      </div>
                      <div>
                        <label className="label">Cantidad *</label>
                        <input
                          type="number"
                          min="1"
                          className="input"
                          disabled={line.serie_estado === SERIE_OPTIONS.capturada}
                          value={line.serie_estado === SERIE_OPTIONS.capturada ? 1 : line.cantidad}
                          onChange={e => updateReceivedDevice(index, { cantidad: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="label">Características</label>
                        <input className="input" value={line.caracteristicas} onChange={e => updateReceivedDevice(index, { caracteristicas: e.target.value })} placeholder="Color, condición, accesorios..." />
                      </div>
                    </div>
                  </div>
                ))}
                <button type="button" className="btn-secondary w-full justify-center" onClick={addReceivedDeviceLine}>
                  <PlusIcon className="h-4 w-4" /> Agregar línea de dispositivos
                </button>
              </div>
            ) : (
            <>
            <div className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-[1.4fr_1fr_1fr]">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  className="input pl-9"
                  placeholder="Buscar por serie, marca, modelo, tipo o ubicación..."
                  value={deviceSearch}
                  onChange={e => setDeviceSearch(e.target.value)}
                />
              </div>
              <select className="input" value={deviceTypeFilter} onChange={e => setDeviceTypeFilter(e.target.value)}>
                <option value="">Todos los tipos</option>
                {deviceTypes.map(tipo => <option key={tipo} value={tipo}>{tipo}</option>)}
              </select>
              <select className="input" value={deviceAssignFilter} onChange={e => setDeviceAssignFilter(e.target.value)}>
                <option value="todos">Todos</option>
                <option value="disponibles">Sin asignar / stock</option>
                <option value="asignados">Asignados</option>
              </select>
            </div>
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
              <span>{filteredDocumentDevices.length} de {dispositivos.length} dispositivo(s)</span>
              {(deviceSearch || deviceTypeFilter || deviceAssignFilter !== 'todos') && (
                <button
                  type="button"
                  className="rounded-full border border-gray-200 px-2 py-0.5 text-gray-500 hover:border-red-200 hover:bg-red-50 hover:text-red-500"
                  onClick={() => { setDeviceSearch(''); setDeviceTypeFilter(''); setDeviceAssignFilter('todos') }}
                >
                  Limpiar filtros
                </button>
              )}
            </div>
            <div className="border border-gray-200 rounded-xl overflow-y-auto max-h-52 divide-y divide-gray-100">
              {filteredDocumentDevices.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-6">
                  {dispositivos.length === 0 ? 'No hay dispositivos disponibles' : 'No hay dispositivos que coincidan con los filtros'}
                </p>
              ) : filteredDocumentDevices.map(d => {
                const sel = form.dispositivos.find(x => x.id === d.id)
                const toggleDevice = () => {
                  if (sel) setForm(f => ({ ...f, dispositivos: f.dispositivos.filter(x => x.id !== d.id) }))
                  else setForm(f => ({ ...f, dispositivos: [...f.dispositivos, { id: d.id, costo: 0 }] }))
                }
                const isAssigned = d.ubicacion_tipo && d.ubicacion_tipo !== 'almacen'
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
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 max-w-[180px] truncate ${
                        isAssigned ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                      }`}
                      title={isAssigned ? d.ubicacion_nombre : 'Stock'}
                    >
                      {isAssigned ? d.ubicacion_nombre : 'Stock'}
                    </span>
                  </div>
                )
              })}
            </div>
            </>
            )}
          </div>

          {form.tipo === 'salida' && (
            <div>
              <label className="label">Motivo de salida</label>
              <input
                className="input"
                value={form.motivo_salida}
                onChange={e => setForm(f => ({ ...f, motivo_salida: e.target.value }))}
                placeholder="Ej. Equipo funcional, envío a sucursal, reemplazo..."
              />
              <p className="mt-1 text-xs text-gray-400">Este campo alimenta la variable {'{{motivo_salida}}'} de la plantilla.</p>
            </div>
          )}

          <div>
            <label className="label">Observaciones</label>
            <textarea className="input" rows={2} value={form.observaciones} onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))} />
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={saving || !form.entidad_id || (isEntradaProveedor ? receivedDeviceCount === 0 : !form.dispositivos.length)}>
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
            {selected.tipo === 'salida' && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                      Logística / almacén
                    </p>
                    <p className="mt-1 text-xs text-amber-700/80">
                      Puedes guardar estos datos ahora y completar la firma/receptor después.
                    </p>
                  </div>
                  {(selected.logistica_nombre || selected.firma_logistica) && (
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                      {selected.firma_logistica ? 'Firma guardada' : 'Datos guardados'}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Nombre de quien firma *</label>
                    <input
                      className="input bg-white"
                      value={logisticaNombre}
                      onChange={e => setLogisticaNombre(e.target.value)}
                      placeholder="Nombre completo"
                    />
                  </div>
                  <div>
                    <label className="label">Área *</label>
                    <input
                      className="input bg-white"
                      value={logisticaArea}
                      onChange={e => setLogisticaArea(e.target.value)}
                      placeholder="Logística, Almacén..."
                    />
                  </div>
                </div>
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    className="btn-secondary text-xs"
                    onClick={handleSaveLogistica}
                    disabled={logisticaSaving}
                  >
                    {logisticaSaving ? 'Guardando...' : 'Guardar datos y firmas internas'}
                  </button>
                </div>
              </div>
            )}
            <div className={`grid gap-5 ${selected.tipo === 'salida' ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <div>
                <FirmaCanvas ref={firmaAgenteRef} label={`Firma del Agente — ${selected.agente_nombre}`} existingSignature={agenteFirma} />
                {agenteFirma && (
                  <p className="mt-1 text-xs text-emerald-600 flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                    Tu firma está pre-cargada desde tu perfil
                  </p>
                )}
              </div>
              {selected.tipo === 'salida' && (
                <FirmaCanvas
                  ref={firmaLogisticaRef}
                  label={`Firma Logística / Almacén${logisticaNombre ? ` — ${logisticaNombre}` : ''}`}
                  existingSignature={selected.firma_logistica || null}
                />
              )}
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

      {/* Modal — Firma previa de logística para salidas en línea */}
      <Modal
        open={modal === 'firmaOnlineSalida'}
        onClose={() => { setModal(null); setOnlineSalidaDoc(null) }}
        title={`Firma logística — ${onlineSalidaDoc?.folio || ''}`}
        size="lg"
      >
        {onlineSalidaDoc && (
          <div className="space-y-5">
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Para enviar una salida a firma en línea, logística puede quedar preparada por etapas: primero guarda nombre/área, después agrega la firma y genera el QR para el receptor.
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Nombre de quien firma *</label>
                <input
                  className="input"
                  value={onlineLogisticaNombre}
                  onChange={e => setOnlineLogisticaNombre(e.target.value)}
                  placeholder="Nombre completo"
                />
              </div>
              <div>
                <label className="label">Área *</label>
                <input
                  className="input"
                  value={onlineLogisticaArea}
                  onChange={e => setOnlineLogisticaArea(e.target.value)}
                  placeholder="Logística, Almacén..."
                />
              </div>
            </div>

            <FirmaCanvas
              ref={firmaOnlineLogisticaRef}
              label={`Firma Logística / Almacén${onlineLogisticaNombre ? ` — ${onlineLogisticaNombre}` : ''}`}
              existingSignature={onlineSalidaDoc.firma_logistica || null}
            />

            <div className="flex justify-end gap-3">
              <button className="btn-secondary" onClick={() => { setModal(null); setOnlineSalidaDoc(null) }}>
                Cancelar
              </button>
              <button className="btn-secondary" onClick={handleSaveOnlineLogistica} disabled={logisticaSaving}>
                {logisticaSaving ? 'Guardando...' : 'Guardar datos'}
              </button>
              <button className="btn-primary" onClick={confirmarFirmaOnlineSalida} disabled={enviandoLink}>
                {enviandoLink ? 'Generando link...' : 'Generar link de firma'}
              </button>
            </div>
          </div>
        )}
      </Modal>

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
                Válido por {firmaLinkVigencia} · Expira: {new Date(firmaLink.expires_at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
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
              href={`https://wa.me/?text=${encodeURIComponent(`Hola, por favor firma el documento ${firmaLink.doc?.folio} en este enlace:\n${firmaLink.url}\n\nVálido por ${firmaLinkVigencia}.`)}`}
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
              {selected.motivo_salida && (
                <div className="text-xs text-gray-600">
                  <span className="font-semibold">Motivo de salida: </span>{selected.motivo_salida}
                </div>
              )}
              {selected.observaciones && (
                <div className="text-xs text-gray-600">
                  <span className="font-semibold">Observaciones: </span>{selected.observaciones}
                </div>
              )}

              {/* Firmas */}
              <div className={`grid gap-8 pt-6 border-t border-gray-200 ${selected.tipo === 'salida' ? 'grid-cols-3' : 'grid-cols-2'}`}>
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
                {selected.tipo === 'salida' && (
                  <div className="text-center">
                    {selected.firma_logistica ? (
                      <img src={selected.firma_logistica} alt="Firma logística o almacén" className="h-16 mx-auto mb-2 object-contain" />
                    ) : (
                      <div className="h-16 border-b border-gray-400 mb-2" />
                    )}
                    <div className="text-xs font-semibold text-gray-700">{selected.logistica_nombre || 'Logística / Almacén'}</div>
                    <div className="text-xs text-gray-500">{selected.logistica_area || 'Logística / Almacén'}</div>
                  </div>
                )}
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
