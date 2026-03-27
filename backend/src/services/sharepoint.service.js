/**
 * sharepoint.service.js
 * Integración con Microsoft SharePoint via Microsoft Graph API.
 *
 * Requiere en .env:
 *   SHAREPOINT_TENANT_ID
 *   SHAREPOINT_CLIENT_ID
 *   SHAREPOINT_CLIENT_SECRET
 *   SHAREPOINT_SITE_ID     (ej: previta.sharepoint.com,abc123,def456)
 *   SHAREPOINT_DRIVE_ID    (ID del Document Library destino)
 *   SHAREPOINT_FOLDER      (ej: Documentos-Firmados/AthenaSys)
 */

const https = require('https')

// ─── Token cache ─────────────────────────────────────────────────────────────
let _tokenCache = null
let _tokenExpires = 0

/**
 * Obtiene un access token de Azure AD (client credentials flow).
 * El token se cachea hasta 5 minutos antes de su expiración.
 */
async function getAccessToken() {
  const now = Date.now()
  if (_tokenCache && now < _tokenExpires) return _tokenCache

  const tenantId = process.env.SHAREPOINT_TENANT_ID
  const clientId = process.env.SHAREPOINT_CLIENT_ID
  const secret   = process.env.SHAREPOINT_CLIENT_SECRET

  if (!tenantId || !clientId || !secret) {
    throw new Error('Faltan variables de entorno de SharePoint (TENANT_ID, CLIENT_ID, CLIENT_SECRET)')
  }

  const body = new URLSearchParams({
    grant_type:    'client_credentials',
    client_id:     clientId,
    client_secret: secret,
    scope:         'https://graph.microsoft.com/.default',
  }).toString()

  const data = await httpPost(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    body,
    { 'Content-Type': 'application/x-www-form-urlencoded' }
  )

  _tokenCache  = data.access_token
  _tokenExpires = now + (data.expires_in - 300) * 1000  // 5 min de margen
  return _tokenCache
}

// ─── Helpers HTTP ─────────────────────────────────────────────────────────────
function httpPost(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj  = new URL(url)
    const bodyBuf = typeof body === 'string' ? Buffer.from(body) : body
    const opts = {
      hostname: urlObj.hostname,
      path:     urlObj.pathname + urlObj.search,
      method:   'POST',
      headers:  { 'Content-Length': bodyBuf.length, ...headers },
    }
    const req = https.request(opts, res => {
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => {
        try {
          const json = JSON.parse(Buffer.concat(chunks).toString())
          if (res.statusCode >= 400) reject(new Error(json.error?.message || JSON.stringify(json)))
          else resolve(json)
        } catch (e) { reject(e) }
      })
    })
    req.on('error', reject)
    req.write(bodyBuf)
    req.end()
  })
}

function httpRequest(method, url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj  = new URL(url)
    const bodyBuf = body ? (Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body))) : null
    const opts = {
      hostname: urlObj.hostname,
      path:     urlObj.pathname + urlObj.search,
      method,
      headers: {
        ...(bodyBuf ? { 'Content-Length': bodyBuf.length } : {}),
        ...headers,
      },
    }
    const req = https.request(opts, res => {
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString()
        if (res.statusCode === 204 || !raw) return resolve(null)
        try {
          const json = JSON.parse(raw)
          if (res.statusCode >= 400) reject(new Error(json.error?.message || raw))
          else resolve(json)
        } catch (e) { reject(e) }
      })
    })
    req.on('error', reject)
    if (bodyBuf) req.write(bodyBuf)
    req.end()
  })
}

// ─── Helpers de ruta ──────────────────────────────────────────────────────────
function getDriveUrl() {
  const siteId  = process.env.SHAREPOINT_SITE_ID
  const driveId = process.env.SHAREPOINT_DRIVE_ID
  if (!siteId || !driveId) throw new Error('Faltan SHAREPOINT_SITE_ID o SHAREPOINT_DRIVE_ID')
  return `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}`
}

