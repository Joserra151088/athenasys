const router = require('express').Router()
const { authMiddleware } = require('../middleware/auth.middleware')

router.use(authMiddleware)

// Tipo de cambio USD/MXN - se puede conectar a una API real en producción
// Por ahora retorna un valor de referencia
router.get('/', async (req, res) => {
  try {
    // En producción: conectar a Banxico API o similar
    // https://www.banxico.org.mx/SieAPIRest/service/v1/series/SF43718/datos/oportuno
    // Por ahora retorna valor fijo actualizable
    const rate = {
      usd_mxn: 17.15,
      fecha: new Date().toISOString(),
      fuente: 'Referencia manual (actualizar con API Banxico en producción)'
    }
    res.json(rate)
  } catch {
    res.json({ usd_mxn: 17.00, fecha: new Date().toISOString(), fuente: 'Fallback' })
  }
})

module.exports = router
