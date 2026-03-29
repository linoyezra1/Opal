import { Resend } from 'resend';

const rtlWrap = (inner) => `
<!doctype html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;color:#0f172a;direction:rtl;text-align:right;">
${inner}
</body>
</html>`;

/** Email 1 — אחרי תשלום מוצלח: ללא מצורפים, קישור בולט להשלמת מוטבים */
function buildOrderConfirmationHtml(payload) {
  const amount = Number(payload.monthlyTotal || 0).toLocaleString('he-IL');
  const link = payload.beneficiaryLink || '#';

  return rtlWrap(`
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:640px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;direction:rtl;text-align:right;">
          <tr>
            <td style="padding:28px 24px;background:#eff6ff;border-bottom:1px solid #dbeafe;text-align:center;">
              <div style="display:inline-block;padding:10px 18px;border-radius:12px;background:#dbeafe;color:#1d4ed8;font-weight:700;">OPAL</div>
              <h1 style="margin:18px 0 8px 0;font-size:22px;text-align:center;">אישור הזמנה</h1>
              <p style="margin:0;color:#475569;font-size:15px;text-align:center;">תודה שבחרת באופאל — רופא עד הבית</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px;direction:rtl;text-align:right;">
              <h2 style="margin:0 0 12px 0;font-size:17px;text-align:right;">פרטי ההזמנה</h2>
              <p style="margin:6px 0;font-size:15px;text-align:right;"><strong>מספר הזמנה:</strong> ${payload.orderNumber || '—'}</p>
              <p style="margin:6px 0;font-size:15px;text-align:right;"><strong>שם לקוח:</strong> ${payload.customerName || '—'}</p>
              <p style="margin:6px 0;font-size:15px;text-align:right;"><strong>דוא״ל:</strong> <span dir="ltr" style="display:inline-block;text-align:left;">${payload.email || '—'}</span></p>
              <p style="margin:6px 0;font-size:15px;text-align:right;"><strong>טלפון:</strong> <span dir="ltr" style="display:inline-block;text-align:left;">${payload.phone || '—'}</span></p>
              <p style="margin:6px 0;font-size:15px;text-align:right;"><strong>מוצר:</strong> ${payload.productName || '—'}</p>
              <p style="margin:6px 0;font-size:15px;text-align:right;"><strong>תשלום חודשי:</strong> ₪${amount}</p>
              <p style="margin:6px 0;font-size:15px;text-align:right;"><strong>תאריך:</strong> ${payload.orderDate || '—'}</p>

              <div style="margin:28px 0 8px 0;padding:20px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;text-align:center;">
                <p style="margin:0 0 16px 0;font-size:15px;color:#334155;text-align:center;">להשלמת פרטי המוטבים במערכת</p>
                <a href="${link}" style="display:inline-block;background:#2563eb;color:#ffffff !important;text-decoration:none;padding:14px 28px;border-radius:12px;font-weight:700;font-size:16px;text-align:center;">
                  לחץ כאן להשלמת פרטי מוטבים
                </a>
              </div>
              <p style="margin:16px 0 0 0;font-size:13px;color:#64748b;text-align:center;">אם הכפתור לא נפתח, העתיקו את הקישור לדפדפן:<br /><span dir="ltr" style="word-break:break-all;">${link}</span></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`);
}

