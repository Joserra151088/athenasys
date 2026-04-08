import { useState, useEffect, useRef, useCallback } from 'react'
import { plantillaAPI, configAPI } from '../utils/api'
import { DOCUMENT_TYPES } from '../utils/constants'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import {
  PlusIcon, PencilIcon, ClockIcon, ChevronDownIcon,
  EyeIcon, PencilSquareIcon, MagnifyingGlassIcon, PhotoIcon,
  BuildingOfficeIcon, CheckIcon
} from '@heroicons/react/24/outline'
import PageHeader from '../components/PageHeader'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useNotification } from '../context/NotificationContext'

// ── Tags organizados por categoría ──────────────────────────────────────────
const TAG_GROUPS = [
  {
    label: 'Receptor / Empleado', color: 'blue',
    tags: [
      { tag: '{{receptor_nombre}}',      desc: 'Nombre completo del empleado',   ejemplo: 'Carlos Mendoza Ruiz' },
      { tag: '{{receptor_num_empleado}}',desc: 'Número de empleado',              ejemplo: 'EMP-001' },
      { tag: '{{receptor_area}}',        desc: 'Área o departamento',             ejemplo: 'Tecnologías de la Información' },
      { tag: '{{receptor_puesto}}',      desc: 'Puesto del empleado',             ejemplo: 'Gerente de TI' },
      { tag: '{{receptor_email}}',       desc: 'Correo electrónico',              ejemplo: 'c.mendoza@empresa.com' },
    ]
  },
  {
    label: 'Sucursal / Ubicación', color: 'green',
    tags: [
      { tag: '{{sucursal_nombre}}', desc: 'Nombre de la sucursal o corporativo', ejemplo: 'Corporativo Central' },
      { tag: '{{sucursal_estado}}', desc: 'Estado o ciudad',                      ejemplo: 'Ciudad de México' },
      { tag: '{{sucursal_tipo}}',   desc: 'Tipo: Sucursal o Corporativo',         ejemplo: 'Corporativo' },
    ]
  },
  {
    label: 'Agente de Soporte TI', color: 'purple',
    tags: [
      { tag: '{{agente_nombre}}', desc: 'Nombre del agente que registra', ejemplo: 'Laura Sánchez Torres' },
    ]
  },
  {
    label: 'Documento', color: 'orange',
    tags: [
      { tag: '{{fecha_documento}}', desc: 'Fecha de generación del documento', ejemplo: format(new Date(), 'dd/MM/yyyy') },
      { tag: '{{motivo_salida}}',   desc: 'Motivo de salida (actas de salida)', ejemplo: 'Baja laboral' },
      { tag: '{{folio}}',           desc: 'Folio único del documento',          ejemplo: 'DOC-2026-0042' },
    ]
  },
  {
    label: 'Dispositivos', color: 'red',
    tags: [
      { tag: '{{lista_dispositivos}}', desc: 'Lista detallada de equipos',  ejemplo: '- CPU Dell OptiPlex 7090 (DELL-001)\n- Monitor Dell 27"' },
      { tag: '{{num_dispositivos}}',   desc: 'Cantidad total de equipos',   ejemplo: '2' },
    ]
  },
]

const GROUP_COLORS = {
  blue:   { pill: 'bg-blue-100 text-blue-700 border-blue-200',     btn: 'bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200' },
  green:  { pill: 'bg-green-100 text-green-700 border-green-200',  btn: 'bg-green-50 hover:bg-green-100 text-green-700 border border-green-200' },
  purple: { pill: 'bg-purple-100 text-purple-700 border-purple-200', btn: 'bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200' },
  orange: { pill: 'bg-orange-100 text-orange-700 border-orange-200', btn: 'bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200' },
  red:    { pill: 'bg-red-100 text-red-700 border-red-200',        btn: 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200' },
}

const SAMPLE_DATA = {
  '{{receptor_nombre}}':      'Juan García Pérez',
  '{{receptor_num_empleado}}':'EMP-0042',
  '{{receptor_area}}':        'Tecnologías de la Información',
  '{{receptor_puesto}}':      'Analista Senior',
  '{{receptor_email}}':       'juan.garcia@empresa.com',
  '{{sucursal_nombre}}':      'Corporativo CDMX',
  '{{sucursal_estado}}':      'Ciudad de México',
  '{{sucursal_tipo}}':        'Corporativo',
  '{{agente_nombre}}':        'José Ramón Estrada Rendón',
  '{{fecha_documento}}':      format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: es }),
  '{{folio}}':                'SAL-2026-000001',
  '{{motivo_salida}}':        'Asignación de equipo de trabajo',
  '{{lista_dispositivos}}':   `<table style="width:100%;border-collapse:collapse;font-size:12px;margin:8px 0">
    <thead><tr style="background:#1e293b;color:white">
      <th style="padding:6px 10px;text-align:left">Equipo</th>
      <th style="padding:6px 10px;text-align:left">Marca/Modelo</th>
      <th style="padding:6px 10px;text-align:left">No. Serie</th>
    </tr></thead>
    <tbody>
      <tr style="background:#f8fafc"><td style="padding:5px 10px">Laptop</td><td style="padding:5px 10px">Dell XPS 15</td><td style="padding:5px 10px">ABC123XYZ</td></tr>
      <tr><td style="padding:5px 10px">Monitor</td><td style="padding:5px 10px">LG 27UK850</td><td style="padding:5px 10px">DEF456UVW</td></tr>
    </tbody>
  </table>`,
  '{{num_dispositivos}}': '2',
}

