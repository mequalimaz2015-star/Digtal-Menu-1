/**
 * emailService.js — nodemailer wrapper for MEGA Digital Menu
 *
 * Supports two SMTP providers (set in .env):
 *
 *  Option A — Brevo (RECOMMENDED — delivers to inbox, 300 emails/day free)
 *    Sign up free at: https://brevo.com
 *    Then: Settings → SMTP & API → Generate SMTP Key
 *    SMTP_HOST=smtp-relay.brevo.com
 *    SMTP_PORT=587
 *    SMTP_USER=your-login@smtp-brevo.com   (shown in Settings → SMTP & API)
 *    SMTP_PASS=your-smtp-key               (NOT your account password)
 *    SMTP_FROM=MEGA Digital Menu <noreply@yourdomain.com>
 *
 *  Option B — Gmail App Password (goes to Promotions/Spam tab)
 *    SMTP_HOST=smtp.gmail.com
 *    SMTP_PORT=587
 *    SMTP_USER=youremail@gmail.com
 *    SMTP_PASS=your-16-char-app-password
 *    SMTP_FROM=MEGA Digital Menu <youremail@gmail.com>
 *
 *  Falls back to Ethereal (test SMTP) if no config is set.
 */

const nodemailer = require('nodemailer')

let _transporter = null

async function getTransporter() {
  if (_transporter) return _transporter

  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    const host = process.env.SMTP_HOST || 'smtp.gmail.com'
    const port = parseInt(process.env.SMTP_PORT) || 587
    const isBrevo = host.includes('brevo.com')

    _transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: { rejectUnauthorized: false },
      ...(isBrevo && { pool: true, maxConnections: 5, maxMessages: 100 }),
    })

    try {
      await _transporter.verify()
      const provider = isBrevo ? 'Brevo' : 'Gmail'
      console.log(`📧 Email: ${provider} SMTP connected OK — ${process.env.SMTP_USER}`)
    } catch (verifyErr) {
      console.error('❌ Email: SMTP connection failed:', verifyErr.message)
      _transporter = null
      throw verifyErr
    }
  } else {
    const testAccount = await nodemailer.createTestAccount()
    _transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass },
    })
    console.log('📧 Email: no SMTP config — using Ethereal test account:', testAccount.user)
    console.log('   Preview emails at https://ethereal.email')
  }

  return _transporter
}

// ─────────────────────────────────────────────────────────────────────────────

