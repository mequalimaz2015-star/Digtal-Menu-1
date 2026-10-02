/**
 * emailService.js — MEGA Digital Menu
 *
 * Uses Brevo Transactional Email HTTP API (v3).
 *
 * Required env vars (set in AletCloud Variables tab):
 *   BREVO_API_KEY   — your Brevo API key (xsmtpsib-...)
 *   BREVO_SENDER    — sender email (must be your verified Brevo SMTP login)
 *
 * The BREVO_API_KEY and BREVO_SENDER are read at runtime from env vars.
 * Set them in AletCloud → your app → Variables / Environment tab.
 */

const https = require('https')

// ── Resolve sender: use BREVO_SENDER or fall back to SMTP_USER ───────────────
function getSender() {
  return process.env.BREVO_SENDER || process.env.SMTP_USER || ''
}

function getApiKey() {
  return process.env.BREVO_API_KEY || ''
}

// ── Send via Brevo HTTP API ───────────────────────────────────────────────────
async function sendViaBrevoApi({ to, subject, html, text }) {
  const apiKey     = getApiKey()
  const senderEmail = getSender()

  if (!apiKey)        throw new Error('BREVO_API_KEY env var not set')
  if (!senderEmail)   throw new Error('BREVO_SENDER (or SMTP_USER) env var not set')

  const body = JSON.stringify({
    sender:      { name: 'MEGA Digital Menu', email: senderEmail },
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

// ── Send via Brevo SMTP (nodemailer fallback) ─────────────────────────────────
async function sendViaSMTP({ to, subject, html, text }) {
  const nodemailer  = require('nodemailer')
  const smtpUser    = process.env.SMTP_USER
  const smtpPass    = process.env.SMTP_PASS
  const smtpHost    = process.env.SMTP_HOST || 'smtp-relay.brevo.com'
  const smtpPort    = parseInt(process.env.SMTP_PORT || '587')
  const senderEmail = getSender()

  if (!smtpUser || !smtpPass) throw new Error('SMTP_USER / SMTP_PASS env vars not set')

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

  const info = await transport.sendMail({
    from: `MEGA Digital Menu <${senderEmail || smtpUser}>`,
    to, subject, html, text,
  })
  return { ok: true, messageId: info.messageId }
}

// ── Main sendEmail ────────────────────────────────────────────────────────────
async function sendEmail({ to, subject, html, text }) {
  const apiKey      = getApiKey()
  const senderEmail = getSender()
  console.log(`📧 Sending to ${to} | BREVO_API_KEY=${apiKey ? 'SET' : 'NOT SET'} | sender=${senderEmail || 'NOT SET'}`)

  // Try HTTP API first
  if (apiKey && senderEmail) {
    try {
      const result = await sendViaBrevoApi({ to, subject, html, text })
      console.log(`📧 Brevo API ✅ sent to ${to}`)
      return { ok: true, messageId: result.messageId }
    } catch (apiErr) {
      console.error(`📧 Brevo API ❌ ${apiErr.message}`)
    }
  }

  // Try SMTP fallback
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const result = await sendViaSMTP({ to, subject, html, text })
      console.log(`📧 Brevo SMTP ✅ sent to ${to}`)
      return result
    } catch (smtpErr) {
      console.error(`📧 Brevo SMTP ❌ ${smtpErr.message}`)
      return { ok: false, error: smtpErr.message }
    }
  }

  const missing = []
  if (!apiKey)      missing.push('BREVO_API_KEY')
  if (!senderEmail) missing.push('BREVO_SENDER')
  if (!process.env.SMTP_USER) missing.push('SMTP_USER')
  if (!process.env.SMTP_PASS) missing.push('SMTP_PASS')

  const errMsg = `Email not configured. Missing env vars: ${missing.join(', ')}. Set them in AletCloud → Variables tab.`
  console.error(`📧 ❌ ${errMsg}`)
  return { ok: false, error: errMsg }
}

// ── OTP email template ────────────────────────────────────────────────────────
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

// ── Welcome email template ────────────────────────────────────────────────────
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
