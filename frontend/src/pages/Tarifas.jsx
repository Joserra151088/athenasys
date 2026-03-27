import { useState, useEffect } from 'react'
import { PencilIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { tarifasAPI } from '../utils/api'
import { useAuth } from '../context/AuthContext'

export default function Tarifas() {
  const [tarifas, setTarifas] = useState([])
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState(null)
  const [editVal, setEditVal] = useState('')
  const [saving, setSaving] = useState(false)
  const { hasRole } = useAuth()
  const canEdit = hasRole('super_admin', 'agente_soporte')

  const load = async () => {
    try {
      const data = await tarifasAPI.getAll()
      setTarifas(Array.isArray(data) ? data : [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const startEdit = (t) => {
    setEditId(t.id)
    setEditVal(String(t.costo_dia))
  }

  const cancelEdit = () => { setEditId(null); setEditVal('') }

  const saveEdit = async (t) => {
    setSaving(true)
    try {
      await tarifasAPI.update(t.id, { costo_dia: parseFloat(editVal) })
      await load()
      setEditId(null)
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }

  const fmtMXN = (n) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tarifas de Equipo</h1>
        <p className="text-gray-500 text-sm mt-1">
          Costo de renta diaria por tipo de dispositivo. El paquete CPU incluye Monitor, Teclado y Mouse.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 bg-amber-50 border-b border-amber-200">
          <p className="text-sm text-amber-800 font-medium">
            ⚠️ Las tarifas afectan el cálculo financiero retroactivo del período seleccionado.
            Modifícalas con cuidado.
          </p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo de Equipo</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Descripción</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Costo/Día (MXN)</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Costo/Mes est.</th>
              {canEdit && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={5} className="text-center py-10 text-gray-400">Cargando...</td></tr>
            ) : tarifas.map(t => (
              <tr key={t.id} className={`hover:bg-gray-50 ${t.es_paquete ? 'bg-blue-50/40' : ''}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{t.tipo}</span>
                    {t.es_paquete && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">Paquete</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-500">{t.nombre_display}</td>
                <td className="px-4 py-3 text-right">
                  {editId === t.id ? (
                    <div className="flex items-center justify-end gap-2">
                      <input
                        type="number"
                        value={editVal}
                        onChange={e => setEditVal(e.target.value)}
                        className="input w-24 text-right text-sm py-1"
                        min="0"
                        step="0.50"
                      />
                    </div>
                  ) : (
                    <span className="font-semibold text-gray-900">{fmtMXN(t.costo_dia)}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-gray-500">
                  {fmtMXN((editId === t.id ? parseFloat(editVal) || 0 : t.costo_dia) * 30)}
                </td>
                {canEdit && (
                  <td className="px-4 py-3 text-right">
                    {editId === t.id ? (
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => saveEdit(t)} disabled={saving}
                          className="p-1.5 rounded bg-green-100 text-green-700 hover:bg-green-200">
                          <CheckIcon className="h-4 w-4" />
                        </button>
                        <button onClick={cancelEdit}
                          className="p-1.5 rounded bg-gray-100 text-gray-500 hover:bg-gray-200">
                          <XMarkIcon className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => startEdit(t)}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700">
                        <PencilIcon className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
