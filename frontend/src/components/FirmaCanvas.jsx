import { useRef, forwardRef, useImperativeHandle, useState, useEffect } from 'react'
import SignatureCanvas from 'react-signature-canvas'
import { TrashIcon, PencilIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline'

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

const FirmaCanvas = forwardRef(function FirmaCanvas({ label, existingSignature }, ref) {
  const sigRef = useRef(null)
  const canvasWrapRef = useRef(null)
  const [expanded, setExpanded] = useState(false)
  const [localSig, setLocalSig] = useState(null) // base64 confirmed in modal
  const [canvasSize, setCanvasSize] = useState({ width: 600, height: 220 })

  useEffect(() => {
    if (!expanded) return undefined

    const measure = () => {
      if (sigRef.current && !sigRef.current.isEmpty()) return
      const width = Math.floor(canvasWrapRef.current?.clientWidth || 600)
      const height = Math.floor(clamp(width * 0.38, 190, 280))
      setCanvasSize(size => (size.width === width && size.height === height ? size : { width, height }))
    }

    measure()
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    if (observer && canvasWrapRef.current) observer.observe(canvasWrapRef.current)
    window.addEventListener('resize', measure)

    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [expanded])

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
      setLocalSig(sigRef.current.getTrimmedCanvas().toDataURL('image/png'))
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
          className="fixed inset-0 z-[300] bg-black/70 flex items-center justify-center p-3 sm:p-4"
          onClick={(e) => e.target === e.currentTarget && setExpanded(false)}
        >
          <div className="bg-white rounded-2xl shadow-2xl p-4 sm:p-6 w-full max-w-3xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg text-gray-900">{label || 'Firma digital'}</h3>
              <button type="button" onClick={() => setExpanded(false)} className="p-1 rounded text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-gray-500">Firma en el área de abajo usando el ratón o el dedo. En móvil, mantén el dedo dentro del recuadro.</p>
            <div
              ref={canvasWrapRef}
              className="border-2 border-dashed border-gray-300 rounded-xl overflow-hidden bg-gray-50 hover:border-primary-400 transition-colors"
              style={{ touchAction: 'none', overscrollBehavior: 'contain' }}
            >
              <SignatureCanvas
                ref={sigRef}
                penColor="#1d4ed8"
                minWidth={0.8}
                maxWidth={2.4}
                velocityFilterWeight={0.65}
                canvasProps={{
                  width: canvasSize.width,
                  height: canvasSize.height,
                  style: {
                    width: `${canvasSize.width}px`,
                    height: `${canvasSize.height}px`,
                    display: 'block',
                    touchAction: 'none',
                  },
                }}
                backgroundColor="rgb(249, 250, 251)"
              />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
              <button type="button" className="btn-secondary text-sm" onClick={() => sigRef.current?.clear()}>
                <TrashIcon className="h-4 w-4" /> Limpiar
              </button>
              <div className="flex gap-3 justify-end">
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
