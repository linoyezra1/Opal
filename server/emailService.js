import { Resend } from 'resend';
import { getOpalLogoDataUriForEmail, OPAL_BLUE, OPAL_GOLD } from './emailBrandAssets.js';
const FONT_STACK = "'Heebo', 'Segoe UI', Arial, sans-serif";

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

function buildInlineLogoHtml(logoDataUri) {
  if (!logoDataUri) {
    return `<span style="font-size:20px;font-weight:700;color:${OPAL_BLUE};letter-spacing:0.02em;text-align:right;display:block;font-family:${FONT_STACK};">אופאל</span>`;
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
<body style="margin:0;background:#f5f5f5;font-family:${FONT_STACK};color:#333;direction:rtl;text-align:right;">
${inner}
</body>
</html>`;

/**
 * Email 1 — אישור הזמנה
 */
function buildOrderConfirmationHtml(payload, logoDataUri = '') {
  const amount = Number(payload.monthlyTotal || 0).toLocaleString('he-IL');
  const link = String(payload.beneficiaryLink || '#').trim() || '#';
  const monthlyDisplay = `${amount} ₪`;

  const orderId = escapeHtml(payload.orderNumber || '—');
  const orderDate = escapeHtml(payload.orderDate || '—');
  const customerName = escapeHtml(payload.customerName || 'לקוח');
  const customerPhone = escapeHtml(String(payload.phone || '').trim() || '—');
  const productTitle = escapeHtml(
    String(payload.productName || payload.subscriptionType || '').trim() || 'רופא עד הבית'
  );

  const servicePhone = escapeHtml(String(process.env.MEDICAL_SERVICES_PHONE || '00-0000000').trim());
  const tel = escapeAttr(telHref(String(process.env.MEDICAL_SERVICES_PHONE || '').trim()));
  const claimsLink = String(
    process.env.CLAIMS_ONLINE_URL ||
      'https://medi-care.org.il/online-claim/#elementor-action%3Aaction%3Dpopup%3Aopen%26settings%3DeyJpZCI6IjQzNiIsInRvZ2dsZSI6ZmFsc2V9'
  ).trim() || '#';
  const salesPhone = escapeHtml(String(process.env.OPAL_SALES_PHONE || '054-4261369').trim());
  const contactEmail = escapeHtml(String(process.env.OPAL_CONTACT_EMAIL || 'opal2000@zahav.net.il').trim());

  const logoBlock = buildInlineLogoHtml(logoDataUri);

  return rtlWrap(`
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" dir="rtl" style="background-color:#f5f5f5;padding:32px 16px;direction:rtl;text-align:right;">
    <tr>
      <td align="right" dir="rtl">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" align="right" dir="rtl" style="max-width:560px;background-color:#ffffff;direction:rtl;text-align:right;">
          <tr>
            <td align="center" dir="rtl" style="background-color:${OPAL_BLUE};padding:20px 32px 24px;text-align:center;font-family:${FONT_STACK};">
              <h1 style="margin:0 0 10px;color:#ffffff;font-size:20px;font-weight:600;line-height:1.4;text-align:center;direction:rtl;font-family:${FONT_STACK};">
                אישור הזמנה: <span dir="ltr" style="unicode-bidi:embed;font-family:${FONT_STACK};">${orderId}</span>
              </h1>
            </td>
          </tr>
          <tr>
            <td align="right" dir="rtl" style="padding:28px 32px;direction:rtl;text-align:right;font-family:${FONT_STACK};">
              <p style="font-size:13px;color:#666;margin:0 0 16px;line-height:1.6;text-align:right;direction:rtl;font-family:${FONT_STACK};">
                כתב השירות וגילוי הנאות מצורפים למייל זה.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" align="right" dir="rtl" style="border-collapse:collapse;margin-bottom:24px;direction:rtl;text-align:right;">
                <tr>
                  <td align="right" style="padding:10px 0;color:#666;font-size:14px;border-bottom:1px solid #eee;text-align:right;direction:rtl;font-family:${FONT_STACK};">תאריך הזמנה:</td>
                  <td align="right" style="padding:10px 0;color:${OPAL_BLUE};font-size:14px;border-bottom:1px solid #eee;text-align:right;direction:rtl;font-family:${FONT_STACK};"><span dir="ltr" style="unicode-bidi:embed;font-family:${FONT_STACK};">${orderDate}</span></td>
                </tr>
                <tr>
                <td align="right" style="padding:10px 0;color:#666;font-size:14px;border-bottom:1px solid #eee;text-align:right;direction:rtl;font-family:${FONT_STACK};">מוצר:</td>
                <td align="right" style="padding:10px 0;color:${OPAL_BLUE};font-size:14px;font-weight:600;border-bottom:1px solid #eee;text-align:right;direction:rtl;font-family:${FONT_STACK};">${productTitle}</td>
                </tr>
                <tr>
                  <td align="right" style="padding:10px 0;color:#666;font-size:14px;border-bottom:1px solid #eee;text-align:right;direction:rtl;font-family:${FONT_STACK};">שם הלקוח:</td>
                  <td align="right" style="padding:10px 0;color:${OPAL_BLUE};font-size:14px;font-weight:600;border-bottom:1px solid #eee;text-align:right;direction:rtl;font-family:${FONT_STACK};">${customerName}</td>
                </tr>
                <tr>
                  <td align="right" style="padding:10px 0;color:#666;font-size:14px;border-bottom:1px solid #eee;text-align:right;direction:rtl;font-family:${FONT_STACK};">טלפון:</td>
                  <td align="right" style="padding:10px 0;color:${OPAL_BLUE};font-size:14px;border-bottom:1px solid #eee;text-align:right;direction:rtl;font-family:${FONT_STACK};"><span dir="ltr" style="unicode-bidi:embed;font-family:${FONT_STACK};">${customerPhone}</span></td>
                </tr>
                <tr>
                  <td align="right" style="padding:12px 0;color:#666;font-size:14px;text-align:right;direction:rtl;font-family:${FONT_STACK};">סה״כ תשלום חודשי:</td>
                  <td align="right" style="padding:12px 0;color:${OPAL_GOLD};font-size:18px;font-weight:700;text-align:right;direction:rtl;font-family:${FONT_STACK};"><span dir="ltr" style="unicode-bidi:embed;font-family:${FONT_STACK};">${escapeHtml(monthlyDisplay)}</span></td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" dir="rtl" style="margin-bottom:28px;direction:rtl;text-align:right;border-collapse:collapse;">
                <tr>
                  <td style="border-right:3px solid ${OPAL_GOLD};padding-right:16px;text-align:right;direction:rtl;font-family:${FONT_STACK};">
                    <p style="font-size:14px;color:${OPAL_BLUE};margin:0 0 8px;font-weight:600;text-align:right;font-family:${FONT_STACK};">להפעלת השירות יש למלא את פרטי המוטבים</p>
                    <p style="font-size:13px;color:#666;margin:0 0 14px;text-align:right;font-family:${FONT_STACK};">ללא קבלת פרטי המוטבים לא יהיה ניתן לקבל את השירות</p>
                    <a href="${escapeAttr(link)}" style="display:inline-block;background-color:${OPAL_BLUE};color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:4px;font-size:14px;font-weight:500;text-align:center;font-family:${FONT_STACK};">
                      מילוי פרטי מוטבים
                    </a>
                  </td>
                </tr>
              </table>
              <div style="border-top:1px solid #eee;margin-bottom:20px;"></div>
              <div dir="rtl" style="margin-bottom:16px;text-align:right;">
                <p style="margin:0 0 4px;text-align:right;font-family:${FONT_STACK};">
                  <span style="margin:0 0 10px;color:${OPAL_BLUE};font-size:15px;font-weight:600;text-align:right;font-family:${FONT_STACK};">לשרות רפואי חייג:</span>
                </p>
                <a href="${tel}" style="display:inline-block;color:${OPAL_BLUE};text-decoration:none;font-size:26px;font-weight:800;text-align:right;font-family:${FONT_STACK};">
                  <span dir="ltr" style="unicode-bidi:embed;font-family:${FONT_STACK};">${servicePhone}</span>
                </a>
              </div>
              <div dir="rtl" style="margin-bottom:20px;text-align:right;">
                <p style="margin:0 0 10px;color:${OPAL_BLUE};font-size:15px;font-weight:600;text-align:right;font-family:${FONT_STACK};">הגשת מסמכים רפואיים — תביעה און ליין:</p>
                <a href="${escapeAttr(claimsLink)}" style="display:inline-block;background-color:${OPAL_GOLD};color:#ffffff;text-decoration:none;padding:10px 22px;border-radius:4px;font-size:15px;font-weight:700;text-align:center;font-family:${FONT_STACK};">
                  להגשת תביעה לחצו כאן
                </a>
              </div>
              <div dir="rtl" style="font-size:14px;color:#555;line-height:1.8;text-align:right;margin-bottom:20px;">
                <p style="margin:0;text-align:right;font-family:${FONT_STACK};">
                  <span style="color:${OPAL_BLUE};font-weight:500;font-family:${FONT_STACK};">מכירות:</span>
                  <span dir="ltr" style="unicode-bidi:embed;font-family:${FONT_STACK};">${salesPhone}</span>
                </p>
              </div>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" dir="rtl" style="direction:rtl;text-align:right;border-collapse:collapse;">
                <tr>
                  <td style="border-right:3px solid ${OPAL_GOLD};padding-right:12px;font-size:14px;color:#444;line-height:1.8;text-align:right;font-family:${FONT_STACK};">
                    <span style="font-size:15px;font-weight:800;color:${OPAL_BLUE};font-family:${FONT_STACK};">שים לב:</span> החיוב החודשי דרך חברת אופאל תקשורת בע״מ.<br />
                    <span style="font-size:13px;color:#555;font-family:${FONT_STACK};">המנוי כפוף לכתב השירות ולגילוי נאות המצורפים למייל זה.</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        <p dir="rtl" style="margin:16px 0 0;font-size:13px;color:#64748b;text-align:right;max-width:560px;font-family:${FONT_STACK};">
          אם הכפתור לא נפתח, העתיקו את הקישור לדפדפן:<br />
          <span dir="ltr" style="word-break:break-all;text-align:left;display:inline-block;max-width:100%;font-family:${FONT_STACK};">${escapeHtml(link)}</span>
        </p>
      </td>
    </tr>
  </table>`);
}

/**
 * Email 2 — סיכום הזמנה
 *
 * טבלת מבוטחים אחת (סוג | שם | ת.ז), ללא רקע אפור — עיצוב תואם לטבלת התאריך/מוצר/סכום.
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

  const thInsured = `padding:8px 0 10px;color:#999;font-size:13px;font-weight:600;text-align:right;direction:rtl;font-family:${FONT_STACK};border-bottom:1px solid #eee;`;
  const tdRow = `padding:10px 0;text-align:right;direction:rtl;font-family:${FONT_STACK};border-bottom:1px solid #eee;vertical-align:middle;font-size:14px;`;

  let insuredBodyRows = `<tr>
                  <td align="right" style="${tdRow}font-weight:600;color:#333;">מבוטח ראשי</td>
                  <td align="right" style="${tdRow}font-weight:600;color:${OPAL_BLUE};">${primaryName}</td>
                  <td align="right" style="${tdRow}font-weight:600;color:#666;white-space:nowrap;"><span dir="ltr" style="unicode-bidi:embed;font-family:${FONT_STACK};">${primaryId}</span></td>
                </tr>`;

  secondaries.forEach((b) => {
    const name = escapeHtml(b?.name || '—');
    const idNum = escapeHtml(b?.idNumber || '—');
    insuredBodyRows += `<tr>
                  <td align="right" style="${tdRow}color:#666;font-weight:400;">מוטב משני</td>
                  <td align="right" style="${tdRow}color:#333;font-weight:400;">${name}</td>
                  <td align="right" style="${tdRow}color:#666;font-weight:400;white-space:nowrap;"><span dir="ltr" style="unicode-bidi:embed;font-family:${FONT_STACK};">${idNum}</span></td>
                </tr>`;
  });

  const medicalPhone = String(process.env.MEDICAL_SERVICES_PHONE || '00-0000000').trim();
  const claimsLink = String(
    process.env.CLAIMS_ONLINE_URL ||
      'https://medi-care.org.il/online-claim/#elementor-action%3Aaction%3Dpopup%3Aopen%26settings%3DeyJpZCI6IjQzNiIsInRvZ2dsZSI6ZmFsc2V9'
  ).trim() || '#';
  const medicalPhoneEsc = escapeHtml(medicalPhone);
  const tel = escapeAttr(telHref(medicalPhone));
  const salesPhone = escapeHtml(String(process.env.OPAL_SALES_PHONE || '054-4261369').trim());
  const contactEmail = escapeHtml(String(process.env.OPAL_CONTACT_EMAIL || 'opal2000@zahav.net.il').trim());

  const logoBlock = buildInlineLogoHtml(logoDataUri);

  return rtlWrap(`
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" dir="rtl" style="background-color:#f5f5f5;padding:32px 16px;direction:rtl;text-align:right;">
    <tr>
      <td align="right" dir="rtl">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" align="right" dir="rtl" style="max-width:560px;background-color:#ffffff;direction:rtl;text-align:right;">
          <tr>
            <td align="center" dir="rtl" style="background-color:${OPAL_BLUE};padding:20px 32px 24px;text-align:center;font-family:${FONT_STACK};">
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:600;line-height:1.4;text-align:center;direction:rtl;font-family:${FONT_STACK};">
                סיכום הזמנה: <span dir="ltr" style="unicode-bidi:embed;font-family:${FONT_STACK};">${orderId}</span>
              </h1>
            </td>
          </tr>
          <tr>
            <td align="right" dir="rtl" style="padding:28px 32px;direction:rtl;text-align:right;font-family:${FONT_STACK};">
              <p style="font-size:13px;color:#666;margin:0 0 16px;line-height:1.6;text-align:right;direction:rtl;font-family:${FONT_STACK};">
                פרטי ההצטרפות נקלטו והופעלו במערכת בהצלחה.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" align="right" dir="rtl" style="border-collapse:collapse;margin-bottom:20px;direction:rtl;text-align:right;">
                <tr>
                  <td align="right" style="padding:10px 0;color:#666;font-size:14px;border-bottom:1px solid #eee;text-align:right;direction:rtl;font-family:${FONT_STACK};">תאריך:</td>
                  <td align="right" style="padding:10px 0;color:${OPAL_BLUE};font-size:14px;border-bottom:1px solid #eee;text-align:right;direction:rtl;font-family:${FONT_STACK};"><span dir="ltr" style="unicode-bidi:embed;font-family:${FONT_STACK};">${orderDate}</span></td>
                </tr>
                <tr>
                  <td align="right" style="padding:10px 0;color:#666;font-size:14px;border-bottom:1px solid #eee;text-align:right;direction:rtl;font-family:${FONT_STACK};">מוצר:</td>
                  <td align="right" style="padding:10px 0;color:${OPAL_BLUE};font-size:14px;font-weight:600;border-bottom:1px solid #eee;text-align:right;direction:rtl;font-family:${FONT_STACK};">${subscriptionType}</td>
                </tr>
                <tr>
                  <td align="right" style="padding:12px 0;color:#666;font-size:14px;text-align:right;direction:rtl;font-family:${FONT_STACK};">סה״כ תשלום חודשי:</td>
                  <td align="right" style="padding:12px 0;color:${OPAL_GOLD};font-size:18px;font-weight:700;text-align:right;direction:rtl;font-family:${FONT_STACK};"><span dir="ltr" style="unicode-bidi:embed;font-family:${FONT_STACK};">${escapeHtml(monthlyDisplay)}</span></td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" align="right" dir="rtl" style="border-collapse:collapse;margin-bottom:20px;direction:rtl;text-align:right;font-family:${FONT_STACK};">
                <thead>
                  <tr>
                    <th align="right" style="${thInsured}">סוג מבוטח</th>
                    <th align="right" style="${thInsured}">שם</th>
                    <th align="right" style="${thInsured}">ת.ז</th>
                  </tr>
                </thead>
                <tbody>
                  ${insuredBodyRows}
                </tbody>
              </table>
              <div style="border-top:1px solid #eee;margin-bottom:20px;"></div>
              <div dir="rtl" style="margin-bottom:16px;text-align:right;">
                <p style="margin:0 0 4px;text-align:right;font-family:${FONT_STACK};"><span style="color:${OPAL_BLUE};font-size:18px;font-weight:800;font-family:${FONT_STACK};">לשרות רפואי חייג:</span></p>
                <a href="${tel}" style="display:inline-block;color:${OPAL_BLUE};text-decoration:none;font-size:26px;font-weight:800;text-align:right;font-family:${FONT_STACK};"><span dir="ltr" style="unicode-bidi:embed;font-family:${FONT_STACK};">${medicalPhoneEsc}</span></a>
              </div>
              <div dir="rtl" style="margin-bottom:20px;text-align:right;">
                <p style="margin:0 0 10px;color:${OPAL_BLUE};font-size:15px;font-weight:600;text-align:right;font-family:${FONT_STACK};">הגשת מסמכים רפואיים — תביעה און ליין:</p>
                <a href="${escapeAttr(claimsLink)}" style="display:inline-block;background-color:${OPAL_GOLD};color:#ffffff;text-decoration:none;padding:10px 22px;border-radius:4px;font-size:15px;font-weight:700;text-align:center;font-family:${FONT_STACK};">להגשת תביעה לחצו כאן</a>
              </div>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" dir="rtl" style="direction:rtl;text-align:right;border-collapse:collapse;">
                <tr>
                  <td style="border-right:3px solid ${OPAL_GOLD};padding-right:12px;font-size:14px;color:#444;line-height:1.8;text-align:right;font-family:${FONT_STACK};">
                    <span style="font-size:15px;font-weight:800;color:${OPAL_BLUE};font-family:${FONT_STACK};">שים לב:</span> החיוב החודשי דרך חברת אופאל תקשורת בע״מ.<br />
                    <span style="font-size:13px;color:#555;font-family:${FONT_STACK};">המנוי כפוף לכתב השירות ולגילוי נאות המצורפים למייל זה.</span>
                  </td>
                </tr>
              </table>
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
  const productName = String(payload.productName || payload.subscriptionType || '').trim() || 'מנוי';
  const subject = `אישור הזמנה - ${productName}`.trim();
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

export async function sendEmployeeApprovalRequestEmail(payload) {
  const to = String(payload.to || '').trim();
  if (!to) return { sent: false, reason: 'missing-recipient' };
  const apiKey = String(process.env.RESEND_API_KEY || '').trim();
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not configured; skipping employee approval email');
    return { sent: false, reason: 'resend-not-configured' };
  }

  const resend = new Resend(apiKey);
  const fromAddress = process.env.MAIL_FROM_ADDRESS || 'onboarding@resend.dev';
  const fromName = process.env.MAIL_FROM_NAME || 'OPAL';
  const employeeName = escapeHtml(payload.employeeName || '—');
  const orgName     = escapeHtml(payload.orgName     || '');
  const productName = escapeHtml(payload.productName || 'רופא עד הבית');
  const employeeId  = escapeHtml(payload.employeeId  || '—');
  const employeePhone = escapeHtml(payload.employeePhone || '—');
  const approveUrl  = escapeAttr(String(payload.approveUrl || '#').trim());
  const logoDataUri = await getOpalLogoDataUriForEmail();
  const logoBlock   = buildInlineLogoHtml(logoDataUri);

  const html = rtlWrap(`
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" dir="rtl" style="background-color:#f5f7fb;padding:32px 16px;direction:rtl;text-align:right;">
    <tr>
      <td align="right" dir="rtl">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" align="right" dir="rtl" style="max-width:560px;background-color:#ffffff;direction:rtl;text-align:right;">
          <tr>
            <td dir="rtl" style="background-color:#ffffff;padding:20px 24px 16px;font-family:${FONT_STACK};">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" dir="rtl" style="border-collapse:collapse;direction:rtl;">
                <tr>
                  <td align="right" valign="middle" style="text-align:right;">
                    <h2 style="margin:0;color:${OPAL_BLUE};font-size:22px;font-weight:700;line-height:1.4;text-align:right;font-family:${FONT_STACK};">
                      בקשת אישור עובד חדש
                    </h2>
                  </td>
                  <td align="left" valign="middle" style="text-align:left;width:120px;">
                    ${logoBlock}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="right" dir="rtl" style="padding:28px 32px;direction:rtl;text-align:right;font-family:${FONT_STACK};">
              <p style="font-size:15px;color:#333;margin:0 0 20px;line-height:1.7;font-family:${FONT_STACK};">
                שלום,<br/>
                העובד <strong>${employeeName}</strong> נרשם לשירות <strong>${productName}</strong>${orgName ? ` עבור ארגון <strong>${orgName}</strong>` : ''}.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" align="right" dir="rtl" style="border-collapse:collapse;margin-bottom:28px;direction:rtl;text-align:right;">
                <tr>
                  <td style="padding:9px 0;color:#666;font-size:14px;border-bottom:1px solid #eee;font-family:${FONT_STACK};">שם העובד:</td>
                  <td style="padding:9px 0;color:${OPAL_BLUE};font-size:14px;font-weight:600;border-bottom:1px solid #eee;font-family:${FONT_STACK};">${employeeName}</td>
                </tr>
                <tr>
                  <td style="padding:9px 0;color:#666;font-size:14px;border-bottom:1px solid #eee;font-family:${FONT_STACK};">תעודת זהות:</td>
                  <td style="padding:9px 0;color:${OPAL_BLUE};font-size:14px;border-bottom:1px solid #eee;font-family:${FONT_STACK};"><span dir="ltr">${employeeId}</span></td>
                </tr>
                <tr>
                  <td style="padding:9px 0;color:#666;font-size:14px;border-bottom:1px solid #eee;font-family:${FONT_STACK};">טלפון:</td>
                  <td style="padding:9px 0;color:${OPAL_BLUE};font-size:14px;border-bottom:1px solid #eee;font-family:${FONT_STACK};"><span dir="ltr">${employeePhone}</span></td>
                </tr>
                <tr>
                  <td style="padding:9px 0;color:#666;font-size:14px;font-family:${FONT_STACK};">שירות:</td>
                  <td style="padding:9px 0;color:${OPAL_BLUE};font-size:14px;font-weight:600;font-family:${FONT_STACK};">${productName}</td>
                </tr>
              </table>
              <div style="text-align:center;margin-bottom:24px;">
                <a href="${approveUrl}" style="display:inline-block;background-color:${OPAL_BLUE};color:white;text-decoration:none;padding:14px 40px;border-radius:6px;font-size:16px;font-weight:700;font-family:${FONT_STACK};letter-spacing:0.02em;">
                  ✓ אשר עובד
                </a>
              </div>
              <p style="font-size:12px;color:#999;text-align:center;font-family:${FONT_STACK};">
                לחיצה על הכפתור תפעיל את המנוי אוטומטית. אם אינך מכיר עובד זה, התעלם מהודעה זו.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`);

  const subject = `בקשת אישור עובד: ${payload.employeeName || ''}`.trim();
  try {
    const result = await resend.emails.send({
      from: `"${fromName}" <${fromAddress}>`,
      to: [to],
      subject,
      html,
    });
    if (result?.error) {
      console.error('[email] Employee approval email failed', result.error);
      throw new Error(result.error?.message || 'Resend send failed');
    }
    return { sent: true, provider: 'resend', id: result?.data?.id || null };
  } catch (err) {
    console.error('[email] Employee approval email exception', { message: err?.message });
    throw err;
  }
}

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
  const subject = `סיכום הצטרפות והפעלת שירות - ${payload.orderNumber || ''}`.trim();
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
