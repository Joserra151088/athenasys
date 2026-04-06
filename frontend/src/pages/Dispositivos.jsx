import { useState, useEffect, useCallback } from 'react'
import { deviceAPI, proveedorAPI, catalogosAPI } from '../utils/api'
import { DEVICE_TYPES, DEVICE_STATUS, LOCATION_TYPES, DEVICE_DAILY_RATES } from '../utils/constants'
import { useAuth } from '../context/AuthContext'
import { useNotification } from '../context/NotificationContext'
import Badge from '../components/Badge'
import Modal from '../components/Modal'
import Pagination from '../components/Pagination'
import ConfirmDialog from '../components/ConfirmDialog'
import {
  PlusIcon, MagnifyingGlassIcon, PencilIcon, TrashIcon, FunnelIcon,
  CurrencyDollarIcon, CubeIcon, TagIcon
} from '@heroicons/react/24/outline'

const TIPOS_SIN_SERIE = ['Mouse', 'Teclado']

// Tipos sin costo mensual (pertenecen a la empresa)
const TIPOS_SIN_COSTO = ['Mouse', 'Teclado', 'TP-Link', 'Biométrico']
// Tipos con costo único (no mensual)
const TIPOS_COSTO_UNICO = ['Cámara Web', 'Diadema']

// Configuración de campos extra por tipo de dispositivo
const CAMPOS_POR_TIPO = {
  'Laptop': [
    { key: 'procesador',    label: 'Procesador',              type: 'text',   placeholder: 'Intel Core i7-1165G7, AMD Ryzen 5...' },
    { key: 'ram',           label: 'Memoria RAM',             type: 'text',   placeholder: '8 GB, 16 GB, 32 GB...' },
    { key: 'sistema_op',    label: 'Sistema operativo',       type: 'text',   placeholder: 'Windows 11 Pro, macOS Ventura...' },
    { key: 'pantalla',      label: 'Tamaño de pantalla',      type: 'text',   placeholder: '14", 15.6", 13.3"...' },
    { key: 'tipo_disco',    label: 'Tipo de almacenamiento',  type: 'select', options: ['SSD', 'HDD', 'NVMe'] },
    { key: 'almacenamiento',label: 'Capacidad de almacenamiento', type: 'text', placeholder: '256 GB, 512 GB, 1 TB...' },
  ],
  'CPU': [
    { key: 'procesador',    label: 'Procesador',        type: 'text', placeholder: 'Intel Core i5-10400, AMD Ryzen 7...' },
    { key: 'ram',           label: 'Memoria RAM',       type: 'text', placeholder: '8 GB, 16 GB...' },
    { key: 'sistema_op',    label: 'Sistema operativo', type: 'text', placeholder: 'Windows 10 Pro, Windows 11...' },
  ],
  'Monitor': [
    { key: 'pantalla',      label: 'Tamaño de pantalla', type: 'text', placeholder: '24", 27", 32"...' },
  ],
  'Tablet': [
    { key: 'procesador',     label: 'Procesador',                  type: 'text', placeholder: 'Apple M1, Snapdragon 865...' },
    { key: 'ram',            label: 'Memoria RAM',                 type: 'text', placeholder: '4 GB, 8 GB...' },
    { key: 'almacenamiento', label: 'Capacidad de almacenamiento', type: 'text', placeholder: '64 GB, 128 GB...' },
    { key: 'sistema_op',     label: 'Sistema operativo',           type: 'text', placeholder: 'iPadOS 16, Android 13...' },
  ],
  'Módem de Internet_Telmex': [
    { key: 'paquete',        label: 'Nombre del paquete contratado', type: 'text', placeholder: 'Infinitum 300 MB...' },
    { key: 'telefono',       label: 'Número de teléfono',            type: 'text', placeholder: '55 1234 5678' },
    { key: 'ancho_banda',    label: 'Ancho de banda contratado',     type: 'text', placeholder: '300 Mbps, 500 Mbps...' },
  ],
  'Módem de Internet_Telcel': [
    { key: 'plan',           label: 'Nombre del plan contratado', type: 'text', placeholder: 'Plan Plus 50 GB...' },
    { key: 'imei',           label: 'IMEI',                       type: 'text', placeholder: '123456789012345' },
    { key: 'sim',            label: 'SIM',                        type: 'text', placeholder: '8952140...' },
    { key: 'telefono',       label: 'Número de teléfono',         type: 'text', placeholder: '55 1234 5678' },
  ],
}

