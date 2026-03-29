import { Resend } from 'resend';
import { getOpalLogoDataUriForEmail, OPAL_BLUE, OPAL_GOLD } from './emailBrandAssets.js';

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function telHref(phone) {
  const d = String(phone || '').replace(/\D/g, '');
  return d ? `tel:${d}` : '#';
}

const rtlWrap = (inner) => `
<!doctype html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin:0;background:#f5f5f5;font-family:'Heebo','Segoe UI',Arial,sans-serif;color:#333;direction:rtl;text-align:right;">
${inner}
</body>
</html>`;

/**
 * Email 1 — visual parity with `src/NEW/components/email/post-payment-email.tsx`.
 * Logo sits above the navy headline band (not inside it). Opening line per product copy.
 */
function buildOrderConfirmationHtml(payload, logoDataUri = '') {
  const amount = Number(payload.monthlyTotal || 0).toLocaleString('he-IL');
  const link = String(payload.beneficiaryLink || '#').trim() || '#';
  const monthlyDisplay = `₪${amount}`;

  const orderId = escapeHtml(payload.orderNumber || '—');
  const orderDate = escapeHtml(payload.orderDate || '—');
  const customerName = escapeHtml(payload.customerName || 'לקוח');
  const productTitle = escapeHtml(
    String(payload.productName || payload.subscriptionType || '').trim() || 'רופא עד הבית'
  );

  const servicePhone = escapeHtml(String(process.env.MEDICAL_SERVICES_PHONE || '00-0000000').trim());
  const claimsLink = String(process.env.CLAIMS_ONLINE_URL || '#').trim() || '#';
  const salesPhone = escapeHtml(String(process.env.OPAL_SALES_PHONE || '054-4261369').trim());
  const contactEmail = escapeHtml(String(process.env.OPAL_CONTACT_EMAIL || 'opal2000@zahav.net.il').trim());

  const logoBlock = logoDataUri
    ? `<img src="${escapeAttr(logoDataUri)}" alt="אופאל" width="140" height="40" style="height:40px;width:auto;max-width:180px;display:inline-block;background-color:#ffffff;border-radius:4px;padding:4px 8px;object-fit:contain;" />`
    : `<span style="font-size:20px;font-weight:700;color:${OPAL_BLUE};letter-spacing:0.02em;">אופאל</span>`;

  return rtlWrap(`
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f5f5f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background-color:#ffffff;direction:rtl;">
          <tr>
            <td style="padding:24px 32px 16px;text-align:center;background-color:#ffffff;">
              ${logoBlock}
            </td>
          </tr>
          <tr>
            <td style="background-color:${OPAL_BLUE};padding:20px 32px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:600;line-height:1.4;">
                שמחים על הצטרפותך למנוי ${productTitle}
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px;">
              <p style="font-size:15px;color:#333;margin:0 0 16px;line-height:1.7;">
                שלום ${customerName}, כתב השירות וגילוי הנאות מצורפים למייל זה.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-bottom:24px;">
                <tr>
                  <td style="padding:10px 0;color:#666;font-size:14px;border-bottom:1px solid #eee;">מספר הזמנה</td>
                  <td style="padding:10px 0;color:${OPAL_BLUE};font-size:14px;font-weight:600;text-align:left;border-bottom:1px solid #eee;">${orderId}</td>
                </tr>
                <tr>
                  <td style="padding:10px 0;color:#666;font-size:14px;border-bottom:1px solid #eee;">תאריך</td>
                  <td style="padding:10px 0;color:${OPAL_BLUE};font-size:14px;text-align:left;border-bottom:1px solid #eee;">${orderDate}</td>
                </tr>
                <tr>
                  <td style="padding:12px 0;color:${OPAL_BLUE};font-size:15px;font-weight:600;">תשלום חודשי</td>
                  <td style="padding:12px 0;color:${OPAL_GOLD};font-size:18px;font-weight:700;text-align:left;">${escapeHtml(monthlyDisplay)}</td>
                </tr>
              </table>
              <div style="border-right:3px solid ${OPAL_GOLD};padding-right:16px;margin-bottom:28px;">
                <p style="font-size:14px;color:${OPAL_BLUE};margin:0 0 8px;font-weight:600;">להפעלת השירות יש למלא את פרטי המוטבים</p>
                <p style="font-size:13px;color:#666;margin:0 0 14px;">ללא קבלת פרטי המוטבים לא יהיה ניתן לקבל את השירות</p>
                <a href="${escapeAttr(link)}" style="display:inline-block;background-color:${OPAL_BLUE};color:#ffffff !important;padding:10px 20px;border-radius:4px;text-decoration:none;font-size:14px;font-weight:500;">
                  מילוי פרטי מוטבים
                </a>
              </div>
              <div style="border-top:1px solid #eee;margin-bottom:20px;"></div>
              <div style="font-size:14px;color:#555;line-height:1.8;">
                <p style="margin:0 0 6px;">
                  <span style="color:${OPAL_BLUE};font-weight:500;">הזמנת שירותים רפואיים:</span>
                  <span dir="ltr">${servicePhone}</span>
                </p>
                <p style="margin:0 0 6px;">
                  <span style="color:${OPAL_BLUE};font-weight:500;">הגשת מסמכים:</span>
                  <a href="${escapeAttr(claimsLink)}" style="color:${OPAL_GOLD};text-decoration:none;">תביעה און ליין</a>
                </p>
                <p style="margin:0;">
                  <span style="color:${OPAL_BLUE};font-weight:500;">מכירות:</span>
                  <span dir="ltr">${salesPhone}</span>
                </p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color:#F5F5F5;padding:16px 32px;text-align:center;">
              <p style="font-size:12px;color:#666;margin:0 0 4px;">החיוב החודשי דרך חברת אופאל תקשורת בע״מ</p>
              <p style="font-size:12px;color:#888;margin:0;" dir="ltr">${salesPhone} | ${contactEmail}</p>
            </td>
          </tr>
        </table>
        <p style="margin:16px 0 0;font-size:13px;color:#64748b;text-align:center;max-width:560px;">
          אם הכפתור לא נפתח, העתיקו את הקישור לדפדפן:<br />
          <span dir="ltr" style="word-break:break-all;">${escapeHtml(link)}</span>
        </p>
      </td>
    </tr>
  </table>`);
}

