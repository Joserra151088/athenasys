import { useState, useEffect, useCallback, useRef } from 'react'
import { sucursalAPI, centroCostoAPI } from '../utils/api'
import { RECORD_TYPES } from '../utils/constants'
import { useAuth } from '../context/AuthContext'
import { useNotification } from '../context/NotificationContext'
import Modal from '../components/Modal'
import Pagination from '../components/Pagination'
import ConfirmDialog from '../components/ConfirmDialog'
import Badge from '../components/Badge'
import { PlusIcon, MagnifyingGlassIcon, PencilIcon, TrashIcon, FolderOpenIcon, MapPinIcon, XMarkIcon, ArrowUpTrayIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline'
import { Link } from 'react-router-dom'

const EMPTY = { nombre: '', tipo: 'sucursal', direccion: '', estado: '', lat: '', lng: '', centro_costos: '', centro_costo_codigo: '', centro_costo_nombre: '' }

const ESTADOS_MX = ['Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche', 'Chiapas', 'Chihuahua', 'Ciudad de México', 'Coahuila', 'Colima', 'Durango', 'Guanajuato', 'Guerrero', 'Hidalgo', 'Jalisco', 'Estado de México', 'Michoacán', 'Morelos', 'Nayarit', 'Nuevo León', 'Oaxaca', 'Puebla', 'Querétaro', 'Quintana Roo', 'San Luis Potosí', 'Sinaloa', 'Sonora', 'Tabasco', 'Tamaulipas', 'Tlaxcala', 'Veracruz', 'Yucatán', 'Zacatecas']

// Componente de búsqueda de Centro de Costos
function CentroCostoSearch({ value, nombre, onChange }) {
  const [query, setQuery] = useState(nombre || '')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => { setQuery(nombre || '') }, [nombre])

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const search = useCallback(async (q) => {
    if (!q || q.length < 1) { setResults([]); setOpen(false); return }
    try {
      const data = await centroCostoAPI.search(q)
      setResults(data)
      setOpen(data.length > 0)
    } catch (_) {}
  }, [])

  const handleInput = (e) => {
    const q = e.target.value
    setQuery(q)
    if (!q) { onChange('', ''); setOpen(false); return }
    search(q)
  }

  const handleSelect = (cc) => {
    setQuery(`${cc.codigo} — ${cc.nombre}`)
    onChange(cc.codigo, cc.nombre)
    setOpen(false)
    setResults([])
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <input
          className="input pr-8"
          placeholder="Buscar por código o nombre..."
          value={query}
          onChange={handleInput}
          onFocus={() => query && results.length > 0 && setOpen(true)}
        />
        {query && (
          <button type="button" onClick={() => { setQuery(''); onChange('', ''); setOpen(false); setResults([]) }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <XMarkIcon className="h-4 w-4" />
          </button>
        )}
      </div>
      {value && (
        <p className="text-xs text-primary-600 mt-0.5">Código: <span className="font-mono font-semibold">{value}</span></p>
      )}
      {open && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
          {results.map(cc => (
            <button key={cc.id} type="button"
              className="w-full text-left px-3 py-2 hover:bg-primary-50 text-sm border-b border-gray-50 last:border-0"
              onClick={() => handleSelect(cc)}>
              <span className="font-mono text-xs text-gray-500">{cc.codigo}</span>
              <span className="mx-2 text-gray-300">|</span>
              <span className="text-gray-800">{cc.nombre}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Sucursales() {
  const { canEdit, isAdmin } = useAuth()
  const { showError } = useNotification()
  const [sucursales, setSucursales] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 20 })
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [csvModal, setCsvModal] = useState(false)
  const [csvResult, setCsvResult] = useState(null)
  const [csvImporting, setCsvImporting] = useState(false)
  const csvFileRef = useRef(null)

  const load = useCallback((page = 1) => {
    setLoading(true)
    const params = { page, limit: 20 }
    if (search) params.search = search
    sucursalAPI.getAll(params).then(d => {
      setSucursales(d.data)
      setPagination({ page: d.page, pages: Math.ceil(d.total / 20), total: d.total, limit: 20 })
    }).finally(() => setLoading(false))
  }, [search])

  useEffect(() => { load(1) }, [load])

  const openCreate = () => { setEditing(null); setForm(EMPTY); setModal(true) }
  const openEdit = (s) => {
    setEditing(s)
    setForm({
      nombre: s.nombre, tipo: s.tipo, direccion: s.direccion || '',
      estado: s.estado || '', lat: s.lat || '', lng: s.lng || '',
      centro_costos: s.centro_costos || '',
      centro_costo_codigo: s.centro_costo_codigo || '',
      centro_costo_nombre: s.centro_costo_nombre || ''
    })
    setModal(true)
  }

  const handleSave = async (ev) => {
    ev.preventDefault()
    setSaving(true)
    try {
      if (editing) await sucursalAPI.update(editing.id, form)
      else await sucursalAPI.create(form)
      setModal(false)
      load(1)
    } catch (err) { showError(err?.message || 'Error al guardar') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    try { await sucursalAPI.delete(id); load(pagination.page) }
    catch (err) { showError(err?.message || 'Error') }
  }

  const downloadCsvTemplate = () => {
    const header = 'nombre,tipo,direccion,estado,lat,lng'
    const sample = 'Sucursal Querétaro,sucursal,"Av. 5 de Febrero 1234, Qro",Querétaro,20.5888,-100.3899'
    const blob = new Blob([header + '\n' + sample], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'plantilla_sucursales.csv'; a.click()
  }

  const handleCsvImport = async (e) => {
    e.preventDefault()
    const file = csvFileRef.current?.files[0]
    if (!file) return
    setCsvImporting(true); setCsvResult(null)
    try {
      const fd = new FormData(); fd.append('archivo', file)
      const result = await sucursalAPI.importarCSV(fd)
      setCsvResult(result)
      load(1)
    } catch (err) { setCsvResult({ error: err?.message || 'Error al importar' }) }
    finally { setCsvImporting(false) }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sucursales</h1>
          <p className="text-sm text-gray-500 mt-0.5">Corporativo y sucursales de la empresa</p>
        </div>
        <div className="flex gap-2">
          {canEdit() && <button className="btn-secondary" onClick={() => { setCsvResult(null); setCsvModal(true) }}><ArrowUpTrayIcon className="h-4 w-4" /> Importar CSV</button>}
          {canEdit() && <button className="btn-primary" onClick={openCreate}><PlusIcon className="h-4 w-4" /> Agregar Sucursal</button>}
        </div>
      </div>

      <div className="card p-4">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input type="text" className="input pl-9" placeholder="Buscar por nombre, estado, dirección..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="table-header">Nombre</th>
                <th className="table-header">Tipo</th>
                <th className="table-header">Estado</th>
                <th className="table-header">Centro de Costos</th>
                <th className="table-header">Dirección</th>
                <th className="table-header">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={6} className="py-12 text-center"><div className="inline-block animate-spin rounded-full h-6 w-6 border-4 border-primary-600 border-t-transparent" /></td></tr>
              ) : sucursales.length === 0 ? (
                <tr><td colSpan={6} className="py-12 text-center text-gray-400">No se encontraron sucursales</td></tr>
              ) : sucursales.map(s => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="table-cell">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 bg-teal-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <MapPinIcon className="h-4 w-4 text-teal-600" />
                      </div>
                      <span className="font-medium">{s.nombre}</span>
                    </div>
                  </td>
                  <td className="table-cell">
                    <Badge {...(RECORD_TYPES[s.tipo] || { label: s.tipo, color: 'bg-gray-100 text-gray-600' })} />
                  </td>
                  <td className="table-cell text-sm">{s.estado || '—'}</td>
                  <td className="table-cell">
                    {s.centro_costo_codigo ? (
                      <div>
                        <span className="font-mono text-xs bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">{s.centro_costo_codigo}</span>
                        <div className="text-xs text-gray-500 mt-0.5 max-w-36 truncate">{s.centro_costo_nombre}</div>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm">{s.centro_costos || '—'}</span>
                    )}
                  </td>
                  <td className="table-cell text-xs text-gray-500 max-w-48 truncate">{s.direccion || '—'}</td>
                  <td className="table-cell">
                    <div className="flex gap-1">
                      <Link to={`/expedientes?tipo=sucursal&id=${s.id}`} className="p-1.5 rounded text-gray-400 hover:text-emerald-600 hover:bg-emerald-50" title="Ver expediente">
                        <FolderOpenIcon className="h-4 w-4" />
                      </Link>
                      {canEdit() && <button onClick={() => openEdit(s)} className="p-1.5 rounded text-gray-400 hover:text-primary-600 hover:bg-primary-50"><PencilIcon className="h-4 w-4" /></button>}
                      {isAdmin() && <button onClick={() => setDeleteId(s.id)} className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"><TrashIcon className="h-4 w-4" /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination {...pagination} onPageChange={load} />
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Editar Sucursal' : 'Agregar Sucursal'} size="lg">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Nombre *</label>
              <input className="input" required value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
            </div>
            <div>
              <label className="label">Tipo *</label>
              <select className="input" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                <option value="sucursal">Sucursal</option>
                <option value="corporativo">Corporativo</option>
              </select>
            </div>
            <div>
              <label className="label">Estado</label>
              <select className="input" value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}>
                <option value="">Seleccionar...</option>
                {ESTADOS_MX.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Dirección</label>
              <input className="input" value={form.direccion} onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="label">Centro de Costos</label>
              <CentroCostoSearch
                value={form.centro_costo_codigo}
                nombre={form.centro_costo_nombre}
                onChange={(codigo, nombre) => setForm(f => ({ ...f, centro_costo_codigo: codigo, centro_costo_nombre: nombre, centro_costos: codigo }))}
              />
            </div>
            <div>
              <label className="label">Latitud</label>
              <input type="number" step="any" className="input" placeholder="19.4326" value={form.lat} onChange={e => setForm(f => ({ ...f, lat: e.target.value }))} />
            </div>
            <div>
              <label className="label">Longitud</label>
              <input type="number" step="any" className="input" placeholder="-99.1332" value={form.lng} onChange={e => setForm(f => ({ ...f, lng: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Agregar'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => handleDelete(deleteId)} title="Eliminar sucursal" message="¿Estás seguro de que deseas eliminar esta sucursal?" />

      {/* Modal importar CSV */}
      <Modal open={csvModal} onClose={() => setCsvModal(false)} title="Importar Sucursales desde CSV" size="md">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-600">Sube un archivo CSV con los datos de sucursales.</p>
            <button className="btn-secondary text-xs py-1.5" onClick={downloadCsvTemplate}><ArrowDownTrayIcon className="h-4 w-4" /> Descargar plantilla</button>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500">
            <strong>Columnas requeridas:</strong> nombre, tipo<br />
            <strong>Columnas opcionales:</strong> direccion, estado, lat, lng
          </div>
          <form onSubmit={handleCsvImport} className="space-y-3">
            <input ref={csvFileRef} type="file" accept=".csv" className="input" required />
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setCsvModal(false)}>Cancelar</button>
              <button type="submit" className="btn-primary" disabled={csvImporting}>{csvImporting ? 'Importando...' : 'Importar'}</button>
            </div>
          </form>
          {csvResult && (
            <div className={`rounded-lg p-3 text-sm ${csvResult.error ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-green-50 border border-green-200 text-green-800'}`}>
              {csvResult.error ? csvResult.error : (
                <>
                  <div className="font-semibold mb-1">Resultado:</div>
                  <div>Creadas: <strong>{csvResult.creados}</strong></div>
                  <div>Errores: <strong>{csvResult.errores}</strong></div>
                  {csvResult.detalle?.errores?.length > 0 && (
                    <div className="mt-2 text-xs text-red-600">{csvResult.detalle.errores.map((e, i) => <div key={i}>Línea {e.linea}: {e.error}</div>)}</div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
