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

/** Inline logo for HTML email: explicit width for Outlook/Gmail; data URI unchanged (base64, no compression). */
function buildInlineLogoHtml(logoDataUri) {
  if (!logoDataUri) {
    return `<span style="font-size:20px;font-weight:700;color:${OPAL_BLUE};letter-spacing:0.02em;text-align:right;display:block;">אופאל</span>`;
  }
  return `<img src="${escapeAttr(logoDataUri)}" alt="אופאל" width="150" height="auto" border="0" style="display:block;margin:0 auto;width:150px;max-width:150px;height:auto;line-height:0;border:0;outline:none;text-decoration:none;background-color:#ffffff;border-radius:4px;padding:4px 8px;" />`;
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

  const logoBlock = buildInlineLogoHtml(logoDataUri);

  return rtlWrap(`
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" dir="rtl" style="background-color:#f5f5f5;padding:32px 16px;direction:rtl;text-align:right;">
    <tr>
      <td align="right" dir="rtl">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" align="right" dir="rtl" style="max-width:560px;background-color:#ffffff;direction:rtl;text-align:right;">
          <tr>
            <td align="center" dir="rtl" style="padding:24px 32px 16px;text-align:center;background-color:#ffffff;">
              ${logoBlock}
            </td>
          </tr>
          <tr>
            <td align="center" dir="rtl" style="background-color:${OPAL_BLUE};padding:20px 32px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:600;line-height:1.4;text-align:center;direction:rtl;">
                שמחים על הצטרפותך למנוי ${productTitle}
              </h1>
            </td>
          </tr>
          <tr>
            <td align="right" dir="rtl" style="padding:28px 32px;direction:rtl;text-align:right;">
              <p style="font-size:15px;color:#333;margin:0 0 16px;line-height:1.7;text-align:right;direction:rtl;">
                שלום ${customerName}, כתב השירות וגילוי הנאות מצורפים למייל זה.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" align="right" dir="rtl" style="border-collapse:collapse;margin-bottom:24px;direction:rtl;text-align:right;">
                <tr>
                  <td align="right" style="padding:10px 0;color:#666;font-size:14px;border-bottom:1px solid #eee;text-align:right;direction:rtl;">מספר הזמנה</td>
                  <td align="right" style="padding:10px 0;color:${OPAL_BLUE};font-size:14px;font-weight:600;border-bottom:1px solid #eee;text-align:right;direction:rtl;"><span dir="ltr" style="unicode-bidi:embed;">${orderId}</span></td>
                </tr>
                <tr>
                  <td align="right" style="padding:10px 0;color:#666;font-size:14px;border-bottom:1px solid #eee;text-align:right;direction:rtl;">תאריך</td>
                  <td align="right" style="padding:10px 0;color:${OPAL_BLUE};font-size:14px;border-bottom:1px solid #eee;text-align:right;direction:rtl;"><span dir="ltr" style="unicode-bidi:embed;">${orderDate}</span></td>
                </tr>
                <tr>
                  <td align="right" style="padding:12px 0;color:${OPAL_BLUE};font-size:15px;font-weight:600;text-align:right;direction:rtl;">תשלום חודשי</td>
                  <td align="right" style="padding:12px 0;color:${OPAL_GOLD};font-size:18px;font-weight:700;text-align:right;direction:rtl;"><span dir="ltr" style="unicode-bidi:embed;">${escapeHtml(monthlyDisplay)}</span></td>
                </tr>
              </table>
              <div dir="rtl" style="border-right:3px solid ${OPAL_GOLD};padding-right:16px;margin-bottom:28px;text-align:right;">
                <p style="font-size:14px;color:${OPAL_BLUE};margin:0 0 8px;font-weight:600;text-align:right;">להפעלת השירות יש למלא את פרטי המוטבים</p>
                <p style="font-size:13px;color:#666;margin:0 0 14px;text-align:right;">ללא קבלת פרטי המוטבים לא יהיה ניתן לקבל את השירות</p>
                <a href="${escapeAttr(link)}" style="display:inline-block;background-color:${OPAL_BLUE};color:#ffffff !important;padding:10px 20px;border-radius:4px;text-decoration:none;font-size:14px;font-weight:500;text-align:center;">
                  מילוי פרטי מוטבים
                </a>
              </div>
              <div style="border-top:1px solid #eee;margin-bottom:20px;"></div>
              <div dir="rtl" style="font-size:14px;color:#555;line-height:1.8;text-align:right;">
                <p style="margin:0 0 6px;text-align:right;">
                  <span style="color:${OPAL_BLUE};font-weight:500;">הזמנת שירותים רפואיים:</span>
                  <span dir="ltr" style="unicode-bidi:embed;">${servicePhone}</span>
                </p>
                <p style="margin:0 0 6px;text-align:right;">
                  <span style="color:${OPAL_BLUE};font-weight:500;">הגשת מסמכים:</span>
                  <a href="${escapeAttr(claimsLink)}" style="color:${OPAL_GOLD};text-decoration:none;">תביעה און ליין</a>
                </p>
                <p style="margin:0;text-align:right;">
                  <span style="color:${OPAL_BLUE};font-weight:500;">מכירות:</span>
                  <span dir="ltr" style="unicode-bidi:embed;">${salesPhone}</span>
                </p>
              </div>
            </td>
          </tr>
          <tr>
            <td align="center" dir="rtl" style="background-color:#F5F5F5;padding:16px 32px;text-align:center;">
              <p style="font-size:12px;color:#666;margin:0 0 4px;text-align:center;direction:rtl;">החיוב החודשי דרך חברת אופאל תקשורת בע״מ</p>
              <p style="font-size:12px;color:#888;margin:0;text-align:center;" dir="ltr">${salesPhone} | ${contactEmail}</p>
            </td>
          </tr>
        </table>
        <p dir="rtl" style="margin:16px 0 0;font-size:13px;color:#64748b;text-align:right;max-width:560px;">
          אם הכפתור לא נפתח, העתיקו את הקישור לדפדפן:<br />
          <span dir="ltr" style="word-break:break-all;text-align:left;display:inline-block;max-width:100%;">${escapeHtml(link)}</span>
        </p>
      </td>
    </tr>
  </table>`);
}

