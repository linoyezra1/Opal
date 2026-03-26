import nodemailer from 'nodemailer';

function buildOrderConfirmationHtml(payload) {
  const amount = Number(payload.monthlyTotal || 0).toLocaleString('he-IL');
  const secondaries = Array.isArray(payload.secondaryBeneficiaries) ? payload.secondaryBeneficiaries : [];
  const secondaryRows = secondaries
    .map(
      (b, i) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${i + 2}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${b.name || '—'}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;" dir="ltr">${b.idNumber || '—'}</td>
      </tr>`
    )
    .join('');

  return `
<!doctype html>
<html lang="he" dir="rtl">
<body style="margin:0;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a;">
  <table width="100%" cellspacing="0" cellpadding="0" style="padding:24px;">
    <tr>
      <td align="center">
        <table width="680" cellspacing="0" cellpadding="0" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:24px;background:#eff6ff;border-bottom:1px solid #dbeafe;text-align:center;">
              <div style="display:inline-block;padding:10px 16px;border-radius:12px;background:#dbeafe;color:#1d4ed8;font-weight:700;">OPAL</div>
              <h1 style="margin:16px 0 6px 0;font-size:24px;">אישור הזמנה</h1>
              <p style="margin:0;color:#475569;">תודה שבחרת באופאל - רופא עד הבית</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px;">
              <h2 style="margin:0 0 10px 0;font-size:18px;">פרטי הזמנה</h2>
              <p style="margin:4px 0;"><strong>מספר הזמנה:</strong> ${payload.orderNumber || '—'}</p>
              <p style="margin:4px 0;"><strong>שם לקוח:</strong> ${payload.customerName || '—'}</p>
              <p style="margin:4px 0;"><strong>דוא"ל:</strong> <span dir="ltr">${payload.email || '—'}</span></p>
              <p style="margin:4px 0;"><strong>טלפון:</strong> <span dir="ltr">${payload.phone || '—'}</span></p>
              <p style="margin:4px 0;"><strong>מוצר:</strong> ${payload.productName || '—'}</p>
              <p style="margin:4px 0;"><strong>תשלום חודשי:</strong> ₪${amount}</p>
              <p style="margin:4px 0;"><strong>תאריך:</strong> ${payload.orderDate || '—'}</p>

              <div style="margin-top:20px;padding:16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
                <h3 style="margin:0 0 8px 0;font-size:16px;">פרטי מוטבים</h3>
                <p style="margin:4px 0;"><strong>מוטב ראשי:</strong> ${payload.primaryBeneficiary?.name || '—'} (${payload.primaryBeneficiary?.idNumber || '—'})</p>
                ${
                  secondaryRows
                    ? `<table width="100%" cellspacing="0" cellpadding="0" style="margin-top:10px;border-collapse:collapse;">
                    <tr>
                      <th style="text-align:right;padding:8px;border-bottom:1px solid #cbd5e1;">#</th>
                      <th style="text-align:right;padding:8px;border-bottom:1px solid #cbd5e1;">שם</th>
                      <th style="text-align:right;padding:8px;border-bottom:1px solid #cbd5e1;">ת.ז</th>
                    </tr>
                    ${secondaryRows}
                  </table>`
                    : '<p style="margin:8px 0 0 0;color:#64748b;">לא הוגדרו מוטבים משניים.</p>'
                }
              </div>

              <div style="margin-top:24px;text-align:center;">
                <a href="${payload.beneficiaryLink || '#'}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:700;">
                  להשלמת פרטי מוטבים
                </a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function createTransporter() {
  const user = process.env.SMTP_USER || '';
  const pass = process.env.SMTP_PASS || '';
  if (!user || !pass) return null;

  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    family: 4,
    auth: { user, pass },
  });
}

export async function sendOrderConfirmationEmail(payload) {
  const to = String(payload.to || '').trim();
  if (!to) return { sent: false, reason: 'missing-recipient' };

  const transporter = createTransporter();
  if (!transporter) {
    console.warn('[email] SMTP not configured; skipping email send');
    return { sent: false, reason: 'smtp-not-configured' };
  }

  const fromAddress = process.env.MAIL_FROM_ADDRESS || 'linoy05353@gmail.com';
  const fromName = process.env.MAIL_FROM_NAME || 'OPAL';
  const subject = `אישור הזמנה - ${payload.orderNumber || ''}`.trim();
  const html = buildOrderConfirmationHtml(payload);

  await transporter.sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    to,
    subject,
    html,
  });
  return { sent: true };
}

