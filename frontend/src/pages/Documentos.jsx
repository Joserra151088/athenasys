import { useState, useEffect, useCallback, useRef } from 'react'
import { documentoAPI, plantillaAPI, empleadoAPI, sucursalAPI, deviceAPI, usuarioSistemaAPI } from '../utils/api'
import { DOCUMENT_TYPES } from '../utils/constants'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import Pagination from '../components/Pagination'
import FirmaCanvas from '../components/FirmaCanvas'
import { PlusIcon, MagnifyingGlassIcon, EyeIcon, PencilSquareIcon, PrinterIcon } from '@heroicons/react/24/outline'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

const DOC_CODES = { responsiva: 'F-TI-39-V2', entrada: 'F-TI-84-V1', salida: 'F-TI-85-V1' }
const DOC_TITLES = { responsiva: 'CARTA RESPONSIVA', entrada: 'FORMATO DE ENTRADA DE EQUIPO', salida: 'FORMATO DE SALIDA DE EQUIPO' }

function DocumentHeader({ tipo, editable = false }) {
  const [logo, setLogo] = useState(() => localStorage.getItem('athenasys_logo') || null)
  const handleLogoUpload = (e) => {
    const file = e.target.files[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => { localStorage.setItem('athenasys_logo', ev.target.result); setLogo(ev.target.result) }
    reader.readAsDataURL(file)
  }
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
      <tbody><tr>
        <td style={{ border: '1.5px solid #9ca3af', width: '28%', padding: 8, textAlign: 'center', verticalAlign: 'middle' }}>
          {logo ? (
            <img src={logo} alt="Logo" style={{ maxHeight: 64, maxWidth: 160, objectFit: 'contain', display: 'block', margin: '0 auto' }} />
          ) : (
            <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 11 }}>LOGO</div>
          )}
          {editable && (
            <label style={{ cursor: 'pointer', fontSize: 10, color: '#6366f1', display: 'block', marginTop: 4 }}>
              <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} />
              {logo ? 'Cambiar logo' : '+ Subir logo'}
            </label>
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

  // Create form
  const [form, setForm] = useState({ tipo: 'responsiva', plantilla_id: '', entidad_tipo: 'empleado', entidad_id: '', dispositivos: [], receptor_id: '', observaciones: '' })
  const [plantillas, setPlantillas] = useState([])
  const [entidades, setEntidades] = useState([])
  const [empleados, setEmpleados] = useState([])
  const [dispositivos, setDispositivos] = useState([])

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
    setPlantillas(pl)
    setEmpleados(emp.data)
    setEntidades(emp.data)
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
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await documentoAPI.create(form)
      setModal(null)
      load(1)
    } catch (err) { alert(err?.message || 'Error') }
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
    if (!firmaReceptor) { alert('La firma del receptor es requerida'); return }
    setSaving(true)
    try {
      await documentoAPI.sign(selected.id, { firma_agente: firmaAgente, firma_receptor: firmaReceptor })
      setModal(null)
      load(1)
    } catch (err) { alert(err?.message || 'Error') }
    finally { setSaving(false) }
  }

  const exportPDF = async () => {
    if (!previewRef.current) return
    const canvas = await html2canvas(previewRef.current, { scale: 2, useCORS: true })
    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
    const w = pdf.internal.pageSize.getWidth()
    const h = (canvas.height * w) / canvas.width
    pdf.addImage(imgData, 'PNG', 0, 0, w, h)
    pdf.save(`${selected?.folio || 'documento'}.pdf`)
  }

  const getPlantillaTexto = (doc) => {
    if (!doc?.plantilla?.texto_legal) return ''
    return doc.plantilla.texto_legal
      .replace('{{receptor_nombre}}', doc.receptor_nombre || doc.entidad_nombre || '')
      .replace('{{receptor_num_empleado}}', '')
      .replace('{{receptor_area}}', '')
      .replace('{{sucursal_nombre}}', doc.entidad_nombre || '')
      .replace('{{agente_nombre}}', doc.agente_nombre || '')
      .replace('{{motivo_salida}}', doc.observaciones || '')
  }

  const renderPlantillaHTML = (doc) => {
    const text = getPlantillaTexto(doc)
    if (!text) return 'Sin texto legal configurado.'
    // If it has HTML tags, return as-is; otherwise convert newlines
    if (/<[a-z][\s\S]*>/i.test(text)) return text
    return text.replace(/\n/g, '<br/>')
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
                <th className="table-header">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={8} className="py-12 text-center"><div className="inline-block animate-spin rounded-full h-6 w-6 border-4 border-primary-600 border-t-transparent" /></td></tr>
              ) : documentos.length === 0 ? (
                <tr><td colSpan={8} className="py-12 text-center text-gray-400">No hay documentos</td></tr>
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
                    <div className="flex gap-1">
                      <button onClick={() => openPreview(d)} className="p-1.5 rounded text-gray-400 hover:text-primary-600 hover:bg-primary-50" title="Vista previa">
                        <EyeIcon className="h-4 w-4" />
                      </button>
                      {canEdit() && !d.firmado && (
                        <button onClick={() => openSign(d)} className="p-1.5 rounded text-gray-400 hover:text-emerald-600 hover:bg-emerald-50" title="Firmar">
                          <PencilSquareIcon className="h-4 w-4" />
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
            <div>
              <label className="label">{form.entidad_tipo === 'empleado' ? 'Empleado' : 'Sucursal'} *</label>
              <select className="input" required value={form.entidad_id} onChange={e => setForm(f => ({ ...f, entidad_id: e.target.value }))}>
                <option value="">Seleccionar...</option>
                {entidades.map(e => <option key={e.id} value={e.id}>{e.nombre_completo || e.nombre}</option>)}
              </select>
            </div>
            {form.tipo === 'responsiva' && (
              <div className="col-span-2">
                <label className="label">Persona que recibe *</label>
                <select className="input" value={form.receptor_id} onChange={e => setForm(f => ({ ...f, receptor_id: e.target.value }))}>
                  <option value="">Seleccionar empleado receptor...</option>
                  {empleados.map(e => <option key={e.id} value={e.id}>{e.nombre_completo} — {e.num_empleado}</option>)}
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
                {saving ? 'Firmando...' : 'Firmar y guardar'}
              </button>
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
              <DocumentHeader tipo={selected.tipo} editable={true} />

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