function renderPreview(html) {
  let out = html
  for (const g of TAG_GROUPS) {
    for (const t of g.tags) {
      out = out.split(t.tag).join(`<mark class="preview-tag" data-color="${g.color}">${t.ejemplo}</mark>`)
    }
  }
  return out
}

function renderRealPreview(html, logo, headerCfg = {}) {
  const empresa = headerCfg.empresa || 'AthenaSys'
  const subtitulo = headerCfg.subtitulo || 'Área de Tecnologías de la Información'
  const color = headerCfg.color || '#1e293b'
  let body = html
  for (const [tag, val] of Object.entries(SAMPLE_DATA)) {
    body = body.split(tag).join(val)
  }
  const logoHtml = logo
    ? `<img src="${logo}" alt="Logo" style="height:48px;object-fit:contain;border-radius:4px" />`
    : ''
  return `
    <div style="font-family:Georgia,serif;color:#1e293b;line-height:1.7">
      <div style="background:${color};color:white;padding:20px 28px;display:flex;align-items:center;justify-content:space-between;border-radius:8px 8px 0 0">
        <div style="display:flex;align-items:center;gap:12px">
          ${logoHtml}
          <div>
            <div style="font-weight:bold;font-size:18px">${empresa}</div>
            <div style="font-size:11px;color:#94a3b8">${subtitulo}</div>
          </div>
        </div>
        <div style="text-align:right">
          <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em">Folio</div>
          <div style="font-weight:bold;font-family:monospace;font-size:14px">${SAMPLE_DATA['{{folio}}']}</div>
          <div style="font-size:11px;color:#94a3b8">${SAMPLE_DATA['{{fecha_documento}}']}</div>
        </div>
      </div>
      <div style="border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;padding:24px 28px">
        ${body}
        <div style="margin-top:48px;display:grid;grid-template-columns:1fr 1fr;gap:40px">
          <div style="border-top:2px solid ${color};padding-top:8px;text-align:center">
            <div style="height:40px"></div>
            <div style="font-size:12px;color:#64748b">Firma del receptor</div>
            <div style="font-size:13px;font-weight:600;margin-top:4px">${SAMPLE_DATA['{{receptor_nombre}}']}</div>
            <div style="font-size:11px;color:#94a3b8">${SAMPLE_DATA['{{receptor_puesto}}']}</div>
          </div>
          <div style="border-top:2px solid ${color};padding-top:8px;text-align:center">
            <div style="height:40px"></div>
            <div style="font-size:12px;color:#64748b">Firma del agente TI</div>
            <div style="font-size:13px;font-weight:600;margin-top:4px">${SAMPLE_DATA['{{agente_nombre}}']}</div>
            <div style="font-size:11px;color:#94a3b8">Soporte TI</div>
          </div>
        </div>
      </div>
    </div>
  `
}

