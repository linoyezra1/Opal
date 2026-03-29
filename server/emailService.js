import { Resend } from 'resend';

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
<body style="margin:0;background:#f5f7fa;font-family:'Heebo','Segoe UI',Arial,sans-serif;color:#1e293b;direction:rtl;text-align:right;">
${inner}
</body>
</html>`;

/**
 * Email 1 — אחרי תשלום (עיצוב כמו src/NEW/components/email/post-payment-email.tsx).
 * ללא מצורפים; CTA להשלמת מוטבים.
 */
function buildOrderConfirmationHtml(payload) {
  const amount = Number(payload.monthlyTotal || 0).toLocaleString('he-IL');
  const link = String(payload.beneficiaryLink || '#').trim() || '#';
  const monthlyDisplay = `₪${amount}`;

  const orderId = escapeHtml(payload.orderNumber || '—');
  const orderDate = escapeHtml(payload.orderDate || '—');
  const customerName = escapeHtml(payload.customerName || '—');
  const customerId = escapeHtml(payload.customerId || payload.primaryBeneficiary?.idNumber || '—');
  const startDate = escapeHtml(payload.subscriptionStartDate || payload.orderDate || '—');
  const address = escapeHtml(String(payload.address || '').trim() || '—');
  const phone = escapeHtml(payload.phone || '—');
  const email = escapeHtml(payload.email || '—');
  const last4 = String(payload.lastFourDigits || '').trim();
  const last4Display = last4 ? escapeHtml(last4) : escapeHtml('לא זמין');
  const subscriptionType = escapeHtml(
    String(payload.subscriptionType || payload.productName || '').trim() || 'רופא עד הבית'
  );

  return rtlWrap(`
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f5f7fa;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);direction:rtl;">
          <tr>
            <td style="background:linear-gradient(135deg,#0d7377 0%,#14919b 100%);background-color:#0d7377;padding:32px 24px;text-align:center;">
              <table role="presentation" cellspacing="0" cellpadding="0" align="center" style="margin:0 auto 16px;">
                <tr>
                  <td style="width:64px;height:64px;background-color:rgba(255,255,255,0.2);border-radius:50%;text-align:center;vertical-align:middle;font-size:32px;color:#ffffff;line-height:64px;">&#x2714;</td>
                </tr>
              </table>
              <h1 style="margin:0 0 8px;color:#ffffff;font-size:24px;font-weight:700;line-height:1.4;text-align:center;">שמחים על הצטרפותך למנוי רופא עד הבית</h1>
              <p style="margin:0;color:rgba(255,255,255,0.9);font-size:16px;text-align:center;">הזמנתך התקבלה בהצלחה</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 24px;direction:rtl;text-align:right;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#fef2f2;border:2px solid #ef4444;border-radius:8px;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px;text-align:right;">
                    <p style="margin:0 0 16px;color:#dc2626;font-size:15px;font-weight:700;line-height:1.6;text-align:right;">
                      חשוב מאד - בכדי להפעיל את השרות יש למלא את פרטי המוטבים<br />
                      ללא קבלת פרטי המוטבים לא יהיה ניתן לקבל את השרות
                    </p>
                    <a href="${escapeAttr(link)}" style="display:inline-block;background-color:#dc2626;color:#ffffff !important;font-size:16px;font-weight:600;padding:14px 32px;border-radius:8px;text-decoration:none;text-align:center;">
                      לחץ כאן להשלמת פרטי המוטבים
                    </a>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f8fafc;border-radius:8px;margin-bottom:24px;">
                <tr>
                  <td style="padding:24px;">
                    <h2 style="margin:0 0 20px;color:#0d7377;font-size:18px;font-weight:600;padding-bottom:12px;border-bottom:2px solid #e2e8f0;text-align:right;">סיכום הזמנה</h2>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                      <tr>
                        <td style="padding:10px 0;color:#64748b;font-size:14px;width:40%;vertical-align:top;">מספר הזמנה:</td>
                        <td style="padding:10px 0;color:#1e293b;font-size:14px;font-weight:600;">${orderId}</td>
                      </tr>
                      <tr>
                        <td style="padding:10px 0;color:#64748b;font-size:14px;vertical-align:top;">תאריך הזמנה:</td>
                        <td style="padding:10px 0;color:#1e293b;font-size:14px;font-weight:600;">${orderDate}</td>
                      </tr>
                      <tr>
                        <td style="padding:10px 0;color:#64748b;font-size:14px;vertical-align:top;">שם לקוח:</td>
                        <td style="padding:10px 0;color:#1e293b;font-size:14px;font-weight:600;">${customerName}</td>
                      </tr>
                      <tr>
                        <td style="padding:10px 0;color:#64748b;font-size:14px;vertical-align:top;">ת.ז:</td>
                        <td style="padding:10px 0;color:#1e293b;font-size:14px;font-weight:600;direction:ltr;text-align:right;">${customerId}</td>
                      </tr>
                      <tr>
                        <td style="padding:10px 0;color:#64748b;font-size:14px;vertical-align:top;">תאריך תחילת מנוי:</td>
                        <td style="padding:10px 0;color:#1e293b;font-size:14px;font-weight:600;">${startDate}</td>
                      </tr>
                      <tr>
                        <td style="padding:10px 0;color:#64748b;font-size:14px;vertical-align:top;">כתובת:</td>
                        <td style="padding:10px 0;color:#1e293b;font-size:14px;font-weight:600;">${address}</td>
                      </tr>
                      <tr>
                        <td style="padding:10px 0;color:#64748b;font-size:14px;vertical-align:top;">טלפון:</td>
                        <td style="padding:10px 0;color:#1e293b;font-size:14px;font-weight:600;direction:ltr;text-align:right;">${phone}</td>
                      </tr>
                      <tr>
                        <td style="padding:10px 0;color:#64748b;font-size:14px;vertical-align:top;">מייל:</td>
                        <td style="padding:10px 0;color:#1e293b;font-size:14px;font-weight:600;direction:ltr;text-align:right;">${email}</td>
                      </tr>
                      <tr>
                        <td style="padding:10px 0;color:#64748b;font-size:14px;vertical-align:top;">אמצעי תשלום:</td>
                        <td style="padding:10px 0;color:#1e293b;font-size:14px;font-weight:600;">כרטיס המסתיים ב-${last4Display}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f0fdfa;border:1px solid #99f6e4;border-radius:8px;margin-bottom:24px;">
                <tr>
                  <td style="padding:24px;">
                    <h2 style="margin:0 0 16px;color:#0d7377;font-size:18px;font-weight:600;text-align:right;">פרטי המנוי</h2>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                      <tr>
                        <td style="padding:8px 0;color:#64748b;font-size:14px;width:40%;vertical-align:top;">סוג מנוי:</td>
                        <td style="padding:8px 0;color:#1e293b;font-size:14px;font-weight:600;">${subscriptionType}</td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;color:#64748b;font-size:14px;vertical-align:top;">שם כתב שירות:</td>
                        <td style="padding:8px 0;color:#1e293b;font-size:14px;font-weight:600;">רופא עד הבית</td>
                      </tr>
                      <tr>
                        <td style="padding:12px 0;color:#0d7377;font-size:16px;font-weight:700;vertical-align:top;">סה"כ תשלום חודשי:</td>
                        <td style="padding:12px 0;color:#0d7377;font-size:20px;font-weight:700;">${escapeHtml(monthlyDisplay)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f8fafc;border-radius:8px;margin-bottom:0;">
                <tr>
                  <td style="padding:20px;text-align:center;">
                    <p style="margin:0 0 8px;color:#64748b;font-size:14px;">לשאלות ובירורים:</p>
                    <p style="margin:0;color:#1e293b;font-size:16px;font-weight:600;direction:ltr;">054-4261369 | opal2000@zahav.net.il</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color:#1e293b;padding:24px;text-align:center;">
              <p style="margin:0 0 8px;color:#94a3b8;font-size:13px;line-height:1.6;">שים לב: החיוב החודשי של המנוי דרך חברת אופאל תקשורת בע"מ</p>
              <p style="margin:0;color:#64748b;font-size:12px;">אופאל - בית ליזמות רפואית</p>
            </td>
          </tr>
        </table>
        <p style="margin:16px 0 0;font-size:13px;color:#64748b;text-align:center;max-width:600px;">
          אם הכפתור לא נפתח, העתיקו את הקישור לדפדפן:<br />
          <span dir="ltr" style="word-break:break-all;">${escapeHtml(link)}</span>
        </p>
      </td>
    </tr>
  </table>`);
}

/**
 * Email 2 — אחרי טופס מוטבים (עיצוב כמו src/NEW/components/email/final-summary-email.tsx).
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
    const border = index < secondaries.length - 1 ? 'border-bottom:1px solid #e2e8f0;' : '';
    beneficiariesRows += `
      <tr>
        <td style="padding:14px 16px;color:#1e293b;font-size:14px;font-weight:500;${border}">${name}</td>
        <td style="padding:14px 16px;color:#1e293b;font-size:14px;font-weight:500;direction:ltr;text-align:left;${border}">${idNum}</td>
      </tr>`;
  });

  const beneficiariesBlock =
    secondaries.length > 0
      ? `
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:24px;">
        <tr>
          <td>
            <h2 style="margin:0 0 16px;color:#1e293b;font-size:16px;font-weight:600;padding-bottom:8px;border-bottom:1px solid #e2e8f0;text-align:right;">מוטבים נוספים</h2>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background-color:#f8fafc;border-radius:8px;">
              <tr style="background-color:#e2e8f0;">
                <th style="padding:12px 16px;text-align:right;color:#64748b;font-size:13px;font-weight:600;">שם מלא</th>
                <th style="padding:12px 16px;text-align:left;color:#64748b;font-size:13px;font-weight:600;">ת.ז</th>
              </tr>
              ${beneficiariesRows}
            </table>
          </td>
        </tr>
      </table>`
      : '';

  const medicalPhone = String(process.env.MEDICAL_SERVICES_PHONE || '00-0000000').trim();
  const claimsLink = String(process.env.CLAIMS_ONLINE_URL || '#').trim() || '#';
  const medicalPhoneEsc = escapeHtml(medicalPhone);
  const tel = escapeAttr(telHref(medicalPhone));

  return rtlWrap(`
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f5f7fa;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);direction:rtl;">
          <tr>
            <td style="background:linear-gradient(135deg,#0d7377 0%,#14919b 100%);background-color:#0d7377;padding:32px 24px;text-align:center;">
              <table role="presentation" cellspacing="0" cellpadding="0" align="center" style="margin:0 auto 16px;">
                <tr>
                  <td style="width:64px;height:64px;background-color:rgba(255,255,255,0.2);border-radius:50%;text-align:center;vertical-align:middle;font-size:32px;color:#ffffff;line-height:64px;">&#128196;</td>
                </tr>
              </table>
              <h1 style="margin:0 0 8px;color:#ffffff;font-size:24px;font-weight:700;line-height:1.4;text-align:center;">סיכום הצטרפות ופרטי מנוי</h1>
              <p style="margin:0;color:rgba(255,255,255,0.9);font-size:16px;text-align:center;">אופאל - רופא עד הבית</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 24px;direction:rtl;text-align:right;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f8fafc;border-radius:8px;margin-bottom:24px;">
                <tr>
                  <td style="padding:16px 20px;width:50%;vertical-align:top;text-align:right;">
                    <span style="color:#64748b;font-size:13px;">מספר הזמנה</span>
                    <p style="margin:4px 0 0;color:#1e293b;font-size:16px;font-weight:600;">${orderId}</p>
                  </td>
                  <td style="padding:16px 20px;width:50%;vertical-align:top;text-align:left;">
                    <span style="color:#64748b;font-size:13px;">תאריך</span>
                    <p style="margin:4px 0 0;color:#1e293b;font-size:16px;font-weight:600;">${orderDate}</p>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f0fdfa;border:2px solid #0d7377;border-radius:8px;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" style="margin-bottom:12px;">
                      <tr>
                        <td style="background-color:#0d7377;color:#ffffff;font-size:12px;font-weight:600;padding:4px 12px;border-radius:4px;">מבוטח ראשי</td>
                      </tr>
                    </table>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="vertical-align:middle;text-align:right;">
                          <p style="margin:0;color:#1e293b;font-size:18px;font-weight:700;">${primaryName}</p>
                        </td>
                        <td style="vertical-align:middle;text-align:left;white-space:nowrap;">
                          <span style="color:#64748b;font-size:13px;">ת.ז: </span>
                          <span style="color:#1e293b;font-size:15px;font-weight:600;direction:ltr;">${primaryId}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              ${beneficiariesBlock}

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#fefce8;border:1px solid #fde047;border-radius:8px;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px;text-align:center;">
                    <p style="margin:0 0 4px;color:#64748b;font-size:14px;">סוג מנוי</p>
                    <p style="margin:0 0 12px;color:#1e293b;font-size:16px;font-weight:600;">${subscriptionType}</p>
                    <span style="display:inline-block;background-color:#0d7377;color:#ffffff;font-size:20px;font-weight:700;padding:12px 32px;border-radius:8px;">${escapeHtml(monthlyDisplay)} לחודש</span>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f8fafc;border-radius:8px;margin-bottom:24px;">
                <tr>
                  <td style="padding:24px;">
                    <h2 style="margin:0 0 16px;color:#0d7377;font-size:16px;font-weight:600;text-align:center;">פרטי נותן השירות</h2>
                    <p style="margin:0 0 8px;color:#64748b;font-size:14px;text-align:center;">טלפונים להזמנת שירותים רפואיים:</p>
                    <p style="margin:0;text-align:center;">
                      <a href="${tel}" style="color:#0d7377;font-size:24px;font-weight:700;text-decoration:none;direction:ltr;display:inline-block;">${medicalPhoneEsc}</a>
                    </p>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:20px;padding-top:20px;border-top:1px solid #e2e8f0;">
                      <tr>
                        <td style="text-align:center;">
                          <a href="${escapeAttr(claimsLink)}" style="display:inline-block;background-color:#0d7377;color:#ffffff !important;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;text-decoration:none;">
                            להגשת מסמכים רפואיים - תביעה און ליין
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#fef3c7;border:1px solid #f59e0b;border-radius:8px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 8px;color:#92400e;font-size:14px;font-weight:600;">שים לב:</p>
                    <p style="margin:0;color:#92400e;font-size:13px;line-height:1.6;">
                      החיוב החודשי של המנוי דרך חברת אופאל תקשורת בע"מ.<br />
                      לפניות ובירורים: 054-4261369 | דוא"ל: opal2000@zahav.net.il
                    </p>
                    <p style="margin:12px 0 0;color:#92400e;font-size:13px;line-height:1.6;">
                      במייל זה צורפו: סיכום מוטבים ב־PDF, גילוי נאות וכתב שירות.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color:#1e293b;padding:24px;text-align:center;">
              <p style="margin:0 0 8px;color:#94a3b8;font-size:12px;line-height:1.6;">המנוי כפוף לכתב השירות ולגילוי נאות המצורפים למייל זה.</p>
              <p style="margin:0;color:#64748b;font-size:12px;">אופאל - בית ליזמות רפואית</p>
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
