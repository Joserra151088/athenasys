import { useState, useEffect, useRef } from 'react'
import { plantillaAPI, configAPI } from '../utils/api'
import { DOCUMENT_TYPES } from '../utils/constants'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import {
  PlusIcon, PencilIcon, ClockIcon, ChevronDownIcon,
  EyeIcon, PencilSquareIcon, MagnifyingGlassIcon, PhotoIcon
} from '@heroicons/react/24/outline'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

// ── Tags organizados por categoría ──────────────────────────────────────────
const TAG_GROUPS = [
  {
    label: 'Receptor / Empleado',
    color: 'blue',
    tags: [
      { tag: '{{receptor_nombre}}',        desc: 'Nombre completo del empleado',         ejemplo: 'Carlos Mendoza Ruiz' },
      { tag: '{{receptor_num_empleado}}',   desc: 'Número de empleado',                   ejemplo: 'EMP-001' },
      { tag: '{{receptor_area}}',           desc: 'Área o departamento',                  ejemplo: 'Tecnologías de la Información' },
      { tag: '{{receptor_puesto}}',         desc: 'Puesto del empleado',                  ejemplo: 'Gerente de TI' },
      { tag: '{{receptor_email}}',          desc: 'Correo electrónico',                   ejemplo: 'c.mendoza@empresa.com' },
    ]
  },
  {
    label: 'Sucursal / Ubicación',
    color: 'green',
    tags: [
      { tag: '{{sucursal_nombre}}',  desc: 'Nombre de la sucursal o corporativo', ejemplo: 'Corporativo Central' },
      { tag: '{{sucursal_estado}}',  desc: 'Estado o ciudad',                     ejemplo: 'Ciudad de México' },
      { tag: '{{sucursal_tipo}}',    desc: 'Tipo: Sucursal o Corporativo',         ejemplo: 'Corporativo' },
    ]
  },
  {
    label: 'Agente de Soporte TI',
    color: 'purple',
    tags: [
      { tag: '{{agente_nombre}}',    desc: 'Nombre del agente que registra',       ejemplo: 'Laura Sánchez Torres' },
    ]
  },
  {
    label: 'Documento',
    color: 'orange',
    tags: [
      { tag: '{{fecha_documento}}',   desc: 'Fecha de generación del documento',   ejemplo: format(new Date(), 'dd/MM/yyyy') },
      { tag: '{{motivo_salida}}',     desc: 'Motivo de salida (actas de salida)',   ejemplo: 'Baja laboral' },
      { tag: '{{folio}}',             desc: 'Folio único del documento',            ejemplo: 'DOC-2026-0042' },
    ]
  },
  {
    label: 'Dispositivos',
    color: 'red',
    tags: [
      { tag: '{{lista_dispositivos}}', desc: 'Lista detallada de equipos',         ejemplo: '- CPU Dell OptiPlex 7090 (DELL-001)\n- Monitor Dell 27" (MON-002)' },
      { tag: '{{num_dispositivos}}',   desc: 'Cantidad total de equipos',          ejemplo: '2' },
    ]
  },
]

const GROUP_COLORS = {
  blue:   { pill: 'bg-blue-100 text-blue-700 border-blue-200',   btn: 'bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200' },
  green:  { pill: 'bg-green-100 text-green-700 border-green-200', btn: 'bg-green-50 hover:bg-green-100 text-green-700 border border-green-200' },
  purple: { pill: 'bg-purple-100 text-purple-700 border-purple-200', btn: 'bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200' },
  orange: { pill: 'bg-orange-100 text-orange-700 border-orange-200', btn: 'bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200' },
  red:    { pill: 'bg-red-100 text-red-700 border-red-200',      btn: 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200' },
}

// Datos de ejemplo para la vista previa realista
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
  '{{lista_dispositivos}}':   '<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:#1e293b;color:white"><th style="padding:4px 8px;text-align:left">Equipo</th><th style="padding:4px 8px;text-align:left">Serie</th></tr></thead><tbody><tr style="background:#f8fafc"><td style="padding:4px 8px">Laptop Dell XPS 15</td><td style="padding:4px 8px">ABC123XYZ</td></tr><tr><td style="padding:4px 8px">MacBook Pro M3</td><td style="padding:4px 8px">DEF456UVW</td></tr></tbody></table>',
  '{{num_dispositivos}}':     '2',
}