const EMPTY_FORM = { tipo: '', marca: '', serie: '', modelo: '', cantidad: 1, proveedor_id: '', caracteristicas: '', costo_dia: '', campos_extra: {}, costo_tipo: 'mensual' }

// Muestra costo con estilo según tipo de tarifa
function CostoBadge({ tipo, costo }) {
  const rate = DEVICE_DAILY_RATES[tipo]
  if (!rate) return <span className="text-gray-400 text-xs">—</span>

  if (rate.tipo === 'paquete') return (
    <div className="flex flex-col">
      <span className="text-emerald-700 font-semibold text-sm">
        ${parseFloat(costo || rate.costo).toFixed(2)}
        <span className="text-xs font-normal text-gray-400">/día</span>
      </span>
      <span className="text-xs text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded mt-0.5 inline-flex items-center gap-0.5">
        <CubeIcon className="h-3 w-3" /> Paquete
      </span>
    </div>
  )
  if (rate.tipo === 'incluido') return (
    <div className="flex flex-col">
      <span className="text-gray-400 text-sm">$0.00<span className="text-xs">/día</span></span>
      <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded mt-0.5">En CPU</span>
    </div>
  )
  if (rate.tipo === 'accesorio') return (
    <div className="flex flex-col">
      <span className="text-gray-400 text-sm">$0.00<span className="text-xs">/día</span></span>
      <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded mt-0.5">Accesorio</span>
    </div>
  )
  return (
    <span className="text-gray-700 font-medium text-sm">
      ${parseFloat(costo || rate.costo).toFixed(2)}
      <span className="text-xs font-normal text-gray-400">/día</span>
    </span>
  )
}

