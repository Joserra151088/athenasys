import { useRef, forwardRef, useImperativeHandle, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { TrashIcon, PencilIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline'

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

const BACKGROUND_COLOR = 'rgb(249, 250, 251)'
const PEN_COLOR = '#1d4ed8'

function trimCanvas(sourceCanvas) {
  const context = sourceCanvas.getContext('2d')
  if (!context) return sourceCanvas

  const { width, height } = sourceCanvas
  const pixels = context.getImageData(0, 0, width, height).data

  let top = null
  let left = null
  let right = null
  let bottom = null

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4
      const alpha = pixels[index + 3]
      const isBackground =
        pixels[index] === 249 &&
        pixels[index + 1] === 250 &&
        pixels[index + 2] === 251 &&
        alpha === 255

      if (alpha !== 0 && !isBackground) {
        if (top === null) top = y
        if (left === null || x < left) left = x
        if (right === null || x > right) right = x
        if (bottom === null || y > bottom) bottom = y
      }
    }
  }

  if (top === null || left === null || right === null || bottom === null) {
    return sourceCanvas
  }

  const padding = 8
  const cropLeft = Math.max(left - padding, 0)
  const cropTop = Math.max(top - padding, 0)
  const cropWidth = Math.min(right - left + padding * 2 + 1, width - cropLeft)
  const cropHeight = Math.min(bottom - top + padding * 2 + 1, height - cropTop)

  const trimmed = document.createElement('canvas')
  trimmed.width = cropWidth
  trimmed.height = cropHeight
  const trimmedContext = trimmed.getContext('2d')
  if (!trimmedContext) return sourceCanvas

  trimmedContext.fillStyle = BACKGROUND_COLOR
  trimmedContext.fillRect(0, 0, cropWidth, cropHeight)
  trimmedContext.drawImage(
    sourceCanvas,
    cropLeft,
    cropTop,
    cropWidth,
    cropHeight,
    0,
    0,
    cropWidth,
    cropHeight
  )

  return trimmed
}