// ── WYSIWYG Toolbar usando document.execCommand ───────────────────────────────
function RichToolbar({ editorRef, onInput, logo }) {
  const exec = (cmd, value = null) => {
    editorRef.current?.focus()
    document.execCommand(cmd, false, value)
    setTimeout(onInput, 0)
  }

  const FONT_SIZES = [
    { label: 'Pequeño',  val: '2' },
    { label: 'Normal',   val: '3' },
    { label: 'Grande',   val: '4' },
    { label: 'Mayor',    val: '5' },
  ]

  const COLORS = ['#000000', '#dc2626', '#2563eb', '#16a34a', '#9333ea', '#ea580c', '#64748b']

  return (
    <div className="flex flex-wrap items-center gap-0.5 p-1.5 bg-gray-50 border border-b-0 border-gray-200 rounded-t-lg select-none">
      {/* Formato de texto */}
      <button type="button" onMouseDown={e => { e.preventDefault(); exec('bold') }}
        title="Negrita (Ctrl+B)" className="p-1.5 rounded hover:bg-gray-200 font-bold text-sm w-7 h-7 flex items-center justify-center">B</button>
      <button type="button" onMouseDown={e => { e.preventDefault(); exec('italic') }}
        title="Cursiva (Ctrl+I)" className="p-1.5 rounded hover:bg-gray-200 italic text-sm w-7 h-7 flex items-center justify-center">I</button>
      <button type="button" onMouseDown={e => { e.preventDefault(); exec('underline') }}
        title="Subrayado (Ctrl+U)" className="p-1.5 rounded hover:bg-gray-200 underline text-sm w-7 h-7 flex items-center justify-center">U</button>
      <button type="button" onMouseDown={e => { e.preventDefault(); exec('strikeThrough') }}
        title="Tachado" className="p-1.5 rounded hover:bg-gray-200 line-through text-sm w-7 h-7 flex items-center justify-center">S</button>

      <div className="w-px h-5 bg-gray-300 mx-1" />

      {/* Alineación */}
      <button type="button" onMouseDown={e => { e.preventDefault(); exec('justifyLeft') }}
        title="Alinear izquierda" className="p-1.5 rounded hover:bg-gray-200 text-sm w-7 h-7 flex items-center justify-center">
        <svg viewBox="0 0 16 16" className="w-4 h-4"><path fill="currentColor" d="M2 4h12v1H2zm0 3h8v1H2zm0 3h12v1H2zm0 3h8v1H2z"/></svg>
      </button>
      <button type="button" onMouseDown={e => { e.preventDefault(); exec('justifyCenter') }}
        title="Centrar" className="p-1.5 rounded hover:bg-gray-200 text-sm w-7 h-7 flex items-center justify-center">
        <svg viewBox="0 0 16 16" className="w-4 h-4"><path fill="currentColor" d="M2 4h12v1H2zm2 3h8v1H4zm-2 3h12v1H2zm2 3h8v1H4z"/></svg>
      </button>
      <button type="button" onMouseDown={e => { e.preventDefault(); exec('justifyRight') }}
        title="Alinear derecha" className="p-1.5 rounded hover:bg-gray-200 text-sm w-7 h-7 flex items-center justify-center">
        <svg viewBox="0 0 16 16" className="w-4 h-4"><path fill="currentColor" d="M2 4h12v1H2zm4 3h8v1H6zm-4 3h12v1H2zm4 3h8v1H6z"/></svg>
      </button>
      <button type="button" onMouseDown={e => { e.preventDefault(); exec('justifyFull') }}
        title="Justificar" className="p-1.5 rounded hover:bg-gray-200 text-sm w-7 h-7 flex items-center justify-center">
        <svg viewBox="0 0 16 16" className="w-4 h-4"><path fill="currentColor" d="M2 4h12v1H2zm0 3h12v1H2zm0 3h12v1H2zm0 3h12v1H2z"/></svg>
      </button>

      <div className="w-px h-5 bg-gray-300 mx-1" />

      {/* Listas */}
      <button type="button" onMouseDown={e => { e.preventDefault(); exec('insertUnorderedList') }}
        title="Lista con viñetas" className="p-1.5 rounded hover:bg-gray-200 text-sm w-7 h-7 flex items-center justify-center">
        <svg viewBox="0 0 16 16" className="w-4 h-4"><path fill="currentColor" d="M3 4a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0 4a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0 4a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM4 3.5h10v1H4zm0 4h10v1H4zm0 4h10v1H4z"/></svg>
      </button>
      <button type="button" onMouseDown={e => { e.preventDefault(); exec('insertOrderedList') }}
        title="Lista numerada" className="p-1.5 rounded hover:bg-gray-200 text-sm w-7 h-7 flex items-center justify-center">
        <svg viewBox="0 0 16 16" className="w-4 h-4"><path fill="currentColor" d="M1 2.5h1v2H1v-2zm0 4h1v2H1v-2zm0 4h1v2H1v-2zM4 3.5h10v1H4zm0 4h10v1H4zm0 4h10v1H4z"/></svg>
      </button>

      <div className="w-px h-5 bg-gray-300 mx-1" />

      {/* Encabezado */}
      <select
        title="Estilo de párrafo"
        className="text-xs border border-gray-200 rounded px-1 py-0.5 bg-white h-7 cursor-pointer"
        defaultValue=""
        onChange={e => { exec('formatBlock', e.target.value || 'p'); e.target.value = '' }}
      >
        <option value="">Párrafo</option>
        <option value="h1">Título 1</option>
        <option value="h2">Título 2</option>
        <option value="h3">Título 3</option>
        <option value="p">Normal</option>
      </select>

      {/* Tamaño de fuente */}
      <select
        title="Tamaño de fuente"
        className="text-xs border border-gray-200 rounded px-1 py-0.5 bg-white h-7 cursor-pointer"
        defaultValue=""
        onChange={e => { if (e.target.value) exec('fontSize', e.target.value); e.target.value = '' }}
      >
        <option value="">Tamaño</option>
        {FONT_SIZES.map(s => <option key={s.val} value={s.val}>{s.label}</option>)}
      </select>

      {/* Tipo de fuente */}
      <select
        title="Tipo de fuente"
        className="text-xs border border-gray-200 rounded px-1 py-0.5 bg-white h-7 cursor-pointer"
        style={{ maxWidth: 130 }}
        defaultValue=""
        onChange={e => { if (e.target.value) exec('fontName', e.target.value); e.target.value = '' }}
      >
        <option value="">Fuente</option>
        <option value="Georgia, serif">Georgia</option>
        <option value="'Times New Roman', Times, serif">Times New Roman</option>
        <option value="Garamond, serif">Garamond</option>
        <option value="Arial, Helvetica, sans-serif">Arial</option>
        <option value="Verdana, Geneva, sans-serif">Verdana</option>
        <option value="Tahoma, Geneva, sans-serif">Tahoma</option>
        <option value="Calibri, Candara, sans-serif">Calibri</option>
        <option value="'Courier New', Courier, monospace">Courier New</option>
        <option value="'Trebuchet MS', sans-serif">Trebuchet MS</option>
      </select>

      <div className="w-px h-5 bg-gray-300 mx-1" />

      {/* Colores */}
      <span className="text-xs text-gray-400 ml-0.5">Color:</span>
      {COLORS.map(c => (
        <button key={c} type="button"
          onMouseDown={e => { e.preventDefault(); exec('foreColor', c) }}
          title={c}
          className="w-5 h-5 rounded-full border border-gray-300 hover:scale-110 transition-transform flex-shrink-0"
          style={{ backgroundColor: c }} />
      ))}

      <div className="w-px h-5 bg-gray-300 mx-1" />

      {/* Deshacer / Rehacer */}
      <button type="button" onMouseDown={e => { e.preventDefault(); exec('undo') }}
        title="Deshacer (Ctrl+Z)" className="p-1.5 rounded hover:bg-gray-200 text-gray-500 text-xs w-7 h-7 flex items-center justify-center">↩</button>
      <button type="button" onMouseDown={e => { e.preventDefault(); exec('redo') }}
        title="Rehacer (Ctrl+Y)" className="p-1.5 rounded hover:bg-gray-200 text-gray-500 text-xs w-7 h-7 flex items-center justify-center">↪</button>

      {/* Limpiar formato */}
      <button type="button" onMouseDown={e => { e.preventDefault(); exec('removeFormat') }}
        title="Limpiar formato" className="p-1.5 rounded hover:bg-gray-200 text-gray-500 text-xs h-7 px-2">
        ✕ Fmt
      </button>

      {/* Insertar logo */}
      {logo && (
        <>
          <div className="w-px h-5 bg-gray-300 mx-1" />
          <button
            type="button"
            onMouseDown={e => {
              e.preventDefault()
              editorRef.current?.focus()
              document.execCommand('insertHTML', false, `<img src="${logo}" alt="Logo" style="max-height:56px;object-fit:contain;vertical-align:middle;margin:4px 0" />`)
              setTimeout(onInput, 0)
            }}
            title="Insertar logo en el documento"
            className="p-1.5 rounded hover:bg-gray-200 text-gray-500 text-xs h-7 px-2 flex items-center gap-1"
          >
            <PhotoIcon className="h-3.5 w-3.5" /> Logo
          </button>
        </>
      )}
    </div>
  )
}