// Previsualización del costo en el formulario
function CostoPreview({ tipo }) {
  if (!tipo) return null
  const rate = DEVICE_DAILY_RATES[tipo]
  if (!rate) return null

  const colorMap = {
    paquete:   'bg-emerald-50 border-emerald-200 text-emerald-800',
    unitario:  'bg-blue-50   border-blue-200   text-blue-800',
    incluido:  'bg-amber-50  border-amber-200  text-amber-800',
    accesorio: 'bg-gray-50   border-gray-200   text-gray-600',
  }

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${colorMap[rate.tipo]}`}>
      <CurrencyDollarIcon className="h-4 w-4 flex-shrink-0" />
      <div>
        <span className="font-semibold">
          {rate.costo > 0 ? `$${rate.costo.toFixed(2)} MXN/día` : 'Sin costo de renta'}
        </span>
        {' — '}
        <span className="opacity-80">{rate.nota}</span>
      </div>
    </div>
  )
}

export default function Dispositivos() {
  const { canEdit, isAdmin } = useAuth()
  const { showError } = useNotification()
  const [dispositivos, setDispositivos] = useState([])
  const [proveedores, setProveedores] = useState([])
  const [tiposDispositivo, setTiposDispositivo] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 20 })
  const [filters, setFilters] = useState({ search: '', tipo: '', estado: '', ubicacion_tipo: '' })
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [showFilters, setShowFilters] = useState(false)

  const load = useCallback((page = 1) => {
    setLoading(true)
    const params = { page, limit: 20, ...filters }
    Object.keys(params).forEach(k => !params[k] && delete params[k])
    deviceAPI.getAll(params).then(d => {
      setDispositivos(d.data)
      setPagination({ page: d.page, pages: d.pages, total: d.total, limit: d.limit })
    }).finally(() => setLoading(false))
  }, [filters])

  useEffect(() => { load(1) }, [load])
  useEffect(() => {
    proveedorAPI.getAll().then(setProveedores)
    catalogosAPI.tiposDispositivo.getAll().then(r => setTiposDispositivo(r.map(t => t.nombre || t.valor || t)))
  }, [])

  // Detecta qué campos extra mostrar según tipo y proveedor (para módem)
  const getCamposExtra = () => {
    if (!form.tipo) return []
    if (form.tipo === 'Módem de Internet') {
      const prov = proveedores.find(p => p.id === form.proveedor_id)
      const nombre = (prov?.nombre || '').toLowerCase()
      if (nombre.includes('telmex')) return CAMPOS_POR_TIPO['Módem de Internet_Telmex'] || []
      if (nombre.includes('telcel')) return CAMPOS_POR_TIPO['Módem de Internet_Telcel'] || []
      return []
    }
    return CAMPOS_POR_TIPO[form.tipo] || []
  }

  // Determina costo_tipo según el tipo de dispositivo seleccionado
  const getCostoTipo = (tipo) => {
    if (TIPOS_SIN_COSTO.includes(tipo)) return 'sin_costo'
    if (TIPOS_COSTO_UNICO.includes(tipo)) return 'unico'
    return 'mensual'
  }

  const handleTipoChange = (tipo) => {
    const costo_tipo = getCostoTipo(tipo)
    const costo_dia = costo_tipo === 'sin_costo' ? 0 : ''
    setForm(f => ({ ...f, tipo, campos_extra: {}, costo_tipo, costo_dia }))
  }

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setModal(true) }
  const openEdit = (d) => {
    setEditing(d)
    setForm({
      tipo: d.tipo, marca: d.marca, serie: d.serie || '', modelo: d.modelo || '',
      cantidad: d.cantidad || 1, proveedor_id: d.proveedor_id || '',
      caracteristicas: d.caracteristicas || '',
      costo_dia: d.costo_dia !== undefined ? d.costo_dia : '',
      campos_extra: d.campos_extra || {},
      costo_tipo: d.costo_tipo || 'mensual'
    })
    setModal(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editing) await deviceAPI.update(editing.id, form)
      else await deviceAPI.create(form)
      setModal(false)
      load(1)
    } catch (err) {
      showError(err?.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await deviceAPI.delete(id)
      load(pagination.page)
    } catch (err) {
      showError(err?.message || 'No se puede eliminar')
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dispositivos</h1>
          <p className="text-sm text-gray-500 mt-0.5">Inventario completo de dispositivos TI</p>
        </div>
        {canEdit() && (
          <button className="btn-primary" onClick={openCreate}>
            <PlusIcon className="h-4 w-4" /> Agregar Dispositivo
          </button>
        )}
      </div>

      {/* Leyenda de tarifas */}
      <div className="flex flex-wrap gap-2 text-xs">
        <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1.5 rounded-lg">
          <CubeIcon className="h-3.5 w-3.5" />
          <span><strong>Paquete CPU</strong> — Monitor + Teclado + Mouse incluidos ($85/día)</span>
        </div>
        <div className="flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1.5 rounded-lg">
          <TagIcon className="h-3.5 w-3.5" />
          <span><strong>Unitario</strong> — Costo independiente por dispositivo</span>
        </div>
        <div className="flex items-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1.5 rounded-lg">
          <span><strong>En CPU</strong> — Monitor, Teclado y Mouse: $0 (van con el CPU)</span>
        </div>
      </div>

      {/* Búsqueda y filtros */}
      <div className="card p-4">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text" className="input pl-9"
              placeholder="Buscar por tipo, marca, serie, ubicación..."
              value={filters.search}
              onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            />
          </div>
          <button className="btn-secondary" onClick={() => setShowFilters(!showFilters)}>
            <FunnelIcon className="h-4 w-4" /> Filtros
          </button>
        </div>
        {showFilters && (
          <div className="grid grid-cols-3 gap-3 mt-3">
            <div>
              <label className="label">Tipo</label>
              <select className="input" value={filters.tipo} onChange={e => setFilters(f => ({ ...f, tipo: e.target.value }))}>
                <option value="">Todos</option>
                {(tiposDispositivo.length > 0 ? tiposDispositivo : DEVICE_TYPES).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Estado</label>
              <select className="input" value={filters.estado} onChange={e => setFilters(f => ({ ...f, estado: e.target.value }))}>
                <option value="">Todos</option>
                {Object.entries(DEVICE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Ubicación</label>
              <select className="input" value={filters.ubicacion_tipo} onChange={e => setFilters(f => ({ ...f, ubicacion_tipo: e.target.value }))}>
                <option value="">Todas</option>
                {Object.entries(LOCATION_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Tabla */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="table-header">Tipo</th>
                <th className="table-header">Marca / Modelo</th>
                <th className="table-header">Serie</th>
                <th className="table-header">Proveedor</th>
                <th className="table-header">Características</th>
                <th className="table-header text-right">Costo/día</th>
                <th className="table-header">Estado</th>
                <th className="table-header">Ubicación</th>
                {canEdit() && <th className="table-header">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={9} className="py-12 text-center">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-4 border-primary-600 border-t-transparent" />
                </td></tr>
              ) : dispositivos.length === 0 ? (
                <tr><td colSpan={9} className="py-12 text-center text-gray-400">No se encontraron dispositivos</td></tr>
              ) : dispositivos.map(d => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="table-cell font-medium">{d.tipo}</td>
                  <td className="table-cell">
                    <div className="font-medium">{d.marca}</div>
                    <div className="text-xs text-gray-400">{d.modelo}</div>
                  </td>
                  <td className="table-cell font-mono text-xs text-gray-600">
                    {TIPOS_SIN_SERIE.includes(d.tipo)
                      ? <span className="text-gray-500 italic">{d.cantidad || 1} uds.</span>
                      : d.serie}
                  </td>
                  <td className="table-cell text-sm">{d.proveedor_nombre || '—'}</td>
                  <td className="table-cell max-w-48">
                    <p className="text-xs text-gray-500 truncate">{d.caracteristicas || '—'}</p>
                  </td>
                  <td className="table-cell text-right">
                    <CostoBadge tipo={d.tipo} costo={d.costo_dia} />
                  </td>
                  <td className="table-cell">
                    <Badge {...(DEVICE_STATUS[d.estado] || { label: d.estado, color: 'bg-gray-100 text-gray-600' })} />
                  </td>
                  <td className="table-cell">
                    <Badge {...(LOCATION_TYPES[d.ubicacion_tipo] || { label: d.ubicacion_tipo, color: 'bg-gray-100 text-gray-600' })} />
                    <div className="text-xs text-gray-400 mt-0.5 truncate max-w-36">{d.ubicacion_nombre}</div>
                  </td>
                  {canEdit() && (
                    <td className="table-cell">
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(d)} className="p-1.5 rounded text-gray-400 hover:text-primary-600 hover:bg-primary-50">
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        {isAdmin() && (
                          <button onClick={() => setDeleteId(d.id)} className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50">
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination {...pagination} onPageChange={load} />
      </div>

      {/* Modal crear/editar */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Editar Dispositivo' : 'Agregar Dispositivo'} size="lg">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Tipo de dispositivo *</label>
              <select className="input" required value={form.tipo}
                onChange={e => handleTipoChange(e.target.value)}>
                <option value="">Seleccionar...</option>
                {(tiposDispositivo.length > 0 ? tiposDispositivo : DEVICE_TYPES).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Marca *</label>
              <input className="input" required placeholder="Dell, HP, Logitech..."
                value={form.marca} onChange={e => setForm(f => ({ ...f, marca: e.target.value }))} />
            </div>

            {/* Mouse y Teclado: cantidad en lugar de serie/modelo */}
            {TIPOS_SIN_SERIE.includes(form.tipo) ? (
              <div className="col-span-2">
                <label className="label">Cantidad de unidades</label>
                <input type="number" min="1" className="input" value={form.cantidad}
                  onChange={e => setForm(f => ({ ...f, cantidad: parseInt(e.target.value) || 1 }))} />
                <p className="text-xs text-gray-400 mt-1">Los {form.tipo}s se registran por cantidad, no por número de serie individual</p>
              </div>
            ) : (
              <>
                <div>
                  <label className="label">Número de serie *</label>
                  <input className="input" required placeholder="SN-XXXXXXXX"
                    value={form.serie} onChange={e => setForm(f => ({ ...f, serie: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Modelo</label>
                  <input className="input" placeholder="OptiPlex 7090, EliteBook 840..."
                    value={form.modelo} onChange={e => setForm(f => ({ ...f, modelo: e.target.value }))} />
                </div>
              </>
            )}

            <div className="col-span-2">
              <label className="label">Proveedor</label>
              <select className="input" value={form.proveedor_id}
                onChange={e => setForm(f => ({ ...f, proveedor_id: e.target.value }))}>
                <option value="">Sin proveedor</option>
                {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>

            {/* ── Campos específicos por tipo de dispositivo ── */}
            {getCamposExtra().length > 0 && (
              <div className="col-span-2 space-y-3 bg-blue-50 border border-blue-100 rounded-xl p-4">
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
                  Especificaciones — {form.tipo}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {getCamposExtra().map(campo => (
                    <div key={campo.key} className={campo.type === 'select' ? '' : ''}>
                      <label className="label">{campo.label}</label>
                      {campo.type === 'select' ? (
                        <select className="input" value={form.campos_extra[campo.key] || ''}
                          onChange={e => setForm(f => ({ ...f, campos_extra: { ...f.campos_extra, [campo.key]: e.target.value } }))}>
                          <option value="">Seleccionar...</option>
                          {campo.options.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : (
                        <input className="input" type="text" placeholder={campo.placeholder}
                          value={form.campos_extra[campo.key] || ''}
                          onChange={e => setForm(f => ({ ...f, campos_extra: { ...f.campos_extra, [campo.key]: e.target.value } }))} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Aviso para módem sin proveedor Telmex/Telcel seleccionado */}
            {form.tipo === 'Módem de Internet' && getCamposExtra().length === 0 && form.proveedor_id && (
              <div className="col-span-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                El proveedor seleccionado no es Telmex ni Telcel. Solo se guardarán los campos generales.
              </div>
            )}
            {form.tipo === 'Módem de Internet' && !form.proveedor_id && (
              <div className="col-span-2 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                Selecciona el proveedor (Telmex o Telcel) para ver los campos específicos del módem.
              </div>
            )}

            <div className="col-span-2">
              <label className="label">Observaciones generales</label>
              <textarea className="input" rows={2} placeholder="Notas adicionales..."
                value={form.caracteristicas}
                onChange={e => setForm(f => ({ ...f, caracteristicas: e.target.value }))} />
            </div>

            {/* ── Costo según tipo ── */}
            {form.costo_tipo === 'sin_costo' ? (
              <div className="col-span-2 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-500">
                <span className="text-lg">🏢</span>
                <span>Este dispositivo <strong>no tiene costo mensual</strong> — pertenece a la empresa.</span>
              </div>
            ) : (
              <>
                <div>
                  <label className="label">
                    {form.costo_tipo === 'unico' ? 'Costo único (MXN)' : 'Costo de renta / día (MXN)'}
                  </label>
                  {form.costo_tipo === 'unico' && (
                    <p className="text-xs text-blue-600 mb-1">Este costo es único, no afecta los cálculos mensuales.</p>
                  )}
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                    <input type="number" min="0" step="0.01" className="input pl-7"
                      placeholder="0.00"
                      value={form.costo_dia === 0 || form.costo_dia === '0' ? '0' : (form.costo_dia || '')}
                      onChange={e => {
                        const val = e.target.value
                        setForm(f => ({ ...f, costo_dia: val === '' ? '' : parseFloat(val) }))
                      }} />
                  </div>
                  {form.costo_tipo === 'mensual' && (
                    <button type="button"
                      onClick={() => setForm(f => ({ ...f, costo_dia: 0 }))}
                      className="text-xs text-gray-400 hover:text-emerald-600 mt-1 underline">
                      Sin costo (establecer en $0)
                    </button>
                  )}
                  {form.tipo && DEVICE_DAILY_RATES[form.tipo] && (
                    <p className="text-xs text-gray-400 mt-1">{DEVICE_DAILY_RATES[form.tipo].nota}</p>
                  )}
                </div>
                <div className="flex items-end pb-1">
                  {form.tipo && DEVICE_DAILY_RATES[form.tipo] && <CostoPreview tipo={form.tipo} />}
                </div>
              </>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Agregar dispositivo'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => handleDelete(deleteId)}
        title="Eliminar dispositivo"
        message="¿Estás seguro de que deseas eliminar este dispositivo? Esta acción no se puede deshacer."
      />
    </div>
  )
}
