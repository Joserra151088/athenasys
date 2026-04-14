/**
 * FirmaOnline.jsx — Página pública de firma en línea para el receptor.
 * Accesible sin autenticación en: /firmar/:token
 * El receptor dibuja su firma, se genera el PDF y se envía al backend.
 */
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import SignatureCanvas from 'react-signature-canvas'
import { firmaOnlineAPI } from '../utils/api'
import { generateDocumentPDF as generateSharedDocumentPDF } from '../utils/documentPdf'

const tipoLabel = { entrada: 'Entrega de equipo', salida: 'Devolución de equipo', responsiva: 'Responsiva de resguardo' }

async function generarPDF(doc, firmaAgenteImg, firmaReceptorImg) {
  return generateSharedDocumentPDF(
    {
      ...doc,
      plantilla_texto: doc?.plantilla_texto || '',
      logo_global: doc?.logo_global || null,
    },
    {
      logo: doc?.logo_global || null,
      firmaAgenteImg,
      firmaLogisticaImg: doc?.firma_logistica || null,
      firmaReceptorImg,
    }
  )
}

export default function FirmaOnline() {
  const { token } = useParams()
  const sigRef    = useRef(null)

  const [estado,   setEstado]   = useState('cargando')  // cargando | pendiente | firmado | expirado | error
  const [docInfo,  setDocInfo]  = useState(null)
  const [mensaje,  setMensaje]  = useState('')
  const [enviando, setEnviando] = useState(false)
  const [firmado,  setFirmado]  = useState(false)
  const [canvasVacio, setCanvasVacio] = useState(true)

  useEffect(() => {
    firmaOnlineAPI.getDocumento(token)
      .then(data => {
        if (data.estado === 'firmado') {
          setEstado('firmado')
          setMensaje(data.message || 'Este documento ya fue firmado.')
        } else {
          setDocInfo(data.documento)
          setEstado('pendiente')
        }
      })
      .catch(err => {
        const msg = err?.message || 'Link no válido o expirado'
        const est = err?.estado || 'error'
        setEstado(est === 'expirado' ? 'expirado' : 'error')
        setMensaje(msg)
      })
  }, [token])

  const limpiarFirma = () => {
    sigRef.current?.clear()
    setCanvasVacio(true)
  }

  const handleFirmar = async () => {
    if (!sigRef.current || sigRef.current.isEmpty()) {
      setMensaje('Por favor dibuja tu firma antes de continuar.')
      return
    }
    setEnviando(true)
    setMensaje('')
    try {
      const firmaReceptor = sigRef.current.getTrimmedCanvas().toDataURL('image/png')
      const firmaAgente   = docInfo.firma_agente || null

      // Generar PDF con ambas firmas
      let pdf_base64 = null
      try {
        const pdf = await generarPDF(docInfo, firmaAgente, firmaReceptor)
        pdf_base64 = pdf.output('datauristring')
      } catch (pdfErr) {
        console.warn('[FirmaOnline] No se pudo generar el PDF:', pdfErr.message)
      }

      await firmaOnlineAPI.firmar(token, { firma_receptor: firmaReceptor, pdf_base64 })
      setFirmado(true)
      setEstado('firmado')
    } catch (err) {
      setMensaje(err?.message || 'Error al enviar la firma. Intenta de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  // ── Pantallas de estado ─────────────────────────────────────────────────
  if (estado === 'cargando') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Cargando documento...</p>
        </div>
      </div>
    )
  }

  if (estado === 'expirado') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <div className="text-5xl mb-4">⏰</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Link expirado</h2>
          <p className="text-gray-500 text-sm">{mensaje || 'Este enlace de firma ya no es válido. Solicita uno nuevo al agente de TI.'}</p>
        </div>
      </div>
    )
  }

  if (estado === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <div className="text-5xl mb-4">❌</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Link no válido</h2>
          <p className="text-gray-500 text-sm">{mensaje || 'Este enlace no existe o ya fue cancelado.'}</p>
        </div>
      </div>
    )
  }

  if (estado === 'firmado') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">
            {firmado ? '¡Documento firmado!' : 'Ya firmado'}
          </h2>
          <p className="text-gray-500 text-sm">
            {firmado
              ? 'Tu firma fue registrada correctamente. Puedes cerrar esta página.'
              : (mensaje || 'Este documento ya fue firmado anteriormente.')}
          </p>
          {firmado && (
            <div className="mt-6 bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="text-green-700 text-xs font-medium">
                El documento ha sido registrado en el sistema AthenaSys TI.
              </p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Pantalla principal de firma ──────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-indigo-700 text-white px-4 py-4 shadow-lg">
        <div className="max-w-lg mx-auto">
          <p className="text-indigo-200 text-xs uppercase tracking-wide mb-0.5">AthenaSys Inventario TI</p>
          <h1 className="text-lg font-bold leading-tight">Firma de documento</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">

        {/* Resumen del documento */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 text-xl">
              {docInfo?.tipo === 'entrada' ? '📥' : docInfo?.tipo === 'salida' ? '📤' : '📋'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-indigo-600 font-semibold uppercase tracking-wide">
                {tipoLabel[docInfo?.tipo] || docInfo?.tipo}
              </p>
              <p className="font-bold text-gray-900 text-base">{docInfo?.folio}</p>
            </div>
          </div>

          <div className="mt-4 space-y-2 divide-y divide-gray-100">
            <div className="flex justify-between py-2 text-sm">
              <span className="text-gray-500">Receptor</span>
              <span className="font-medium text-gray-800">{docInfo?.entidad_nombre}</span>
            </div>
            <div className="flex justify-between py-2 text-sm">
              <span className="text-gray-500">Agente TI</span>
              <span className="font-medium text-gray-800">{docInfo?.agente_nombre}</span>
            </div>
            {docInfo?.tipo === 'salida' && docInfo?.logistica_nombre && (
              <div className="flex justify-between py-2 text-sm">
                <span className="text-gray-500">{docInfo.logistica_area || 'Logística / Almacén'}</span>
                <span className="font-medium text-gray-800">{docInfo.logistica_nombre}</span>
              </div>
            )}
            {docInfo?.dispositivos?.length > 0 && (
              <div className="py-2 text-sm">
                <p className="text-gray-500 mb-2">Equipos ({docInfo.dispositivos.length})</p>
                <div className="space-y-1">
                  {docInfo.dispositivos.map((d, i) => (
                    <div key={i} className="bg-gray-50 rounded-lg px-3 py-2 text-xs">
                      <span className="font-medium text-gray-700">{d.tipo}</span>
                      {d.marca && <span className="text-gray-500"> · {d.marca} {d.modelo}</span>}
                      {d.serie && <span className="font-mono text-gray-400 ml-1">#{d.serie}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {docInfo?.observaciones && (
              <div className="py-2 text-sm">
                <p className="text-gray-500 text-xs mb-1">Observaciones</p>
                <p className="text-gray-700 text-xs">{docInfo.observaciones}</p>
              </div>
            )}
          </div>
        </div>

        {/* Área de firma */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-1">Tu firma</h2>
          <p className="text-xs text-gray-400 mb-3">Dibuja tu firma en el recuadro de abajo con tu dedo o ratón</p>

          <div className="border-2 border-dashed border-gray-200 rounded-xl overflow-hidden bg-gray-50 relative"
               style={{ touchAction: 'none' }}>
            <SignatureCanvas
              ref={sigRef}
              penColor="#1e293b"
              canvasProps={{
                className: 'w-full',
                style: { width: '100%', height: '180px', display: 'block' },
              }}
              onEnd={() => setCanvasVacio(false)}
            />
            {canvasVacio && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-gray-300 text-sm">✍️ Firma aquí</p>
              </div>
            )}
          </div>

          <div className="flex justify-end mt-2">
            <button
              type="button"
              onClick={limpiarFirma}
              className="text-xs text-gray-400 hover:text-red-400 underline transition-colors"
            >
              Limpiar firma
            </button>
          </div>
        </div>

        {/* Mensaje de error */}
        {mensaje && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
            {mensaje}
          </div>
        )}

        {/* Botón firmar */}
        <button
          onClick={handleFirmar}
          disabled={enviando || canvasVacio}
          className={`w-full py-4 rounded-2xl text-white font-bold text-base shadow-lg transition-all
            ${(enviando || canvasVacio)
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-700 active:scale-98'}`}
        >
          {enviando
            ? <span className="flex items-center justify-center gap-2">
                <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                Enviando firma...
              </span>
            : '✅ Firmar documento'}
        </button>

        <p className="text-center text-xs text-gray-400 pb-4">
          Al firmar confirmas haber recibido / entregado los equipos listados.<br />
          Tu firma quedará registrada junto con la fecha y hora.
        </p>
      </div>
    </div>
  )
}
