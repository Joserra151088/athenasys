const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses')

const ses = new SESClient({
  region: process.env.AWS_REGION || 'us-east-2',
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
})

const FROM = process.env.SES_FROM_EMAIL || 'soporte@previta.com.mx'

/**
 * Envía el link de firma al receptor del documento
 */
async function enviarLinkFirma({ receptor_email, receptor_nombre, agente_nombre, folio, tipo, url, expires_at }) {
  const fechaExpira = new Date(expires_at).toLocaleString('es-MX', {
    timeZone:    'America/Mexico_City',
    day:         '2-digit',
    month:       'long',
    year:        'numeric',
    hour:        '2-digit',
    minute:      '2-digit',
  })

  const tipoLabel = { entrada: 'Entrada', salida: 'Salida', responsiva: 'Responsiva' }[tipo] || tipo

  const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:30px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">

        <!-- Header -->
        <tr>
          <td style="background:#1F4E79;padding:32px 40px;text-align:center;">
            <h1 style="color:#ffffff;margin:0;font-size:26px;font-weight:bold;">AthenaSys</h1>
            <p style="color:#a8c6e8;margin:6px 0 0;font-size:14px;">Sistema de Inventario TI</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <p style="color:#333;font-size:16px;margin:0 0 16px;">Hola <strong>${receptor_nombre || 'Usuario'}</strong>,</p>
            <p style="color:#555;font-size:15px;line-height:1.6;margin:0 0 24px;">
              <strong>${agente_nombre}</strong> te ha enviado un documento para firma digital.
              Por favor revisa el documento y firma con tu nombre.
            </p>

            <!-- Detalles del documento -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;border-radius:6px;margin-bottom:28px;">
              <tr>
                <td style="padding:20px;">
                  <p style="margin:0 0 8px;color:#888;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Detalles del documento</p>
                  <p style="margin:4px 0;color:#333;font-size:14px;"><strong>Folio:</strong> ${folio}</p>
                  <p style="margin:4px 0;color:#333;font-size:14px;"><strong>Tipo:</strong> ${tipoLabel}</p>
                  <p style="margin:4px 0;color:#333;font-size:14px;"><strong>Generado por:</strong> ${agente_nombre}</p>
                  <p style="margin:4px 0;color:#e74c3c;font-size:13px;"><strong>Expira:</strong> ${fechaExpira}</p>
                </td>
              </tr>
            </table>

            <!-- Botón -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding:10px 0 28px;">
                  <a href="${url}" style="display:inline-block;background:#1F4E79;color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:6px;font-size:16px;font-weight:bold;">
                    Firmar Documento
                  </a>
                </td>
              </tr>
            </table>

            <p style="color:#888;font-size:13px;margin:0 0 8px;">Si el botón no funciona, copia y pega este enlace en tu navegador:</p>
            <p style="color:#2E75B6;font-size:12px;word-break:break-all;margin:0 0 24px;">
              <a href="${url}" style="color:#2E75B6;">${url}</a>
            </p>

            <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
            <p style="color:#aaa;font-size:12px;margin:0;">
              Este correo fue generado automáticamente por AthenaSys. No respondas a este mensaje.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8f9fa;padding:20px 40px;text-align:center;border-top:1px solid #eee;">
            <p style="color:#aaa;font-size:12px;margin:0;">AthenaSys &copy; ${new Date().getFullYear()} — Sistema de Inventario TI</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`

  const command = new SendEmailCommand({
    Source: `AthenaSys <${FROM}>`,
    Destination: { ToAddresses: [receptor_email] },
    Message: {
      Subject: { Data: `[AthenaSys] Documento pendiente de firma — ${folio}`, Charset: 'UTF-8' },
      Body: { Html: { Data: html, Charset: 'UTF-8' } },
    },
  })

  await ses.send(command)
  console.log(`[Email] Link de firma enviado a ${receptor_email} para documento ${folio}`)
}

module.exports = { enviarLinkFirma }
