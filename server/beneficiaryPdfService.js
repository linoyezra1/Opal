import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import bidiFactory from 'bidi-js';
import fs from 'fs/promises';
import path from 'path';
import {
  candidateServerAssetPaths,
  readFirstExistingFile,
  getGeneratedPdfDir,
} from './repoAssets.js';

/** Brand colors */
const OPAL_BLUE    = rgb(26 / 255, 54 / 255, 93 / 255);
const OPAL_GOLD    = rgb(197 / 255, 160 / 255, 89 / 255);
const OPAL_GOLD_30 = rgb(0.92, 0.88, 0.8);
const TEXT  = rgb(0.12, 0.14, 0.16);
const MUTED = rgb(0.45, 0.48, 0.52);
const WHITE = rgb(1, 1, 1);
const LINE  = rgb(0.82, 0.84, 0.88);

/* ─── bidi-js singleton ─────────────────────────────────────────────────── */
const bidi = bidiFactory();

/**
 * reorderVisualBidi
 * -----------------
 * ממיר טקסט מסדר לוגי לסדר ויזואלי עבור pdf-lib.
 * pdf-lib מציב תווים שמאל→ימין לפי סדרם במחרוזת;
 * לכן עבור עברית יש להפוך את הסדר הוויזואלי לפני הצגה.
 *
 * לוגיקה:
 *  1. bidi.getEmbeddingLevels → רמות bidi לכל תו
 *  2. bidi.getReorderSegments → רשימת [start,end] בסדר ויזואלי
 *  3. קטעי RTL (רמה אי-זוגית) מופכים; קטעי LTR נשמרים כמות שהם
 *
 * fallback: היפוך מילים בלבד (אם bidi-js זורק שגיאה)
 */
