require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const express = require('express')
const cors = require('cors')
const path = require('path')

const authRoutes = require('./routes/auth.routes')
const dispositivoRoutes = require('./routes/dispositivo.routes')
const empleadoRoutes = require('./routes/empleado.routes')
const sucursalRoutes = require('./routes/sucursal.routes')
const asignacionRoutes = require('./routes/asignacion.routes')
const documentoRoutes = require('./routes/documento.routes')
const plantillaRoutes = require('./routes/plantilla.routes')
const expedienteRoutes = require('./routes/expediente.routes')
const cambioRoutes = require('./routes/cambio.routes')
const cotizacionRoutes = require('./routes/cotizacion.routes')
const proveedorRoutes = require('./routes/proveedor.routes')
const usuarioSistemaRoutes = require('./routes/usuarioSistema.routes')
const auditoriaRoutes = require('./routes/auditoria.routes')
const exchangeRoutes = require('./routes/exchange.routes')
const licenciaRoutes = require('./routes/licencia.routes')
const centroCostoRoutes = require('./routes/centroCosto.routes')
const tarifasRoutes = require('./routes/tarifas.routes')
const finanzasRoutes = require('./routes/finanzas.routes')
const presupuestoRoutes = require('./routes/presupuesto.routes')
const reportesRoutes = require('./routes/reportes.routes')
const catalogosRoutes = require('./routes/catalogos.routes')
const configRoutes     = require('./routes/config.routes')
const firmaOnlineRoutes = require('./routes/firma-online.routes')

const { initDB } = require('./data/db')
const { tryRetryPendingDocs } = require('./services/pdfRetry')

const app = express()
const PORT = process.env.PORT || 3002

app.use(cors({ origin: '*', credentials: true }))
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

// Servir archivos subidos (firmas, pdfs)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')))

// Rutas API
app.use('/api/auth', authRoutes)
app.use('/api/dispositivos', dispositivoRoutes)
app.use('/api/empleados', empleadoRoutes)
app.use('/api/sucursales', sucursalRoutes)
app.use('/api/asignaciones', asignacionRoutes)
app.use('/api/documentos', documentoRoutes)
app.use('/api/plantillas', plantillaRoutes)
app.use('/api/expedientes', expedienteRoutes)
app.use('/api/cambios', cambioRoutes)
app.use('/api/cotizaciones', cotizacionRoutes)
app.use('/api/proveedores', proveedorRoutes)
app.use('/api/usuarios-sistema', usuarioSistemaRoutes)
app.use('/api/auditoria', auditoriaRoutes)
app.use('/api/exchange-rate', exchangeRoutes)
app.use('/api/licencias', licenciaRoutes)
app.use('/api/centros-costo', centroCostoRoutes)
app.use('/api/tarifas', tarifasRoutes)
app.use('/api/finanzas', finanzasRoutes)
app.use('/api/presupuesto', presupuestoRoutes)
app.use('/api/reportes', reportesRoutes)
app.use('/api/catalogos', catalogosRoutes)
app.use('/api/config', configRoutes)
app.use('/api/firma-online', firmaOnlineRoutes)

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }))

// Error handler
app.use((err, req, res, next) => {
  console.error(err)
  res.status(err.status || 500).json({ message: err.message || 'Error interno del servidor' })
})

// Iniciar BD y luego levantar servidor
initDB()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 AthenaSys Backend corriendo en http://0.0.0.0:${PORT}`)
      // Iniciar job de reintento de PDFs pendientes
      tryRetryPendingDocs()
      setInterval(tryRetryPendingDocs, 60 * 60 * 1000) // cada hora
    })
  })
  .catch(err => {
    console.error('❌ Error iniciando base de datos:', err.message)
    process.exit(1)
  })

module.exports = app
