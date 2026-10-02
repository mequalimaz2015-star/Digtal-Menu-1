/**
 * emailService.js — MEGA Digital Menu
 *
 * Sends via Brevo SMTP (nodemailer) using the SMTP credentials.
 * The SMTP_USER (bc0aa6001@smtp-brevo.com) is the authorized sender.
 *
 * Required env vars:
 *   SMTP_HOST=smtp-relay.brevo.com
 *   SMTP_PORT=587
 *   SMTP_USER=bc0aa6001@smtp-brevo.com
 *   SMTP_PASS=xsmtpsib-...
 *   SMTP_FROM=MEGA Digital Menu <bc0aa6001@smtp-brevo.com>
 *
 * Optional — Brevo HTTP API (only works if sender domain is verified in Brevo):
 *   BREVO_API_KEY=xsmtpsib-...
 */

const https = require('https')

// ── Send via Brevo HTTP API ───────────────────────────────────────────────────
async function sendViaBrevoApi({ to, subject, html, text }) {
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) throw new Error('BREVO_API_KEY not set')

  // Always use SMTP_USER as sender — it's the pre-authorized Brevo address
  const fromEmail = process.env.SMTP_USER || 'bc0aa6001@smtp-brevo.com'
  const fromName  = 'MEGA Digital Menu'

  const body = JSON.stringify({
    sender:      { name: fromName, email: fromEmail },
    to:          [{ email: to }],
    subject,
    htmlContent: html || `<pre>${text}</pre>`,
    textContent: text || '',
  })

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.brevo.com',
        path:     '/v3/smtp/email',
        method:   'POST',
        headers:  {
          'Content-Type':   'application/json',
          'Accept':         'application/json',
          'api-key':        apiKey,
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = ''
        res.on('data', chunk => data += chunk)
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ ok: true, messageId: JSON.parse(data || '{}').messageId || '' })
          } else {
            reject(new Error(`Brevo API ${res.statusCode}: ${data}`))
          }
        })
      }
    )
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

// ── Send via nodemailer SMTP ──────────────────────────────────────────────────
async function sendViaSMTP({ to, subject, html, text }) {
  const nodemailer = require('nodemailer')

  const smtpHost = process.env.SMTP_HOST || 'smtp-relay.brevo.com'
  const smtpPort = parseInt(process.env.SMTP_PORT || '587')
  const smtpUser = process.env.SMTP_USER
  const smtpPass = process.env.SMTP_PASS

  if (!smtpUser || !smtpPass) {
    throw new Error('SMTP_USER and SMTP_PASS are required for SMTP delivery')
  }

  // The from address MUST be the SMTP_USER for Brevo relay
  const from = `MEGA Digital Menu <${smtpUser}>`

  const transport = nodemailer.createTransport({
    host:   smtpHost,
    port:   smtpPort,
    secure: smtpPort === 465,
    auth:   { user: smtpUser, pass: smtpPass },
    tls:    { rejectUnauthorized: false },
    connectionTimeout: 10000,
    greetingTimeout:   10000,
    socketTimeout:     15000,
  })

  const info = await transport.sendMail({ from, to, subject, html, text })
  return { ok: true, messageId: info.messageId }
}

// ── Main sendEmail function ───────────────────────────────────────────────────
async function sendEmail({ to, subject, html, text }) {
  console.log(`📧 Attempting to send email to ${to}`)
  console.log(`📧 Config: BREVO_API_KEY=${process.env.BREVO_API_KEY ? 'SET' : 'NOT SET'} | SMTP_USER=${process.env.SMTP_USER || 'NOT SET'} | SMTP_PASS=${process.env.SMTP_PASS ? 'SET' : 'NOT SET'}`)

  // Try Brevo HTTP API first (uses SMTP_USER as sender — always authorized)
  if (process.env.BREVO_API_KEY) {
    try {
      const result = await sendViaBrevoApi({ to, subject, html, text })
      console.log(`📧 Brevo HTTP API ✅ sent to ${to} — messageId: ${result.messageId}`)
      return { ok: true, messageId: result.messageId }
    } catch (err) {
      console.error(`📧 Brevo HTTP API ❌ failed: ${err.message}`)
      // Fall through to SMTP
    }
  }

  // Try Brevo SMTP
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const result = await sendViaSMTP({ to, subject, html, text })
      console.log(`📧 Brevo SMTP ✅ sent to ${to}`)
      return result
    } catch (err) {
      console.error(`📧 Brevo SMTP ❌ failed: ${err.message}`)
      return { ok: false, error: `SMTP error: ${err.message}` }
    }
  }

  console.error('📧 No email credentials configured. Set BREVO_API_KEY or SMTP_USER/PASS in environment variables.')
  return { ok: false, error: 'No email provider configured' }
}