const FirmaCanvas = forwardRef(function FirmaCanvas({ label, existingSignature }, ref) {
  const canvasRef = useRef(null)
  const canvasWrapRef = useRef(null)
  const drawingRef = useRef(false)
  const lastPointRef = useRef(null)
  const [expanded, setExpanded] = useState(false)
  const [localSig, setLocalSig] = useState(null)
  const [canvasSize, setCanvasSize] = useState({ width: 600, height: 220 })
  const [inlineError, setInlineError] = useState('')
  const [hasStroke, setHasStroke] = useState(false)

  const displaySig = localSig || existingSignature

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return

    context.save()
    context.setTransform(1, 0, 0, 1, 0, 0)
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.restore()

    context.fillStyle = BACKGROUND_COLOR
    context.fillRect(0, 0, canvasSize.width, canvasSize.height)
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.strokeStyle = PEN_COLOR
    context.lineWidth = 2
    setHasStroke(false)
  }

  const setupCanvas = (seedImage = null) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) {
      setInlineError('No se pudo inicializar el área de firma.')
      return
    }

    const ratio = Math.max(window.devicePixelRatio || 1, 1)
    canvas.width = Math.floor(canvasSize.width * ratio)
    canvas.height = Math.floor(canvasSize.height * ratio)
    canvas.style.width = `${canvasSize.width}px`
    canvas.style.height = `${canvasSize.height}px`

    context.setTransform(1, 0, 0, 1, 0, 0)
    context.scale(ratio, ratio)
    context.fillStyle = BACKGROUND_COLOR
    context.fillRect(0, 0, canvasSize.width, canvasSize.height)
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.strokeStyle = PEN_COLOR
    context.lineWidth = 2

    if (!seedImage) {
      setHasStroke(false)
      return
    }

    const image = new Image()
    image.onload = () => {
      context.fillStyle = BACKGROUND_COLOR
      context.fillRect(0, 0, canvasSize.width, canvasSize.height)

      const padding = 14
      const maxWidth = canvasSize.width - padding * 2
      const maxHeight = canvasSize.height - padding * 2
      const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1)
      const drawWidth = image.width * scale
      const drawHeight = image.height * scale
      const offsetX = (canvasSize.width - drawWidth) / 2
      const offsetY = (canvasSize.height - drawHeight) / 2
      context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight)
      setHasStroke(true)
    }
    image.onerror = () => setInlineError('No se pudo cargar la firma anterior para editarla.')
    image.src = seedImage
  }

  useEffect(() => {
    if (!expanded) return undefined

    const measure = () => {
      const width = Math.floor(canvasWrapRef.current?.clientWidth || 600)
      const height = Math.floor(clamp(width * 0.38, 190, 280))
      setCanvasSize((size) => (size.width === width && size.height === height ? size : { width, height }))
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

  useEffect(() => {
    if (!expanded) return
    setInlineError('')
    setupCanvas(localSig || existingSignature || null)
  }, [expanded, canvasSize.width, canvasSize.height])

  useImperativeHandle(
    ref,
    () => ({
      getDataURL: () => {
        if (localSig) return localSig
        if (existingSignature && !localSig) return existingSignature
        return null
      },
      clear: () => setLocalSig(null),
      isEmpty: () => !localSig && !existingSignature,
    }),
    [localSig, existingSignature]
  )

  const getCanvasPoint = (event) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    }
  }

  const handlePointerDown = (event) => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    const point = getCanvasPoint(event)
    if (!canvas || !context || !point) return

    event.preventDefault()
    drawingRef.current = true
    lastPointRef.current = point
    setHasStroke(true)

    if (canvas.setPointerCapture) {
      try {
        canvas.setPointerCapture(event.pointerId)
      } catch (_) {
        // no-op
      }
    }

    context.beginPath()
    context.moveTo(point.x, point.y)
  }

  const handlePointerMove = (event) => {
    if (!drawingRef.current) return
    const context = canvasRef.current?.getContext('2d')
    const point = getCanvasPoint(event)
    if (!context || !point) return

    event.preventDefault()
    const lastPoint = lastPointRef.current || point
    context.beginPath()
    context.moveTo(lastPoint.x, lastPoint.y)
    context.lineTo(point.x, point.y)
    context.stroke()
    lastPointRef.current = point
  }

  const stopDrawing = (event) => {
    const canvas = canvasRef.current
    drawingRef.current = false
    lastPointRef.current = null
    if (canvas?.releasePointerCapture) {
      try {
        canvas.releasePointerCapture(event.pointerId)
      } catch (_) {
        // no-op
      }
    }
  }

  const confirmSignature = () => {
    try {
      const canvas = canvasRef.current
      if (canvas && hasStroke) {
        const trimmed = trimCanvas(canvas)
        setLocalSig(trimmed.toDataURL('image/png'))
      }
      setInlineError('')
      setExpanded(false)
    } catch (error) {
      console.error('[FirmaCanvas] Error confirmando firma:', error)
      setInlineError('No se pudo confirmar la firma. Intenta nuevamente.')
    }
  }

  const clearAll = () => {
    setLocalSig(null)
    setInlineError('')
    clearCanvas()
  }

  const openExpanded = () => {
    setInlineError('')
    setExpanded(true)
  }

  const signatureModal =
    expanded && typeof document !== 'undefined'
      ? createPortal(
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
                <canvas
                  ref={canvasRef}
                  className="block"
                  style={{ touchAction: 'none' }}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={stopDrawing}
                  onPointerLeave={stopDrawing}
                  onPointerCancel={stopDrawing}
                />
              </div>
              {inlineError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
                  {inlineError}
                </div>
              )}
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
                <button type="button" className="btn-secondary text-sm" onClick={clearCanvas}>
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
          </div>,
          document.body
        )
      : null

  return (
    <div>
      {label && <label className="label mb-1">{label}</label>}

      <div
        onClick={openExpanded}
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
      {signatureModal}
    </div>
  )
})

export default FirmaCanvas
