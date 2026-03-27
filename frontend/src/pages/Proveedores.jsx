import { useState, useEffect, useRef } from 'react'
import { proveedorAPI } from '../utils/api'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import { PlusIcon, PencilIcon, TrashIcon, DocumentTextIcon, ArrowDownTrayIcon, XMarkIcon, PaperClipIcon } from '@heroicons/react/24/outline'

const EMPTY = { nombre: '', contacto: '', telefono: '', contacto_nombre: '', rfc: '', direccion: '', url_web: '', imagen: null }
const TIPOS_DOC = [
  { value: 'contrato', label: 'Contrato' },
  { value: 'constancia_fiscal', label: 'Constancia Fiscal' },
  { value: 'otro', label: 'Otro' },
]

function getInitials(name) {
  return name ? name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() : '?'
}

function ProveedorAvatar({ imagen, nombre, size = 60 }) {
  if (imagen) {
    return <img src={imagen} alt={nombre} className="rounded-full object-cover border border-gray-200" style={{ width: size, height: size }} />
  }
  return (
    <div className="rounded-full bg-indigo-100 flex items-center justify-center font-bold text-indigo-600 border border-indigo-200 flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.35 }}>
      {getInitials(nombre)}
    </div>
  )
}

function DocumentosModal({ proveedor, onClose }) {
  const { canEdit } = useAuth()
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ nombre: '', tipo: 'otro' })
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const fileRef = useRef(null)
  const [fileB64, setFileB64] = useState(null)
  const [fileName, setFileName] = useState('')

  const load = () => {
    setLoading(true)
    proveedorAPI.getDocumentos(proveedor.id).then(setDocs).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [proveedor.id])

  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (ev) => setFileB64(ev.target.result)
    reader.readAsDataURL(file)
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!form.nombre) return
    setSaving(true)
    try {
      await proveedorAPI.addDocumento(proveedor.id, { ...form, archivo: fileB64, nombre_archivo: fileName })
      load()
      setForm({ nombre: '', tipo: 'otro' })
      setFileB64(null); setFileName('')
      if (fileRef.current) fileRef.current.value = ''
    } catch (err) { alert(err?.message || 'Error') }
    finally { setSaving(false) }
  }

  const handleDelete = async (docId) => {
    try { await proveedorAPI.deleteDocumento(proveedor.id, docId); load() }
    catch (err) { alert(err?.message || 'Error') }
    finally { setDeleteId(null) }
  }

  const downloadDoc = (doc) => {
    if (!doc.archivo) return
    const a = document.createElement('a')
    a.href = doc.archivo
    a.download = doc.nombre_archivo || doc.nombre
    a.click()
  }

  return (
    <div className="space-y-4">
      {canEdit() && (
        <form onSubmit={handleAdd} className="bg-gray-50 rounded-lg p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label text-xs">Nombre del documento *</label>
              <input className="input text-sm" required value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
            </div>
            <div>
              <label className="label text-xs">Tipo</label>
              <select className="input text-sm" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                {TIPOS_DOC.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label text-xs">Archivo</label>
            <input ref={fileRef} type="file" className="input text-sm" onChange={handleFile} />
          </div>
          <div className="flex justify-end">
            <button type="submit" className="btn-primary text-sm py-1.5" disabled={saving}>{saving ? 'Subiendo...' : 'Adjuntar documento'}</button>
          </div>
        </form>
      )}

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {loading ? <div className="text-center py-4 text-gray-400 text-sm">Cargando...</div>
          : docs.length === 0 ? <div className="text-center py-4 text-gray-400 text-sm">No hay documentos adjuntos</div>
          : docs.map(doc => (
            <div key={doc.id} className="flex items-center gap-3 px-3 py-2 border border-gray-200 rounded-lg">
              <PaperClipIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{doc.nombre}</div>
                <div className="text-xs text-gray-400">{TIPOS_DOC.find(t => t.value === doc.tipo)?.label || doc.tipo}</div>
              </div>
              <div className="flex gap-1">
                {doc.archivo && (
                  <button onClick={() => downloadDoc(doc)} className="p-1.5 rounded text-gray-400 hover:text-primary-600 hover:bg-primary-50" title="Descargar">
                    <ArrowDownTrayIcon className="h-4 w-4" />
                  </button>
                )}
                {canEdit() && (
                  <button onClick={() => setDeleteId(doc.id)} className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50" title="Eliminar">
                    <TrashIcon className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))
        }
      </div>
      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => handleDelete(deleteId)} title="Eliminar documento" message="¿Estás seguro de que deseas eliminar este documento?" />
    </div>
  )
}

export default function Proveedores() {
  const { canEdit, isAdmin } = useAuth()
  const [proveedores, setProveedores] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [docsProveedor, setDocsProveedor] = useState(null)
  const imgRef = useRef(null)

  const load = () => { setLoading(true); proveedorAPI.getAll().then(setProveedores).finally(() => setLoading(false)) }
  useEffect(() => { load() }, [])

  const openCreate = () => { setEditing(null); setForm(EMPTY); setModal(true) }
  const openEdit = (p) => {
    setEditing(p)
    setForm({
      nombre: p.nombre || '',
      contacto: p.contacto || '',
      telefono: p.telefono || '',
      contacto_nombre: p.contacto_nombre || '',
      rfc: p.rfc || '',
      direccion: p.direccion || '',
      url_web: p.url_web || '',
      imagen: p.imagen || null,
    })
    setModal(true)
  }

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setForm(f => ({ ...f, imagen: ev.target.result }))
    reader.readAsDataURL(file)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editing) await proveedorAPI.update(editing.id, form)
      else await proveedorAPI.create(form)
      setModal(false)
      load()
    } catch (err) { alert(err?.message || 'Error') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    try { await proveedorAPI.delete(id); load() }
    catch (err) { alert(err?.message || 'Error') }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Proveedores</h1>
          <p className="text-sm text-gray-500 mt-0.5">Proveedores de equipos y servicios de TI</p>
        </div>
        {canEdit() && <button className="btn-primary" onClick={openCreate}><PlusIcon className="h-4 w-4" /> Agregar Proveedor</button>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-3 text-center py-12"><div className="inline-block animate-spin rounded-full h-6 w-6 border-4 border-primary-600 border-t-transparent" /></div>
        ) : proveedores.length === 0 ? (
          <div className="col-span-3 text-center text-gray-400 py-12">No hay proveedores registrados</div>
        ) : proveedores.map(p => (
          <div key={p.id} className="card flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <ProveedorAvatar imagen={p.imagen} nombre={p.nombre} size={56} />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900 truncate">{p.nombre}</div>
                {p.rfc && <div className="text-xs text-gray-500 font-mono">RFC: {p.rfc}</div>}
                {p.contacto_nombre && <div className="text-xs text-gray-500">Contacto: {p.contacto_nombre}</div>}
              </div>
              <div className="flex gap-1 flex-shrink-0">
                {canEdit() && <button onClick={() => openEdit(p)} className="p-1.5 rounded text-gray-400 hover:text-primary-600 hover:bg-primary-50"><PencilIcon className="h-4 w-4" /></button>}
                {isAdmin() && <button onClick={() => setDeleteId(p.id)} className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"><TrashIcon className="h-4 w-4" /></button>}
              </div>
            </div>

            <div className="space-y-1 text-sm text-gray-600">
              {p.contacto && <div className="flex items-center gap-1 truncate">
                <span className="text-gray-400 text-xs w-16 flex-shrink-0">Email:</span>
                <a href={`mailto:${p.contacto}`} className="text-primary-600 hover:underline truncate">{p.contacto}</a>
              </div>}
              {p.telefono && <div className="flex items-center gap-1">
                <span className="text-gray-400 text-xs w-16 flex-shrink-0">Tel:</span>
                <span>{p.telefono}</span>
              </div>}
              {p.direccion && <div className="flex items-start gap-1">
                <span className="text-gray-400 text-xs w-16 flex-shrink-0 pt-0.5">Dir:</span>
                <span className="text-xs">{p.direccion}</span>
              </div>}
              {p.url_web && <div className="flex items-center gap-1">
                <span className="text-gray-400 text-xs w-16 flex-shrink-0">Web:</span>
                <a href={p.url_web.startsWith('http') ? p.url_web : `https://${p.url_web}`} target="_blank" rel="noopener noreferrer"
                  className="text-primary-600 hover:underline truncate text-xs">{p.url_web}</a>
              </div>}
            </div>

            <div className="border-t pt-2">
              <button onClick={() => setDocsProveedor(p)} className="text-xs text-primary-600 hover:underline flex items-center gap-1">
                <DocumentTextIcon className="h-3.5 w-3.5" /> Ver / Agregar documentos
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal crear/editar */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Editar Proveedor' : 'Agregar Proveedor'} size="lg">
        <form onSubmit={handleSave} className="space-y-4">
          {/* Logo / imagen */}
          <div className="flex items-center gap-4">
            <ProveedorAvatar imagen={form.imagen} nombre={form.nombre || 'N'} size={64} />
            <div>
              <label className="label text-xs mb-1">Logo / Imagen</label>
              <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
              <div className="flex gap-2">
                <button type="button" className="btn-secondary text-xs py-1.5" onClick={() => imgRef.current?.click()}>Subir imagen</button>
                {form.imagen && <button type="button" className="text-xs text-red-500 hover:underline" onClick={() => setForm(f => ({ ...f, imagen: null }))}>Quitar</button>}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="label">Nombre *</label><input className="input" required value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} /></div>
            <div><label className="label">RFC</label><input className="input font-mono" value={form.rfc} onChange={e => setForm(f => ({ ...f, rfc: e.target.value }))} /></div>
            <div><label className="label">Teléfono</label><input className="input" value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} /></div>
            <div><label className="label">Nombre de contacto</label><input className="input" value={form.contacto_nombre} onChange={e => setForm(f => ({ ...f, contacto_nombre: e.target.value }))} /></div>
            <div><label className="label">Email de contacto</label><input className="input" type="email" value={form.contacto} onChange={e => setForm(f => ({ ...f, contacto: e.target.value }))} /></div>
            <div className="col-span-2"><label className="label">Dirección</label><input className="input" value={form.direccion} onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))} /></div>
            <div className="col-span-2"><label className="label">Sitio web</label><input className="input" placeholder="https://..." value={form.url_web} onChange={e => setForm(f => ({ ...f, url_web: e.target.value }))} /></div>
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Guardando...' : editing ? 'Guardar' : 'Agregar'}</button>
          </div>
        </form>
      </Modal>

      {/* Modal documentos */}
      <Modal open={!!docsProveedor} onClose={() => setDocsProveedor(null)} title={`Documentos — ${docsProveedor?.nombre}`} size="lg">
        {docsProveedor && <DocumentosModal proveedor={docsProveedor} onClose={() => setDocsProveedor(null)} />}
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => { handleDelete(deleteId); setDeleteId(null) }} title="Eliminar proveedor" message="¿Estás seguro de que deseas eliminar este proveedor?" />
    </div>
  )
}
