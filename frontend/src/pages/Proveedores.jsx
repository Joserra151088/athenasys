import { useState, useEffect } from 'react'
import { proveedorAPI } from '../utils/api'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import { PlusIcon, PencilIcon, TrashIcon, TruckIcon } from '@heroicons/react/24/outline'

const EMPTY = { nombre: '', contacto: '', telefono: '' }

export default function Proveedores() {
  const { canEdit, isAdmin } = useAuth()
  const [proveedores, setProveedores] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState(null)

  const load = () => { setLoading(true); proveedorAPI.getAll().then(setProveedores).finally(() => setLoading(false)) }
  useEffect(() => { load() }, [])

  const openCreate = () => { setEditing(null); setForm(EMPTY); setModal(true) }
  const openEdit = (p) => { setEditing(p); setForm({ nombre: p.nombre, contacto: p.contacto, telefono: p.telefono }); setModal(true) }

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
          <div key={p.id} className="card flex items-start gap-4">
            <div className="h-10 w-10 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <TruckIcon className="h-5 w-5 text-indigo-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-gray-900">{p.nombre}</div>
              {p.contacto && <div className="text-sm text-gray-500 truncate">{p.contacto}</div>}
              {p.telefono && <div className="text-sm text-gray-500">{p.telefono}</div>}
            </div>
            <div className="flex gap-1 flex-shrink-0">
              {canEdit() && <button onClick={() => openEdit(p)} className="p-1.5 rounded text-gray-400 hover:text-primary-600 hover:bg-primary-50"><PencilIcon className="h-4 w-4" /></button>}
              {isAdmin() && <button onClick={() => setDeleteId(p.id)} className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"><TrashIcon className="h-4 w-4" /></button>}
            </div>
          </div>
        ))}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Editar Proveedor' : 'Agregar Proveedor'} size="sm">
        <form onSubmit={handleSave} className="space-y-4">
          <div><label className="label">Nombre *</label><input className="input" required value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} /></div>
          <div><label className="label">Contacto (email)</label><input className="input" value={form.contacto} onChange={e => setForm(f => ({ ...f, contacto: e.target.value }))} /></div>
          <div><label className="label">Teléfono</label><input className="input" value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} /></div>
          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Guardando...' : editing ? 'Guardar' : 'Agregar'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => handleDelete(deleteId)} title="Eliminar proveedor" message="¿Estás seguro?" />
    </div>
  )
}
