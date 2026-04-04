const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3')

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'us-east-2',
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
})

const BUCKET = process.env.S3_BUCKET || 'athenasys-documentos'

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
  await s3.send(command)
  return `https://${BUCKET}.s3.${process.env.AWS_REGION || 'us-east-2'}.amazonaws.com/${key}`
}

/**
 * Elimina un archivo de S3
 * @param {string} key - Ruta dentro del bucket
 */
async function deleteFile(key) {
  const command = new DeleteObjectCommand({ Bucket: BUCKET, Key: key })
  await s3.send(command)
}

module.exports = { uploadPDF, deleteFile }
