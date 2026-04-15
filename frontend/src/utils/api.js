import axios from 'axios'
import { API_URL } from './constants'

const api = axios.create({ baseURL: API_URL })

api.interceptors.request.use(config => {
  const token = localStorage.getItem('ti_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  res => res.data,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('ti_token')
      localStorage.removeItem('ti_user')
      window.location.href = '/login'
    }
    return Promise.reject(err.response?.data || err)
  }
)

// Auth
export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me')
}

// Dispositivos
export const deviceAPI = {
  getAll: (params) => api.get('/dispositivos', { params }),
  getById: (id) => api.get(`/dispositivos/${id}`),
  create: (data) => api.post('/dispositivos', data),
  update: (id, data) => api.put(`/dispositivos/${id}`, data),
  delete: (id) => api.delete(`/dispositivos/${id}`),
  getStats: () => api.get('/dispositivos/stats'),
  getTrayectoria: (serie) => api.get('/dispositivos/trayectoria', { params: { serie } })
}

// Empleados
export const empleadoAPI = {
  getAll: (params) => api.get('/empleados', { params }),
  getById: (id) => api.get(`/empleados/${id}`),
  create: (data) => api.post('/empleados', data),
  update: (id, data) => api.put(`/empleados/${id}`, data),
  delete: (id) => api.delete(`/empleados/${id}`),
  importarCSV: (formData) => api.post('/empleados/importar-csv', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getTrayectoria: (nombre) => api.get('/empleados/trayectoria', { params: { nombre } }),
  uploadFoto: (id, formData) => api.post(`/empleados/${id}/foto`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
}

// Sucursales
export const sucursalAPI = {
  getAll: (params) => api.get('/sucursales', { params }),
  getById: (id) => api.get(`/sucursales/${id}`),
  create: (data) => api.post('/sucursales', data),
  update: (id, data) => api.put(`/sucursales/${id}`, data),
  delete: (id) => api.delete(`/sucursales/${id}`),
  importarCSV: (formData) => api.post('/sucursales/importar-csv', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  uploadFoto: (id, formData) => api.post(`/sucursales/${id}/foto`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
}

// Asignaciones
export const asignacionAPI = {
  getAll: (params) => api.get('/asignaciones', { params }),
  getByTarget: (tipo, id) => api.get(`/asignaciones/${tipo}/${id}`),
  asignar: (data) => api.post('/asignaciones', data),
  update: (id, data) => api.put(`/asignaciones/${id}`, data),
  desasignar: (id) => api.delete(`/asignaciones/${id}`)
}

// Documentos
export const documentoAPI = {
  getAll:           (params) => api.get('/documentos', { params }),
  getById:          (id)     => api.get(`/documentos/${id}`),
  create:           (data)   => api.post('/documentos', data),
  /**
   * Firma un documento. Incluye opcionalmente el PDF como base64
   * para subirlo a SharePoint.
   * @param {string} id
   * @param {{ firma_agente?, firma_receptor, pdf_base64? }} data
   */
  sign:             (id, data) => api.post(`/documentos/${id}/firmar`, data),
  saveLogistica:    (id, data) => api.patch(`/documentos/${id}/logistica`, data),
  delete:           (id)       => api.delete(`/documentos/${id}`),
  sharepointStatus: ()         => api.get('/documentos/sharepoint/status'),
}

// Plantillas
export const plantillaAPI = {
  getAll: (params) => api.get('/plantillas', { params }),
  getById: (id) => api.get(`/plantillas/${id}`),
  create: (data) => api.post('/plantillas', data),
  update: (id, data) => api.put(`/plantillas/${id}`, data),
  getVersiones: (id) => api.get(`/plantillas/${id}/versiones`)
}

// Expedientes
export const expedienteAPI = {
  getEmpleado: (id) => api.get(`/expedientes/empleado/${id}`),
  getSucursal: (id) => api.get(`/expedientes/sucursal/${id}`)
}

// Cambios de equipo
export const cambioAPI = {
  getAll: (params) => api.get('/cambios', { params }),
  getById: (id) => api.get(`/cambios/${id}`),
  create: (data) => api.post('/cambios', data)
}

// Cotizaciones
export const cotizacionAPI = {
  getAll: (params) => api.get('/cotizaciones', { params }),
  getById: (id) => api.get(`/cotizaciones/${id}`),
  create: (data) => api.post('/cotizaciones', data),
  update: (id, data) => api.put(`/cotizaciones/${id}`, data),
  delete: (id) => api.delete(`/cotizaciones/${id}`),
  getRepositorio: () => api.get('/cotizaciones/repositorio'),
  addRepositorio: (data) => api.post('/cotizaciones/repositorio', data),
  updateRepositorio: (id, data) => api.put(`/cotizaciones/repositorio/${id}`, data),
  deleteRepositorio: (id) => api.delete(`/cotizaciones/repositorio/${id}`)
}

// Proveedores
export const proveedorAPI = {
  getAll: () => api.get('/proveedores'),
  create: (data) => api.post('/proveedores', data),
  update: (id, data) => api.put(`/proveedores/${id}`, data),
  delete: (id) => api.delete(`/proveedores/${id}`),
  getDocumentos: (id) => api.get(`/proveedores/${id}/documentos`),
  addDocumento: (id, data) => api.post(`/proveedores/${id}/documentos`, data),
  deleteDocumento: (id, docId) => api.delete(`/proveedores/${id}/documentos/${docId}`)
}

// Usuarios del sistema
export const usuarioSistemaAPI = {
  getAll: () => api.get('/usuarios-sistema'),
  create: (data) => api.post('/usuarios-sistema', data),
  update: (id, data) => api.put(`/usuarios-sistema/${id}`, data),
  delete: (id) => api.delete(`/usuarios-sistema/${id}`),
  getMyFirma: () => api.get('/usuarios-sistema/me/firma'),
  saveMyFirma: (firma_base64) => api.post('/usuarios-sistema/me/firma', { firma_base64 }),
  deleteMyFirma: () => api.delete('/usuarios-sistema/me/firma')
}

// Licencias
export const licenciaAPI = {
  getAll: (params) => api.get('/licencias', { params }),
  getById: (id) => api.get(`/licencias/${id}`),
  getStats: () => api.get('/licencias/stats'),
  create: (data) => api.post('/licencias', data),
  update: (id, data) => api.put(`/licencias/${id}`, data),
  delete: (id) => api.delete(`/licencias/${id}`),
  getAsignaciones: (id) => api.get(`/licencias/${id}/asignaciones`),
  asignar: (id, data) => api.post(`/licencias/${id}/asignar`, data),
  liberar: (asignacionId) => api.delete(`/licencias/asignaciones/${asignacionId}`),
  getAsignacionesByEmpleado: (empleado_id) => api.get(`/licencias/empleado/${empleado_id}/asignaciones`),
}

// Dominios
export const dominioAPI = {
  getAll: (params) => api.get('/dominios', { params }),
  getById: (id) => api.get(`/dominios/${id}`),
  getStats: () => api.get('/dominios/stats'),
  create: (data) => api.post('/dominios', data),
  update: (id, data) => api.put(`/dominios/${id}`, data),
  delete: (id) => api.delete(`/dominios/${id}`),
}

// Auditoría
export const auditoriaAPI = {
  getAll: (params) => api.get('/auditoria', { params })
}

// Tipo de cambio USD/MXN
export const exchangeAPI = {
  getRate: () => api.get('/exchange-rate')
}

// Configuración global (logo, etc.)
export const configAPI = {
  getLogo: () => api.get('/config/logo'),
  setLogo: (logo) => api.put('/config/logo', { logo }),
  getDocsPath: () => api.get('/config/docs-path'),
  setDocsPath: (docPath) => api.put('/config/docs-path', { path: docPath }),
  getHeaderConfig: () => api.get('/config/header'),
  setHeaderConfig: (cfg) => api.put('/config/header', cfg),
  triggerPdfRetry: () => api.post('/config/pdf-retry'),
  reloadDb: () => api.post('/config/reload-db'),
  browseFolder: () => api.get('/config/browse-folder'),
}

// Centros de Costo
export const centroCostoAPI = {
  getAll:   (params) => api.get('/centros-costo', { params }),
  search:   (q) => api.get('/centros-costo/search', { params: { q } }),
  getById:  (id) => api.get(`/centros-costo/${id}`),
  create:   (data) => api.post('/centros-costo', data),
  update:   (id, data) => api.put(`/centros-costo/${id}`, data),
  remove:   (id) => api.delete(`/centros-costo/${id}`),
  activate: (id) => api.post(`/centros-costo/activate/${id}`),
  importCompare: (rows, apply) => api.post('/centros-costo/import', { rows, apply }),
}

// Tarifas de equipo
export const tarifasAPI = {
  getAll: () => api.get('/tarifas'),
  update: (id, data) => api.put(`/tarifas/${id}`, data)
}

// Finanzas
export const finanzasAPI = {
  getResumen: (params) => api.get('/finanzas/resumen', { params }),
  getDetalle: (params) => api.get('/finanzas/detalle', { params }),
  getHistorico: (params) => api.get('/finanzas/historico', { params }),
  getPorCC: (codigo, params) => api.get(`/finanzas/por-centro-costo/${codigo}`, { params })
}

// Reportes
export const reportesAPI = {
  inventario: (params) => api.get('/reportes/inventario', { params }),
  asignaciones: (params) => api.get('/reportes/asignaciones', { params }),
  licencias: (params) => api.get('/reportes/licencias', { params }),
  centrosCosto: (params) => api.get('/reportes/centros-costo', { params }),
  gastos: (params) => api.get('/reportes/gastos', { params }),
  gastosHistorico: (params) => api.get('/reportes/gastos-historico', { params }),
}

export const presupuestoAPI = {
  // Agrupadores
  getAgrupadores: () => api.get('/presupuesto/agrupadores'),
  createAgrupador: (data) => api.post('/presupuesto/agrupadores', data),
  updateAgrupador: (id, data) => api.put(`/presupuesto/agrupadores/${id}`, data),
  deleteAgrupador: (id) => api.delete(`/presupuesto/agrupadores/${id}`),
  // Partidas
  getPartidas: (params) => api.get('/presupuesto/partidas', { params }),
  getProveedoresLista: () => api.get('/presupuesto/proveedores-lista'),
  createPartida: (data) => api.post('/presupuesto/partidas', data),
  updatePartida: (id, data) => api.put(`/presupuesto/partidas/${id}`, data),
  deletePartida: (id) => api.delete(`/presupuesto/partidas/${id}`),
  // Gastos
  getGastos: (params) => api.get('/presupuesto/gastos', { params }),
  saveGasto: (data) => api.post('/presupuesto/gastos', data),
  // Cambios
  getCambios: (params) => api.get('/presupuesto/cambios', { params }),
  createCambio: (data) => api.post('/presupuesto/cambios', data),
  // Detalle
  getDetalle: (params) => api.get('/presupuesto/detalle', { params }),
  createDetalle: (data) => api.post('/presupuesto/detalle', data),
  updateDetalle: (id, data) => api.put(`/presupuesto/detalle/${id}`, data),
  deleteDetalle: (id) => api.delete(`/presupuesto/detalle/${id}`),
  bulkDeleteDetalle: (ids) => api.delete('/presupuesto/detalle', { data: { ids } }),
  clonarMes: (data) => api.post('/presupuesto/detalle/clonar', data),
  buscarPorSerie: (serie) => api.get('/presupuesto/dispositivo-por-serie', { params: { serie } }),
  // Dashboard
  getDashboard: (params) => api.get('/presupuesto/dashboard', { params }),
  seedExcel: () => api.post('/presupuesto/seed-excel'),
}

// Catálogos
function makeCatalogAPI(slug) {
  return {
    getAll:  ()         => api.get(`/catalogos/${slug}`),
    getTodos: ()        => api.get(`/catalogos/${slug}/todos`),
    create:  (data)     => api.post(`/catalogos/${slug}`, data),
    update:  (id, data) => api.put(`/catalogos/${slug}/${id}`, data),
    delete:  (id)       => api.delete(`/catalogos/${slug}/${id}`),
  }
}
export const catalogosAPI = {
  tiposDispositivo: makeCatalogAPI('tipos-dispositivo'),
  tiposLicencia:    makeCatalogAPI('tipos-licencia'),
  areas:            makeCatalogAPI('areas'),
  marcas:           makeCatalogAPI('marcas'),
  supervisores:     makeCatalogAPI('supervisores'),
  puestos:          makeCatalogAPI('puestos'),
}

// Firma Online
// solicitar/getEstado usan el interceptor con auth; getDocumento/firmar son públicos
const publicApi = axios.create({ baseURL: API_URL })
publicApi.interceptors.response.use(r => r.data, err => Promise.reject(err.response?.data || err))

export const firmaOnlineAPI = {
  solicitar:    (documento_id, data = {}) => api.post('/firma-online/solicitar', { documento_id, ...data }),
  getDocumento: (token)        => publicApi.get(`/firma-online/${token}`),
  firmar:       (token, data)  => publicApi.post(`/firma-online/${token}/firmar`, data),
  getEstado:    (documento_id) => api.get(`/firma-online/estado/${documento_id}`),
}

export default api