function sanitizeFilename(name) {
  // SharePoint no permite: " * : < > ? / \ |
  return name.replace(/["*:<>?/\\|]/g, '_').substring(0, 200)
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Sube un archivo (Buffer) a SharePoint.
 *
 * @param {Buffer}  fileBuffer  - Contenido del archivo
 * @param {string}  filename    - Nombre del archivo (ej: "responsiva_juan_perez.pdf")
 * @param {string}  [subfolder] - Subcarpeta dentro de SHAREPOINT_FOLDER (opcional)
 * @returns {{ id, name, webUrl, size }}
 */
async function uploadFile(fileBuffer, filename, subfolder = '') {
  const token    = await getAccessToken()
  const baseFolder = process.env.SHAREPOINT_FOLDER || 'AthenaSys'
  const folder   = subfolder ? `${baseFolder}/${subfolder}` : baseFolder
  const safeName = sanitizeFilename(filename)

  // Upload simple (< 4 MB). Para archivos más grandes usar upload session.
  const url = `${getDriveUrl()}/root:/${folder}/${safeName}:/content`

  const result = await httpRequest('PUT', url, fileBuffer, {
    Authorization:  `Bearer ${token}`,
    'Content-Type': 'application/pdf',
  })

  return {
    id:     result.id,
    name:   result.name,
    webUrl: result.webUrl,
    size:   result.size,
  }
}

/**
 * Elimina un archivo de SharePoint por su item ID.
 *
 * @param {string} itemId - ID del item en SharePoint (guardado al subir)
 */
async function deleteFile(itemId) {
  if (!itemId) throw new Error('itemId requerido para eliminar de SharePoint')
  const token = await getAccessToken()
  const url   = `${getDriveUrl()}/items/${itemId}`
  await httpRequest('DELETE', url, null, { Authorization: `Bearer ${token}` })
  return { deleted: true, itemId }
}

/**
 * Obtiene metadatos de un archivo por su item ID.
 *
 * @param {string} itemId
 * @returns {{ id, name, webUrl, size, lastModifiedDateTime }}
 */
async function getFileInfo(itemId) {
  const token = await getAccessToken()
  const url   = `${getDriveUrl()}/items/${itemId}`
  const result = await httpRequest('GET', url, null, { Authorization: `Bearer ${token}` })
  return {
    id:                   result.id,
    name:                 result.name,
    webUrl:               result.webUrl,
    size:                 result.size,
    lastModifiedDateTime: result.lastModifiedDateTime,
  }
}

/**
 * Lista los archivos de una carpeta en SharePoint.
 *
 * @param {string} [subfolder] - Subcarpeta dentro de SHAREPOINT_FOLDER
 * @returns {Array}
 */
async function listFiles(subfolder = '') {
  const token      = await getAccessToken()
  const baseFolder = process.env.SHAREPOINT_FOLDER || 'AthenaSys'
  const folder     = subfolder ? `${baseFolder}/${subfolder}` : baseFolder
  const url        = `${getDriveUrl()}/root:/${folder}:/children`

  const result = await httpRequest('GET', url, null, { Authorization: `Bearer ${token}` })
  return (result.value || []).map(item => ({
    id:     item.id,
    name:   item.name,
    webUrl: item.webUrl,
    size:   item.size,
  }))
}

/**
 * Verifica que las credenciales y la conexión a SharePoint son válidas.
 * Útil para el health check del servidor.
 *
 * @returns {{ ok: boolean, site: string, drive: string }}
 */
async function testConnection() {
  const token   = await getAccessToken()
  const siteId  = process.env.SHAREPOINT_SITE_ID
  const driveId = process.env.SHAREPOINT_DRIVE_ID

  const siteInfo = await httpRequest(
    'GET',
    `https://graph.microsoft.com/v1.0/sites/${siteId}`,
    null,
    { Authorization: `Bearer ${token}` }
  )
  const driveInfo = await httpRequest(
    'GET',
    `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}`,
    null,
    { Authorization: `Bearer ${token}` }
  )

  return {
    ok:    true,
    site:  siteInfo.displayName,
    drive: driveInfo.name,
  }
}

module.exports = { uploadFile, deleteFile, getFileInfo, listFiles, testConnection }