// Reemplaza todos los tags con sus ejemplos para la vista previa simple
function renderPreview(text) {
  let out = text
  for (const g of TAG_GROUPS) {
    for (const t of g.tags) {
      out = out.split(t.tag).join(`<mark class="preview-tag" data-color="${g.color}">${t.ejemplo}</mark>`)
    }
  }
  // If no HTML tags detected, convert newlines to <br>
  if (!/<[a-z][\s\S]*>/i.test(out)) {
    out = out.replace(/\n/g, '<br/>')
  }
  return out
}

// Genera el HTML del documento real con los datos de ejemplo
function renderRealPreview(text, logo) {
  let body = text
  for (const [tag, val] of Object.entries(SAMPLE_DATA)) {
    body = body.split(tag).join(val)
  }
  if (!/<[a-z][\s\S]*>/i.test(body)) {
    body = body.replace(/\n/g, '<br/>')
  }
  const logoHtml = logo ? `<img src="${logo}" alt="Logo" style="height:48px;object-fit:contain;border-radius:4px" />` : ''
  return `
    <div style="font-family:Georgia,serif;color:#1e293b;line-height:1.6">
      <div style="background:#1e293b;color:white;padding:20px 28px;display:flex;align-items:center;justify-content:space-between;border-radius:8px 8px 0 0">
        <div style="display:flex;align-items:center;gap:12px">
          ${logoHtml}
          <div>
            <div style="font-weight:bold;font-size:18px">AthenaSys</div>
            <div style="font-size:11px;color:#94a3b8">Área de Tecnologías de la Información</div>
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
        <div style="margin-top:40px;display:grid;grid-template-columns:1fr 1fr;gap:32px">
          <div style="border-top:2px solid #1e293b;padding-top:8px;text-align:center">
            <div style="font-size:12px;color:#64748b">Firma del receptor</div>
            <div style="font-size:13px;font-weight:600;margin-top:4px">${SAMPLE_DATA['{{receptor_nombre}}']}</div>
            <div style="font-size:11px;color:#94a3b8">${SAMPLE_DATA['{{receptor_puesto}}']}</div>
          </div>
          <div style="border-top:2px solid #1e293b;padding-top:8px;text-align:center">
            <div style="font-size:12px;color:#64748b">Firma del agente TI</div>
            <div style="font-size:13px;font-weight:600;margin-top:4px">${SAMPLE_DATA['{{agente_nombre}}']}</div>
            <div style="font-size:11px;color:#94a3b8">Soporte TI</div>
          </div>
        </div>
      </div>
    </div>
  `
}

// Toolbar de formato enriquecido
function RichToolbar({ textareaRef, form, setForm }) {
  const wrap = (before, after) => {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart, end = ta.selectionEnd
    const selected = form.texto_legal.substring(start, end)
    const newText = form.texto_legal.substring(0, start) + before + selected + after + form.texto_legal.substring(end)
    setForm(f => ({ ...f, texto_legal: newText }))
    setTimeout(() => { ta.focus(); ta.selectionStart = start + before.length; ta.selectionEnd = end + before.length }, 0)
  }

  const alignWrap = (align) => {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart, end = ta.selectionEnd
    const selected = form.texto_legal.substring(start, end)
    const before = `<div style="text-align:${align}">`, after = '</div>'
    const newText = form.texto_legal.substring(0, start) + before + selected + after + form.texto_legal.substring(end)
    setForm(f => ({ ...f, texto_legal: newText }))
    setTimeout(() => { ta.focus(); ta.selectionStart = start + before.length; ta.selectionEnd = end + before.length }, 0)
  }

  const colorWrap = (color) => wrap(`<span style="color:${color}">`, '</span>')

  const COLORS = ['#000000', '#dc2626', '#2563eb', '#16a34a', '#9333ea', '#ea580c', '#64748b']

  return (
    <div className="flex flex-wrap items-center gap-1 p-2 bg-gray-100 border-b border-gray-200 rounded-t-lg">
      <button type="button" onClick={() => wrap('<b>', '</b>')} title="Negrita" className="px-2 py-1 text-sm font-bold rounded hover:bg-gray-200">B</button>
      <button type="button" onClick={() => wrap('<em>', '</em>')} title="Cursiva" className="px-2 py-1 text-sm italic rounded hover:bg-gray-200">I</button>
      <button type="button" onClick={() => wrap('<u>', '</u>')} title="Subrayado" className="px-2 py-1 text-sm underline rounded hover:bg-gray-200">U</button>
      <div className="w-px h-5 bg-gray-300 mx-1" />
      <button type="button" onClick={() => alignWrap('left')} title="Izquierda" className="px-2 py-1 text-sm rounded hover:bg-gray-200">⬅</button>
      <button type="button" onClick={() => alignWrap('center')} title="Centrado" className="px-2 py-1 text-sm rounded hover:bg-gray-200">↔</button>
      <button type="button" onClick={() => alignWrap('right')} title="Derecha" className="px-2 py-1 text-sm rounded hover:bg-gray-200">➡</button>
      <div className="w-px h-5 bg-gray-300 mx-1" />
      <button type="button" onClick={() => wrap('<h2>', '</h2>')} title="Título" className="px-2 py-1 text-xs font-bold rounded hover:bg-gray-200">T</button>
      <button type="button" onClick={() => wrap('<li>', '</li>')} title="Lista" className="px-2 py-1 text-sm rounded hover:bg-gray-200">•</button>
      <div className="w-px h-5 bg-gray-300 mx-1" />
      {COLORS.map(c => (
        <button key={c} type="button" onClick={() => colorWrap(c)} title={c}
          className="w-5 h-5 rounded-full border border-gray-300 hover:scale-110 transition-transform flex-shrink-0"
          style={{ backgroundColor: c }} />
      ))}
    </div>
  )
}

