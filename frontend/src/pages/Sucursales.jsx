import { useState, useEffect, useCallback, useRef } from 'react'
import { sucursalAPI, centroCostoAPI } from '../utils/api'
import { RECORD_TYPES } from '../utils/constants'
import { useAuth } from '../context/AuthContext'
import { useNotification } from '../context/NotificationContext'
import Modal from '../components/Modal'
import Pagination from '../components/Pagination'
import ConfirmDialog from '../components/ConfirmDialog'
import Badge from '../components/Badge'
import { PlusIcon, MagnifyingGlassIcon, PencilIcon, TrashIcon, FolderOpenIcon, MapPinIcon, XMarkIcon, ArrowUpTrayIcon, ArrowDownTrayIcon, AdjustmentsHorizontalIcon, CameraIcon } from '@heroicons/react/24/outline'
import PageHeader from '../components/PageHeader'
import { Link } from 'react-router-dom'

const EMPTY = { nombre: '', tipo: 'sucursal', direccion: '', estado: '', lat: '', lng: '', email: '', centro_costos: '', centro_costo_codigo: '', centro_costo_nombre: '', determinante: '' }

const ESTADOS_MX = ['Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche', 'Chiapas', 'Chihuahua', 'Ciudad de México', 'Coahuila', 'Colima', 'Durango', 'Guanajuato', 'Guerrero', 'Hidalgo', 'Jalisco', 'Estado de México', 'Michoacán', 'Morelos', 'Nayarit', 'Nuevo León', 'Oaxaca', 'Puebla', 'Querétaro', 'Quintana Roo', 'San Luis Potosí', 'Sinaloa', 'Sonora', 'Tabasco', 'Tamaulipas', 'Tlaxcala', 'Veracruz', 'Yucatán', 'Zacatecas']