/**
 * Email 2 — visual parity with `src/NEW/components/email/final-summary-email.tsx`.
 */
function buildBeneficiaryCompletionHtml(payload, logoDataUri = '') {
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
        <td align="right" style="padding:10px 0;color:#333;font-size:14px;text-align:right;direction:rtl;${border}">${name}</td>
        <td align="right" style="padding:10px 0;color:#666;font-size:14px;text-align:right;direction:rtl;${border}"><span dir="ltr" style="unicode-bidi:embed;">${idNum}</span></td>
      </tr>`;
  });

  const beneficiariesBlock =
    secondaries.length > 0
      ? `
      <div dir="rtl" style="margin-bottom:24px;text-align:right;">
        <div style="font-size:14px;color:${OPAL_BLUE};font-weight:600;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #eee;text-align:right;">
          מוטבים נוספים
        </div>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" align="right" dir="rtl" style="border-collapse:collapse;direction:rtl;text-align:right;">
          <tbody>${beneficiariesRows}</tbody>
        </table>
      </div>`
      : '';

  const medicalPhone = String(process.env.MEDICAL_SERVICES_PHONE || '00-0000000').trim();
  const claimsLink = String(process.env.CLAIMS_ONLINE_URL || '#').trim() || '#';
  const medicalPhoneEsc = escapeHtml(medicalPhone);
  const tel = escapeAttr(telHref(medicalPhone));

  const logoBlock = buildInlineLogoHtml(logoDataUri);

  return rtlWrap(`
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" dir="rtl" style="background-color:#f5f5f5;padding:32px 16px;direction:rtl;text-align:right;">
    <tr>
      <td align="right" dir="rtl">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" align="right" dir="rtl" style="max-width:560px;background-color:#ffffff;direction:rtl;text-align:right;">
          <tr>
            <td align="center" dir="rtl" style="padding:24px 32px 16px;text-align:center;background-color:#ffffff;">
              ${logoBlock}
            </td>
          </tr>
          <tr>
            <td align="center" dir="rtl" style="background-color:${OPAL_BLUE};padding:20px 32px;text-align:center;">
              <h1 style="color:#ffffff;font-size:20px;font-weight:600;margin:0;text-align:center;direction:rtl;">סיכום הצטרפות ופרטי מנוי</h1>
              <p style="color:rgba(255,255,255,0.8);font-size:14px;margin:8px 0 0;text-align:center;direction:rtl;">אופאל - רופא עד הבית</p>
            </td>
          </tr>
          <tr>
            <td align="right" dir="rtl" style="padding:28px 32px;direction:rtl;text-align:right;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" align="right" dir="rtl" style="border-collapse:collapse;margin-bottom:24px;direction:rtl;text-align:right;">
                <tr>
                  <td align="right" style="padding:8px 0;color:#666;font-size:14px;text-align:right;direction:rtl;">מספר הזמנה</td>
                  <td align="right" style="padding:8px 0;color:${OPAL_BLUE};font-size:14px;font-weight:600;text-align:right;direction:rtl;"><span dir="ltr" style="unicode-bidi:embed;">${orderId}</span></td>
                </tr>
                <tr>
                  <td align="right" style="padding:8px 0;color:#666;font-size:14px;text-align:right;direction:rtl;">תאריך</td>
                  <td align="right" style="padding:8px 0;color:${OPAL_BLUE};font-size:14px;text-align:right;direction:rtl;"><span dir="ltr" style="unicode-bidi:embed;">${orderDate}</span></td>
                </tr>
              </table>
              <div dir="rtl" style="background-color:#F8F9FA;border-right:4px solid ${OPAL_GOLD};padding:16px;margin-bottom:20px;text-align:right;">
                <div style="font-size:11px;color:${OPAL_GOLD};font-weight:600;margin-bottom:8px;text-align:right;">מבוטח ראשי</div>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" align="right" dir="rtl" style="direction:rtl;text-align:right;">
                  <tr>
                    <td align="right" style="text-align:right;direction:rtl;"><span style="color:${OPAL_BLUE};font-size:16px;font-weight:600;">${primaryName}</span></td>
                    <td align="right" style="text-align:right;direction:rtl;white-space:nowrap;"><span dir="ltr" style="unicode-bidi:embed;color:#666;font-size:14px;">${primaryId}</span></td>
                  </tr>
                </table>
              </div>
              ${beneficiariesBlock}
              <div dir="rtl" style="background-color:#F8F9FA;padding:16px;margin-bottom:24px;text-align:right;">
                <div style="color:#666;font-size:13px;margin-bottom:4px;text-align:right;">סוג מנוי</div>
                <div style="color:${OPAL_BLUE};font-size:15px;font-weight:600;margin-bottom:12px;text-align:right;">${subscriptionType}</div>
                <span style="display:inline-block;background-color:${OPAL_BLUE};color:#ffffff;font-size:18px;font-weight:700;padding:10px 24px;border-radius:4px;text-align:center;direction:rtl;">
                  <span dir="ltr" style="unicode-bidi:embed;">${escapeHtml(monthlyDisplay)}</span> לחודש
                </span>
              </div>
              <div style="border-top:1px solid #eee;margin-bottom:20px;"></div>
              <div dir="rtl" style="text-align:right;margin-bottom:24px;">
                <div style="color:#666;font-size:13px;margin-bottom:8px;text-align:right;">טלפונים להזמנת שירותים רפואיים</div>
                <a href="${tel}" style="color:${OPAL_BLUE};font-size:20px;font-weight:700;text-decoration:none;display:inline-block;text-align:right;">
                  <span dir="ltr" style="unicode-bidi:embed;">${medicalPhoneEsc}</span>
                </a>
                <div style="margin-top:16px;text-align:right;">
                  <a href="${escapeAttr(claimsLink)}" style="color:${OPAL_GOLD};font-size:14px;font-weight:500;text-decoration:none;">
                    להגשת מסמכים רפואיים - תביעה און ליין
                  </a>
                </div>
              </div>
              <div dir="rtl" style="border-right:3px solid ${OPAL_GOLD};padding-right:12px;font-size:13px;color:#555;line-height:1.6;text-align:right;">
                <strong style="color:${OPAL_BLUE};">שים לב:</strong> החיוב החודשי דרך חברת אופאל תקשורת בע״מ.<br />
                לפניות: <span dir="ltr" style="unicode-bidi:embed;">054-4261369</span> | <span dir="ltr" style="unicode-bidi:embed;">opal2000@zahav.net.il</span>
              </div>
            </td>
          </tr>
          <tr>
            <td align="center" dir="rtl" style="background-color:#F5F5F5;padding:16px 32px;text-align:center;">
              <p style="font-size:11px;color:#888;margin:0;text-align:center;direction:rtl;">
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
  const logoDataUri = await getOpalLogoDataUriForEmail();
  const html = buildBeneficiaryCompletionHtml(payload, logoDataUri);

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
