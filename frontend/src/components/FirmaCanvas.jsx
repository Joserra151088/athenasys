import { useRef, forwardRef, useImperativeHandle, useState } from 'react'
import SignatureCanvas from 'react-signature-canvas'
import { TrashIcon, PencilIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline'

const FirmaCanvas = forwardRef(function FirmaCanvas({ label, existingSignature }, ref) {
  const sigRef = useRef(null)
  const [expanded, setExpanded] = useState(false)
  const [localSig, setLocalSig] = useState(null) // base64 confirmed in modal

  useImperativeHandle(ref, () => ({
    getDataURL: () => {
      if (localSig) return localSig
      if (existingSignature && !localSig) return existingSignature
      return null
    },
    clear: () => setLocalSig(null),
    isEmpty: () => !localSig && !existingSignature
  }), [localSig, existingSignature])

  const confirmSignature = () => {
    if (sigRef.current && !sigRef.current.isEmpty()) {
      setLocalSig(sigRef.current.toDataURL('image/png'))
    }
    setExpanded(false)
  }

  const clearAll = () => { setLocalSig(null); sigRef.current?.clear() }

  const displaySig = localSig || existingSignature

  return (
    <div>
      {label && <label className="label mb-1">{label}</label>}

      {/* Thumbnail / click area */}
      <div
        onClick={() => setExpanded(true)}
        className={`relative border-2 rounded-xl overflow-hidden cursor-pointer transition-all group ${
          displaySig
            ? 'border-emerald-300 bg-emerald-50 hover:border-emerald-400'
            : 'border-dashed border-gray-300 bg-gray-50 hover:border-primary-400'
        }`}
        style={{ minHeight: 80 }}
      >
        {displaySig ? (
          <img src={displaySig} alt="firma" className="h-20 w-full object-contain py-1" />
        ) : (
          <div className="flex flex-col items-center justify-center h-20 gap-1 text-gray-400 group-hover:text-primary-500">
            <PencilIcon className="h-6 w-6" />
            <span className="text-xs font-medium">Clic para firmar</span>
          </div>
        )}
        {displaySig && (
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
            <span className="text-xs bg-white/90 px-2 py-1 rounded font-medium text-gray-700">Cambiar firma</span>
          </div>
        )}
        {existingSignature && !localSig && (
          <div className="absolute top-1 right-1">
            <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-medium">Firma guardada</span>
          </div>
        )}
      </div>

      {localSig && (
        <button type="button" className="mt-1 text-xs text-red-400 hover:text-red-600 flex items-center gap-1" onClick={clearAll}>
          <TrashIcon className="h-3.5 w-3.5" /> Limpiar
        </button>
      )}

      {/* Expanded signature modal */}
      {expanded && (
        <div
          className="fixed inset-0 z-[300] bg-black/70 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setExpanded(false)}
        >
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg text-gray-900">{label || 'Firma digital'}</h3>
              <button type="button" onClick={() => setExpanded(false)} className="p-1 rounded text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-gray-500">Firma en el área de abajo usando el ratón o el dedo en pantalla táctil.</p>
            <div className="border-2 border-dashed border-gray-300 rounded-xl overflow-hidden bg-gray-50 hover:border-primary-400 transition-colors">
              <SignatureCanvas
                ref={sigRef}
                penColor="#1d4ed8"
                canvasProps={{ className: 'w-full', width: 600, height: 220 }}
                backgroundColor="rgb(249, 250, 251)"
              />
            </div>
            <div className="flex justify-between items-center">
              <button type="button" className="btn-secondary text-sm" onClick={() => sigRef.current?.clear()}>
                <TrashIcon className="h-4 w-4" /> Limpiar
              </button>
              <div className="flex gap-3">
                <button type="button" className="btn-secondary" onClick={() => setExpanded(false)}>Cancelar</button>
                <button type="button" className="btn-primary" onClick={confirmSignature}>
                  <CheckIcon className="h-4 w-4" /> Confirmar firma
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
})

export default FirmaCanvas
