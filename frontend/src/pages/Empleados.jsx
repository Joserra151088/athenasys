import { useState, useEffect, useCallback, useRef } from 'react'
import { empleadoAPI, sucursalAPI, centroCostoAPI, catalogosAPI, licenciaAPI } from '../utils/api'
import { useAuth } from '../context/AuthContext'
import { useNotification } from '../context/NotificationContext'
import Modal from '../components/Modal'
import Pagination from '../components/Pagination'
import ConfirmDialog from '../components/ConfirmDialog'
import { PlusIcon, MagnifyingGlassIcon, PencilIcon, TrashIcon, FolderOpenIcon, XMarkIcon, ArrowUpTrayIcon, ArrowDownTrayIcon, KeyIcon, AdjustmentsHorizontalIcon, CameraIcon } from '@heroicons/react/24/outline'
import PageHeader from '../components/PageHeader'
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
  // Buscador de sucursal (modal)
  const [sucursalQuery, setSucursalQuery]   = useState('')
  const [showSucursalDrop, setShowSucursalDrop] = useState(false)
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 20 })
  const [search, setSearch] = useState('')
  const [filterSucursal, setFilterSucursal] = useState('')
  const [filterArea, setFilterArea] = useState('')
  const [filterPuesto, setFilterPuesto] = useState('')
  const [filterJefe, setFilterJefe] = useState('')
  const [filterNumEmpleado, setFilterNumEmpleado] = useState('')
  const [filterEmail, setFilterEmail] = useState('')
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [empLicencias, setEmpLicencias] = useState([])
  // Foto
  const [fotoFile, setFotoFile] = useState(null)
  const [fotoPreview, setFotoPreview] = useState(null)
  const [fotoUploading, setFotoUploading] = useState(false)
  const fotoInputRef = useRef(null)
  const [csvModal, setCsvModal] = useState(false)
  const [csvResult, setCsvResult] = useState(null)
  const [csvImporting, setCsvImporting] = useState(false)
  const csvFileRef = useRef(null)

  // Sorting
  const [sortCol, setSortCol] = useState('')
  const [sortDir, setSortDir] = useState('asc')

  // Column visibility
  const [visibleCols, setVisibleCols] = useState({
    empleado: true, puesto: true, centro_costos: true, jefe: true, sucursal: true, contacto: true
  })
  const [colsMenuOpen, setColsMenuOpen] = useState(false)
  const colsMenuRef = useRef(null)

  // Column resize
  const [colWidths, setColWidths] = useState({})
  const resizingRef = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (colsMenuRef.current && !colsMenuRef.current.contains(e.target)) setColsMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
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
      const newWidth = Math.max(60, resizingRef.current.startWidth + diff)
      setColWidths(w => ({ ...w, [resizingRef.current.colKey]: newWidth }))
    }
    const onUp = () => {
      resizingRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const clearFilters = () => {
    setFilterSucursal('')
    setFilterArea('')
    setFilterPuesto('')
    setFilterJefe('')
    setFilterNumEmpleado('')
    setFilterEmail('')
  }

  const hasActiveFilters = filterSucursal || filterArea || filterPuesto || filterJefe || filterNumEmpleado || filterEmail

  const load = useCallback((page = 1) => {
    setLoading(true)
    const params = { page, limit: 20 }
    if (search) params.search = search
    if (filterSucursal) params.sucursal_id = filterSucursal
    if (filterArea) params.area = filterArea
    if (filterPuesto) params.puesto = filterPuesto
    if (filterJefe) params.jefe_nombre = filterJefe
    if (filterNumEmpleado) params.num_empleado = filterNumEmpleado
    if (filterEmail) params.email = filterEmail
    empleadoAPI.getAll(params).then(d => {
      setEmpleados(d.data)
      setPagination({ page: d.page, pages: d.pages || Math.ceil(d.total / 20), total: d.total, limit: 20 })
    }).finally(() => setLoading(false))
  }, [search, filterSucursal, filterArea, filterPuesto, filterJefe, filterNumEmpleado, filterEmail])

  useEffect(() => { load(1) }, [load])
  useEffect(() => {
    sucursalAPI.getAll({ limit: 300 }).then(d => setSucursales(d.data))
    catalogosAPI.puestos.getAll().then(setCatPuestos).catch(() => {})
    catalogosAPI.areas.getAll().then(setCatAreas).catch(() => {})
    catalogosAPI.supervisores.getAll().then(setCatSupervisores).catch(() => {})
  }, [])

  // Client-side sorting only (filters are server-side)
  const sorted = [...empleados]
    .sort((a, b) => {
      if (!sortCol) return 0
      let va = '', vb = ''
      if (sortCol === 'nombre_completo') { va = (a.nombre_completo || '').toLowerCase(); vb = (b.nombre_completo || '').toLowerCase() }
      else if (sortCol === 'puesto') { va = (a.puesto || '').toLowerCase(); vb = (b.puesto || '').toLowerCase() }
      else if (sortCol === 'area') { va = (a.area || '').toLowerCase(); vb = (b.area || '').toLowerCase() }
      else if (sortCol === 'sucursal') { va = (a.sucursal_nombre || '').toLowerCase(); vb = (b.sucursal_nombre || '').toLowerCase() }
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
    })

  const openCreate = () => {
    setEditing(null); setForm(EMPTY); setSucursalQuery(''); setEmpLicencias([])
    setFotoFile(null); setFotoPreview(null)
    setModal(true)
  }
  const openEdit = async (e) => {
    setEditing(e)
    setFotoFile(null); setFotoPreview(e.foto_url || null)
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
    // Cargar licencias activas del empleado
    setEmpLicencias([])
    licenciaAPI.getAsignacionesByEmpleado(e.id)
      .then(setEmpLicencias)
      .catch(() => setEmpLicencias([]))
    setModal(true)
  }

  const handleSave = async (ev) => {
    ev.preventDefault()
    setSaving(true)
    try {
      let saved
      if (editing) saved = await empleadoAPI.update(editing.id, form)
      else saved = await empleadoAPI.create(form)

      // Upload foto if selected
      if (fotoFile && saved?.id) {
        setFotoUploading(true)
        try {
          const fd = new FormData()
          fd.append('foto', fotoFile)
          await empleadoAPI.uploadFoto(saved.id, fd)
        } catch (fotoErr) {
          showError('Empleado guardado, pero error al subir foto: ' + (fotoErr?.message || ''))
        } finally { setFotoUploading(false) }
      }

      setModal(false)
      load(editing ? pagination.page : 1)
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

  const colLabels = {
    empleado: 'Empleado',
    puesto: 'Puesto / Área',
    centro_costos: 'Centro de Costos',
    jefe: 'Jefe Inmediato',
    sucursal: 'Sucursal',
    contacto: 'Contacto',
  }

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return <span className="text-gray-300 ml-1">⇅</span>
    return <span className="text-blue-500 ml-1">{sortDir === 'asc' ? '▲' : '▼'}</span>
  }

  const ResizeHandle = ({ colKey }) => (
    <div
      className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400 opacity-0 hover:opacity-100 transition-opacity"
      onMouseDown={(e) => startResize(colKey, e)}
    />
  )

  return (
    <div className="space-y-5">
      <PageHeader title="Empleados" subtitle="Registro de empleados y sus asignaciones">
        {canEdit() && <button className="btn-secondary" onClick={() => { setCsvResult(null); setCsvModal(true) }}><ArrowUpTrayIcon className="h-4 w-4" /> Importar CSV</button>}
        {canEdit() && <button className="btn-primary" onClick={openCreate}><PlusIcon className="h-4 w-4" /> Agregar Empleado</button>}
      </PageHeader>

      {/* Barra de filtros */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-wrap gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text" className="input pl-9"
              placeholder="Buscar por nombre, número o puesto..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Filtro Sucursal */}
          <select className="input w-44" value={filterSucursal} onChange={e => setFilterSucursal(e.target.value)}>
            <option value="">Todas las sucursales</option>
            {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>

          {/* Filtro Área */}
          <select className="input w-36" value={filterArea} onChange={e => setFilterArea(e.target.value)}>
            <option value="">Todas las áreas</option>
            {catAreas.map(a => <option key={a.id} value={a.nombre}>{a.nombre}</option>)}
          </select>

          {/* Toggle filtros avanzados */}
          <button
            className={`btn-secondary text-xs ${showAdvancedFilters ? 'bg-primary-50 border-primary-300 text-primary-700' : ''}`}
            onClick={() => setShowAdvancedFilters(v => !v)}
          >
            <AdjustmentsHorizontalIcon className="h-4 w-4" />
            Más filtros {showAdvancedFilters ? '▲' : '▼'}
          </button>

          {/* Toggle columnas */}
          <div ref={colsMenuRef} className="relative">
            <button className="btn-secondary" onClick={() => setColsMenuOpen(o => !o)}>
              <AdjustmentsHorizontalIcon className="h-4 w-4" /> Columnas
            </button>
            {colsMenuOpen && (
              <div className="absolute right-0 mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-xl p-2 min-w-44">
                {Object.entries(colLabels).map(([k, label]) => (
                  <label key={k} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded-lg cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={visibleCols[k]}
                      onChange={() => setVisibleCols(v => ({ ...v, [k]: !v[k] }))}
                      className="rounded"
                    />
                    {label}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Limpiar filtros */}
          {hasActiveFilters && (
            <button
              className="btn-secondary text-xs py-1.5 text-red-500 border-red-200 hover:bg-red-50"
              onClick={clearFilters}
            >
              <XMarkIcon className="h-4 w-4" /> Limpiar
            </button>
          )}
        </div>

        {/* Filtros avanzados por campo */}
        {showAdvancedFilters && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-gray-100">
            <div>
              <label className="block text-xs text-gray-500 mb-1 font-medium">Num. Empleado</label>
              <input
                type="text" className="input text-sm py-1.5"
                placeholder="EMP-001..."
                value={filterNumEmpleado}
                onChange={e => setFilterNumEmpleado(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1 font-medium">Puesto</label>
              <input
                type="text" className="input text-sm py-1.5"
                placeholder="Analista, Gerente..."
                value={filterPuesto}
                onChange={e => setFilterPuesto(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1 font-medium">Jefe Inmediato</label>
              <input
                type="text" className="input text-sm py-1.5"
                placeholder="Nombre del jefe..."
                value={filterJefe}
                onChange={e => setFilterJefe(e.target.value)}
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
          </div>
        )}
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {visibleCols.empleado && (
                  <th
                    className="table-header cursor-pointer select-none hover:bg-gray-100 transition-colors"
                    style={{ width: colWidths['empleado'] || 'auto', position: 'relative' }}
                    onClick={() => handleSort('nombre_completo')}
                  >
                    <div className="flex items-center gap-1">
                      Empleado <SortIcon col="nombre_completo" />
                    </div>
                    <ResizeHandle colKey="empleado" />
                  </th>
                )}
                {visibleCols.puesto && (
                  <th
                    className="table-header cursor-pointer select-none hover:bg-gray-100 transition-colors"
                    style={{ width: colWidths['puesto'] || 'auto', position: 'relative' }}
                    onClick={() => handleSort('puesto')}
                  >
                    <div className="flex items-center gap-1">
                      Puesto / Área <SortIcon col="puesto" />
                    </div>
                    <ResizeHandle colKey="puesto" />
                  </th>
                )}
                {visibleCols.centro_costos && (
                  <th
                    className="table-header"
                    style={{ width: colWidths['centro_costos'] || 'auto', position: 'relative' }}
                  >
                    Centro de Costos
                    <ResizeHandle colKey="centro_costos" />
                  </th>
                )}
                {visibleCols.jefe && (
                  <th
                    className="table-header"
                    style={{ width: colWidths['jefe'] || 'auto', position: 'relative' }}
                  >
                    Jefe Inmediato
                    <ResizeHandle colKey="jefe" />
                  </th>
                )}
                {visibleCols.sucursal && (
                  <th
                    className="table-header cursor-pointer select-none hover:bg-gray-100 transition-colors"
                    style={{ width: colWidths['sucursal'] || 'auto', position: 'relative' }}
                    onClick={() => handleSort('sucursal')}
                  >
                    <div className="flex items-center gap-1">
                      Sucursal <SortIcon col="sucursal" />
                    </div>
                    <ResizeHandle colKey="sucursal" />
                  </th>
                )}
                {visibleCols.contacto && (
                  <th
                    className="table-header"
                    style={{ width: colWidths['contacto'] || 'auto', position: 'relative' }}
                  >
                    Contacto
                    <ResizeHandle colKey="contacto" />
                  </th>
                )}
                <th className="table-header" style={{ position: 'relative' }}>
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={7} className="py-12 text-center"><div className="inline-block animate-spin rounded-full h-6 w-6 border-4 border-primary-600 border-t-transparent" /></td></tr>
              ) : sorted.length === 0 ? (
                <tr><td colSpan={7} className="py-12 text-center text-gray-400">No se encontraron empleados</td></tr>
              ) : sorted.map(e => (
                <tr key={e.id} className="hover:bg-gray-50">
                  {visibleCols.empleado && (
                    <td className="table-cell">
                      <div className="flex items-center gap-3">
                        {e.foto_url
                          ? <img src={e.foto_url} alt={e.nombre_completo} className="h-8 w-8 rounded-full object-cover flex-shrink-0 border border-gray-200" />
                          : <div className="h-8 w-8 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-semibold text-sm flex-shrink-0">{e.nombre_completo?.charAt(0)}</div>
                        }
                        <div>
                          <div className="font-medium text-gray-900">{e.nombre_completo}</div>
                          <div className="text-xs text-gray-400">{e.num_empleado}</div>
                        </div>
                      </div>
                    </td>
                  )}
                  {visibleCols.puesto && (
                    <td className="table-cell">
                      <div className="text-sm">{e.puesto}</div>
                      <div className="text-xs text-gray-400">{e.area}</div>
                    </td>
                  )}
                  {visibleCols.centro_costos && (
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
                  )}
                  {visibleCols.jefe && <td className="table-cell text-sm">{e.jefe_nombre || '—'}</td>}
                  {visibleCols.sucursal && <td className="table-cell text-sm">{e.sucursal_nombre || '—'}</td>}
                  {visibleCols.contacto && (
                    <td className="table-cell">
                      <div className="text-xs">{e.email}</div>
                      <div className="text-xs text-gray-400">{e.telefono}</div>
                    </td>
                  )}
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
          {/* Foto de perfil */}
          <div className="flex items-center gap-4 pb-3 border-b border-gray-100">
            <div className="relative group">
              {fotoPreview
                ? <img src={fotoPreview} alt="Foto" className="h-16 w-16 rounded-full object-cover border-2 border-primary-200" />
                : <div className="h-16 w-16 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-xl border-2 border-primary-200">{form.nombre_completo?.charAt(0) || '?'}</div>
              }
              <button type="button"
                onClick={() => fotoInputRef.current?.click()}
                className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer">
                <CameraIcon className="h-5 w-5 text-white" />
              </button>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Foto de perfil</p>
              <p className="text-xs text-gray-400 mt-0.5">Se guardará en S3 / Colaboradores</p>
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
                          setForm(f => ({
                            ...f,
                            sucursal_id: s.id,
                            sucursal_nombre: s.nombre,
                            // Auto-completar email con el de la sucursal si el empleado no tiene uno
                            email: f.email || s.email || f.email
                          }))
                          setSucursalQuery(s.nombre)
                          setShowSucursalDrop(false)
                        }} className="px-3 py-2 hover:bg-primary-50 cursor-pointer text-sm text-gray-700">
                          <div>{s.nombre}</div>
                          {s.email && <div className="text-xs text-gray-400">{s.email}</div>}
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
          {/* Sección inferior — depende del tipo de sucursal del empleado */}
          {editing && (() => {
            const sucEmpleado = sucursales.find(s => s.id === form.sucursal_id)
            const esSucursalNoCorpo = sucEmpleado && sucEmpleado.tipo !== 'corporativo'

            // Empleado de sucursal no corporativa: solo mostrar correo de la sucursal
            if (esSucursalNoCorpo) {
              return sucEmpleado.email ? (
                <div className="border-t border-gray-100 pt-3">
                  <div className="flex items-center gap-2 bg-teal-50 border border-teal-100 rounded-lg px-3 py-2">
                    <span className="text-teal-500">📧</span>
                    <div>
                      <span className="text-xs text-teal-700 font-medium">Correo de sucursal: </span>
                      <span className="text-xs text-teal-800 font-semibold">{sucEmpleado.email}</span>
                      <div className="text-xs text-teal-500 mt-0.5">{sucEmpleado.nombre}</div>
                    </div>
                  </div>
                </div>
              ) : null
            }

            // Empleado de corporativo (o sin sucursal): mostrar licencias individuales
            return (
              <div className="border-t border-gray-100 pt-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Licencias asignadas</span>
                  {empLicencias.length > 0 && (
                    <span className="text-xs text-gray-400">{empLicencias.length} activa{empLicencias.length !== 1 ? 's' : ''}</span>
                  )}
                </div>
                {empLicencias.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">Sin licencias asignadas</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {empLicencias.map(a => (
                      <div key={a.id} className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 text-indigo-700 px-2.5 py-1 rounded-lg text-xs">
                        <KeyIcon className="h-3 w-3 flex-shrink-0" />
                        <span className="font-semibold">{a.licencia?.nombre || a.licencia_nombre}</span>
                        {a.licencia?.tipo && <span className="text-indigo-400">· {a.licencia.tipo}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })()}
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
