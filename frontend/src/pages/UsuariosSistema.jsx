import { useState, useEffect, useRef } from 'react'
import { usuarioSistemaAPI } from '../utils/api'
import { USER_ROLES } from '../utils/constants'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import ConfirmDialog from '../components/ConfirmDialog'
import FirmaCanvas from '../components/FirmaCanvas'
import { PlusIcon, PencilIcon, UserMinusIcon, KeyIcon, PencilSquareIcon, TrashIcon, CheckIcon } from '@heroicons/react/24/outline'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const EMPTY = { username: '', password: '', nombre: '', email: '', rol: 'agente_soporte' }

export default function UsuariosSistema() {
  const { user: currentUser } = useAuth()
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [deactivateId, setDeactivateId] = useState(null)

  // Firma state
  const [myFirma, setMyFirma] = useState(null)
  const [firmaLoading, setFirmaLoading] = useState(true)
  const [firmaMode, setFirmaMode] = useState(null) // null | 'draw' | 'upload'
  const [firmaSaving, setFirmaSaving] = useState(false)
  const firmaCanvasRef = useRef(null)

  const load = () => {
    setLoading(true)
    usuarioSistemaAPI.getAll().then(setUsuarios).finally(() => setLoading(false))
  }

  const loadMyFirma = () => {
    setFirmaLoading(true)
    usuarioSistemaAPI.getMyFirma().then(d => setMyFirma(d.firma_base64 || null)).finally(() => setFirmaLoading(false))
  }

  useEffect(() => { load(); loadMyFirma() }, [])

  const openCreate = () => { setEditing(null); setForm(EMPTY); setModal(true) }
  const openEdit = (u) => { setEditing(u); setForm({ username: u.username, password: '', nombre: u.nombre, email: u.email, rol: u.rol }); setModal(true) }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editing) await usuarioSistemaAPI.update(editing.id, form)
      else await usuarioSistemaAPI.create(form)
      setModal(false)
      load()
    } catch (err) { alert(err?.message || 'Error') }
    finally { setSaving(false) }
  }

  const handleDeactivate = async (id) => {
    try { await usuarioSistemaAPI.delete(id); load() }
    catch (err) { alert(err?.message || 'Error') }
  }

  const handleSaveFirmaFromCanvas = async () => {
    const data = firmaCanvasRef.current?.getDataURL()
    if (!data) { alert('Dibuja tu firma primero'); return }
    setFirmaSaving(true)
    try {
      await usuarioSistemaAPI.saveMyFirma(data)
      setMyFirma(data)
      setFirmaMode(null)
    } catch (err) { alert(err?.message || 'Error al guardar firma') }
    finally { setFirmaSaving(false) }
  }

  const handleUploadFirma = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const data = ev.target.result
      setFirmaSaving(true)
      try {
        await usuarioSistemaAPI.saveMyFirma(data)
        setMyFirma(data)
        setFirmaMode(null)
      } catch (err) { alert(err?.message || 'Error al guardar firma') }
      finally { setFirmaSaving(false) }
    }
    reader.readAsDataURL(file)
  }

  const handleDeleteFirma = async () => {
    if (!window.confirm('¿Eliminar tu firma guardada?')) return
    try {
      await usuarioSistemaAPI.deleteMyFirma()
      setMyFirma(null)
    } catch (err) { alert(err?.message || 'Error') }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usuarios del Sistema</h1>
          <p className="text-sm text-gray-500 mt-0.5">Administra los accesos y roles de la plataforma</p>
        </div>
        <button className="btn-primary" onClick={openCreate}><PlusIcon className="h-4 w-4" /> Nuevo Usuario</button>
      </div>

      {/* ── Mi Firma ──────────────────────────────────────────────────────── */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900 flex items-center gap-2"><PencilSquareIcon className="h-5 w-5 text-primary-600" /> Mi Firma Digital</h2>
            <p className="text-xs text-gray-500 mt-0.5">Tu firma se usará automáticamente al firmar documentos</p>
          </div>
          {myFirma && (
            <button onClick={handleDeleteFirma} className="btn-secondary text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
              <TrashIcon className="h-3.5 w-3.5" /> Eliminar firma
            </button>
          )}
        </div>

        {firmaLoading ? (
          <div className="flex items-center justify-center h-20"><div className="animate-spin rounded-full h-5 w-5 border-4 border-primary-600 border-t-transparent" /></div>
        ) : myFirma ? (
          <div className="space-y-3">
            <div className="border-2 border-emerald-200 rounded-xl bg-emerald-50 p-3 flex items-center justify-center">
              <img src={myFirma} alt="Mi firma" className="h-24 object-contain" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setFirmaMode('draw')} className="btn-secondary text-xs flex items-center gap-1">
                <PencilIcon className="h-3.5 w-3.5" /> Redibujar
              </button>
              <label className="btn-secondary text-xs flex items-center gap-1 cursor-pointer">
                <PlusIcon className="h-3.5 w-3.5" /> Subir imagen
                <input type="file" accept="image/*" className="hidden" onChange={handleUploadFirma} />
              </label>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="border-2 border-dashed border-gray-200 rounded-xl bg-gray-50 p-6 text-center text-gray-400 text-sm">
              No tienes firma guardada
            </div>
            <div className="flex gap-2">
              <button onClick={() => setFirmaMode('draw')} className="btn-primary text-sm flex items-center gap-1">
                <PencilIcon className="h-4 w-4" /> Dibujar firma
              </button>
              <label className="btn-secondary text-sm flex items-center gap-1 cursor-pointer">
                <PlusIcon className="h-4 w-4" /> Subir imagen
                <input type="file" accept="image/*" className="hidden" onChange={handleUploadFirma} />
              </label>
            </div>
          </div>
        )}

        {/* Draw mode inline */}
        {firmaMode === 'draw' && (
          <div className="border border-primary-200 rounded-xl bg-primary-50 p-4 space-y-3">
            <p className="text-sm font-medium text-primary-800">Dibuja tu firma:</p>
            <FirmaCanvas ref={firmaCanvasRef} label="" existingSignature={null} />
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary text-sm" onClick={() => setFirmaMode(null)}>Cancelar</button>
              <button type="button" className="btn-primary text-sm flex items-center gap-1" onClick={handleSaveFirmaFromCanvas} disabled={firmaSaving}>
                <CheckIcon className="h-4 w-4" /> {firmaSaving ? 'Guardando...' : 'Guardar firma'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4 mb-2">
        {Object.entries(USER_ROLES).map(([k, v]) => (
          <div key={k} className="card flex items-center gap-3">
            <div className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 ${v.color.replace('text-', 'bg-').replace('-700', '-200').replace('-600', '-200')}`}>
              <KeyIcon className={`h-5 w-5 ${v.color.replace('bg-', 'text-').split(' ')[1]}`} />
            </div>
            <div>
              <div className="font-semibold text-sm">{v.label}</div>
              <div className="text-xs text-gray-500">{usuarios.filter(u => u.rol === k).length} usuario(s)</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="table-header">Usuario</th>
                <th className="table-header">Nombre</th>
                <th className="table-header">Email</th>
                <th className="table-header">Rol</th>
                <th className="table-header">Estado</th>
                <th className="table-header">Creado</th>
                <th className="table-header">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={7} className="py-12 text-center"><div className="inline-block animate-spin rounded-full h-6 w-6 border-4 border-primary-600 border-t-transparent" /></td></tr>
              ) : usuarios.map(u => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="table-cell font-mono text-sm font-semibold text-gray-700">{u.username}</td>
                  <td className="table-cell">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-semibold text-xs flex-shrink-0">{u.nombre?.charAt(0)}</div>
                      <span className="text-sm">{u.nombre}</span>
                    </div>
                  </td>
                  <td className="table-cell text-sm text-gray-500">{u.email}</td>
                  <td className="table-cell"><Badge {...(USER_ROLES[u.rol] || { label: u.rol, color: 'bg-gray-100 text-gray-600' })} /></td>
                  <td className="table-cell">{u.activo ? <Badge label="Activo" color="bg-emerald-100 text-emerald-700" /> : <Badge label="Inactivo" color="bg-gray-100 text-gray-500" />}</td>
                  <td className="table-cell text-xs text-gray-500">{u.created_at ? format(new Date(u.created_at), 'dd/MM/yyyy') : ''}</td>
                  <td className="table-cell">
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(u)} className="p-1.5 rounded text-gray-400 hover:text-primary-600 hover:bg-primary-50"><PencilIcon className="h-4 w-4" /></button>
                      {u.activo && <button onClick={() => setDeactivateId(u.id)} className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"><UserMinusIcon className="h-4 w-4" /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Editar Usuario' : 'Nuevo Usuario'} size="md">
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="label">Usuario (login) *</label>
            <input className="input" required placeholder="nombre.apellido" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} disabled={!!editing} />
          </div>
          <div>
            <label className="label">{editing ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña *'}</label>
            <input type="password" className="input" required={!editing} placeholder="••••••••" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
          </div>
          <div>
            <label className="label">Nombre completo *</label>
            <input className="input" required value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
          </div>
          <div>
            <label className="label">Email</label>
            <input type="email" className="input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <label className="label">Rol *</label>
            <select className="input" value={form.rol} onChange={e => setForm(f => ({ ...f, rol: e.target.value }))}>
              {Object.entries(USER_ROLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Guardando...' : editing ? 'Actualizar' : 'Crear usuario'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deactivateId} onClose={() => setDeactivateId(null)} onConfirm={() => handleDeactivate(deactivateId)} title="Desactivar usuario" message="El usuario no podrá iniciar sesión. ¿Confirmar?" />
    </div>
  )
}
