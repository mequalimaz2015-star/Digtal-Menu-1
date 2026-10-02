/**
 * emailService.js — MEGA Digital Menu
 *
 * Uses Brevo Transactional Email HTTP API (v3) — no SMTP, no port issues,
 * no IP whitelisting needed. Just the API key.
 *
 * Set in environment variables (AletCloud Variables tab):
 *   BREVO_API_KEY=xsmtpsib-...   ← your Brevo API key
 *   SMTP_FROM=MEGA Digital Menu <mequalimaz2015@gmail.com>  ← sender name/email
 *
 * Falls back to nodemailer SMTP if BREVO_API_KEY is not set.
 */

const https = require('https')

// ── Send via Brevo HTTP API ───────────────────────────────────────────────────
async function sendViaBrevoApi({ to, subject, html, text }) {
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) throw new Error('BREVO_API_KEY not set')

  const fromRaw  = process.env.SMTP_FROM || 'MEGA Digital Menu <mequalimaz2015@gmail.com>'
  // Parse "Name <email>" format
  const fromMatch = fromRaw.match(/^(.*?)\s*<(.+?)>$/)
  const fromName  = fromMatch ? fromMatch[1].trim() : 'MEGA Digital Menu'
  const fromEmail = fromMatch ? fromMatch[2].trim() : fromRaw.trim()

  const body = JSON.stringify({
    sender:     { name: fromName, email: fromEmail },
    to:         [{ email: to }],
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
          'Content-Type':  'application/json',
          'Accept':        'application/json',
          'api-key':       apiKey,
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

// ── Send via nodemailer SMTP (fallback) ───────────────────────────────────────
async function sendViaSMTP({ to, subject, html, text }) {
  const nodemailer = require('nodemailer')

  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    const transport = nodemailer.createTransport({
      host:   process.env.SMTP_HOST || 'smtp-relay.brevo.com',
      port:   parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      tls:    { rejectUnauthorized: false },
    })
    const info = await transport.sendMail({
      from:    process.env.SMTP_FROM || 'MEGA Digital Menu <mequalimaz2015@gmail.com>',
      to, subject, html, text,
    })
    return { ok: true, messageId: info.messageId }
  }

  // Ethereal test account
  const testAccount = await nodemailer.createTestAccount()
  const transport   = nodemailer.createTransport({
    host: 'smtp.ethereal.email', port: 587, secure: false,
    auth: { user: testAccount.user, pass: testAccount.pass },
  })
  const info    = await transport.sendMail({ from: testAccount.user, to, subject, html, text })
  const preview = nodemailer.getTestMessageUrl(info)
  console.log('📧 Ethereal preview:', preview)
  return { ok: true, messageId: info.messageId, preview }
}

// ── Main sendEmail function ───────────────────────────────────────────────────
async function sendEmail({ to, subject, html, text }) {
  // Try Brevo HTTP API first (preferred — no IP whitelist, no port issues)
  if (process.env.BREVO_API_KEY) {
    try {
      const result = await sendViaBrevoApi({ to, subject, html, text })
      console.log(`📧 Brevo API ✅ sent to ${to} — messageId: ${result.messageId}`)
      return { ok: true, messageId: result.messageId }
    } catch (err) {
      console.error(`📧 Brevo API ❌ failed: ${err.message}`)
      return { ok: false, error: err.message }
    }
  }

  // Fall back to SMTP
  try {
    const result = await sendViaSMTP({ to, subject, html, text })
    console.log(`📧 SMTP ✅ sent to ${to}`)
    return result
  } catch (err) {
    console.error(`📧 SMTP ❌ failed: ${err.message}`)
    return { ok: false, error: err.message }
  }
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