const COL_LABELS = {
  tipo: 'Tipo',
  estado: 'Estado',
  determinante: 'Determinante',
  correo: 'Correo',
  centro_costos: 'Centro de Costos',
  direccion: 'Dirección'
}

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

  // Filtros (server-side)
  const [filterTipo, setFilterTipo] = useState('')
  const [filterEstado, setFilterEstado] = useState('')
  const [filterDeterminante, setFilterDeterminante] = useState('')
  const [filterEmail, setFilterEmail] = useState('')
  const [filterCentroCostos, setFilterCentroCostos] = useState('')
  const [filterDireccion, setFilterDireccion] = useState('')
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)

  // Foto
  const [fotoFile, setFotoFile] = useState(null)
  const [fotoPreview, setFotoPreview] = useState(null)
  const [fotoUploading, setFotoUploading] = useState(false)
  const fotoInputRef = useRef(null)

  // Sorting
  const [sortCol, setSortCol] = useState('')
  const [sortDir, setSortDir] = useState('asc')

  // Columnas visibles
  const colsMenuRef = useRef(null)
  const [colsMenuOpen, setColsMenuOpen] = useState(false)
  const [visibleCols, setVisibleCols] = useState({ tipo: true, estado: true, determinante: true, correo: true, centro_costos: true, direccion: true })

  // Resize columnas
  const resizingRef = useRef(null)
  const [colWidths, setColWidths] = useState({})

  useEffect(() => {
    const h = (e) => { if (colsMenuRef.current && !colsMenuRef.current.contains(e.target)) setColsMenuOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const startResize = (colKey, e) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = e.currentTarget.parentElement.offsetWidth
    resizingRef.current = { colKey, startX, startWidth }
    const onMove = (ev) => {
      if (!resizingRef.current) return
      const diff = ev.clientX - resizingRef.current.startX
      setColWidths(w => ({ ...w, [resizingRef.current.colKey]: Math.max(60, resizingRef.current.startWidth + diff) }))
    }
    const onUp = () => { resizingRef.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const load = useCallback((page = 1) => {
    setLoading(true)
    const params = { page, limit: 20 }
    if (search) params.search = search
    if (filterTipo) params.tipo = filterTipo
    if (filterEstado) params.estado = filterEstado
    if (filterDeterminante) params.determinante = filterDeterminante
    if (filterEmail) params.email = filterEmail
    if (filterCentroCostos) params.centro_costos = filterCentroCostos
    if (filterDireccion) params.direccion = filterDireccion
    sucursalAPI.getAll(params).then(d => {
      setSucursales(d.data)
      setPagination({ page: d.page, pages: d.pages || Math.ceil(d.total / 20), total: d.total, limit: 20 })
    }).finally(() => setLoading(false))
  }, [search, filterTipo, filterEstado, filterDeterminante, filterEmail, filterCentroCostos, filterDireccion])

  useEffect(() => { load(1) }, [load])

  // Sorting en cliente (filtros son server-side)
  const displayData = [...sucursales]
    .sort((a, b) => {
      if (!sortCol) return 0
      const va = (a[sortCol] || '').toString().toLowerCase()
      const vb = (b[sortCol] || '').toString().toLowerCase()
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
    })

  const sortIcon = (col) => sortCol === col ? (sortDir === 'asc' ? '▲' : '▼') : <span className="text-gray-300">⇅</span>

  const openCreate = () => {
    setEditing(null); setForm(EMPTY)
    setFotoFile(null); setFotoPreview(null)
    setModal(true)
  }
  const openEdit = (s) => {
    setEditing(s)
    setFotoFile(null); setFotoPreview(s.foto_url || null)
    setForm({
      nombre: s.nombre, tipo: s.tipo, direccion: s.direccion || '',
      estado: s.estado || '', lat: s.lat || '', lng: s.lng || '',
      centro_costos: s.centro_costos || '',
      centro_costo_codigo: s.centro_costo_codigo || '',
      centro_costo_nombre: s.centro_costo_nombre || '',
      determinante: s.determinante ?? '',
      email: s.email || ''
    })
    setModal(true)
  }

  const handleSave = async (ev) => {
    ev.preventDefault()
    setSaving(true)
    try {
      let saved
      if (editing) saved = await sucursalAPI.update(editing.id, form)
      else saved = await sucursalAPI.create(form)

      // Upload foto if selected
      if (fotoFile && saved?.id) {
        setFotoUploading(true)
        try {
          const fd = new FormData()
          fd.append('foto', fotoFile)
          await sucursalAPI.uploadFoto(saved.id, fd)
        } catch (fotoErr) {
          showError('Sucursal guardada, pero error al subir foto: ' + (fotoErr?.message || ''))
        } finally { setFotoUploading(false) }
      }

      setModal(false)
      load(editing ? pagination.page : 1)
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

  const colSpan = 2 + Object.values(visibleCols).filter(Boolean).length

  return (
    <div className="space-y-5">
      <PageHeader title="Sucursales" subtitle="Corporativo y sucursales de la empresa">
        {canEdit() && <button className="btn-secondary" onClick={() => { setCsvResult(null); setCsvModal(true) }}><ArrowUpTrayIcon className="h-4 w-4" /> Importar CSV</button>}
        {canEdit() && <button className="btn-primary" onClick={openCreate}><PlusIcon className="h-4 w-4" /> Agregar Sucursal</button>}
      </PageHeader>

      <div className="card p-4 space-y-3">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input type="text" className="input pl-9" placeholder="Buscar por nombre, estado, dirección..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="input w-40" value={filterTipo} onChange={e => setFilterTipo(e.target.value)}>
            <option value="">Todos los tipos</option>
            <option value="sucursal">Sucursal</option>
            <option value="corporativo">Corporativo</option>
          </select>
          <select className="input w-44" value={filterEstado} onChange={e => setFilterEstado(e.target.value)}>
            <option value="">Todos los estados</option>
            {ESTADOS_MX.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
          {/* Toggle filtros avanzados */}
          <button
            className={`btn-secondary text-xs ${showAdvancedFilters ? 'bg-primary-50 border-primary-300 text-primary-700' : ''}`}
            onClick={() => setShowAdvancedFilters(v => !v)}
          >
            <AdjustmentsHorizontalIcon className="h-4 w-4" />
            Más filtros {showAdvancedFilters ? '▲' : '▼'}
          </button>
          <div ref={colsMenuRef} className="relative">
            <button className="btn-secondary" onClick={() => setColsMenuOpen(o => !o)}>
              <AdjustmentsHorizontalIcon className="h-4 w-4" /> Columnas
            </button>
            {colsMenuOpen && (
              <div className="absolute right-0 mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-xl p-2 min-w-40">
                {Object.entries(COL_LABELS).map(([k, label]) => (
                  <label key={k} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded-lg cursor-pointer text-sm">
                    <input type="checkbox" checked={visibleCols[k]}
                      onChange={() => setVisibleCols(v => ({ ...v, [k]: !v[k] }))} className="rounded" />
                    {label}
                  </label>
                ))}
              </div>
            )}
          </div>
          {(filterTipo || filterEstado || filterDeterminante || filterEmail || filterCentroCostos || filterDireccion) && (
            <button className="btn-secondary text-xs py-1.5 text-red-500 border-red-200" onClick={() => { setFilterTipo(''); setFilterEstado(''); setFilterDeterminante(''); setFilterEmail(''); setFilterCentroCostos(''); setFilterDireccion('') }}>
              <XMarkIcon className="h-4 w-4" /> Limpiar
            </button>
          )}
        </div>

        {/* Filtros avanzados por campo */}
        {showAdvancedFilters && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-gray-100">
            <div>
              <label className="block text-xs text-gray-500 mb-1 font-medium">Determinante</label>
              <input
                type="text" className="input text-sm py-1.5"
                placeholder="1234..."
                value={filterDeterminante}
                onChange={e => setFilterDeterminante(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1 font-medium">Correo</label>
              <input
                type="text" className="input text-sm py-1.5"
                placeholder="correo@empresa.com"
                value={filterEmail}
                onChange={e => setFilterEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1 font-medium">Centro de Costos</label>
              <input
                type="text" className="input text-sm py-1.5"
                placeholder="Código o nombre..."
                value={filterCentroCostos}
                onChange={e => setFilterCentroCostos(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1 font-medium">Dirección</label>
              <input
                type="text" className="input text-sm py-1.5"
                placeholder="Calle, colonia..."
                value={filterDireccion}
                onChange={e => setFilterDireccion(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th
                  className="table-header cursor-pointer select-none hover:bg-gray-100"
                  style={{ width: colWidths['nombre'] || 'auto', position: 'relative', minWidth: 120 }}
                  onClick={() => handleSort('nombre')}
                >
                  <div className="flex items-center gap-1">Nombre {sortIcon('nombre')}</div>
                  <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-blue-400 transition-colors"
                    onMouseDown={e => startResize('nombre', e)} />
                </th>
                {visibleCols.tipo && (
                  <th
                    className="table-header cursor-pointer select-none hover:bg-gray-100"
                    style={{ width: colWidths['tipo'] || 'auto', position: 'relative', minWidth: 80 }}
                    onClick={() => handleSort('tipo')}
                  >
                    <div className="flex items-center gap-1">Tipo {sortIcon('tipo')}</div>
                    <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-blue-400 transition-colors"
                      onMouseDown={e => startResize('tipo', e)} />
                  </th>
                )}
                {visibleCols.estado && (
                  <th
                    className="table-header cursor-pointer select-none hover:bg-gray-100"
                    style={{ width: colWidths['estado'] || 'auto', position: 'relative', minWidth: 80 }}
                    onClick={() => handleSort('estado')}
                  >
                    <div className="flex items-center gap-1">Estado {sortIcon('estado')}</div>
                    <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-blue-400 transition-colors"
                      onMouseDown={e => startResize('estado', e)} />
                  </th>
                )}
                {visibleCols.determinante && (
                  <th
                    className="table-header text-right"
                    style={{ width: colWidths['determinante'] || 'auto', position: 'relative', minWidth: 80 }}
                  >
                    Determinante
                    <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-blue-400 transition-colors"
                      onMouseDown={e => startResize('determinante', e)} />
                  </th>
                )}
                {visibleCols.correo && (
                  <th
                    className="table-header"
                    style={{ width: colWidths['correo'] || 'auto', position: 'relative', minWidth: 80 }}
                  >
                    Correo
                    <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-blue-400 transition-colors"
                      onMouseDown={e => startResize('correo', e)} />
                  </th>
                )}
                {visibleCols.centro_costos && (
                  <th
                    className="table-header"
                    style={{ width: colWidths['centro_costos'] || 'auto', position: 'relative', minWidth: 100 }}
                  >
                    Centro de Costos
                    <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-blue-400 transition-colors"
                      onMouseDown={e => startResize('centro_costos', e)} />
                  </th>
                )}
                {visibleCols.direccion && (
                  <th
                    className="table-header"
                    style={{ width: colWidths['direccion'] || 'auto', position: 'relative', minWidth: 100 }}
                  >
                    Dirección
                    <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-blue-400 transition-colors"
                      onMouseDown={e => startResize('direccion', e)} />
                  </th>
                )}
                <th className="table-header">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={colSpan} className="py-12 text-center"><div className="inline-block animate-spin rounded-full h-6 w-6 border-4 border-primary-600 border-t-transparent" /></td></tr>
              ) : displayData.length === 0 ? (
                <tr><td colSpan={colSpan} className="py-12 text-center text-gray-400">No se encontraron sucursales</td></tr>
              ) : displayData.map(s => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="table-cell">
                    <div className="flex items-center gap-2">
                      {s.foto_url
                        ? <img src={s.foto_url} alt={s.nombre} className="h-8 w-8 rounded-lg object-cover flex-shrink-0 border border-gray-200" />
                        : <div className="h-8 w-8 bg-teal-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <MapPinIcon className="h-4 w-4 text-teal-600" />
                          </div>
                      }
                      <span className="font-medium">{s.nombre}</span>
                    </div>
                  </td>
                  {visibleCols.tipo && (
                    <td className="table-cell">
                      <Badge {...(RECORD_TYPES[s.tipo] || { label: s.tipo, color: 'bg-gray-100 text-gray-600' })} />
                    </td>
                  )}
                  {visibleCols.estado && (
                    <td className="table-cell text-sm">{s.estado || '—'}</td>
                  )}
                  {visibleCols.determinante && (
                    <td className="table-cell text-right font-mono text-sm">
                      {s.determinante != null && s.determinante !== '' ? s.determinante : <span className="text-gray-300">—</span>}
                    </td>
                  )}
                  {visibleCols.correo && (
                    <td className="table-cell text-xs text-gray-500">{s.email || <span className="text-gray-300">—</span>}</td>
                  )}
                  {visibleCols.centro_costos && (
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
                  )}
                  {visibleCols.direccion && (
                    <td className="table-cell text-xs text-gray-500 max-w-48 truncate">{s.direccion || '—'}</td>
                  )}
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
          {/* Foto de sucursal */}
          <div className="flex items-center gap-4 pb-3 border-b border-gray-100">
            <div className="relative group">
              {fotoPreview
                ? <img src={fotoPreview} alt="Foto" className="h-16 w-16 rounded-xl object-cover border-2 border-primary-200" />
                : <div className="h-16 w-16 rounded-xl bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-xl border-2 border-primary-200">{form.nombre?.charAt(0) || '?'}</div>
              }
              <button type="button"
                onClick={() => fotoInputRef.current?.click()}
                className="absolute inset-0 rounded-xl bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer">
                <CameraIcon className="h-5 w-5 text-white" />
              </button>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Foto de sucursal</p>
              <p className="text-xs text-gray-400 mt-0.5">Se guardará en S3 / Sucursales</p>
              <button type="button" onClick={() => fotoInputRef.current?.click()}
                className="mt-1 text-xs text-primary-600 hover:text-primary-800 font-medium">
                {fotoPreview ? 'Cambiar foto' : 'Subir foto'}
              </button>
            </div>
            <input ref={fotoInputRef} type="file" accept="image/*" className="hidden"
              onChange={e => {
                const file = e.target.files?.[0]
                if (!file) return
                setFotoFile(file)
                const reader = new FileReader()
                reader.onload = ev => setFotoPreview(ev.target.result)
                reader.readAsDataURL(file)
              }} />
          </div>
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
            <div>
              <label className="label">Determinante</label>
              <input
                type="number"
                className="input"
                placeholder="Ej. 1234"
                value={form.determinante}
                onChange={e => setForm(f => ({ ...f, determinante: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Correo electrónico</label>
              <input
                type="email"
                className="input"
                placeholder="sucursal@empresa.com"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              />
              <p className="text-xs text-gray-400 mt-0.5">Se asignará automáticamente a los empleados de esta sucursal</p>
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
