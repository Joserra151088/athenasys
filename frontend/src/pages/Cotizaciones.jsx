import { useState, useEffect, useRef } from 'react'
import { cotizacionAPI, exchangeAPI } from '../utils/api'
import { IVA_RATE } from '../utils/constants'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import Pagination from '../components/Pagination'
import { PlusIcon, MagnifyingGlassIcon, EyeIcon, TrashIcon, PrinterIcon, BookmarkIcon, PlusCircleIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

const ESTADO_COLORS = { borrador: 'bg-gray-100 text-gray-600', enviada: 'bg-blue-100 text-blue-700', aceptada: 'bg-emerald-100 text-emerald-700', rechazada: 'bg-red-100 text-red-700' }

export default function Cotizaciones() {
  const { canEdit, user } = useAuth()
  const [cotizaciones, setCotizaciones] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 20 })
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [saving, setSaving] = useState(false)
  const [exchangeRate, setExchangeRate] = useState(17.15)
  const [repositorio, setRepositorio] = useState([])
  const [showRepo, setShowRepo] = useState(false)
  const previewRef = useRef(null)

  // Form
  const [form, setForm] = useState({ cliente: '', descripcion: '', moneda: 'MXN', tipo_cambio: 17.15, notas: '', items: [] })
  const [newItem, setNewItem] = useState({ nombre: '', descripcion: '', cantidad: 1, precio: '' })

  useEffect(() => {
    loadCotizaciones()
    exchangeAPI.getRate().then(r => { setExchangeRate(r.usd_mxn); setForm(f => ({ ...f, tipo_cambio: r.usd_mxn })) })
    cotizacionAPI.getRepositorio().then(setRepositorio)
  }, [])

  const loadCotizaciones = (page = 1) => {
    setLoading(true)
    const params = { page, limit: 20 }
    if (search) params.search = search
    cotizacionAPI.getAll(params).then(d => {
      setCotizaciones(d.data)
      setPagination({ page: d.page, pages: Math.ceil(d.total / 20), total: d.total, limit: 20 })
    }).finally(() => setLoading(false))
  }

  useEffect(() => { loadCotizaciones(1) }, [search])

  const calcTotals = (items, moneda, tipo_cambio) => {
    const subtotal = items.reduce((s, i) => s + (parseFloat(i.precio) || 0) * (parseInt(i.cantidad) || 0), 0)
    const iva = subtotal * IVA_RATE
    const total = subtotal + iva
    const total_mxn = moneda === 'USD' ? total * parseFloat(tipo_cambio) : total
    return { subtotal, iva, total, total_mxn }
  }

  const fmt = (n, moneda = 'MXN') => {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: moneda, minimumFractionDigits: 2 }).format(n)
  }

  const openCreate = () => {
    setForm({ cliente: '', descripcion: '', moneda: 'MXN', tipo_cambio: exchangeRate, notas: '', items: [] })
    setNewItem({ nombre: '', descripcion: '', cantidad: 1, precio: '' })
    setModal('create')
  }

  const addItem = () => {
    if (!newItem.nombre || !newItem.precio) return
    setForm(f => ({ ...f, items: [...f.items, { ...newItem, precio: parseFloat(newItem.precio), cantidad: parseInt(newItem.cantidad) }] }))
    setNewItem({ nombre: '', descripcion: '', cantidad: 1, precio: '' })
  }

  const addFromRepo = (item) => {
    setForm(f => ({ ...f, items: [...f.items, { nombre: item.nombre, descripcion: item.descripcion, cantidad: 1, precio: item.precio }] }))
  }

  const removeItem = (i) => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }))

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!form.items.length) { alert('Agrega al menos un ítem'); return }
    setSaving(true)
    try {
      await cotizacionAPI.create(form)
      setModal(null)
      loadCotizaciones(1)
    } catch (err) { alert(err?.message || 'Error') }
    finally { setSaving(false) }
  }

  const openPreview = async (c) => {
    const full = await cotizacionAPI.getById(c.id)
    setSelected(full)
    setModal('preview')
  }

  const exportPDF = async () => {
    if (!previewRef.current) return
    const canvas = await html2canvas(previewRef.current, { scale: 2, useCORS: true })
    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
    const w = pdf.internal.pageSize.getWidth()
    const h = Math.min((canvas.height * w) / canvas.width, pdf.internal.pageSize.getHeight())
    pdf.addImage(imgData, 'PNG', 0, 0, w, h)
    pdf.save(`${selected?.folio || 'cotizacion'}.pdf`)
  }

  const { subtotal, iva, total, total_mxn } = calcTotals(form.items, form.moneda, form.tipo_cambio)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cotizaciones</h1>
          <p className="text-sm text-gray-500 mt-0.5">Genera y exporta cotizaciones con IVA y tipo de cambio</p>
        </div>
        <div className="flex gap-2">
          {canEdit() && (
            <button className="btn-secondary" onClick={() => setModal('repositorio')}>
              <BookmarkIcon className="h-4 w-4" /> Repositorio
            </button>
          )}
          {canEdit() && <button className="btn-primary" onClick={openCreate}><PlusIcon className="h-4 w-4" /> Nueva Cotización</button>}
        </div>
      </div>

      <div className="card p-4">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input type="text" className="input pl-9" placeholder="Buscar por folio, cliente..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="table-header">Folio</th>
                <th className="table-header">Cliente</th>
                <th className="table-header">Ítems</th>
                <th className="table-header">Subtotal</th>
                <th className="table-header">IVA</th>
                <th className="table-header">Total</th>
                <th className="table-header">Moneda</th>
                <th className="table-header">Estado</th>
                <th className="table-header">Fecha</th>
                <th className="table-header">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={10} className="py-12 text-center"><div className="inline-block animate-spin rounded-full h-6 w-6 border-4 border-primary-600 border-t-transparent" /></td></tr>
              ) : cotizaciones.length === 0 ? (
                <tr><td colSpan={10} className="py-12 text-center text-gray-400">No hay cotizaciones</td></tr>
              ) : cotizaciones.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="table-cell font-mono text-xs font-semibold text-gray-700">{c.folio}</td>
                  <td className="table-cell font-medium text-sm">{c.cliente}</td>
                  <td className="table-cell text-sm">{c.items?.length || 0}</td>
                  <td className="table-cell text-sm">{fmt(c.subtotal, c.moneda)}</td>
                  <td className="table-cell text-sm">{fmt(c.iva, c.moneda)}</td>
                  <td className="table-cell text-sm font-semibold">{fmt(c.total, c.moneda)}</td>
                  <td className="table-cell"><Badge label={c.moneda} color={c.moneda === 'USD' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'} /></td>
                  <td className="table-cell"><Badge label={c.estado} color={ESTADO_COLORS[c.estado] || 'bg-gray-100 text-gray-600'} /></td>
                  <td className="table-cell text-xs text-gray-500">{c.created_at ? format(new Date(c.created_at), 'dd/MM/yyyy') : ''}</td>
                  <td className="table-cell">
                    <button onClick={() => openPreview(c)} className="p-1.5 rounded text-gray-400 hover:text-primary-600 hover:bg-primary-50">
                      <EyeIcon className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination {...pagination} onPageChange={loadCotizaciones} />
      </div>

      {/* Modal crear */}
      <Modal open={modal === 'create'} onClose={() => setModal(null)} title="Nueva Cotización" size="2xl">
        <form onSubmit={handleCreate} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Cliente *</label>
              <input className="input" required value={form.cliente} onChange={e => setForm(f => ({ ...f, cliente: e.target.value }))} />
            </div>
            <div>
              <label className="label">Descripción del proyecto</label>
              <input className="input" value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
            </div>
            <div>
              <label className="label">Moneda</label>
              <select className="input" value={form.moneda} onChange={e => setForm(f => ({ ...f, moneda: e.target.value }))}>
                <option value="MXN">MXN — Peso Mexicano</option>
                <option value="USD">USD — Dólar Americano</option>
              </select>
            </div>
            {form.moneda === 'USD' && (
              <div>
                <label className="label">Tipo de cambio (USD → MXN)</label>
                <input type="number" step="0.01" className="input" value={form.tipo_cambio} onChange={e => setForm(f => ({ ...f, tipo_cambio: e.target.value }))} />
                <p className="text-xs text-gray-400 mt-1">Tipo de cambio de referencia: ${exchangeRate} MXN/USD</p>
              </div>
            )}
          </div>

          {/* Ítems */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Ítems</label>
              {repositorio.length > 0 && (
                <button type="button" className="text-xs text-primary-600 hover:underline" onClick={() => setShowRepo(!showRepo)}>
                  + Agregar del repositorio
                </button>
              )}
            </div>

            {showRepo && (
              <div className="mb-3 border border-primary-200 rounded-lg overflow-y-auto max-h-40">
                {repositorio.map(item => (
                  <button key={item.id} type="button" onClick={() => { addFromRepo(item); setShowRepo(false) }}
                    className="w-full text-left flex justify-between px-3 py-2 hover:bg-primary-50 text-sm border-b border-gray-100 last:border-0">
                    <span>{item.nombre}</span>
                    <span className="text-gray-500">{fmt(item.precio, item.moneda)}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-2 mb-3">
              {form.items.map((item, i) => (
                <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2">
                  <div className="flex-1">
                    <div className="font-medium text-sm">{item.nombre}</div>
                    <div className="text-xs text-gray-500">{item.descripcion}</div>
                  </div>
                  <div className="text-sm text-gray-600">x{item.cantidad}</div>
                  <div className="text-sm font-semibold">{fmt(item.precio * item.cantidad, form.moneda)}</div>
                  <button type="button" onClick={() => removeItem(i)} className="text-gray-300 hover:text-red-500">
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-5 gap-2 bg-gray-50 rounded-lg p-3">
              <div className="col-span-2">
                <input className="input text-sm" placeholder="Nombre del ítem *" value={newItem.nombre} onChange={e => setNewItem(n => ({ ...n, nombre: e.target.value }))} />
              </div>
              <div>
                <input className="input text-sm" placeholder="Descripción" value={newItem.descripcion} onChange={e => setNewItem(n => ({ ...n, descripcion: e.target.value }))} />
              </div>
              <div>
                <input type="number" min={1} className="input text-sm" placeholder="Qty" value={newItem.cantidad} onChange={e => setNewItem(n => ({ ...n, cantidad: e.target.value }))} />
              </div>
              <div className="flex gap-1">
                <input type="number" step="0.01" className="input text-sm" placeholder="Precio" value={newItem.precio} onChange={e => setNewItem(n => ({ ...n, precio: e.target.value }))} />
                <button type="button" onClick={addItem} className="btn-primary py-2 px-3 flex-shrink-0"><PlusCircleIcon className="h-4 w-4" /></button>
              </div>
            </div>
          </div>

          {/* Totales */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-600">Subtotal</span><span className="font-medium">{fmt(subtotal, form.moneda)}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">IVA (16%)</span><span className="font-medium">{fmt(iva, form.moneda)}</span></div>
            <div className="flex justify-between text-base font-bold border-t border-gray-200 pt-2">
              <span>Total</span><span>{fmt(total, form.moneda)}</span>
            </div>
            {form.moneda === 'USD' && <div className="flex justify-between text-xs text-gray-500"><span>Equivalente MXN</span><span>{fmt(total_mxn, 'MXN')}</span></div>}
          </div>

          <div>
            <label className="label">Notas</label>
            <textarea className="input" rows={2} value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} />
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Creando...' : 'Crear Cotización'}</button>
          </div>
        </form>
      </Modal>

      {/* Modal vista previa cotización */}
      <Modal open={modal === 'preview'} onClose={() => setModal(null)} title={`Cotización — ${selected?.folio}`} size="2xl">
        {selected && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button className="btn-secondary" onClick={exportPDF}><PrinterIcon className="h-4 w-4" /> Exportar PDF</button>
            </div>
            <div ref={previewRef} className="bg-white border border-gray-200 rounded-xl p-8 space-y-6 text-sm font-sans">
              <div className="flex justify-between items-start border-b-2 border-gray-200 pb-5">
                <div>
                  <div className="font-bold text-2xl text-gray-900">COTIZACIÓN</div>
                  <div className="text-gray-500 text-sm">Folio: {selected.folio}</div>
                  <div className="text-gray-500 text-xs">Fecha: {selected.created_at ? format(new Date(selected.created_at), "dd 'de' MMMM yyyy", { locale: es }) : ''}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-gray-800 text-lg">KRONOS TI</div>
                  <div className="text-gray-500 text-xs">Área de Tecnologías de la Información</div>
                  <div className="text-gray-500 text-xs">Elaborado por: {selected.creado_por_nombre}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="font-semibold text-xs uppercase tracking-wide text-gray-500 mb-2">Cliente</div>
                  <div className="font-bold text-gray-900">{selected.cliente}</div>
                  {selected.descripcion && <div className="text-gray-500 text-xs mt-1">{selected.descripcion}</div>}
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="font-semibold text-xs uppercase tracking-wide text-gray-500 mb-2">Condiciones</div>
                  <div className="text-xs space-y-1">
                    <div><span className="font-medium">Moneda:</span> {selected.moneda}</div>
                    <div><span className="font-medium">IVA:</span> 16%</div>
                    {selected.moneda === 'USD' && <div><span className="font-medium">Tipo de cambio:</span> ${selected.tipo_cambio} MXN/USD</div>}
                    <div><span className="font-medium">Validez:</span> 30 días</div>
                  </div>
                </div>
              </div>

              <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-800 text-white">
                  <tr>
                    <th className="text-left px-4 py-2">#</th>
                    <th className="text-left px-4 py-2">Descripción</th>
                    <th className="text-right px-4 py-2">Cant.</th>
                    <th className="text-right px-4 py-2">P. Unit.</th>
                    <th className="text-right px-4 py-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.items?.map((item, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-2 text-gray-500">{i + 1}</td>
                      <td className="px-4 py-2">
                        <div className="font-medium">{item.nombre}</div>
                        {item.descripcion && <div className="text-gray-400">{item.descripcion}</div>}
                      </td>
                      <td className="px-4 py-2 text-right">{item.cantidad}</td>
                      <td className="px-4 py-2 text-right">{fmt(item.precio, selected.moneda)}</td>
                      <td className="px-4 py-2 text-right font-medium">{fmt(item.precio * item.cantidad, selected.moneda)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-end">
                <div className="w-64 space-y-2 text-xs">
                  <div className="flex justify-between"><span className="text-gray-600">Subtotal</span><span>{fmt(selected.subtotal, selected.moneda)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">IVA (16%)</span><span>{fmt(selected.iva, selected.moneda)}</span></div>
                  <div className="flex justify-between text-sm font-bold border-t-2 border-gray-900 pt-2">
                    <span>TOTAL</span><span>{fmt(selected.total, selected.moneda)}</span>
                  </div>
                  {selected.moneda === 'USD' && (
                    <div className="flex justify-between text-gray-500"><span>Total MXN</span><span>{fmt(selected.total_mxn, 'MXN')}</span></div>
                  )}
                </div>
              </div>

              {selected.notas && (
                <div className="border-t pt-4 text-xs text-gray-600">
                  <div className="font-semibold mb-1">Notas:</div>
                  <div>{selected.notas}</div>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Modal repositorio */}
      <Modal open={modal === 'repositorio'} onClose={() => setModal(null)} title="Repositorio de Productos" size="lg">
        <RepositorioManager repositorio={repositorio} onChange={setRepositorio} />
      </Modal>
    </div>
  )
}

function RepositorioManager({ repositorio, onChange }) {
  const [form, setForm] = useState({ nombre: '', descripcion: '', precio: '', moneda: 'MXN' })
  const [saving, setSaving] = useState(false)

  const handleAdd = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await cotizacionAPI.addRepositorio({ ...form, precio: parseFloat(form.precio) })
      const updated = await cotizacionAPI.getRepositorio()
      onChange(updated)
      setForm({ nombre: '', descripcion: '', precio: '', moneda: 'MXN' })
    } catch { alert('Error al agregar') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    await cotizacionAPI.deleteRepositorio(id)
    onChange(repositorio.filter(r => r.id !== id))
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleAdd} className="grid grid-cols-4 gap-3 bg-gray-50 rounded-lg p-3">
        <div className="col-span-2"><input className="input text-sm" placeholder="Nombre *" required value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} /></div>
        <div><input type="number" step="0.01" className="input text-sm" placeholder="Precio *" required value={form.precio} onChange={e => setForm(f => ({ ...f, precio: e.target.value }))} /></div>
        <div className="flex gap-1">
          <select className="input text-sm" value={form.moneda} onChange={e => setForm(f => ({ ...f, moneda: e.target.value }))}><option value="MXN">MXN</option><option value="USD">USD</option></select>
          <button type="submit" className="btn-primary py-2 px-3 flex-shrink-0" disabled={saving}><PlusCircleIcon className="h-4 w-4" /></button>
        </div>
      </form>
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {repositorio.map(item => (
          <div key={item.id} className="flex items-center justify-between px-3 py-2 border border-gray-200 rounded-lg">
            <div>
              <div className="text-sm font-medium">{item.nombre}</div>
              <div className="text-xs text-gray-500">{item.descripcion}</div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold">{new Intl.NumberFormat('es-MX', { style: 'currency', currency: item.moneda }).format(item.precio)}</span>
              <button onClick={() => handleDelete(item.id)} className="text-gray-300 hover:text-red-500"><TrashIcon className="h-4 w-4" /></button>
            </div>
          </div>
        ))}
        {repositorio.length === 0 && <p className="text-center text-gray-400 text-sm py-6">Sin productos en el repositorio</p>}
      </div>
    </div>
  )
}