/** Email 2 — אחרי שליחת טופס מוטבים: כולל מצורפים (PDF סיכום + מסמכים) */
function buildBeneficiaryCompletionHtml(payload) {
  const amount = Number(payload.monthlyTotal || 0).toLocaleString('he-IL');

  return rtlWrap(`
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:640px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;direction:rtl;text-align:right;">
          <tr>
            <td style="padding:28px 24px;background:#ecfdf5;border-bottom:1px solid #a7f3d0;text-align:center;">
              <div style="display:inline-block;padding:10px 18px;border-radius:12px;background:#d1fae5;color:#047857;font-weight:700;">OPAL</div>
              <h1 style="margin:18px 0 8px 0;font-size:22px;text-align:center;">השלמת פרטי מוטבים</h1>
              <p style="margin:0;color:#065f46;font-size:15px;text-align:center;">הפרטים נקלטו בהצלחה. מצורפים מסמכים וסיכום להדפסה.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px;direction:rtl;text-align:right;">
              <h2 style="margin:0 0 12px 0;font-size:17px;">סיכום הזמנה</h2>
              <p style="margin:6px 0;font-size:15px;"><strong>מספר הזמנה:</strong> ${payload.orderNumber || '—'}</p>
              <p style="margin:6px 0;font-size:15px;"><strong>שם לקוח:</strong> ${payload.customerName || '—'}</p>
              <p style="margin:6px 0;font-size:15px;"><strong>מוצר:</strong> ${payload.productName || '—'}</p>
              <p style="margin:6px 0;font-size:15px;"><strong>תשלום חודשי:</strong> ₪${amount}</p>
              <p style="margin:6px 0;font-size:15px;"><strong>תאריך:</strong> ${payload.orderDate || '—'}</p>

              <div style="margin-top:20px;padding:16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
                <h3 style="margin:0 0 8px 0;font-size:16px;">מוטב ראשי</h3>
                <p style="margin:4px 0;font-size:15px;">${payload.primaryBeneficiary?.name || '—'} — ת.ז <span dir="ltr">${payload.primaryBeneficiary?.idNumber || '—'}</span></p>
              </div>

              <p style="margin-top:20px;font-size:14px;color:#475569;">במייל זה צורפו: סיכום מוטבים ב־PDF, גילוי נאות וכתב שירות.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`);
}

export async function sendOrderConfirmationEmail(payload) {
  const to = String(payload.to || '').trim();
  if (!to) return { sent: false, reason: 'missing-recipient' };
  const apiKey = String(process.env.RESEND_API_KEY || '').trim();
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not configured; skipping email send');
    return { sent: false, reason: 'resend-not-configured' };
  }

  const resend = new Resend(apiKey);
  const fromAddress = process.env.MAIL_FROM_ADDRESS || 'onboarding@resend.dev';
  const fromName = process.env.MAIL_FROM_NAME || 'OPAL';
  const subject = `אישור הזמנה - ${payload.orderNumber || ''}`.trim();
  const html = buildOrderConfirmationHtml(payload);

  try {
    const result = await resend.emails.send({
      from: `"${fromName}" <${fromAddress}>`,
      to: [to],
      subject,
      html,
      attachments: [],
    });
    if (result?.error) {
      console.error('[email] Resend send failed', result.error);
      throw new Error(result.error?.message || 'Resend send failed');
    }
    return { sent: true, provider: 'resend', id: result?.data?.id || null };
  } catch (err) {
    console.error('[email] Resend send exception', {
      message: err?.message || String(err),
      name: err?.name,
      statusCode: err?.statusCode,
    });
    throw err;
  }
}

/** מייל סיום אחרי טופס מוטבים — חייב מצורפים (מועברים מ־index.js) */
export async function sendBeneficiaryCompletionEmail(payload) {
  const to = String(payload.to || '').trim();
  if (!to) return { sent: false, reason: 'missing-recipient' };
  const apiKey = String(process.env.RESEND_API_KEY || '').trim();
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not configured; skipping beneficiary completion email');
    return { sent: false, reason: 'resend-not-configured' };
  }

  const attachments = Array.isArray(payload.attachments) ? payload.attachments : [];
  if (!attachments.length) {
    console.warn('[email] Beneficiary completion email skipped: no attachments');
    return { sent: false, reason: 'missing-attachments' };
  }

  const resend = new Resend(apiKey);
  const fromAddress = process.env.MAIL_FROM_ADDRESS || 'onboarding@resend.dev';
  const fromName = process.env.MAIL_FROM_NAME || 'OPAL';
  const subject = `סיכום מוטבים והזמנה - ${payload.orderNumber || ''}`.trim();
  const html = buildBeneficiaryCompletionHtml(payload);

  try {
    const result = await resend.emails.send({
      from: `"${fromName}" <${fromAddress}>`,
      to: [to],
      subject,
      html,
      attachments,
    });
    if (result?.error) {
      console.error('[email] Resend beneficiary completion failed', result.error);
      throw new Error(result.error?.message || 'Resend send failed');
    }
    return { sent: true, provider: 'resend', id: result?.data?.id || null };
  } catch (err) {
    console.error('[email] Resend beneficiary completion exception', {
      message: err?.message || String(err),
      name: err?.name,
      statusCode: err?.statusCode,
    });
    throw err;
  }
}