export default function Plantillas() {
  const { canEdit } = useAuth()
  const [plantillas, setPlantillas] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [versiones, setVersiones] = useState([])
  const [showVersiones, setShowVersiones] = useState(null)
  const [form, setForm] = useState({ tipo: 'responsiva', nombre: '', texto_legal: '' })
  const [saving, setSaving] = useState(false)
  const [editorTab, setEditorTab] = useState('editar') // 'editar' | 'vista' | 'real'
  const [tagSearch, setTagSearch] = useState('')
  const textareaRef = useRef(null)
  const logoFileRef = useRef(null)

  // Logo global
  const [globalLogo, setGlobalLogo] = useState(null)
  const [logoModal, setLogoModal] = useState(false)
  const [logoPreview, setLogoPreview] = useState(null)
  const [logoSaving, setLogoSaving] = useState(false)

  const load = () => {
    setLoading(true)
    plantillaAPI.getAll().then(setPlantillas).finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    configAPI.getLogo().then(r => setGlobalLogo(r.logo)).catch(() => {})
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
    setSaving(true)
    try {
      if (editing) await plantillaAPI.update(editing.id, form)
      else await plantillaAPI.create(form)
      setModal(false)
      load()
    } catch (err) { alert(err?.message || 'Error') }
    finally { setSaving(false) }
  }

  const loadVersiones = async (id) => {
    if (showVersiones === id) { setShowVersiones(null); return }
    const v = await plantillaAPI.getVersiones(id)
    setVersiones(v)
    setShowVersiones(id)
  }

  // Inserta el tag en la posición actual del cursor
  const insertTag = (tag) => {
    const ta = textareaRef.current
    if (!ta) {
      setForm(f => ({ ...f, texto_legal: f.texto_legal + tag }))
      return
    }
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const current = form.texto_legal
    const newText = current.substring(0, start) + tag + current.substring(end)
    setForm(f => ({ ...f, texto_legal: newText }))
    // Restaurar foco y cursor después del tag
    setTimeout(() => {
      ta.focus()
      ta.selectionStart = start + tag.length
      ta.selectionEnd = start + tag.length
    }, 0)
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
    } catch (err) { alert(err?.message || 'Error al guardar logo') }
    finally { setLogoSaving(false) }
  }

  const handleLogoRemove = async () => {
    setLogoSaving(true)
    try {
      await configAPI.setLogo(null)
      setGlobalLogo(null)
      setLogoPreview(null)
      setLogoModal(false)
    } catch (err) { alert(err?.message || 'Error') }
    finally { setLogoSaving(false) }
  }

  // Filtro de búsqueda en tags
  const filteredGroups = tagSearch
    ? TAG_GROUPS.map(g => ({
        ...g,
        tags: g.tags.filter(t =>
          t.tag.includes(tagSearch.toLowerCase()) ||
          t.desc.toLowerCase().includes(tagSearch.toLowerCase())
        )
      })).filter(g => g.tags.length > 0)
    : TAG_GROUPS

  // Contar cuántos tags usa el texto
  const tagsUsados = TAG_GROUPS.flatMap(g => g.tags).filter(t => form.texto_legal.includes(t.tag))

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Plantillas de Documentos</h1>
          <p className="text-sm text-gray-500 mt-0.5">Administra los templates con versionamiento</p>
        </div>
        <div className="flex gap-2">
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
        </div>
      </div>

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
                className="bg-gray-50 rounded-lg p-4 text-xs text-gray-600 max-h-32 overflow-y-auto"
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

          {/* Tabs editar / vista previa */}
          <div className="flex items-center gap-1 border-b border-gray-200 -mb-2">
            <button
              type="button"
              onClick={() => setEditorTab('editar')}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                editorTab === 'editar'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <PencilSquareIcon className="h-4 w-4" /> Editar
            </button>
            <button
              type="button"
              onClick={() => setEditorTab('vista')}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                editorTab === 'vista'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <EyeIcon className="h-4 w-4" /> Vista previa
              {tagsUsados.length > 0 && (
                <span className="ml-1 bg-primary-100 text-primary-700 text-xs px-1.5 py-0.5 rounded-full">
                  {tagsUsados.length} tags
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setEditorTab('real')}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                editorTab === 'real'
                  ? 'border-emerald-600 text-emerald-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <EyeIcon className="h-4 w-4" /> Vista Previa Real
            </button>
          </div>

          {/* ── Tab: Editar ─────────────────────────────────────────────── */}
          {editorTab === 'editar' && (
            <div className="flex gap-4 flex-1" style={{ minHeight: '380px' }}>

              {/* Textarea */}
              <div className="flex-1 flex flex-col">
                <label className="label mb-1">Texto legal *</label>
                <RichToolbar textareaRef={textareaRef} form={form} setForm={setForm} />
                <textarea
                  ref={textareaRef}
                  className="input font-mono text-xs flex-1 resize-none rounded-t-none"
                  style={{ minHeight: '300px' }}
                  required
                  value={form.texto_legal}
                  placeholder="Escribe el texto del documento. Haz clic en un tag de la derecha para insertarlo en la posición del cursor."
                  onChange={e => setForm(f => ({ ...f, texto_legal: e.target.value }))}
                />
                <p className="text-xs text-gray-400 mt-1.5">
                  💡 Coloca el cursor donde quieras insertar el dato y haz clic en el tag correspondiente.
                </p>
              </div>

              {/* Panel de tags */}
              <div className="w-64 flex-shrink-0 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="label mb-0 text-xs">Datos dinámicos</label>
                </div>

                {/* Buscador de tags */}
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

                {/* Lista de grupos y tags */}
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
                            onClick={() => insertTag(t.tag)}
                            title={`Ejemplo: ${t.ejemplo}`}
                            className={`w-full text-left rounded-lg px-2.5 py-2 text-xs transition-all hover:shadow-sm ${GROUP_COLORS[group.color].btn}`}
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

          {/* ── Tab: Vista previa ───────────────────────────────────────── */}
          {editorTab === 'vista' && (
            <div className="flex-1 flex flex-col gap-3">
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
                Los valores en <span className="font-semibold">color</span> son datos de ejemplo. En el documento real se sustituyen automáticamente.
              </div>
              <div
                className="flex-1 bg-white border border-gray-200 rounded-xl p-6 text-sm leading-relaxed whitespace-pre-line overflow-y-auto shadow-inner"
                style={{ minHeight: '320px', fontFamily: 'Georgia, serif' }}
                dangerouslySetInnerHTML={{ __html: renderPreview(form.texto_legal) }}
              />
              {/* Leyenda de tags usados */}
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
                className="flex-1 bg-white border border-gray-200 rounded-xl overflow-y-auto shadow-inner"
                style={{ minHeight: '380px' }}
                dangerouslySetInnerHTML={{ __html: renderRealPreview(form.texto_legal, globalLogo) }}
              />
            </div>
          )}

          {/* Aviso versión */}
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
            {(globalLogo) && (
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

      {/* Estilos para la vista previa */}
      <style>{`
        mark.preview-tag {
          background: none;
          border-radius: 3px;
          padding: 0 2px;
          font-weight: 600;
        }
        mark.preview-tag[data-color="blue"]   { color: #1d4ed8; background: #dbeafe; }
        mark.preview-tag[data-color="green"]  { color: #15803d; background: #dcfce7; }
        mark.preview-tag[data-color="purple"] { color: #7e22ce; background: #f3e8ff; }
        mark.preview-tag[data-color="orange"] { color: #c2410c; background: #ffedd5; }
        mark.preview-tag[data-color="red"]    { color: #b91c1c; background: #fee2e2; }
      `}</style>
    </div>
  )
}
