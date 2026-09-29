/**
 * emailService.js — nodemailer wrapper for MEGA Digital Menu
 *
 * Uses env vars:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 *
 * Falls back to Ethereal (test SMTP) if no config set — perfect for dev.
 */

const nodemailer = require('nodemailer')

let _transporter = null

async function getTransporter() {
  if (_transporter) return _transporter

  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    _transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST || 'smtp.gmail.com',
      port:   parseInt(process.env.SMTP_PORT) || 587,
      secure: parseInt(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
    console.log('📧 Email: using configured SMTP', process.env.SMTP_HOST)
  } else {
    // Create a disposable Ethereal test account — emails visible at ethereal.email
    const testAccount = await nodemailer.createTestAccount()
    _transporter = nodemailer.createTransport({
      host:   'smtp.ethereal.email',
      port:   587,
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
    const from = process.env.SMTP_FROM || '"MEGA Digital Menu" <noreply@megadigitalmenu.com>'
    const info = await transport.sendMail({ from, to, subject, html, text })
    const preview = nodemailer.getTestMessageUrl(info)
    if (preview) console.log('📧 Email preview (Ethereal):', preview)
    return { ok: true, messageId: info.messageId, preview }
  } catch (err) {
    console.error('❌ Email send failed:', err.message)
    return { ok: false, error: err.message }
  }
}

// ── Email templates ───────────────────────────────────────────────────────────

function otpEmailHtml(otp, restaurantName) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155;">

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#f59e0b,#ea580c);padding:32px 40px;text-align:center;">
          <img src="https://digital-menu.app.aletcloud.com/mega-logo.png" alt="MEGA" width="60" height="60"
               style="border-radius:50%;border:3px solid rgba(255,255,255,0.3);margin-bottom:12px;" />
          <h1 style="color:#fff;margin:0;font-size:22px;font-weight:800;">MEGA Digital Menu</h1>
          <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:13px;">Email Verification</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:40px;">
          <h2 style="color:#f1f5f9;font-size:20px;margin:0 0 8px;">Verify your email address</h2>
          <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 28px;">
            Hi there! You're registering <strong style="color:#f1f5f9;">${restaurantName || 'your restaurant'}</strong>
            on MEGA Digital Menu. Enter the code below to confirm your email address.
          </p>

          <!-- OTP Box -->
          <div style="background:#0f172a;border:2px solid #f59e0b;border-radius:12px;padding:24px;text-align:center;margin-bottom:28px;">
            <p style="color:#94a3b8;font-size:12px;margin:0 0 8px;text-transform:uppercase;letter-spacing:2px;">Your Verification Code</p>
            <div style="font-size:48px;font-weight:900;letter-spacing:10px;color:#f59e0b;font-family:monospace;">
              ${otp}
            </div>
            <p style="color:#64748b;font-size:12px;margin:12px 0 0;">This code expires in <strong style="color:#f59e0b;">10 minutes</strong></p>
          </div>

          <p style="color:#64748b;font-size:12px;line-height:1.6;margin:0;">
            If you didn't request this, you can safely ignore this email. Someone may have entered your email by mistake.
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#0f172a;padding:20px 40px;text-align:center;border-top:1px solid #1e293b;">
          <p style="color:#475569;font-size:11px;margin:0;">
            © ${new Date().getFullYear()} MEGA Digital Menu · Bole Road, Addis Ababa, Ethiopia
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function welcomeEmailHtml({ restaurantName, adminName, slug }) {
  const menuUrl = `https://digital-menu.app.aletcloud.com/r/${slug}/menu`
  const adminUrl = `https://digital-menu.app.aletcloud.com/admin`
  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155;">

        <tr><td style="background:linear-gradient(135deg,#f59e0b,#ea580c);padding:32px 40px;text-align:center;">
          <img src="https://digital-menu.app.aletcloud.com/mega-logo.png" alt="MEGA" width="60" height="60"
               style="border-radius:50%;border:3px solid rgba(255,255,255,0.3);margin-bottom:12px;" />
          <h1 style="color:#fff;margin:0;font-size:22px;font-weight:800;">Welcome to MEGA Digital Menu! 🎉</h1>
          <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:13px;">Your restaurant is live</p>
        </td></tr>

        <tr><td style="padding:40px;">
          <h2 style="color:#f1f5f9;font-size:20px;margin:0 0 8px;">Hi ${adminName || 'there'}! 👋</h2>
          <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 24px;">
            Congratulations! <strong style="color:#f1f5f9;">${restaurantName}</strong> is now registered on
            MEGA Digital Menu. Your free 14-day trial has started — no credit card required.
          </p>

          <!-- CTA buttons -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
            <tr>
              <td width="48%" style="padding-right:8px;">
                <a href="${adminUrl}" style="display:block;background:linear-gradient(135deg,#f59e0b,#ea580c);color:#fff;text-align:center;padding:14px 20px;border-radius:10px;font-weight:700;font-size:14px;text-decoration:none;">
                  Open Admin Panel →
                </a>
              </td>
              <td width="48%" style="padding-left:8px;">
                <a href="${menuUrl}" style="display:block;background:#1e293b;color:#f59e0b;text-align:center;padding:14px 20px;border-radius:10px;font-weight:700;font-size:14px;text-decoration:none;border:1px solid #f59e0b;">
                  View Your Menu →
                </a>
              </td>
            </tr>
          </table>

          <!-- Steps -->
          <div style="background:#0f172a;border-radius:12px;padding:20px;">
            <p style="color:#f1f5f9;font-weight:700;font-size:14px;margin:0 0 16px;">🚀 Next Steps:</p>
            ${[
              ['1', '🍽️ Add your menu categories and items'],
              ['2', '📱 Set up your tables and download QR codes'],
              ['3', '👥 Add your kitchen and waiter staff accounts'],
              ['4', '💬 Share your menu link with customers'],
            ].map(([n, text]) => `
            <div style="display:flex;gap:12px;margin-bottom:12px;">
              <div style="width:24px;height:24px;background:#f59e0b;border-radius:50%;text-align:center;line-height:24px;font-size:12px;font-weight:900;color:#0f172a;flex-shrink:0;">${n}</div>
              <p style="color:#94a3b8;font-size:13px;margin:2px 0 0;">${text}</p>
            </div>`).join('')}
          </div>

          <div style="margin-top:24px;padding:16px;background:#0f172a;border-radius:10px;border-left:3px solid #f59e0b;">
            <p style="color:#94a3b8;font-size:12px;margin:0;">
              Your menu URL: <a href="${menuUrl}" style="color:#f59e0b;">${menuUrl}</a>
            </p>
          </div>
        </td></tr>

        <tr><td style="background:#0f172a;padding:20px 40px;text-align:center;border-top:1px solid #1e293b;">
          <p style="color:#475569;font-size:11px;margin:0;">
            Questions? Email us at <a href="mailto:support@megadigitalmenu.com" style="color:#f59e0b;">support@megadigitalmenu.com</a>
            or call +251 911 000 000
          </p>
          <p style="color:#334155;font-size:11px;margin:8px 0 0;">
            © ${new Date().getFullYear()} MEGA Digital Menu · Bole Road, Addis Ababa, Ethiopia
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

module.exports = { sendEmail, otpEmailHtml, welcomeEmailHtml }
