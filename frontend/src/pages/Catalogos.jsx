import { useState, useEffect, useCallback } from 'react'
import { catalogosAPI } from '../utils/api'
import { useAuth } from '../context/AuthContext'
import { useNotification } from '../context/NotificationContext'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import Badge from '../components/Badge'
import {
  PlusIcon, PencilIcon, TrashIcon, BookOpenIcon,
  ComputerDesktopIcon, KeyIcon, BuildingOfficeIcon, TagIcon,
  UserGroupIcon, BriefcaseIcon
} from '@heroicons/react/24/outline'
import PageHeader from '../components/PageHeader'

// ─── Configuración de cada catálogo ──────────────────────────────────────────
const CATALOGOS = [
  {
    key: 'tiposDispositivo',
    label: 'Tipos de Dispositivo',
    desc: 'Categorías de hardware gestionado en el inventario',
    icon: ComputerDesktopIcon,
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
  },
  {
    key: 'tiposLicencia',
    label: 'Tipos de Licencia',
    desc: 'Categorías de software y licencias de sistemas',
    icon: KeyIcon,
    color: 'bg-purple-50 text-purple-700 border-purple-200',
    iconBg: 'bg-purple-100',
    iconColor: 'text-purple-600',
  },
  {
    key: 'areas',
    label: 'Áreas / Departamentos',
    desc: 'Áreas organizacionales a las que pertenecen empleados y activos',
    icon: BuildingOfficeIcon,
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
  },
  {
    key: 'marcas',
    label: 'Marcas',
    desc: 'Fabricantes de hardware registrados en el inventario',
    icon: TagIcon,
    color: 'bg-amber-50 text-amber-700 border-amber-200',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
  },
  {
    key: 'supervisores',
    label: 'Supervisores',
    desc: 'Lista de supervisores / jefes inmediatos asignables a empleados',
    icon: UserGroupIcon,
    color: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    iconBg: 'bg-indigo-100',
    iconColor: 'text-indigo-600',
  },
  {
    key: 'puestos',
    label: 'Puestos',
    desc: 'Cargos y posiciones del personal dentro de la organización',
    icon: BriefcaseIcon,
    color: 'bg-rose-50 text-rose-700 border-rose-200',
    iconBg: 'bg-rose-100',
    iconColor: 'text-rose-600',
  },
]

// ─── Panel de un catálogo ─────────────────────────────────────────────────────
function CatalogoPanel({ config }) {
  const { canEdit, isAdmin } = useAuth()
  const { showError } = useNotification()
  const api = catalogosAPI[config.key]

  const [items, setItems]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState(false)
  const [editing, setEditing]   = useState(null)
  const [nombre, setNombre]     = useState('')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [deleteId, setDeleteId] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    api.getAll().then(setItems).finally(() => setLoading(false))
  }, [config.key]) // eslint-disable-line

  useEffect(() => { load() }, [load])

  const openCreate = () => { setEditing(null); setNombre(''); setError(''); setModal(true) }
  const openEdit   = (item) => { setEditing(item); setNombre(item.nombre); setError(''); setModal(true) }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!nombre.trim()) { setError('El nombre no puede estar vacío'); return }
    setSaving(true); setError('')
    try {
      if (editing) await api.update(editing.id, { nombre: nombre.trim() })
      else         await api.create({ nombre: nombre.trim() })
      setModal(false); load()
    } catch (err) {
      setError(err?.message || 'Error al guardar')
    } finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    try { await api.delete(id); load() }
    catch (err) { showError(err?.message || 'No se puede eliminar') }
  }

  const Icon = config.icon

  return (
    <div className="card">
      {/* Header del catálogo */}
      <div className={`flex items-center justify-between p-4 rounded-t-xl border-b ${config.color} border`}>
        <div className="flex items-center gap-3">
          <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${config.iconBg}`}>
            <Icon className={`h-5 w-5 ${config.iconColor}`} />
          </div>
          <div>
            <h3 className="font-semibold text-sm">{config.label}</h3>
            <p className="text-xs opacity-70">{config.desc}</p>
          </div>
        </div>
        {canEdit() && (
          <button onClick={openCreate} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1">
            <PlusIcon className="h-3.5 w-3.5" /> Agregar
          </button>
        )}
      </div>

      {/* Lista */}
      <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
        {loading ? (
          <div className="py-8 flex justify-center">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary-600 border-t-transparent" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400">Sin registros. Agrega el primero.</div>
        ) : items.map((item, idx) => (
          <div key={item.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 group">
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400 w-5 text-right">{idx + 1}.</span>
              <span className="text-sm font-medium text-gray-800">{item.nombre}</span>
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {canEdit() && (
                <button onClick={() => openEdit(item)}
                  className="p-1 rounded text-gray-400 hover:text-primary-600 hover:bg-primary-50">
                  <PencilIcon className="h-3.5 w-3.5" />
                </button>
              )}
              {isAdmin() && (
                <button onClick={() => setDeleteId(item.id)}
                  className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50">
                  <TrashIcon className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Footer contador */}
      <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 rounded-b-xl">
        <span className="text-xs text-gray-400">{items.length} {items.length === 1 ? 'registro' : 'registros'}</span>
      </div>

      {/* Modal crear/editar */}
      <Modal open={modal} onClose={() => setModal(false)}
        title={editing ? `Editar — ${config.label}` : `Agregar — ${config.label}`} size="sm">
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="label">Nombre *</label>
            <input
              autoFocus
              className="input"
              placeholder={`Nombre del ${config.label.toLowerCase().replace('s ', ' ').replace(/es$/, '')}...`}
              value={nombre}
              onChange={e => { setNombre(e.target.value); setError('') }}
            />
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Agregar'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirm eliminación */}
      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => handleDelete(deleteId)}
        title="Eliminar registro"
        message="¿Seguro que deseas eliminar este registro del catálogo? Los dispositivos y licencias que ya lo usen no se verán afectados."
      />
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function Catalogos() {
  return (
    <div className="space-y-6">
      <PageHeader title="Catálogos" subtitle="Administra los catálogos base del sistema" />

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700 flex items-start gap-2">
        <span className="mt-0.5">ℹ️</span>
        <span>
          Los registros eliminados no afectan los dispositivos o licencias existentes que ya los tenían asignados.
          Solo dejan de aparecer en los selectores al crear nuevos registros.
        </span>
      </div>

      {/* Grid de catálogos */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {CATALOGOS.map(cat => (
          <CatalogoPanel key={cat.key} config={cat} />
        ))}
      </div>
    </div>
  )
}