function reorderVisualBidi(text) {
  const str = String(text ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (!str) return str;

  // אין תווים עבריים/ערביים → LTR טהור, אין צורך בטיפול
  if (!/[\u0590-\u05FF\u0600-\u06FF\uFB1D-\uFB4F]/.test(str)) return str;

  try {
    const levels   = bidi.getEmbeddingLevels(str, 'rtl');
    const segments = bidi.getReorderSegments(str, levels);

    let visual = '';
    for (const [start, end] of segments) {
      const chunk = str.slice(start, end + 1);
      const level = levels[start] ?? 0;
      // רמה אי-זוגית = RTL → הפוך את התווים בקטע
      visual += level % 2 === 1 ? [...chunk].reverse().join('') : chunk;
    }
    return visual;
  } catch {
    // fallback בטוח: מהפך מילים (לא תווים בודדים)
    return str.split(/(\s+)/).reverse().join('');
  }
}

/* ─── helpers ───────────────────────────────────────────────────────────── */
function line(text, fallback = '—') {
  const t = String(text || '').trim();
  return t || fallback;
}

function normalizeText(value) {
  return String(value ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
}

function formatDateDDMMYYYY(value) {
  const raw = normalizeText(value);
  if (!raw || raw === '—') return '—';
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return [
    String(parsed.getDate()).padStart(2, '0'),
    String(parsed.getMonth() + 1).padStart(2, '0'),
    String(parsed.getFullYear()),
  ].join('/');
}

/* ─── model builder ─────────────────────────────────────────────────────── */
export function buildBeneficiaryPdfModel(input = {}) {
  const primary   = input.primaryBeneficiary   || {};
  const secondary = Array.isArray(input.secondaryBeneficiaries)
    ? input.secondaryBeneficiaries : [];
  return {
    orderNumber:            line(input.orderNumber, ''),
    orderDate:              line(input.orderDate, ''),
    numerator:              line(input.numerator, '—'),
    customerName:           line(input.customerName),
    customerId:             line(input.customerId),
    subscriptionStartDate:  line(input.subscriptionStartDate),
    address:                line(input.address),
    phone:                  line(input.phone),
    email:                  line(input.email),
    lastFourDigits:         line(input.lastFourDigits, '—'),
    transactionDescription: line(input.transactionDescription, input.productName),
    serviceDocumentName:    line(input.serviceDocumentName, 'רופא עד הבית'),
    productName:            line(input.productName),
    monthlyTotal:           Number(input.monthlyTotal || 0),
    primaryBeneficiary: {
      fullName: line(
        primary.fullName ||
        [primary.firstName, primary.lastName].filter(Boolean).join(' ')
      ),
      idNumber:              line(primary.idNumber || primary.id),
      dateOfBirth:           line(primary.dateOfBirth),
      maritalStatus:         line(primary.maritalStatus),
      healthFund:            line(primary.healthFund),
      supplementalInsurance: line(primary.supplementalInsurance),
    },
    secondaryBeneficiaries: secondary.map((b) => ({
      fullName: line(
        b.fullName ||
        [b.firstName, b.lastName].filter(Boolean).join(' ')
      ),
      idNumber:              line(b.idNumber || b.id),
      dateOfBirth:           line(b.dateOfBirth),
      maritalStatus:         line(b.maritalStatus),
      healthFund:            line(b.healthFund),
      supplementalInsurance: line(b.supplementalInsurance),
    })),
  };
}

/* ─── logo ──────────────────────────────────────────────────────────────── */
async function tryEmbedLogo(pdfDoc) {
  try {
    const candidates = candidateServerAssetPaths('branding', 'opal-logo.jpeg');
    const { buffer } = await readFirstExistingFile(candidates, 'opal-logo.jpeg');
    return await pdfDoc.embedJpg(buffer);
  } catch {
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   PDF GENERATOR
   ═══════════════════════════════════════════════════════════════════════════ */
export async function generateBeneficiarySummaryPdfBuffer(modelInput = {}) {
  const model = buildBeneficiaryPdfModel(modelInput);

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const fontCandidates = candidateServerAssetPaths('fonts', 'Heebo-Regular.ttf');
  const { buffer: fontBytes } = await readFirstExistingFile(
    fontCandidates,
    'Heebo-Regular.ttf (server/assets/fonts)'
  );
  const font      = await pdfDoc.embedFont(fontBytes);
  const logoImage = await tryEmbedLogo(pdfDoc);

  const pageW  = 595;
  const pageH  = 842;
  const margin = 36;
  const innerW = pageW - margin * 2;
  let page     = pdfDoc.addPage([pageW, pageH]);

  /* pre-process static footer strings once */
  const footerDisclaimerV = reorderVisualBidi(
    'המנוי כפוף לכתב השרות ולגילוי הנאות. מסמך זה נוצר אוטומטית מהמערכת.'
  );
  const footerContactV = reorderVisualBidi(
    'אופאל תקשורת בע״מ · 054-4261369 · opal2000@zahav.net.il'
  );

  /* ── primitive draw helpers ──────────────────────────────────────────── */

  /**
   * drawRTL
   * -------
   * מצייר טקסט כך שקצהו הימני = xRight.
   * dir='rtl' → מעבר דרך reorderVisualBidi (עברית, שמות, כותרות)
   * dir='ltr' → נשאר כמות שהוא (מספרים, אימייל, URL, תאריכים)
   */
  function drawRTL(pg, rawText, xRight, y, size, color = TEXT, dir = 'rtl') {
    const raw   = normalizeText(rawText) || '—';
    const value = dir === 'rtl' ? reorderVisualBidi(raw) : raw;
    const w     = font.widthOfTextAtSize(value, size);
    pg.drawText(value, { x: xRight - w, y, size, font, color });
  }

  /** drawLTR — מחרוזת LTR פשוטה עם x אבסולוטי */
  function drawLTR(pg, rawText, xLeft, y, size, color = TEXT) {
    const value = normalizeText(rawText) || '';
    if (!value) return;
    pg.drawText(value, { x: xLeft, y, size, font, color });
  }

  function drawCenter(pg, visualText, y, size, color = TEXT) {
    const w = font.widthOfTextAtSize(visualText, size);
    pg.drawText(visualText, { x: (pageW - w) / 2, y, size, font, color });
  }

  /* ── footer ──────────────────────────────────────────────────────────── */
  function drawFooter(pg) {
    pg.drawLine({
      start: { x: margin, y: 58 },
      end:   { x: pageW - margin, y: 58 },
      thickness: 0.8,
      color: LINE,
    });
    drawCenter(pg, footerDisclaimerV, 40, 7, MUTED);
    drawCenter(pg, footerContactV,    28, 8, MUTED);
  }

  /* ── header ──────────────────────────────────────────────────────────── */
  function drawHeader(pg, yTop) {
    const headerH = 80;

    pg.drawRectangle({
      x: margin, y: yTop - headerH,
      width: innerW, height: headerH,
      color: OPAL_BLUE,
    });
    pg.drawRectangle({
      x: margin, y: yTop - headerH,
      width: innerW, height: 4,
      color: OPAL_GOLD,
    });

    if (logoImage) {
      const logoW = 68;
      const logoH = (logoImage.height / logoImage.width) * logoW;
      pg.drawImage(logoImage, {
        x:      pageW - margin - logoW - 8,
        y:      yTop - headerH + (headerH - logoH) / 2 + 4,
        width:  logoW,
        height: logoH,
      });
    }

    /* anchor point: נקודת ימין לטקסטים בheader
       (משמאל ללוגו אם קיים, אחרת בצד ימין) */
    const textRight = logoImage
      ? pageW - margin - 68 - 14
      : pageW - margin - 10;

    drawRTL(pg, 'אישור הזמנה וסיכום מוטבים', textRight, yTop - 26, 15, WHITE, 'rtl');

    /* שורת מס' הזמנה: label RTL + value LTR */
    const orderLabelV = reorderVisualBidi('מספר הזמנה:');
    const orderLabelW = font.widthOfTextAtSize(orderLabelV, 10);
    pg.drawText(orderLabelV, { x: textRight - orderLabelW, y: yTop - 46, size: 10, font, color: WHITE });
    drawLTR(pg, model.orderNumber, textRight - orderLabelW - font.widthOfTextAtSize(model.orderNumber, 10) - 4, yTop - 46, 10, WHITE);

    /* שורת מוצר: label RTL + value RTL */
    const productLabelV = reorderVisualBidi('מוצר:');
    const productLabelW = font.widthOfTextAtSize(productLabelV, 10);
    pg.drawText(productLabelV, { x: textRight - productLabelW, y: yTop - 62, size: 10, font, color: rgb(0.9, 0.93, 0.97) });
    const productNameV = reorderVisualBidi(model.productName);
    const productNameW = font.widthOfTextAtSize(productNameV, 10);
    pg.drawText(productNameV, {
      x: textRight - productLabelW - productNameW - 4,
      y: yTop - 62, size: 10, font, color: rgb(0.9, 0.93, 0.97),
    });

    return yTop - headerH - 16;
  }

  const yRef = { current: drawHeader(page, pageH - margin) };

  function ensureSpace(needed) {
    if (yRef.current - needed >= 76) return;
    drawFooter(page);
    page = pdfDoc.addPage([pageW, pageH]);
    yRef.current = drawHeader(page, pageH - margin);
  }

  /* ── info card ───────────────────────────────────────────────────────── */
  function drawInfoCard(title, items, options = {}) {
    const cardWidth = options.width ?? innerW;
    const lineGap   = 22;
    const cardH     = 28 + items.length * lineGap + 12;
    ensureSpace(cardH + 10);

    const x    = options.x ?? margin;
    const yTop = yRef.current;

    page.drawRectangle({
      x, y: yTop - cardH, width: cardWidth, height: cardH,
      color: WHITE, borderColor: LINE, borderWidth: 1,
    });
    page.drawRectangle({
      x, y: yTop - 28, width: cardWidth, height: 28,
      color: rgb(0.94, 0.97, 1),
    });
    drawRTL(page, title, x + cardWidth - 10, yTop - 19, 11, OPAL_BLUE, 'rtl');

    const labelW = 115;
    let lineY    = yTop - 46;
    for (const item of items) {
      const dir = item.dir ?? 'rtl';
      drawRTL(page, `${item.label}:`, x + cardWidth - 10,          lineY, 9, TEXT,      'rtl');
      drawRTL(page,  item.value,      x + cardWidth - 10 - labelW, lineY, 9, OPAL_BLUE, dir);
      lineY -= lineGap;
    }

    if (options.advance !== false) yRef.current -= cardH + 12;
    return { cardH };
  }

  /* ── two cards side by side ──────────────────────────────────────────── */
  const cardGap = 12;
  const halfW   = (innerW - cardGap) / 2;

  const customerItems = [
    { label: 'שם לקוח', value: model.customerName, dir: 'rtl' },
    { label: 'טלפון',   value: model.phone,         dir: 'ltr' },
    { label: 'אימייל',  value: model.email,         dir: 'ltr' },
  ];
  const subItems = [
    { label: 'תאריך תחילת מנוי', value: formatDateDDMMYYYY(model.subscriptionStartDate), dir: 'ltr' },
    { label: 'אמצעי תשלום',      value: `****${model.lastFourDigits}`,                   dir: 'ltr' },
    { label: 'סכום חודשי',       value: `₪${Number(model.monthlyTotal || 0).toLocaleString('he-IL')}`, dir: 'ltr' },
  ];

  const projH = 28 + Math.max(customerItems.length, subItems.length) * 22 + 12;
  ensureSpace(projH + 16);

  const { cardH: ch1 } = drawInfoCard('פרטי לקוח', customerItems, {
    width: halfW, x: margin + halfW + cardGap, advance: false,
  });
  const { cardH: ch2 } = drawInfoCard('פרטי מנוי', subItems, {
    width: halfW, x: margin, advance: false,
  });
  yRef.current -= Math.max(ch1, ch2) + 14;

  /* ── beneficiaries table ─────────────────────────────────────────────── */
  const tableRows = [
    {
      service:   model.serviceDocumentName,
      id:        model.primaryBeneficiary.idNumber,
      fullName:  model.primaryBeneficiary.fullName,
      isPrimary: true,
    },
    ...model.secondaryBeneficiaries.map((b) => ({
      service:   model.serviceDocumentName,
      id:        b.idNumber,
      fullName:  b.fullName,
      isPrimary: false,
    })),
  ];

  const tableHeaderH = 30;
  const rowH         = 26;
  const tableH       = tableHeaderH + tableRows.length * rowH;
  ensureSpace(tableH + 14);

  const colService = innerW * 0.28;
  const colId      = innerW * 0.24;
  const tableTop   = yRef.current;
  const tableRight = pageW - margin;
  const div1X      = tableRight - colService;         // גבול שירות | ת.ז
  const div2X      = tableRight - colService - colId; // גבול ת.ז | שם

  // כותרת טבלה
  page.drawRectangle({
    x: margin, y: tableTop - tableHeaderH,
    width: innerW, height: tableHeaderH,
    color: rgb(0.88, 0.94, 1), borderColor: LINE, borderWidth: 1,
  });

  // קווי הפרדה אנכיים
  for (const dx of [div1X, div2X]) {
    page.drawLine({
      start: { x: dx, y: tableTop },
      end:   { x: dx, y: tableTop - tableH },
      thickness: 1, color: LINE,
    });
  }

  drawRTL(page, 'שירות',  tableRight - 8, tableTop - 20, 10, OPAL_BLUE, 'rtl');
  drawRTL(page, 'ת.ז',    div1X      - 8, tableTop - 20, 10, OPAL_BLUE, 'rtl');
  drawRTL(page, 'שם מלא', div2X      - 8, tableTop - 20, 10, OPAL_BLUE, 'rtl');

  let rowTop = tableTop - tableHeaderH;
  for (const row of tableRows) {
    page.drawRectangle({
      x: margin, y: rowTop - rowH,
      width: innerW, height: rowH,
      color: row.isPrimary ? OPAL_GOLD_30 : WHITE,
      borderColor: LINE, borderWidth: 0.8,
    });
    drawRTL(page, row.service,  tableRight - 8, rowTop - 17, 9, TEXT,      'rtl');
    drawRTL(page, row.id,       div1X      - 8, rowTop - 17, 9, OPAL_BLUE, 'ltr'); // ת.ז = מספר!
    drawRTL(page, row.fullName, div2X      - 8, rowTop - 17, 9, TEXT,      'rtl');
    rowTop -= rowH;
  }
  yRef.current -= tableH + 16;

  /* ── service / claims box ────────────────────────────────────────────── */
  const ctaH     = 90;
  const ctaPhone = normalizeText(process.env.MEDICAL_SERVICES_PHONE || '054-4261369');
  const claims   = normalizeText(process.env.CLAIMS_ONLINE_URL || 'https://opal-medical.co.il/claims');

  ensureSpace(ctaH + 14);
  const ctaTop = yRef.current;

  page.drawRectangle({
    x: margin, y: ctaTop - ctaH,
    width: innerW, height: ctaH,
    color: WHITE, borderColor: OPAL_GOLD, borderWidth: 1.5,
  });
  page.drawRectangle({
    x: margin, y: ctaTop - ctaH,
    width: innerW, height: 26,
    color: OPAL_GOLD_30,
  });

  drawRTL(page, 'מוקד שירות ותביעות',  pageW - margin - 10, ctaTop - 17, 11, OPAL_BLUE, 'rtl');
  drawRTL(page, 'לשרות רפואי חייג:',   pageW - margin - 10, ctaTop - 46, 10, OPAL_BLUE, 'rtl');
  drawLTR(page, ctaPhone,               margin + 10,          ctaTop - 46, 11, OPAL_BLUE);
  drawRTL(page, 'קישור להגשת תביעה:', pageW - margin - 10, ctaTop - 66,  9, OPAL_BLUE, 'rtl');
  drawLTR(page, claims,                 margin + 10,          ctaTop - 66,  8, OPAL_GOLD);

  yRef.current -= ctaH + 14;

  /* ── notice box ──────────────────────────────────────────────────────── */
  const noticeH = 52;
  ensureSpace(noticeH + 10);

  page.drawRectangle({
    x: margin, y: yRef.current - noticeH,
    width: innerW, height: noticeH,
    color: rgb(0.99, 0.99, 0.99), borderColor: LINE, borderWidth: 1,
  });
  drawRTL(page,
    'שים לב: החיוב החודשי מתבצע דרך אופאל תקשורת בע״מ. המנוי כפוף לכתב השרות ולגילוי הנאות.',
    pageW - margin - 10, yRef.current - 18, 9, TEXT, 'rtl');
  drawRTL(page, 'לשאלות ותמיכה:', pageW - margin - 10, yRef.current - 36, 8, MUTED, 'rtl');
  drawLTR(page, '054-4261369 · opal2000@zahav.net.il', margin + 10, yRef.current - 36, 8, MUTED);
  yRef.current -= noticeH;

  drawFooter(page);

  return Buffer.from(await pdfDoc.save());
}

/* ─── disk save ─────────────────────────────────────────────────────────── */
export async function saveBeneficiarySummaryPdfToDisk({ transactionId, buffer }) {
  const fileName = `beneficiary-summary-${String(transactionId || '').trim() || 'unknown'}.pdf`;
  const outDir   = getGeneratedPdfDir();
  await fs.mkdir(outDir, { recursive: true });
  const fullPath = path.resolve(outDir, fileName);
  await fs.writeFile(fullPath, buffer);
  return { fileName, fullPath };
}