export default function Plantillas() {
  const { canEdit } = useAuth()
  const { showError, showSuccess } = useNotification()
  const [plantillas, setPlantillas] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [versiones, setVersiones] = useState([])
  const [showVersiones, setShowVersiones] = useState(null)
  const [form, setForm] = useState({ tipo: 'responsiva', nombre: '', texto_legal: '' })
  const [saving, setSaving] = useState(false)
  const [editorTab, setEditorTab] = useState('editar')
  const [tagSearch, setTagSearch] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const editorRef = useRef(null)
  const logoFileRef = useRef(null)

  // Logo global
  const [globalLogo, setGlobalLogo] = useState(null)
  const [logoModal, setLogoModal] = useState(false)
  const [logoPreview, setLogoPreview] = useState(null)
  const [logoSaving, setLogoSaving] = useState(false)

  // Header config
  const [headerConfig, setHeaderConfig] = useState({ empresa: 'AthenaSys', subtitulo: 'Área de Tecnologías de la Información', color: '#1e293b' })
  const [showHeaderEdit, setShowHeaderEdit] = useState(false)
  const [headerSaving, setHeaderSaving] = useState(false)
  const [headerSaved, setHeaderSaved] = useState(false)

  const load = () => {
    setLoading(true)
    plantillaAPI.getAll().then(setPlantillas).finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    configAPI.getLogo().then(r => setGlobalLogo(r.logo)).catch(() => {})
    configAPI.getHeaderConfig().then(r => {
      setHeaderConfig({ empresa: r.empresa, subtitulo: r.subtitulo, color: r.color })
      if (r.logo) setGlobalLogo(r.logo)
    }).catch(() => {})
  }, [])

  // Sincronizar contenido del editor cuando se abre el modal o cambia de tab
  useEffect(() => {
    if (modal && editorTab === 'editar' && editorRef.current) {
      editorRef.current.innerHTML = form.texto_legal || ''
    }
  }, [modal, editorTab])

  const handleEditorInput = useCallback(() => {
    if (editorRef.current) {
      setForm(f => ({ ...f, texto_legal: editorRef.current.innerHTML }))
    }
  }, [])

  const openCreate = () => {
    setEditing(null)
    setForm({ tipo: 'responsiva', nombre: '', texto_legal: '' })
    setEditorTab('editar')
    setModal(true)
  }

  const openEdit = (p) => {
    setEditing(p)
    setForm({ tipo: p.tipo, nombre: p.nombre, texto_legal: p.texto_legal })
    setEditorTab('editar')
    setModal(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    // Capturar contenido actualizado del editor antes de guardar
    const textoFinal = editorRef.current?.innerHTML || form.texto_legal
    if (!textoFinal.trim() || textoFinal === '<br>') {
      showError('El texto legal no puede estar vacío', 'Campo requerido')
      return
    }
    setSaving(true)
    try {
      const payload = { ...form, texto_legal: textoFinal }
      if (editing) await plantillaAPI.update(editing.id, payload)
      else await plantillaAPI.create(payload)
      setModal(false)
      load()
    } catch (err) { showError(err?.message || 'Error') }
    finally { setSaving(false) }
  }

  const loadVersiones = async (id) => {
    if (showVersiones === id) { setShowVersiones(null); return }
    const v = await plantillaAPI.getVersiones(id)
    setVersiones(v)
    setShowVersiones(id)
  }

  // Insertar tag en posición del cursor dentro del contentEditable
  const insertTag = (tag) => {
    editorRef.current?.focus()
    // Usar insertText para insertar el tag como texto plano en la posición del cursor
    document.execCommand('insertText', false, tag)
    handleEditorInput()
  }

  // Drag & drop: el tag se arrastra desde el panel y se suelta en el editor
  const handleTagDragStart = (e, tag) => {
    e.dataTransfer.setData('text/plain', tag)
    e.dataTransfer.effectAllowed = 'copy'
  }

  const handleEditorDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const tag = e.dataTransfer.getData('text/plain')
    if (!tag) return
    editorRef.current?.focus()
    document.execCommand('insertText', false, tag)
    handleEditorInput()
  }

  const handleLogoFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setLogoPreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  const handleLogoSave = async () => {
    setLogoSaving(true)
    try {
      await configAPI.setLogo(logoPreview)
      setGlobalLogo(logoPreview)
      setLogoModal(false)
    } catch (err) { showError(err?.message || 'Error al guardar logo') }
    finally { setLogoSaving(false) }
  }

  const handleSaveHeaderConfig = async () => {
    setHeaderSaving(true)
    try {
      await configAPI.setHeaderConfig(headerConfig)
      setHeaderSaved(true)
      showSuccess('Encabezado guardado correctamente')
      setTimeout(() => setHeaderSaved(false), 3000)
    } catch (err) { showError(err?.message || 'Error al guardar encabezado') }
    finally { setHeaderSaving(false) }
  }

  const handleLogoRemove = async () => {
    setLogoSaving(true)
    try {
      await configAPI.setLogo(null)
      setGlobalLogo(null)
      setLogoPreview(null)
      setLogoModal(false)
    } catch (err) { showError(err?.message || 'Error') }
    finally { setLogoSaving(false) }
  }

  const filteredGroups = tagSearch
    ? TAG_GROUPS.map(g => ({
        ...g,
        tags: g.tags.filter(t =>
          t.tag.includes(tagSearch.toLowerCase()) ||
          t.desc.toLowerCase().includes(tagSearch.toLowerCase())
        )
      })).filter(g => g.tags.length > 0)
    : TAG_GROUPS

  const tagsUsados = TAG_GROUPS.flatMap(g => g.tags).filter(t => form.texto_legal.includes(t.tag))

  return (
    <div className="space-y-5">
      <PageHeader title="Plantillas de Documentos" subtitle="Administra los templates con versionamiento">
        {canEdit() && (
          <button className="btn-secondary" onClick={() => { setLogoPreview(globalLogo); setLogoModal(true) }}>
            <PhotoIcon className="h-4 w-4" /> Configurar Logo
          </button>
        )}
        {canEdit() && (
          <button className="btn-primary" onClick={openCreate}>
            <PlusIcon className="h-4 w-4" /> Nueva Plantilla
          </button>
        )}
      </PageHeader>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-600 border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-4">
          {plantillas.map(p => (
            <div key={p.id} className="card space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Badge {...(DOCUMENT_TYPES[p.tipo] || { label: p.tipo, color: 'bg-gray-100 text-gray-600' })} />
                  <div>
                    <div className="font-semibold text-gray-900">{p.nombre}</div>
                    <div className="text-xs text-gray-400">
                      Versión {p.version} · Creado por {p.creado_por_nombre || 'Sistema'} · {p.updated_at ? format(new Date(p.updated_at), 'dd/MM/yyyy', { locale: es }) : ''}
                      {p.modificado_por_nombre && ` · Modificado por ${p.modificado_por_nombre}`}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => loadVersiones(p.id)} className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1">
                    <ClockIcon className="h-3.5 w-3.5" /> Historial ({p.versiones?.length || 0})
                    <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${showVersiones === p.id ? 'rotate-180' : ''}`} />
                  </button>
                  {canEdit() && (
                    <button onClick={() => openEdit(p)} className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1">
                      <PencilIcon className="h-3.5 w-3.5" /> Editar
                    </button>
                  )}
                </div>
              </div>

              <div
                className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600 max-h-32 overflow-y-auto leading-relaxed"
                style={{ fontFamily: 'Georgia, serif' }}
                dangerouslySetInnerHTML={{ __html: /<[a-z][\s\S]*>/i.test(p.texto_legal) ? p.texto_legal : p.texto_legal.replace(/\n/g, '<br/>') }}
              />

              {showVersiones === p.id && versiones.length > 0 && (
                <div className="border-t pt-3 space-y-2">
                  <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Historial de versiones</div>
                  {versiones.map((v, i) => (
                    <div key={i} className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="font-medium text-amber-800">Versión {v.version}</span>
                        <span className="text-amber-600">{v.fecha ? format(new Date(v.fecha), 'dd/MM/yyyy HH:mm') : ''}</span>
                      </div>
                      {v.modificado_por_nombre && <div className="text-amber-700">Modificado por: {v.modificado_por_nombre}</div>}
                      <div
                        className="text-gray-600 max-h-20 overflow-y-auto"
                        dangerouslySetInnerHTML={{ __html: /<[a-z][\s\S]*>/i.test(v.texto_legal) ? v.texto_legal : (v.texto_legal || '').replace(/\n/g, '<br/>') }}
                      />
                    </div>
                  ))}
                </div>
              )}
              {showVersiones === p.id && versiones.length === 0 && (
                <div className="border-t pt-3 text-xs text-gray-400">No hay versiones anteriores.</div>
              )}
            </div>
          ))}
          {plantillas.length === 0 && (
            <div className="card text-center text-gray-400 py-12">No hay plantillas configuradas</div>
          )}
        </div>
      )}

      {/* ── Modal editor ──────────────────────────────────────────────────── */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editing ? `Editar Plantilla (v${editing?.version})` : 'Nueva Plantilla'}
        size="2xl"
      >
        <form onSubmit={handleSave} className="flex flex-col gap-4" style={{ minHeight: '70vh' }}>

          {/* Fila superior: tipo + nombre */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Tipo de documento *</label>
              <select className="input" required value={form.tipo}
                onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                {Object.entries(DOCUMENT_TYPES).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Nombre *</label>
              <input className="input" required value={form.nombre}
                onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
            </div>
          </div>

          {/* ── Encabezado del documento ─────────────────────────────────── */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setShowHeaderEdit(!showHeaderEdit)}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 text-sm font-medium text-gray-700 transition-colors"
            >
              <span className="flex items-center gap-2">
                <BuildingOfficeIcon className="h-4 w-4 text-gray-500" />
                Encabezado del documento
                <span className="text-xs font-normal text-gray-400">— empresa, subtítulo, color y logo</span>
              </span>
              <ChevronDownIcon className={`h-4 w-4 text-gray-400 transition-transform ${showHeaderEdit ? 'rotate-180' : ''}`} />
            </button>

            {showHeaderEdit && (
              <div className="p-4 border-t border-gray-200 grid grid-cols-2 gap-4 bg-white">
                {/* Logo */}
                <div className="col-span-2">
                  <label className="label text-xs mb-1">Logo del encabezado</label>
                  <div className="flex items-center gap-3">
                    {globalLogo ? (
                      <img src={globalLogo} alt="Logo" className="h-12 object-contain border border-gray-200 rounded-lg p-1.5 bg-gray-50" />
                    ) : (
                      <div className="h-12 w-24 border border-dashed border-gray-300 rounded-lg flex items-center justify-center text-xs text-gray-400">Sin logo</div>
                    )}
                    <button
                      type="button"
                      className="btn-secondary text-xs py-1.5 flex items-center gap-1"
                      onClick={() => { setLogoPreview(globalLogo); setLogoModal(true) }}
                    >
                      <PhotoIcon className="h-3.5 w-3.5" />
                      {globalLogo ? 'Cambiar logo' : 'Subir logo'}
                    </button>
                    {globalLogo && (
                      <button
                        type="button"
                        className="text-xs text-red-500 hover:text-red-700 underline"
                        onClick={handleLogoRemove}
                      >Quitar logo</button>
                    )}
                  </div>
                </div>

                {/* Empresa */}
                <div>
                  <label className="label text-xs">Nombre de empresa</label>
                  <input
                    className="input text-sm"
                    value={headerConfig.empresa || ''}
                    onChange={e => setHeaderConfig(h => ({ ...h, empresa: e.target.value }))}
                    placeholder="AthenaSys"
                  />
                </div>

                {/* Subtítulo */}
                <div>
                  <label className="label text-xs">Subtítulo / Departamento</label>
                  <input
                    className="input text-sm"
                    value={headerConfig.subtitulo || ''}
                    onChange={e => setHeaderConfig(h => ({ ...h, subtitulo: e.target.value }))}
                    placeholder="Área de Tecnologías de la Información"
                  />
                </div>

                {/* Color */}
                <div>
                  <label className="label text-xs">Color del encabezado</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={headerConfig.color || '#1e293b'}
                      onChange={e => setHeaderConfig(h => ({ ...h, color: e.target.value }))}
                      className="h-9 w-14 rounded border border-gray-200 cursor-pointer p-0.5"
                    />
                    <span className="text-xs font-mono text-gray-600">{headerConfig.color || '#1e293b'}</span>
                  </div>
                </div>

                {/* Preview mini + Save */}
                <div className="flex items-end justify-end">
                  <button
                    type="button"
                    className="btn-primary text-sm flex items-center gap-1.5 py-2"
                    onClick={handleSaveHeaderConfig}
                    disabled={headerSaving}
                  >
                    {headerSaved
                      ? <><CheckIcon className="h-4 w-4" /> Guardado</>
                      : headerSaving
                        ? 'Guardando...'
                        : <><CheckIcon className="h-4 w-4" /> Guardar encabezado</>
                    }
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 border-b border-gray-200 -mb-2">
            {[
              { id: 'editar', label: 'Editar', icon: <PencilSquareIcon className="h-4 w-4" /> },
              { id: 'vista',  label: 'Vista previa', icon: <EyeIcon className="h-4 w-4" />, badge: tagsUsados.length > 0 ? `${tagsUsados.length} tags` : null },
              { id: 'real',   label: 'Vista Previa Real', icon: <EyeIcon className="h-4 w-4" />, green: true },
            ].map(tab => (
              <button key={tab.id} type="button" onClick={() => setEditorTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  editorTab === tab.id
                    ? tab.green ? 'border-emerald-600 text-emerald-600' : 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}>
                {tab.icon} {tab.label}
                {tab.badge && <span className="ml-1 bg-primary-100 text-primary-700 text-xs px-1.5 py-0.5 rounded-full">{tab.badge}</span>}
              </button>
            ))}
          </div>

          {/* ── Tab: Editar (WYSIWYG) ─────────────────────────────────────── */}
          {editorTab === 'editar' && (
            <div className="flex gap-4 flex-1" style={{ minHeight: '380px' }}>

              {/* Editor WYSIWYG */}
              <div className="flex-1 flex flex-col">
                <label className="label mb-1">
                  Texto legal *
                  <span className="ml-2 text-xs font-normal text-gray-400">— Arrastra un dato dinámico al editor o haz clic en él</span>
                </label>

                {/* Toolbar */}
                <RichToolbar editorRef={editorRef} onInput={handleEditorInput} logo={globalLogo} />

                {/* ContentEditable editor */}
                <div
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  spellCheck={false}
                  className={`flex-1 border border-gray-200 rounded-b-lg p-4 text-sm leading-relaxed overflow-y-auto focus:outline-none focus:ring-2 focus:ring-primary-400 transition-all ${
                    dragOver ? 'bg-primary-50 border-primary-400 border-dashed' : 'bg-white'
                  }`}
                  style={{ minHeight: '300px', fontFamily: 'Georgia, serif' }}
                  onInput={handleEditorInput}
                  onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleEditorDrop}
                  data-placeholder="Escribe el texto del documento aquí..."
                />

                {dragOver && (
                  <p className="text-xs text-primary-600 mt-1 text-center animate-pulse">
                    Suelta el dato aquí para insertarlo
                  </p>
                )}
              </div>

              {/* Panel de tags */}
              <div className="w-64 flex-shrink-0 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="label mb-0 text-xs">Datos dinámicos</label>
                </div>

                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar tag..."
                    value={tagSearch}
                    onChange={e => setTagSearch(e.target.value)}
                    className="input pl-7 text-xs py-1.5 w-full"
                  />
                </div>

                {/* Info drag & drop */}
                <div className="bg-blue-50 border border-blue-100 rounded-lg px-2.5 py-1.5 text-xs text-blue-600">
                  💡 <strong>Arrastra</strong> un dato al editor o <strong>haz clic</strong> para insertarlo en el cursor
                </div>

                <div className="flex-1 overflow-y-auto space-y-3 pr-0.5" style={{ maxHeight: '310px' }}>
                  {filteredGroups.map(group => (
                    <div key={group.label}>
                      <div className={`text-xs font-semibold px-2 py-1 rounded-md mb-1.5 border ${GROUP_COLORS[group.color].pill}`}>
                        {group.label}
                      </div>
                      <div className="space-y-1">
                        {group.tags.map(t => (
                          <button
                            key={t.tag}
                            type="button"
                            draggable
                            onDragStart={e => handleTagDragStart(e, t.tag)}
                            onClick={() => insertTag(t.tag)}
                            title={`Ejemplo: ${t.ejemplo}`}
                            className={`w-full text-left rounded-lg px-2.5 py-2 text-xs transition-all hover:shadow-sm cursor-grab active:cursor-grabbing ${GROUP_COLORS[group.color].btn}`}
                          >
                            <div className="font-mono font-medium truncate">{t.tag}</div>
                            <div className="text-xs opacity-70 mt-0.5 truncate">{t.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {filteredGroups.length === 0 && (
                    <div className="text-center text-xs text-gray-400 py-4">Sin resultados</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Tab: Vista previa (tags resaltados) ──────────────────────── */}
          {editorTab === 'vista' && (
            <div className="flex-1 flex flex-col gap-3">
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
                Los valores en <span className="font-semibold">color</span> son datos de ejemplo. En el documento real se sustituyen automáticamente.
              </div>
              <div
                className="flex-1 bg-white border border-gray-200 rounded-xl p-6 text-sm leading-relaxed overflow-y-auto shadow-inner"
                style={{ minHeight: '320px', fontFamily: 'Georgia, serif' }}
                dangerouslySetInnerHTML={{ __html: renderPreview(form.texto_legal) }}
              />
              {tagsUsados.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-xs text-gray-500 self-center">Tags usados:</span>
                  {tagsUsados.map(t => {
                    const g = TAG_GROUPS.find(gr => gr.tags.includes(t))
                    return (
                      <span key={t.tag} className={`text-xs px-2 py-0.5 rounded-full border font-mono ${GROUP_COLORS[g?.color || 'blue'].pill}`}>
                        {t.tag}
                      </span>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Tab: Vista previa real ──────────────────────────────────── */}
          {editorTab === 'real' && (
            <div className="flex-1 flex flex-col gap-3">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-xs text-emerald-700">
                Vista previa realista con datos de ejemplo. Así lucirá el documento final generado para el receptor.
                {!globalLogo && <span className="ml-2 text-emerald-600 font-medium">(Sin logo — configúralo con "Configurar Logo")</span>}
              </div>
              <div
                className="flex-1 bg-white border border-gray-200 rounded-xl overflow-y-auto shadow-inner p-4"
                style={{ minHeight: '380px' }}
                dangerouslySetInnerHTML={{ __html: renderRealPreview(form.texto_legal, globalLogo, headerConfig) }}
              />
            </div>
          )}

          {editing && (
            <div className="bg-amber-50 text-amber-700 text-xs px-3 py-2 rounded-lg border border-amber-200">
              Al guardar se creará una nueva versión (v{editing.version + 1}). La versión actual quedará en el historial.
            </div>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" className="btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : editing ? 'Guardar nueva versión' : 'Crear plantilla'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Modal configurar logo global ─────────────────────────────────── */}
      <Modal open={logoModal} onClose={() => setLogoModal(false)} title="Configurar Logo Global" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">El logo se mostrará en el encabezado de todos los documentos generados.</p>
          {(logoPreview || globalLogo) && (
            <div className="flex justify-center">
              <img src={logoPreview || globalLogo} alt="Logo" className="h-24 object-contain border border-gray-200 rounded-lg p-2" />
            </div>
          )}
          <div>
            <label className="label">Subir imagen</label>
            <input ref={logoFileRef} type="file" accept="image/*" className="input" onChange={handleLogoFileChange} />
          </div>
          <div className="flex justify-between gap-2">
            {globalLogo && (
              <button type="button" className="btn-secondary text-red-600 border-red-200 hover:bg-red-50" onClick={handleLogoRemove} disabled={logoSaving}>
                Quitar logo
              </button>
            )}
            <div className="flex gap-2 ml-auto">
              <button type="button" className="btn-secondary" onClick={() => setLogoModal(false)}>Cancelar</button>
              <button type="button" className="btn-primary" onClick={handleLogoSave} disabled={logoSaving || !logoPreview}>
                {logoSaving ? 'Guardando...' : 'Guardar logo'}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      <style>{`
        mark.preview-tag { background: none; border-radius: 3px; padding: 0 2px; font-weight: 600; }
        mark.preview-tag[data-color="blue"]   { color: #1d4ed8; background: #dbeafe; }
        mark.preview-tag[data-color="green"]  { color: #15803d; background: #dcfce7; }
        mark.preview-tag[data-color="purple"] { color: #7e22ce; background: #f3e8ff; }
        mark.preview-tag[data-color="orange"] { color: #c2410c; background: #ffedd5; }
        mark.preview-tag[data-color="red"]    { color: #b91c1c; background: #fee2e2; }
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
          font-style: italic;
        }
      `}</style>
    </div>
  )
}
