import { useState, useEffect, useCallback, useRef } from 'react'
import { empleadoAPI, sucursalAPI, centroCostoAPI, catalogosAPI } from '../utils/api'
import { useAuth } from '../context/AuthContext'
import { useNotification } from '../context/NotificationContext'
import Modal from '../components/Modal'
import Pagination from '../components/Pagination'
import ConfirmDialog from '../components/ConfirmDialog'
import { PlusIcon, MagnifyingGlassIcon, PencilIcon, TrashIcon, FolderOpenIcon, XMarkIcon, ArrowUpTrayIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline'
import { Link } from 'react-router-dom'

const EMPTY = {
  nombre_completo: '', num_empleado: '', puesto: '', area: '',
  centro_costos: '', centro_costo_codigo: '', centro_costo_nombre: '',
  jefe_nombre: '', sucursal_id: '', email: '', telefono: ''
}

// Componente de búsqueda de Centro de Costos
function CentroCostoSearch({ value, nombre, onChange }) {
  const [query, setQuery] = useState(nombre || '')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const ref = useRef(null)

  useEffect(() => { setQuery(nombre || '') }, [nombre])

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const search = useCallback(async (q) => {
    if (!q || q.length < 1) { setResults([]); setOpen(false); return }
    setLoading(true)
    try {
      const data = await centroCostoAPI.search(q)
      setResults(data)
      setOpen(data.length > 0)
    } catch (_) {}
    finally { setLoading(false) }
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

  const handleClear = () => {
    setQuery(''); onChange('', ''); setOpen(false); setResults([])
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
          <button type="button" onClick={handleClear}
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
          {loading && <div className="px-3 py-2 text-xs text-gray-400">Buscando...</div>}
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

export default function Empleados() {
  const { canEdit, isAdmin } = useAuth()
  const { showError } = useNotification()
  const [empleados, setEmpleados] = useState([])
  const [sucursales, setSucursales]   = useState([])
  const [catPuestos, setCatPuestos]   = useState([])
  const [catAreas, setCatAreas]       = useState([])
  const [catSupervisores, setCatSupervisores] = useState([])
  // Buscador de sucursal
  const [sucursalQuery, setSucursalQuery]   = useState('')
  const [showSucursalDrop, setShowSucursalDrop] = useState(false)
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
    empleadoAPI.getAll(params).then(d => {
      setEmpleados(d.data)
      setPagination({ page: d.page, pages: Math.ceil(d.total / 20), total: d.total, limit: 20 })
    }).finally(() => setLoading(false))
  }, [search])

  useEffect(() => { load(1) }, [load])
  useEffect(() => {
    sucursalAPI.getAll({ limit: 300 }).then(d => setSucursales(d.data))
    catalogosAPI.puestos.getAll().then(setCatPuestos).catch(() => {})
    catalogosAPI.areas.getAll().then(setCatAreas).catch(() => {})
    catalogosAPI.supervisores.getAll().then(setCatSupervisores).catch(() => {})
  }, [])

  const openCreate = () => {
    setEditing(null); setForm(EMPTY); setSucursalQuery(''); setModal(true)
  }
  const openEdit = (e) => {
    setEditing(e)
    setForm({
      nombre_completo: e.nombre_completo, num_empleado: e.num_empleado,
      puesto: e.puesto || '', area: e.area || '',
      centro_costos: e.centro_costos || '',
      centro_costo_codigo: e.centro_costo_codigo || '',
      centro_costo_nombre: e.centro_costo_nombre || '',
      jefe_nombre: e.jefe_nombre || '', sucursal_id: e.sucursal_id || '',
      sucursal_nombre: e.sucursal_nombre || '',
      email: e.email || '', telefono: e.telefono || ''
    })
    // Precargar texto del buscador de sucursal
    const suc = sucursales.find(s => s.id === e.sucursal_id)
    setSucursalQuery(suc ? suc.nombre : (e.sucursal_nombre || ''))
    setModal(true)
  }

  const handleSave = async (ev) => {
    ev.preventDefault()
    setSaving(true)
    try {
      if (editing) await empleadoAPI.update(editing.id, form)
      else await empleadoAPI.create(form)
      setModal(false)
      load(1)
    } catch (err) { showError(err?.message || 'Error al guardar') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    try {
      await empleadoAPI.delete(id)
      load(pagination.page)
      // Nota: la eliminación es un "soft delete" — el empleado se marca como
      // inactivo (activo=0) en la base de datos pero el registro se conserva
      // para mantener el historial de documentos y asignaciones.
    } catch (err) { showError(err?.message || 'Error') }
  }

  const downloadCsvTemplate = () => {
    const header = 'num_empleado,nombre_completo,puesto,area,email,telefono,sucursal_nombre'
    const sample = 'EMP-0100,María López García,Analista,Finanzas,m.lopez@empresa.com,5512345678,Corporativo Central'
    const blob = new Blob([header + '\n' + sample], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'plantilla_empleados.csv'; a.click()
  }

  const handleCsvImport = async (e) => {
    e.preventDefault()
    const file = csvFileRef.current?.files[0]
    if (!file) return
    setCsvImporting(true); setCsvResult(null)
    try {
      const fd = new FormData(); fd.append('archivo', file)
      const result = await empleadoAPI.importarCSV(fd)
      setCsvResult(result)
      load(1)
    } catch (err) { setCsvResult({ error: err?.message || 'Error al importar' }) }
    finally { setCsvImporting(false) }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Empleados</h1>
          <p className="text-sm text-gray-500 mt-0.5">Registro de empleados y sus asignaciones</p>
        </div>
        <div className="flex gap-2">
          {canEdit() && <button className="btn-secondary" onClick={() => { setCsvResult(null); setCsvModal(true) }}><ArrowUpTrayIcon className="h-4 w-4" /> Importar CSV</button>}
          {canEdit() && <button className="btn-primary" onClick={openCreate}><PlusIcon className="h-4 w-4" /> Agregar Empleado</button>}
        </div>
      </div>

      <div className="card p-4">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input type="text" className="input pl-9" placeholder="Buscar por nombre, número o puesto..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="table-header">Empleado</th>
                <th className="table-header">Puesto / Área</th>
                <th className="table-header">Centro de Costos</th>
                <th className="table-header">Jefe Inmediato</th>
                <th className="table-header">Sucursal</th>
                <th className="table-header">Contacto</th>
                <th className="table-header">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={7} className="py-12 text-center"><div className="inline-block animate-spin rounded-full h-6 w-6 border-4 border-primary-600 border-t-transparent" /></td></tr>
              ) : empleados.length === 0 ? (
                <tr><td colSpan={7} className="py-12 text-center text-gray-400">No se encontraron empleados</td></tr>
              ) : empleados.map(e => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="table-cell">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-semibold text-sm flex-shrink-0">
                        {e.nombre_completo?.charAt(0)}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{e.nombre_completo}</div>
                        <div className="text-xs text-gray-400">{e.num_empleado}</div>
                      </div>
                    </div>
                  </td>
                  <td className="table-cell">
                    <div className="text-sm">{e.puesto}</div>
                    <div className="text-xs text-gray-400">{e.area}</div>
                  </td>
                  <td className="table-cell">
                    {e.centro_costo_codigo ? (
                      <div>
                        <span className="font-mono text-xs bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">{e.centro_costo_codigo}</span>
                        <div className="text-xs text-gray-500 mt-0.5 max-w-36 truncate">{e.centro_costo_nombre}</div>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm">{e.centro_costos || '—'}</span>
                    )}
                  </td>
                  <td className="table-cell text-sm">{e.jefe_nombre || '—'}</td>
                  <td className="table-cell text-sm">{e.sucursal_nombre || '—'}</td>
                  <td className="table-cell">
                    <div className="text-xs">{e.email}</div>
                    <div className="text-xs text-gray-400">{e.telefono}</div>
                  </td>
                  <td className="table-cell">
                    <div className="flex gap-1">
                      <Link to={`/expedientes?tipo=empleado&id=${e.id}`} className="p-1.5 rounded text-gray-400 hover:text-emerald-600 hover:bg-emerald-50" title="Ver expediente">
                        <FolderOpenIcon className="h-4 w-4" />
                      </Link>
                      {canEdit() && <button onClick={() => openEdit(e)} className="p-1.5 rounded text-gray-400 hover:text-primary-600 hover:bg-primary-50"><PencilIcon className="h-4 w-4" /></button>}
                      {isAdmin() && <button onClick={() => setDeleteId(e.id)} className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"><TrashIcon className="h-4 w-4" /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination {...pagination} onPageChange={load} />
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Editar Empleado' : 'Agregar Empleado'} size="lg">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Nombre completo *</label>
              <input className="input" required value={form.nombre_completo} onChange={e => setForm(f => ({ ...f, nombre_completo: e.target.value }))} />
            </div>
            <div>
              <label className="label">Número de empleado *</label>
              <input className="input" required placeholder="EMP-001" value={form.num_empleado} onChange={e => setForm(f => ({ ...f, num_empleado: e.target.value }))} />
            </div>
            {/* Puesto — dropdown del catálogo */}
            <div>
              <label className="label">Puesto</label>
              <select className="input" value={form.puesto} onChange={e => setForm(f => ({ ...f, puesto: e.target.value }))}>
                <option value="">Sin puesto</option>
                {catPuestos.map(p => <option key={p.id} value={p.nombre}>{p.nombre}</option>)}
                {form.puesto && !catPuestos.some(p => p.nombre === form.puesto) && (
                  <option value={form.puesto}>{form.puesto} (actual)</option>
                )}
              </select>
            </div>
            {/* Área — dropdown del catálogo */}
            <div>
              <label className="label">Área</label>
              <select className="input" value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value }))}>
                <option value="">Sin área</option>
                {catAreas.map(a => <option key={a.id} value={a.nombre}>{a.nombre}</option>)}
                {form.area && !catAreas.some(a => a.nombre === form.area) && (
                  <option value={form.area}>{form.area} (actual)</option>
                )}
              </select>
            </div>
            <div className="col-span-2">
              <label className="label">Centro de Costos</label>
              <CentroCostoSearch
                value={form.centro_costo_codigo}
                nombre={form.centro_costo_nombre || (form.centro_costo_codigo ? `${form.centro_costo_codigo} — ${form.centro_costo_nombre}` : '')}
                onChange={(codigo, nombre) => setForm(f => ({ ...f, centro_costo_codigo: codigo, centro_costo_nombre: nombre, centro_costos: codigo }))}
              />
            </div>
            {/* Jefe inmediato — dropdown del catálogo de supervisores */}
            <div>
              <label className="label">Jefe Inmediato / Supervisor</label>
              <select className="input" value={form.jefe_nombre} onChange={e => setForm(f => ({ ...f, jefe_nombre: e.target.value }))}>
                <option value="">Sin supervisor</option>
                {catSupervisores.map(s => <option key={s.id} value={s.nombre}>{s.nombre}</option>)}
                {form.jefe_nombre && !catSupervisores.some(s => s.nombre === form.jefe_nombre) && (
                  <option value={form.jefe_nombre}>{form.jefe_nombre} (actual)</option>
                )}
              </select>
            </div>
            {/* Sucursal — buscador */}
            <div>
              <label className="label">Sucursal</label>
              <div className="relative">
                <input
                  className="input"
                  placeholder="Buscar sucursal..."
                  value={sucursalQuery}
                  onChange={e => { setSucursalQuery(e.target.value); setShowSucursalDrop(true) }}
                  onFocus={() => setShowSucursalDrop(true)}
                  onBlur={() => setTimeout(() => setShowSucursalDrop(false), 180)}
                />
                {sucursalQuery && (
                  <button type="button" onClick={() => { setSucursalQuery(''); setForm(f => ({ ...f, sucursal_id: '', sucursal_nombre: '' })); setShowSucursalDrop(false) }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-400 text-lg leading-none">×</button>
                )}
                {showSucursalDrop && (
                  <div className="absolute z-50 w-full bg-white border border-gray-200 rounded-xl shadow-xl mt-1 max-h-48 overflow-y-auto">
                    {sucursales
                      .filter(s => !sucursalQuery || s.nombre.toLowerCase().includes(sucursalQuery.toLowerCase()))
                      .slice(0, 20)
                      .map(s => (
                        <div key={s.id} onMouseDown={() => {
                          setForm(f => ({ ...f, sucursal_id: s.id, sucursal_nombre: s.nombre }))
                          setSucursalQuery(s.nombre)
                          setShowSucursalDrop(false)
                        }} className="px-3 py-2 hover:bg-primary-50 cursor-pointer text-sm text-gray-700">
                          {s.nombre}
                        </div>
                      ))}
                    {sucursales.filter(s => !sucursalQuery || s.nombre.toLowerCase().includes(sucursalQuery.toLowerCase())).length === 0 && (
                      <div className="px-3 py-2 text-sm text-gray-400">Sin resultados</div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <label className="label">Teléfono</label>
              <input className="input" value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Agregar'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => handleDelete(deleteId)}
        title="Desactivar empleado"
        message="El empleado será marcado como inactivo (activo = 0) y ya no aparecerá en la plataforma. El registro se conserva en la base de datos para mantener el historial de documentos y asignaciones. ¿Continuar?"
      />

      {/* Modal importar CSV */}
      <Modal open={csvModal} onClose={() => setCsvModal(false)} title="Importar Empleados desde CSV" size="md">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-600">Sube un archivo CSV con los datos de empleados.</p>
            <button className="btn-secondary text-xs py-1.5" onClick={downloadCsvTemplate}><ArrowDownTrayIcon className="h-4 w-4" /> Descargar plantilla</button>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500">
            <strong>Columnas requeridas:</strong> num_empleado, nombre_completo<br />
            <strong>Columnas opcionales:</strong> puesto, area, email, telefono, sucursal_nombre
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
                  <div>Creados: <strong>{csvResult.creados}</strong></div>
                  <div>Duplicados (omitidos): <strong>{csvResult.duplicados}</strong></div>
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