/**
 * Email 2 — visual parity with `src/NEW/components/email/final-summary-email.tsx`.
 */
function buildBeneficiaryCompletionHtml(payload) {
  const amount = Number(payload.monthlyTotal || 0).toLocaleString('he-IL');
  const monthlyDisplay = `₪${amount}`;
  const subscriptionType = escapeHtml(
    String(payload.subscriptionType || payload.productName || '').trim() || 'רופא עד הבית'
  );

  const orderId = escapeHtml(payload.orderNumber || '—');
  const orderDate = escapeHtml(payload.orderDate || '—');
  const primaryName = escapeHtml(payload.primaryBeneficiary?.name || '—');
  const primaryId = escapeHtml(payload.primaryBeneficiary?.idNumber || '—');

  const secondaries = Array.isArray(payload.secondaryBeneficiaries) ? payload.secondaryBeneficiaries : [];
  let beneficiariesRows = '';
  secondaries.forEach((b, index) => {
    const name = escapeHtml(b?.name || '—');
    const idNum = escapeHtml(b?.idNumber || '—');
    const border = index < secondaries.length - 1 ? 'border-bottom:1px solid #eee;' : 'border-bottom:none;';
    beneficiariesRows += `
      <tr>
        <td style="padding:10px 0;color:#333;font-size:14px;${border}">${name}</td>
        <td style="padding:10px 0;color:#666;font-size:14px;text-align:left;direction:ltr;${border}">${idNum}</td>
      </tr>`;
  });

  const beneficiariesBlock =
    secondaries.length > 0
      ? `
      <div style="margin-bottom:24px;">
        <div style="font-size:14px;color:${OPAL_BLUE};font-weight:600;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #eee;">
          מוטבים נוספים
        </div>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
          <tbody>${beneficiariesRows}</tbody>
        </table>
      </div>`
      : '';

  const medicalPhone = String(process.env.MEDICAL_SERVICES_PHONE || '00-0000000').trim();
  const claimsLink = String(process.env.CLAIMS_ONLINE_URL || '#').trim() || '#';
  const medicalPhoneEsc = escapeHtml(medicalPhone);
  const tel = escapeAttr(telHref(medicalPhone));

  return rtlWrap(`
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f5f5f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background-color:#ffffff;direction:rtl;">
          <tr>
            <td style="background-color:${OPAL_BLUE};padding:28px 32px;text-align:center;">
              <h1 style="color:#ffffff;font-size:20px;font-weight:600;margin:0;">סיכום הצטרפות ופרטי מנוי</h1>
              <p style="color:rgba(255,255,255,0.8);font-size:14px;margin:8px 0 0;">אופאל - רופא עד הבית</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-bottom:24px;">
                <tr>
                  <td style="padding:8px 0;color:#666;font-size:14px;">מספר הזמנה</td>
                  <td style="padding:8px 0;color:${OPAL_BLUE};font-size:14px;font-weight:600;text-align:left;">${orderId}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#666;font-size:14px;">תאריך</td>
                  <td style="padding:8px 0;color:${OPAL_BLUE};font-size:14px;text-align:left;">${orderDate}</td>
                </tr>
              </table>
              <div style="background-color:#F8F9FA;border-right:4px solid ${OPAL_GOLD};padding:16px;margin-bottom:20px;">
                <div style="font-size:11px;color:${OPAL_GOLD};font-weight:600;margin-bottom:8px;">מבוטח ראשי</div>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="text-align:right;"><span style="color:${OPAL_BLUE};font-size:16px;font-weight:600;">${primaryName}</span></td>
                    <td style="text-align:left;white-space:nowrap;"><span style="color:#666;font-size:14px;direction:ltr;">${primaryId}</span></td>
                  </tr>
                </table>
              </div>
              ${beneficiariesBlock}
              <div style="background-color:#F8F9FA;padding:16px;margin-bottom:24px;text-align:center;">
                <div style="color:#666;font-size:13px;margin-bottom:4px;">סוג מנוי</div>
                <div style="color:${OPAL_BLUE};font-size:15px;font-weight:600;margin-bottom:12px;">${subscriptionType}</div>
                <span style="display:inline-block;background-color:${OPAL_BLUE};color:#ffffff;font-size:18px;font-weight:700;padding:10px 24px;border-radius:4px;">
                  ${escapeHtml(monthlyDisplay)} לחודש
                </span>
              </div>
              <div style="border-top:1px solid #eee;margin-bottom:20px;"></div>
              <div style="text-align:center;margin-bottom:24px;">
                <div style="color:#666;font-size:13px;margin-bottom:8px;">טלפונים להזמנת שירותים רפואיים</div>
                <a href="${tel}" style="color:${OPAL_BLUE};font-size:20px;font-weight:700;text-decoration:none;direction:ltr;display:inline-block;">
                  ${medicalPhoneEsc}
                </a>
                <div style="margin-top:16px;">
                  <a href="${escapeAttr(claimsLink)}" style="color:${OPAL_GOLD};font-size:14px;font-weight:500;text-decoration:none;">
                    להגשת מסמכים רפואיים - תביעה און ליין
                  </a>
                </div>
              </div>
              <div style="border-right:3px solid ${OPAL_GOLD};padding-right:12px;font-size:13px;color:#555;line-height:1.6;">
                <strong style="color:${OPAL_BLUE};">שים לב:</strong> החיוב החודשי דרך חברת אופאל תקשורת בע״מ.<br />
                לפניות: 054-4261369 | opal2000@zahav.net.il
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color:#F5F5F5;padding:16px 32px;text-align:center;">
              <p style="font-size:11px;color:#888;margin:0;">
                המנוי כפוף לכתב השירות ולגילוי נאות המצורפים למייל זה.
              </p>
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
  const logoDataUri = await getOpalLogoDataUriForEmail();
  const html = buildOrderConfirmationHtml(payload, logoDataUri);
  const attachments = Array.isArray(payload.attachments) ? payload.attachments : [];

  try {
    const result = await resend.emails.send({
      from: `"${fromName}" <${fromAddress}>`,
      to: [to],
      subject,
      html,
      attachments,
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
