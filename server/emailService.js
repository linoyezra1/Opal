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
            <td align="center" dir="rtl" style="background-color:${OPAL_BLUE};padding:20px 32px 24px;text-align:center;">
              <h1 style="margin:0 0 10px;color:#ffffff;font-size:20px;font-weight:600;line-height:1.4;text-align:center;direction:rtl;">
                אישור הזמנה: <span dir="ltr" style="unicode-bidi:embed;">${orderId}</span>
              </h1>
              <p style="margin:0;color:#ffffff;font-size:22px;font-weight:800;letter-spacing:0.01em;text-align:center;direction:rtl;">
                ${productTitle}
              </p>
            </td>
          </tr>
          <tr>
            <td align="right" dir="rtl" style="padding:28px 32px;direction:rtl;text-align:right;">
              <p style="font-size:13px;color:#666;margin:0 0 16px;line-height:1.6;text-align:right;direction:rtl;">
                כתב השירות וגילוי הנאות מצורפים למייל זה.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" align="right" dir="rtl" style="border-collapse:collapse;margin-bottom:24px;direction:rtl;text-align:right;">
                <tr>
                  <td align="right" style="padding:10px 0;color:#666;font-size:14px;border-bottom:1px solid #eee;text-align:right;direction:rtl;">תאריך הזמנה:</td>
                  <td align="right" style="padding:10px 0;color:${OPAL_BLUE};font-size:14px;border-bottom:1px solid #eee;text-align:right;direction:rtl;"><span dir="ltr" style="unicode-bidi:embed;">${orderDate}</span></td>
                </tr>
                <tr>
                  <td align="right" style="padding:10px 0;color:#666;font-size:14px;border-bottom:1px solid #eee;text-align:right;direction:rtl;">שם הלקוח:</td>
                  <td align="right" style="padding:10px 0;color:${OPAL_BLUE};font-size:14px;font-weight:600;border-bottom:1px solid #eee;text-align:right;direction:rtl;">${customerName}</td>
                </tr>
                <tr>
                  <td align="right" style="padding:10px 0;color:#666;font-size:14px;border-bottom:1px solid #eee;text-align:right;direction:rtl;">טלפון:</td>
                  <td align="right" style="padding:10px 0;color:${OPAL_BLUE};font-size:14px;border-bottom:1px solid #eee;text-align:right;direction:rtl;"><span dir="ltr" style="unicode-bidi:embed;">${customerPhone}</span></td>
                </tr>
                <tr>
                  <td align="right" style="padding:12px 0;color:#666;font-size:14px;text-align:right;direction:rtl;">סה״כ תשלום חודשי:</td>
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
              <div dir="rtl" style="margin-bottom:16px;text-align:right;">
                <p style="margin:0 0 4px;text-align:right;">
                  <span style="color:${OPAL_BLUE};font-size:18px;font-weight:800;">לשרות רפואי חייג:</span>
                </p>
                <a href="${tel}" style="color:${OPAL_BLUE};font-size:26px;font-weight:800;text-decoration:none;display:inline-block;text-align:right;">
                  <span dir="ltr" style="unicode-bidi:embed;">${servicePhone}</span>
                </a>
              </div>
              <div dir="rtl" style="margin-bottom:20px;text-align:right;">
                <p style="margin:0 0 10px;color:${OPAL_BLUE};font-size:15px;font-weight:600;text-align:right;">הגשת מסמכים רפואיים — תביעה און ליין:</p>
                <a href="${escapeAttr(claimsLink)}" style="display:inline-block;background-color:${OPAL_GOLD};color:#ffffff !important;padding:10px 22px;border-radius:4px;text-decoration:none;font-size:15px;font-weight:700;text-align:center;">
                  להגשת תביעה לחצו כאן
                </a>
              </div>
              <div dir="rtl" style="font-size:14px;color:#555;line-height:1.8;text-align:right;margin-bottom:20px;">
                <p style="margin:0;text-align:right;">
                  <span style="color:${OPAL_BLUE};font-weight:500;">מכירות:</span>
                  <span dir="ltr" style="unicode-bidi:embed;">${salesPhone}</span>
                </p>
              </div>
              <div dir="rtl" style="border-right:3px solid ${OPAL_GOLD};padding-right:12px;font-size:14px;color:#444;line-height:1.8;text-align:right;">
                <strong style="font-size:15px;font-weight:800;color:${OPAL_BLUE};">שים לב:</strong> החיוב החודשי דרך חברת אופאל תקשורת בע״מ.<br />
                <span style="font-size:13px;color:#555;">המנוי כפוף לכתב השירות ולגילוי נאות המצורפים למייל זה.</span>
              </div>
            </td>
          </tr>
          <tr>
            <td align="center" dir="rtl" style="background-color:#F5F5F5;padding:20px 32px;text-align:center;">
              <div style="margin-bottom:12px;">${logoBlock}</div>
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
 * Email 2 — סיכום הזמנה
 *
 * 1. שם השירות/מוצר מתחת למס' הזמנה, גדול ובולט — לא בכותרת הכחולה
 * 2. "מוטבים משניים" ככותרת עצמאית מחוץ לתיבת המבוטח הראשי
 * 3. עמודת שם השירות/מוצר משמאל לעמודת ת.ז של כל מוטב
 * 4. יישור לימין אחיד לכל שמות המוטבים (ראשי + משניים)
 * 5. "לשרות רפואי חייג" גדול ובולט מעל מספר הטלפון (שהוגדל גם הוא)
 * 6. כפתור גדול להגשת מסמכים רפואיים
 * 7. "המנוי כפוף..." עובר לתוך גוף המייל (לפני האזור האפור)
 * 8. "שים לב" ותוכנו מודגשים
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

  /* ── עמודות מיושרות לימין: שם | שירות | ת.ז ── */
  let beneficiariesRows = '';
  secondaries.forEach((b, index) => {
    const name = escapeHtml(b?.name || '—');
    const idNum = escapeHtml(b?.idNumber || '—');
    const border = index < secondaries.length - 1 ? 'border-bottom:1px solid #eee;' : 'border-bottom:none;';
    beneficiariesRows += `
      <tr>
        <td align="right" style="padding:10px 12px 10px 0;color:#333;font-size:14px;text-align:right;direction:rtl;vertical-align:middle;${border}">${name}</td>
        <td align="right" style="padding:10px 12px;color:#555;font-size:13px;text-align:right;direction:rtl;vertical-align:middle;${border}">${subscriptionType}</td>
        <td align="right" style="padding:10px 0 10px 0;color:#666;font-size:14px;text-align:right;direction:rtl;vertical-align:middle;white-space:nowrap;${border}"><span dir="ltr" style="unicode-bidi:embed;">${idNum}</span></td>
      </tr>`;
  });

  /* ── "מוטבים משניים" ככותרת עצמאית + טבלה מיושרת ── */
  const beneficiariesBlock =
    secondaries.length > 0
      ? `
      <div dir="rtl" style="margin-bottom:24px;text-align:right;">
        <h3 style="margin:0 0 12px;font-size:16px;font-weight:700;color:${OPAL_BLUE};padding-bottom:8px;border-bottom:2px solid ${OPAL_GOLD};text-align:right;direction:rtl;">
          מוטבים משניים
        </h3>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" align="right" dir="rtl" style="border-collapse:collapse;direction:rtl;text-align:right;">
          <thead>
            <tr>
              <th align="right" style="padding-bottom:8px;color:#999;font-size:12px;font-weight:600;text-align:right;direction:rtl;padding-left:12px;">שם</th>
              <th align="right" style="padding-bottom:8px;color:#999;font-size:12px;font-weight:600;text-align:right;direction:rtl;padding-right:12px;padding-left:12px;">שירות</th>
              <th align="right" style="padding-bottom:8px;color:#999;font-size:12px;font-weight:600;text-align:right;direction:rtl;">ת.ז</th>
            </tr>
          </thead>
          <tbody>${beneficiariesRows}</tbody>
        </table>
      </div>`
      : '';

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

          <!-- לוגו -->
          <tr>
            <td align="center" dir="rtl" style="padding:24px 32px 16px;text-align:center;background-color:#ffffff;">
              ${logoBlock}
            </td>
          </tr>

          <!-- כותרת כחולה: רק "סיכום הצטרפות והפעלת שירות" — ללא שם המוצר -->
          <tr>
            <td align="center" dir="rtl" style="background-color:${OPAL_BLUE};padding:20px 32px;text-align:center;">
              <h1 style="color:#ffffff;font-size:20px;font-weight:600;margin:0;text-align:center;direction:rtl;">סיכום הצטרפות והפעלת שירות</h1>
            </td>
          </tr>

          <!-- גוף המייל -->
          <tr>
            <td align="right" dir="rtl" style="padding:28px 32px;direction:rtl;text-align:right;">

              <!-- מספר הזמנה -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" align="right" dir="rtl" style="border-collapse:collapse;margin-bottom:8px;direction:rtl;text-align:right;">
                <tr>
                  <td align="right" style="padding:8px 0;color:#666;font-size:14px;text-align:right;direction:rtl;">מספר הזמנה</td>
                  <td align="right" style="padding:8px 0;color:${OPAL_BLUE};font-size:14px;font-weight:600;text-align:right;direction:rtl;"><span dir="ltr" style="unicode-bidi:embed;">${orderId}</span></td>
                </tr>
              </table>

              <!-- שם השירות/מוצר מתחת למס' הזמנה, גדול ובולט -->
              <p style="margin:0 0 4px;color:${OPAL_BLUE};font-size:26px;font-weight:800;text-align:right;direction:rtl;line-height:1.2;">${subscriptionType}</p>

              <!-- תאריך -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" align="right" dir="rtl" style="border-collapse:collapse;margin-bottom:24px;margin-top:10px;direction:rtl;text-align:right;">
                <tr>
                  <td align="right" style="padding:8px 0;color:#666;font-size:14px;text-align:right;direction:rtl;">תאריך</td>
                  <td align="right" style="padding:8px 0;color:${OPAL_BLUE};font-size:14px;text-align:right;direction:rtl;"><span dir="ltr" style="unicode-bidi:embed;">${orderDate}</span></td>
                </tr>
              </table>

              <!-- מבוטח ראשי -->
              <div dir="rtl" style="background-color:#F8F9FA;border-right:4px solid ${OPAL_GOLD};padding:16px;margin-bottom:8px;text-align:right;">
                <div style="font-size:11px;color:${OPAL_GOLD};font-weight:700;margin-bottom:10px;text-align:right;text-transform:uppercase;letter-spacing:0.04em;">מבוטח ראשי</div>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" align="right" dir="rtl" style="border-collapse:collapse;direction:rtl;text-align:right;">
                  <tr>
                    <td align="right" style="padding:0;text-align:right;direction:rtl;padding-left:12px;">
                      <span style="color:${OPAL_BLUE};font-size:16px;font-weight:600;">${primaryName}</span>
                    </td>
                    <td align="right" style="padding:0;text-align:right;direction:rtl;padding-right:12px;padding-left:12px;">
                      <span style="color:#555;font-size:13px;">${subscriptionType}</span>
                    </td>
                    <td align="right" style="padding:0;text-align:right;direction:rtl;white-space:nowrap;">
                      <span dir="ltr" style="unicode-bidi:embed;color:#666;font-size:14px;">${primaryId}</span>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- "מוטבים משניים" ככותרת עצמאית + רשימה -->
              ${beneficiariesBlock}

              <!-- סוג מנוי + מחיר -->
              <div dir="rtl" style="background-color:#F8F9FA;padding:16px;margin-bottom:24px;text-align:right;">
                <div style="color:#666;font-size:13px;margin-bottom:4px;text-align:right;">סוג מנוי</div>
                <div style="color:${OPAL_BLUE};font-size:15px;font-weight:600;margin-bottom:12px;text-align:right;">${subscriptionType}</div>
                <span style="display:inline-block;background-color:${OPAL_BLUE};color:#ffffff;font-size:18px;font-weight:700;padding:10px 24px;border-radius:4px;text-align:center;direction:rtl;">
                  <span dir="ltr" style="unicode-bidi:embed;">${escapeHtml(monthlyDisplay)}</span> לחודש
                </span>
              </div>

              <div style="border-top:1px solid #eee;margin-bottom:24px;"></div>

              <!-- "לשרות רפואי חייג" גדול + מספר גדול יותר -->
              <div dir="rtl" style="text-align:right;margin-bottom:20px;">
                <p style="margin:0 0 6px;text-align:right;">
                  <span style="color:${OPAL_BLUE};font-size:22px;font-weight:800;letter-spacing:0.01em;">לשרות רפואי חייג:</span>
                </p>
                <a href="${tel}" style="color:${OPAL_BLUE};font-size:34px;font-weight:800;text-decoration:none;display:inline-block;text-align:right;letter-spacing:0.02em;">
                  <span dir="ltr" style="unicode-bidi:embed;">${medicalPhoneEsc}</span>
                </a>
              </div>

              <!-- כפתור גדול להגשת מסמכים -->
              <div dir="rtl" style="margin-bottom:28px;text-align:right;">
                <p style="margin:0 0 12px;color:${OPAL_BLUE};font-size:16px;font-weight:700;text-align:right;">הגשת מסמכים רפואיים — תביעה און ליין:</p>
                <a href="${escapeAttr(claimsLink)}"
                   style="display:inline-block;background-color:${OPAL_GOLD};color:#ffffff !important;padding:14px 32px;border-radius:6px;text-decoration:none;font-size:17px;font-weight:800;text-align:center;letter-spacing:0.01em;">
                  להגשת תביעה לחצו כאן
                </a>
              </div>

              <!-- "שים לב" מודגש + "המנוי כפוף..." בתוך גוף המייל (לא אפור) -->
              <div dir="rtl" style="border-right:4px solid ${OPAL_GOLD};padding-right:14px;font-size:14px;color:#333;line-height:1.9;text-align:right;margin-bottom:24px;">
                <p style="margin:0 0 6px;text-align:right;">
                  <strong style="font-size:16px;font-weight:800;color:${OPAL_BLUE};">⚠ שים לב:</strong>
                  <strong style="font-size:14px;font-weight:700;color:#333;"> החיוב החודשי דרך חברת אופאל תקשורת בע״מ.</strong>
                </p>
                <p style="margin:0 0 6px;text-align:right;">
                  <strong style="font-size:14px;font-weight:700;color:#333;">המנוי כפוף לכתב השירות ולגילוי נאות המצורפים למייל זה.</strong>
                </p>
                <p style="margin:0;font-size:13px;color:#555;text-align:right;">
                  לפניות: <span dir="ltr" style="unicode-bidi:embed;">${salesPhone}</span> | <span dir="ltr" style="unicode-bidi:embed;">${contactEmail}</span>
                </p>
              </div>

            </td>
          </tr>

          <!-- פוטר אפור -->
          <tr>
            <td align="center" dir="rtl" style="background-color:#F5F5F5;padding:20px 32px;text-align:center;">
              <div style="margin-bottom:10px;">${logoBlock}</div>
              <p style="font-size:12px;color:#666;margin:0 0 4px;text-align:center;direction:rtl;">החיוב החודשי דרך חברת אופאל תקשורת בע״מ</p>
              <p style="font-size:11px;color:#888;margin:0;text-align:center;" dir="ltr">${salesPhone} | ${contactEmail}</p>
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
