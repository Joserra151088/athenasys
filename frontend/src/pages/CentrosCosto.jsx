import { useState, useEffect, useCallback, useRef } from 'react'
import {
  TagIcon, MagnifyingGlassIcon, PlusIcon, PencilSquareIcon,
  ArrowUpTrayIcon, CheckCircleIcon, XMarkIcon, ExclamationTriangleIcon
} from '@heroicons/react/24/outline'
import { centroCostoAPI } from '../utils/api'

const LIMIT = 50

// ── CSV parser simple ──────────────────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []
  const header = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'))
  return lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
    const obj = {}
    header.forEach((h, i) => { obj[h] = vals[i] || '' })
    return obj
  }).filter(r => r.codigo || r.code)
    .map(r => ({
      codigo:      r.codigo || r.code || '',
      sort_code:   r.sort_code || r.sortcode || r['sort code'] || '',
      nombre:      r.nombre || r.name || r.descripcion || r.description || '',
      valido_desde: r.valido_desde || r.valid_from || r.fecha || '',
    }))
}

export default function CentrosCosto() {
  const [items,    setItems]    = useState([])
  const [total,    setTotal]    = useState(0)
  const [loading,  setLoading]  = useState(true)
  const [q,        setQ]        = useState('')
  const [page,     setPage]     = useState(1)
  const [showInac, setShowInac] = useState(false)

  // Modal agregar/editar
  const [modal,    setModal]    = useState(null)  // null | 'new' | 'edit'
  const [form,     setForm]     = useState({ codigo: '', sort_code: '', nombre: '', valido_desde: '' })
  const [saving,   setSaving]   = useState(false)
  const [formErr,  setFormErr]  = useState('')

  // Modal importar
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')
  const [importResult, setImportResult] = useState(null)  // { nuevo, actualizado, sin_cambios, detalle }
  const [importLoading, setImportLoading] = useState(false)
  const [importApplied, setImportApplied] = useState(false)
  const fileRef = useRef(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { q, page, limit: LIMIT }
      if (!showInac) params.activo = true
      const res = await centroCostoAPI.getAll(params)
      setItems(res.data || [])
      setTotal(res.total || 0)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [q, page, showInac])

  useEffect(() => { setPage(1) }, [q, showInac])
  useEffect(() => { load() }, [load])

  const totalPages = Math.ceil(total / LIMIT)

  // ── CRUD ────────────────────────────────────────────────────────────────────
  const openNew = () => {
    setForm({ codigo: '', sort_code: '', nombre: '', valido_desde: '' })
    setFormErr('')
    setModal('new')
  }

  const openEdit = (cc) => {
    setForm({
      id: cc.id,
      codigo: cc.codigo || '',
      sort_code: cc.sort_code || '',
      nombre: cc.nombre || '',
      valido_desde: cc.valido_desde ? cc.valido_desde.slice(0, 10) : ''
    })
    setFormErr('')
    setModal('edit')
  }

  const handleSave = async () => {
    if (!form.codigo.trim() || !form.nombre.trim()) { setFormErr('Código y nombre son requeridos'); return }
    setSaving(true)
    setFormErr('')
    try {
      if (modal === 'new') await centroCostoAPI.create(form)
      else await centroCostoAPI.update(form.id, form)
      setModal(null)
      load()
    } catch (e) { setFormErr(e?.response?.data?.message || e?.message || 'Error al guardar') }
    finally { setSaving(false) }
  }

  const handleToggleActivo = async (cc) => {
    try {
      if (cc.activo) await centroCostoAPI.remove(cc.id)
      else await centroCostoAPI.activate(cc.id)
      load()
    } catch (e) { alert(e?.response?.data?.message || 'Error') }
  }

  // ── Import ──────────────────────────────────────────────────────────────────
  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setImportText(ev.target.result)
    reader.readAsText(file, 'utf-8')
  }

  const handleAnalizar = async () => {
    const rows = parseCSV(importText)
    if (!rows.length) { alert('No se encontraron filas válidas. Verifica el formato del archivo.'); return }
    setImportLoading(true)
    setImportApplied(false)
    try {
      const res = await centroCostoAPI.importCompare(rows, false)
      setImportResult(res)
    } catch (e) { alert(e?.response?.data?.message || 'Error al analizar') }
    finally { setImportLoading(false) }
  }

  const handleAplicar = async () => {
    const rows = parseCSV(importText)
    setImportLoading(true)
    try {
      const res = await centroCostoAPI.importCompare(rows, true)
      setImportResult(res)
      setImportApplied(true)
      load()
    } catch (e) { alert(e?.response?.data?.message || 'Error al aplicar') }
    finally { setImportLoading(false) }
  }

  const closeImport = () => {
    setShowImport(false)
    setImportText('')
    setImportResult(null)
    setImportApplied(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Centros de Costo</h1>
          <p className="text-gray-500 text-sm mt-1">
            {total.toLocaleString()} {showInac ? 'registros totales' : 'centros activos'}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)} className="btn-secondary flex items-center gap-1.5 text-sm">
            <ArrowUpTrayIcon className="h-4 w-4" /> Importar archivo
          </button>
          <button onClick={openNew} className="btn-primary flex items-center gap-1.5 text-sm">
            <PlusIcon className="h-4 w-4" /> Nuevo CC
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por código o nombre..."
            value={q}
            onChange={e => setQ(e.target.value)}
            className="input pl-9 w-full"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <input type="checkbox" checked={showInac} onChange={e => setShowInac(e.target.checked)} className="rounded" />
          Mostrar inactivos
        </label>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Código</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Sort Code</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Nombre</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Válido desde</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Estado</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-10 text-gray-400">Cargando...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-gray-400">Sin resultados</td></tr>
              ) : items.map(cc => (
                <tr key={cc.id} className={`hover:bg-gray-50 ${!cc.activo ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <span className="font-mono text-primary-700 font-medium bg-primary-50 px-2 py-0.5 rounded text-xs">
                      {cc.codigo}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{cc.sort_code || '—'}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{cc.nombre}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {cc.valido_desde ? String(cc.valido_desde).slice(0, 10) : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${cc.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {cc.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center gap-1">
                      <button onClick={() => openEdit(cc)} className="p-1 rounded hover:bg-primary-50 text-gray-400 hover:text-primary-600" title="Editar">
                        <PencilSquareIcon className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleToggleActivo(cc)}
                        className={`p-1 rounded text-xs font-medium ${cc.activo ? 'hover:bg-red-50 text-gray-400 hover:text-red-500' : 'hover:bg-green-50 text-gray-400 hover:text-green-600'}`}
                        title={cc.activo ? 'Desactivar' : 'Activar'}
                      >
                        {cc.activo ? <XMarkIcon className="h-3.5 w-3.5" /> : <CheckCircleIcon className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
            <span className="text-sm text-gray-500">Página {page} de {totalPages} · {total.toLocaleString()} registros</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-40">Anterior</button>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-40">Siguiente</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Modal Nuevo/Editar ─────────────────────────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="font-semibold text-gray-900">{modal === 'new' ? 'Nuevo Centro de Costo' : 'Editar Centro de Costo'}</h3>
              <button onClick={() => setModal(null)} className="p-1 rounded hover:bg-gray-100"><XMarkIcon className="h-5 w-5 text-gray-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label">Código *</label>
                <input className="input" value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))} placeholder="CC-001" />
              </div>
              <div>
                <label className="label">Sort Code</label>
                <input className="input" value={form.sort_code} onChange={e => setForm(f => ({ ...f, sort_code: e.target.value }))} placeholder="SC-001" />
              </div>
              <div>
                <label className="label">Nombre *</label>
                <input className="input" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Descripción del centro de costo" />
              </div>
              <div>
                <label className="label">Válido desde</label>
                <input type="date" className="input" value={form.valido_desde} onChange={e => setForm(f => ({ ...f, valido_desde: e.target.value }))} />
              </div>
              {formErr && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{formErr}</p>}
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
              <button onClick={() => setModal(null)} className="btn-secondary">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Importar ────────────────────────────────────────────────────── */}
      {showImport && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="font-semibold text-gray-900">Importar Centros de Costo</h3>
              <button onClick={closeImport} className="p-1 rounded hover:bg-gray-100"><XMarkIcon className="h-5 w-5 text-gray-500" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Instrucciones */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                <p className="font-medium mb-1">Formato CSV esperado (primera fila = encabezados):</p>
                <code className="text-xs bg-blue-100 px-2 py-1 rounded block">codigo,sort_code,nombre,valido_desde</code>
                <p className="mt-1 text-xs">Los nombres de columna también se aceptan en inglés: code, name, description, valid_from</p>
              </div>

              {/* Upload */}
              <div>
                <label className="label">Cargar archivo CSV</label>
                <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFileChange} className="block w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 cursor-pointer" />
              </div>

              {/* O pegar texto */}
              <div>
                <label className="label">O pegar contenido CSV</label>
                <textarea
                  rows={5}
                  className="input w-full font-mono text-xs resize-y"
                  placeholder={'codigo,sort_code,nombre,valido_desde\nCC-001,SC-001,Tecnologías de la Información,2025-01-01'}
                  value={importText}
                  onChange={e => setImportText(e.target.value)}
                />
              </div>

              <button onClick={handleAnalizar} disabled={!importText.trim() || importLoading} className="btn-secondary w-full">
                {importLoading ? 'Analizando...' : 'Analizar archivo'}
              </button>

              {/* Resultado del análisis */}
              {importResult && (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-center text-sm">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="text-xl font-bold text-green-700">{importResult.nuevo}</div>
                      <div className="text-xs text-green-600">Nuevos</div>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <div className="text-xl font-bold text-amber-700">{importResult.actualizado}</div>
                      <div className="text-xs text-amber-600">Con cambios</div>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <div className="text-xl font-bold text-gray-600">{importResult.sin_cambios}</div>
                      <div className="text-xs text-gray-500">Sin cambios</div>
                    </div>
                  </div>

                  {/* Detalle nuevos */}
                  {importResult.detalle.nuevo.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-600 mb-1">Nuevos a crear ({importResult.detalle.nuevo.length})</p>
                      <div className="max-h-28 overflow-y-auto border rounded text-xs divide-y">
                        {importResult.detalle.nuevo.map((r, i) => (
                          <div key={i} className="px-3 py-1.5 flex gap-2">
                            <span className="font-mono text-primary-700 font-medium">{r.codigo}</span>
                            <span className="text-gray-600">{r.nombre}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Detalle actualizados */}
                  {importResult.detalle.actualizado.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-600 mb-1">Con cambios a actualizar ({importResult.detalle.actualizado.length})</p>
                      <div className="max-h-28 overflow-y-auto border rounded text-xs divide-y">
                        {importResult.detalle.actualizado.map((r, i) => (
                          <div key={i} className="px-3 py-1.5">
                            <span className="font-mono text-primary-700 font-medium">{r.codigo}</span>
                            <span className="text-gray-400 mx-1">→</span>
                            <span className="text-gray-800">{r.nombre}</span>
                            {r.prev_nombre !== r.nombre && (
                              <span className="text-gray-400 ml-1 line-through text-xs">{r.prev_nombre}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {importApplied && (
                    <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-green-700 text-sm">
                      <CheckCircleIcon className="h-5 w-5 flex-shrink-0" />
                      Cambios aplicados correctamente
                    </div>
                  )}

                  {!importApplied && (importResult.nuevo > 0 || importResult.actualizado > 0) && (
                    <button onClick={handleAplicar} disabled={importLoading} className="btn-primary w-full">
                      {importLoading ? 'Aplicando...' : `Aplicar ${importResult.nuevo + importResult.actualizado} cambios`}
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
              <button onClick={closeImport} className="btn-secondary">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
