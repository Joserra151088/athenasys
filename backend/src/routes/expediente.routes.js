const router = require('express').Router()
const db = require('../data/db')
const { authMiddleware } = require('../middleware/auth.middleware')

router.use(authMiddleware)

function buildExpediente(entidad_tipo, entidad_id) {
  let entidad = null
  if (entidad_tipo === 'empleado') {
    entidad = db.get('empleados').find({ id: entidad_id, activo: true }).value()
  } else {
    entidad = db.get('sucursales').find({ id: entidad_id, activo: true }).value()
  }
  if (!entidad) return null

  // Asignaciones históricas
  const asignaciones = db.get('asignaciones').filter({ asignado_a_id: entidad_id }).value()
    .map(a => {
      const d = db.get('dispositivos').find({ id: a.dispositivo_id }).value()
      return { ...a, dispositivo: d }
    })

  // Asignaciones activas
  const activas = asignaciones.filter(a => a.activo)

  // Documentos
  const documentos = db.get('documentos').filter({ entidad_tipo, entidad_id }).value()
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  // Cambios de equipos relacionados
  const dispositivosIds = [...new Set(asignaciones.map(a => a.dispositivo_id))]
  const cambios = db.get('cambios').value()
    .filter(c => dispositivosIds.includes(c.dispositivo_id))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  // Licencias asignadas (solo para empleados)
  let licencias_activas = []
  if (entidad_tipo === 'empleado') {
    licencias_activas = db.get('asignaciones_licencias').filter({ empleado_id: entidad_id, activo: true }).value()
      .map(a => {
        const lic = db.get('licencias').find({ id: a.licencia_id }).value()
        return { ...a, licencia: lic }
      })
  }

  return {
    entidad: { ...entidad, tipo: entidad_tipo },
    resumen: {
      total_dispositivos_historicos: asignaciones.length,
      dispositivos_activos: activas.length,
      total_documentos: documentos.length,
      licencias_activas: licencias_activas.length,
      ultimo_documento: documentos[0]?.created_at || null
    },
    dispositivos_activos: activas,
    historial_asignaciones: asignaciones,
    documentos,
    cambios,
    licencias_activas
  }
}

router.get('/empleado/:id', (req, res) => {
  const expediente = buildExpediente('empleado', req.params.id)
  if (!expediente) return res.status(404).json({ message: 'Empleado no encontrado' })
  res.json(expediente)
})

router.get('/sucursal/:id', (req, res) => {
  const expediente = buildExpediente('sucursal', req.params.id)
  if (!expediente) return res.status(404).json({ message: 'Sucursal no encontrada' })
  res.json(expediente)
})

module.exports = router