// ── Email templates ───────────────────────────────────────────────────────────

function otpEmailHtml(otp, restaurantName) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Your verification code</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
    <tr><td align="center">
      <table width="500" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr>
          <td style="background:#f97316;padding:28px 40px;text-align:center;">
            <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;">MEGA Digital Menu</h1>
            <p style="color:rgba(255,255,255,0.9);margin:6px 0 0;font-size:13px;">Email Verification</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px;">
            <p style="color:#1e293b;font-size:16px;font-weight:600;margin:0 0 8px;">Verify your email address</p>
            <p style="color:#64748b;font-size:14px;line-height:1.6;margin:0 0 28px;">
              You requested to register <strong style="color:#1e293b;">${restaurantName || 'your restaurant'}</strong>
              on MEGA Digital Menu. Use the code below to verify your email address.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td style="background:#fff7ed;border:2px solid #f97316;border-radius:10px;padding:24px;text-align:center;">
                  <p style="color:#7c3aed;font-size:11px;font-weight:700;margin:0 0 12px;text-transform:uppercase;letter-spacing:3px;">Verification Code</p>
                  <p style="font-size:48px;font-weight:900;letter-spacing:14px;color:#f97316;font-family:'Courier New',monospace;margin:0;line-height:1;">${otp}</p>
                  <p style="color:#94a3b8;font-size:12px;margin:14px 0 0;">Expires in <strong style="color:#f97316;">10 minutes</strong></p>
                </td>
              </tr>
            </table>
            <p style="color:#94a3b8;font-size:12px;line-height:1.6;margin:0;padding-top:20px;border-top:1px solid #e2e8f0;">
              If you did not request this code, please ignore this email.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;padding:16px 40px;text-align:center;border-top:1px solid #e2e8f0;">
            <p style="color:#94a3b8;font-size:11px;margin:0;">© ${new Date().getFullYear()} MEGA Digital Menu</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function welcomeEmailHtml({ restaurantName, adminName, slug }) {
  const menuUrl  = `https://digital-menu.app.aletcloud.com/r/${slug}/menu`
  const adminUrl = `https://digital-menu.app.aletcloud.com/admin`
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Welcome to MEGA Digital Menu</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr>
          <td style="background:#f97316;padding:32px 40px;text-align:center;">
            <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;">Welcome to MEGA Digital Menu! 🎉</h1>
            <p style="color:rgba(255,255,255,0.9);margin:6px 0 0;font-size:13px;">Your restaurant is now live</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px;">
            <p style="color:#1e293b;font-size:18px;font-weight:700;margin:0 0 8px;">Hi ${adminName || 'there'}! 👋</p>
            <p style="color:#64748b;font-size:14px;line-height:1.7;margin:0 0 24px;">
              <strong style="color:#1e293b;">${restaurantName}</strong> is now registered on MEGA Digital Menu.
              Your free 14-day trial has started — no credit card required.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td width="48%" style="padding-right:6px;">
                  <a href="${adminUrl}" style="display:block;background:#f97316;color:#ffffff;text-align:center;padding:14px;border-radius:8px;font-weight:700;font-size:14px;text-decoration:none;">Open Admin Panel →</a>
                </td>
                <td width="48%" style="padding-left:6px;">
                  <a href="${menuUrl}" style="display:block;background:#ffffff;color:#f97316;text-align:center;padding:14px;border-radius:8px;font-weight:700;font-size:14px;text-decoration:none;border:2px solid #f97316;">View Your Menu →</a>
                </td>
              </tr>
            </table>
            <p style="color:#94a3b8;font-size:12px;margin:0;">
              Your menu URL: <a href="${menuUrl}" style="color:#f97316;">${menuUrl}</a>
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;padding:16px 40px;text-align:center;border-top:1px solid #e2e8f0;">
            <p style="color:#94a3b8;font-size:11px;margin:0;">© ${new Date().getFullYear()} MEGA Digital Menu</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

module.exports = { sendEmail, otpEmailHtml, welcomeEmailHtml }