async function sendEmail({ to, subject, html, text }) {
  try {
    const transport = await getTransporter()
    const from = process.env.SMTP_FROM || 'MEGA Digital Menu <mequalimaz2015@gmail.com>'
    const info = await transport.sendMail({
      from,
      to,
      subject,
      html,
      text,
      headers: {
        'X-Entity-Ref-ID': `mega-${Date.now()}`,
      },
    })
    const preview = nodemailer.getTestMessageUrl(info)
    if (preview) console.log('📧 Email preview (Ethereal):', preview)
    return { ok: true, messageId: info.messageId, preview }
  } catch (err) {
    console.error('❌ Email send failed:', err.message)
    _transporter = null  // reset so next call retries
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

        <!-- Header -->
        <tr>
          <td style="background:#f97316;padding:28px 40px;text-align:center;">
            <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;">MEGA Digital Menu</h1>
            <p style="color:rgba(255,255,255,0.9);margin:6px 0 0;font-size:13px;">Email Verification</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <p style="color:#1e293b;font-size:16px;font-weight:600;margin:0 0 8px;">
              Verify your email address
            </p>
            <p style="color:#64748b;font-size:14px;line-height:1.6;margin:0 0 28px;">
              You requested to register <strong style="color:#1e293b;">${restaurantName || 'your restaurant'}</strong>
              on MEGA Digital Menu. Use the code below to verify your email address.
            </p>

            <!-- OTP Code Box -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td style="background:#fff7ed;border:2px solid #f97316;border-radius:10px;padding:24px;text-align:center;">
                  <p style="color:#7c3aed;font-size:11px;font-weight:700;margin:0 0 12px;text-transform:uppercase;letter-spacing:3px;">Verification Code</p>
                  <p style="font-size:48px;font-weight:900;letter-spacing:14px;color:#f97316;font-family:'Courier New',monospace;margin:0;line-height:1;">
                    ${otp}
                  </p>
                  <p style="color:#94a3b8;font-size:12px;margin:14px 0 0;">
                    This code expires in <strong style="color:#f97316;">10 minutes</strong>
                  </p>
                </td>
              </tr>
            </table>

            <p style="color:#94a3b8;font-size:12px;line-height:1.6;margin:0;padding-top:20px;border-top:1px solid #e2e8f0;">
              If you did not request this code, please ignore this email. Someone may have entered your address by mistake.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:16px 40px;text-align:center;border-top:1px solid #e2e8f0;">
            <p style="color:#94a3b8;font-size:11px;margin:0;">
              © ${new Date().getFullYear()} MEGA Digital Menu &nbsp;·&nbsp; Bole Road, Addis Ababa, Ethiopia
            </p>
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

        <!-- Header -->
        <tr>
          <td style="background:#f97316;padding:32px 40px;text-align:center;">
            <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;">Welcome to MEGA Digital Menu! 🎉</h1>
            <p style="color:rgba(255,255,255,0.9);margin:6px 0 0;font-size:13px;">Your restaurant is now live</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <p style="color:#1e293b;font-size:18px;font-weight:700;margin:0 0 8px;">
              Hi ${adminName || 'there'}! 👋
            </p>
            <p style="color:#64748b;font-size:14px;line-height:1.7;margin:0 0 24px;">
              Congratulations! <strong style="color:#1e293b;">${restaurantName}</strong> is now registered on
              MEGA Digital Menu. Your free 14-day trial has started — no credit card required.
            </p>

            <!-- Buttons -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td width="48%" style="padding-right:6px;">
                  <a href="${adminUrl}"
                     style="display:block;background:#f97316;color:#ffffff;text-align:center;padding:14px;border-radius:8px;font-weight:700;font-size:14px;text-decoration:none;">
                    Open Admin Panel →
                  </a>
                </td>
                <td width="48%" style="padding-left:6px;">
                  <a href="${menuUrl}"
                     style="display:block;background:#ffffff;color:#f97316;text-align:center;padding:14px;border-radius:8px;font-weight:700;font-size:14px;text-decoration:none;border:2px solid #f97316;">
                    View Your Menu →
                  </a>
                </td>
              </tr>
            </table>

            <!-- Next steps -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:10px;padding:20px;margin-bottom:20px;">
              <tr><td>
                <p style="color:#1e293b;font-weight:700;font-size:14px;margin:0 0 14px;">🚀 Next Steps</p>
                ${[
                  '🍽️ Add your menu categories and items',
                  '📱 Set up tables and download QR codes',
                  '👥 Add kitchen and waiter staff accounts',
                  '💬 Share your menu link with customers',
                ].map((step, i) => `
                <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;">
                  <tr>
                    <td width="28" style="vertical-align:top;">
                      <span style="display:inline-block;width:22px;height:22px;background:#f97316;border-radius:50%;text-align:center;line-height:22px;font-size:11px;font-weight:900;color:#ffffff;">${i + 1}</span>
                    </td>
                    <td style="vertical-align:top;padding-left:8px;">
                      <p style="color:#64748b;font-size:13px;margin:2px 0 0;">${step}</p>
                    </td>
                  </tr>
                </table>`).join('')}
              </td></tr>
            </table>

            <p style="color:#94a3b8;font-size:12px;margin:0;">
              Your menu URL:
              <a href="${menuUrl}" style="color:#f97316;text-decoration:none;">${menuUrl}</a>
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:16px 40px;text-align:center;border-top:1px solid #e2e8f0;">
            <p style="color:#94a3b8;font-size:11px;margin:0;">
              © ${new Date().getFullYear()} MEGA Digital Menu &nbsp;·&nbsp; Bole Road, Addis Ababa, Ethiopia
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

module.exports = { sendEmail, otpEmailHtml, welcomeEmailHtml }
