const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3')

function env(name) {
  return (process.env[name] || '').trim()
}

// Si hay credenciales explícitas en el entorno las usa; si no, deja que el SDK
// use el rol IAM del EC2 (credential provider chain automática de AWS SDK v3)
function makeS3Client(useExplicitCredentials = true) {
  const clientConfig = { region: env('AWS_REGION') || 'us-east-2' }
  const accessKeyId = env('AWS_ACCESS_KEY_ID')
  const secretAccessKey = env('AWS_SECRET_ACCESS_KEY')
  if (useExplicitCredentials && accessKeyId && secretAccessKey) {
    clientConfig.credentials = {
      accessKeyId,
      secretAccessKey,
    }
  }
  return new S3Client(clientConfig)
}

const s3 = makeS3Client(true)
const s3Fallback = makeS3Client(false)

const BUCKET = env('S3_BUCKET') || 'athenasys-documentos'

// Mapeo de tipo de documento a carpeta en S3
const S3_FOLDERS = {
  entrada:   'Entradas',
  salida:    'Salidas',
  responsiva: 'Responsivas',
}

// Carpetas de fotos de perfil
const FOTO_FOLDERS = {
  empleado:  'Colaboradores',
  sucursal:  'Sucursales',
  proveedor: 'Proveedores',
}

/** Devuelve la carpeta S3 según el tipo de documento */
function getFolder(tipo) {
  return S3_FOLDERS[tipo] || tipo
}

/** Devuelve la carpeta S3 para fotos según el tipo de entidad */
function getFotoFolder(tipo) {
  return FOTO_FOLDERS[tipo] || 'Fotos'
}

/**
 * Sube un PDF a S3
 * @param {Buffer} buffer  - Contenido del archivo
 * @param {string} key     - Ruta dentro del bucket (ej: "salida/SAL-000001_Juan.pdf")
 * @returns {Promise<string>} URL del archivo en S3
 */
async function uploadPDF(buffer, key) {
  const command = new PutObjectCommand({
    Bucket:      BUCKET,
    Key:         key,
    Body:        buffer,
    ContentType: 'application/pdf',
  })
  await sendWithFallback(command)
  return `https://${BUCKET}.s3.${env('AWS_REGION') || 'us-east-2'}.amazonaws.com/${key}`
}

/**
 * Sube una imagen a S3
 * @param {Buffer} buffer      - Contenido del archivo
 * @param {string} folder      - Carpeta en S3 (ej: "Colaboradores")
 * @param {string} filename    - Nombre del archivo (ej: "emp-001.jpg")
 * @param {string} contentType - MIME type (default: image/jpeg)
 * @returns {Promise<string>} URL del archivo en S3
 */
async function uploadImage(buffer, folder, filename, contentType = 'image/jpeg') {
  const key = `${folder}/${filename}`
  const command = new PutObjectCommand({
    Bucket:      BUCKET,
    Key:         key,
    Body:        buffer,
    ContentType: contentType,
  })
  await sendWithFallback(command)
  return `https://${BUCKET}.s3.${env('AWS_REGION') || 'us-east-2'}.amazonaws.com/${key}`
}

/**
 * Elimina un archivo de S3
 * @param {string} key - Ruta dentro del bucket
 */
async function deleteFile(key) {
  const command = new DeleteObjectCommand({ Bucket: BUCKET, Key: key })
  await sendWithFallback(command)
}

async function sendWithFallback(command) {
  try {
    return await s3.send(command)
  } catch (err) {
    const credentialError = /credential/i.test(err?.message || '')
    if (!credentialError) throw err
    console.warn('[S3] Credenciales explícitas inválidas; reintentando con credential chain por defecto')
    return s3Fallback.send(command)
  }
}

module.exports = { uploadPDF, uploadImage, deleteFile, getFolder, getFotoFolder }
