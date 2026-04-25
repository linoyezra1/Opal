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
const OPAL_GOLD_LIGHT = rgb(0.97, 0.94, 0.84);
const OFF_WHITE = rgb(0.985, 0.985, 0.97);
const ALT_ROW = rgb(0.955, 0.97, 0.99);
const EMERALD = rgb(10 / 255, 132 / 255, 105 / 255);
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

  function drawStatusBadge(pg, text, xRight, yTop, tone = 'default') {
    const badgeText = reorderVisualBidi(text);
    const padX = 8;
    const h = 18;
    const w = font.widthOfTextAtSize(badgeText, 8) + padX * 2;
    const bg = tone === 'success' ? rgb(0.9, 0.97, 0.94) : rgb(0.92, 0.95, 1);
    const fg = tone === 'success' ? EMERALD : OPAL_BLUE;
    pg.drawRectangle({
      x: xRight - w,
      y: yTop - h,
      width: w,
      height: h,
      color: bg,
      borderColor: fg,
      borderWidth: 0.8,
    });
    drawRTL(pg, text, xRight - padX, yTop - 12, 8, fg, 'rtl');
    return w;
  }

  function sectionHead(pg, text, yTop) {
    const titleY = yTop - 14;
    drawRTL(pg, text, pageW - margin, titleY, 12, OPAL_BLUE, 'rtl');
    pg.drawLine({
      start: { x: margin, y: yTop - 20 },
      end:   { x: pageW - margin, y: yTop - 20 },
      thickness: 1.2,
      color: OPAL_GOLD,
    });
    return yTop - 30;
  }

  function drawSoftCard(pg, { x, yTop, width, height, bg = WHITE, stroke = LINE }) {
    pg.drawRectangle({
      x: x + 2,
      y: yTop - height - 2,
      width,
      height,
      color: rgb(0.94, 0.95, 0.97),
      opacity: 0.55,
    });
    pg.drawRectangle({
      x,
      y: yTop - height,
      width,
      height,
      color: bg,
      borderColor: stroke,
      borderWidth: 1,
    });
    pg.drawRectangle({
      x: x + 1.5,
      y: yTop - height + 1.5,
      width: width - 3,
      height: height - 3,
      color: bg,
      borderColor: rgb(0.94, 0.95, 0.97),
      borderWidth: 0.6,
    });
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
    const headerH = 106;
    const x = margin;
    const y = yTop - headerH;
    const contentTop = yTop - 10;

    drawSoftCard(pg, { x, yTop, width: innerW, height: headerH, bg: OFF_WHITE, stroke: LINE });
    pg.drawRectangle({
      x,
      y: y + headerH - 4,
      width: innerW,
      height: 4,
      color: OPAL_GOLD,
    });
    pg.drawRectangle({
      x: x + 14,
      y: y + 10,
      width: innerW - 28,
      height: 1.4,
      color: OPAL_GOLD,
    });

    const leftBoxX = x + 14;
    const rightBoxRight = pageW - margin - 14;
    const titleY = contentTop - 14;

    // Top-right: logo
    if (logoImage) {
      const logoW = 86;
      const logoH = (logoImage.height / logoImage.width) * logoW;
      pg.drawImage(logoImage, {
        x: rightBoxRight - logoW,
        y: contentTop - logoH + 1,
        width: logoW,
        height: logoH,
      });
    }

    // Top-center: title
    drawCenter(pg, reorderVisualBidi('סיכום הזמנה'), titleY, 20, OPAL_BLUE);

    // Top-left: order details
    drawLTR(pg, `#${normalizeText(model.orderNumber) || '—'}`, leftBoxX, contentTop - 12, 11, OPAL_BLUE);
    const orderDate = formatDateDDMMYYYY(model.orderDate);
    drawLTR(pg, orderDate, leftBoxX, contentTop - 28, 10, MUTED);
    drawLTR(pg, normalizeText(model.numerator) ? `Ref ${normalizeText(model.numerator)}` : 'Ref —', leftBoxX, contentTop - 44, 9, MUTED);

    // Header metadata right-aligned in RTL under title area
    const metaRight = pageW - margin - 14;
    drawRTL(pg, `מוצר: ${line(model.productName)}`, metaRight, y + 34, 10, OPAL_BLUE, 'rtl');
    drawStatusBadge(pg, 'פוליסה פעילה', metaRight, y + 26, 'success');

    return yTop - headerH - 20;
  }

  const yRef = { current: drawHeader(page, pageH - margin) };

  function ensureSpace(needed) {
    if (yRef.current - needed >= 76) return;
    drawFooter(page);
    page = pdfDoc.addPage([pageW, pageH]);
    yRef.current = drawHeader(page, pageH - margin);
  }

  /* ── info grid ───────────────────────────────────────────────────────── */
  function infoGrid(title, items, options = {}) {
    const cardWidth = options.width ?? innerW;
    const lineGap   = 24;
    const padX      = 14;
    const padTop    = 14;
    const cardH     = 34 + items.length * lineGap + 16;
    ensureSpace(cardH + 12);

    const x    = options.x ?? margin;
    const yTop = yRef.current;

    drawSoftCard(page, {
      x,
      yTop,
      width: cardWidth,
      height: cardH,
      bg: options.alt ? ALT_ROW : OFF_WHITE,
      stroke: options.alt ? rgb(0.78, 0.85, 0.95) : LINE,
    });
    page.drawRectangle({
      x: x + 1,
      y: yTop - 34,
      width: cardWidth - 2,
      height: 33,
      color: WHITE,
    });
    drawRTL(page, title, x + cardWidth - padX, yTop - 21, 11, OPAL_BLUE, 'rtl');
    page.drawLine({
      start: { x: x + padX, y: yTop - 36 },
      end: { x: x + cardWidth - padX, y: yTop - 36 },
      thickness: 1,
      color: OPAL_GOLD,
    });

    const labelW = 122;
    let lineY    = yTop - (padTop + 34);
    for (const item of items) {
      const dir = item.dir ?? 'rtl';
      drawRTL(page, `${item.label}:`, x + cardWidth - padX,          lineY, 9, MUTED,      'rtl');
      drawRTL(page,  item.value,      x + cardWidth - padX - labelW, lineY, 10, OPAL_BLUE, dir);
      lineY -= lineGap;
    }

    if (options.advance !== false) yRef.current -= cardH + 14;
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

  yRef.current = sectionHead(page, 'פרטי לקוח ומנוי', yRef.current);
  const projH = 34 + Math.max(customerItems.length, subItems.length) * 24 + 16;
  ensureSpace(projH + 20);

  const { cardH: ch1 } = infoGrid('פרטי לקוח', customerItems, {
    width: halfW, x: margin + halfW + cardGap, advance: false,
  });
  const { cardH: ch2 } = infoGrid('פרטי מנוי', subItems, {
    width: halfW, x: margin, advance: false, alt: true,
  });
  yRef.current -= Math.max(ch1, ch2) + 18;

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

  function itemsTable(rows) {
    const tableHeaderH = 34;
    const rowH         = 30;
    const totalsH      = 42;
    const tableH       = tableHeaderH + rows.length * rowH + totalsH;
    ensureSpace(tableH + 16);

    const tableTop   = yRef.current;
    const tableRight = pageW - margin;
    const colService = innerW * 0.3;
    const colId      = innerW * 0.25;
    const div1X      = tableRight - colService;
    const div2X      = tableRight - colService - colId;

    drawSoftCard(page, {
      x: margin,
      yTop: tableTop,
      width: innerW,
      height: tableHeaderH + rows.length * rowH,
      bg: WHITE,
      stroke: LINE,
    });

    page.drawRectangle({
      x: margin + 1,
      y: tableTop - tableHeaderH,
      width: innerW - 2,
      height: tableHeaderH - 1,
      color: OPAL_BLUE,
    });

    for (const dx of [div1X, div2X]) {
      page.drawLine({
        start: { x: dx, y: tableTop },
        end:   { x: dx, y: tableTop - tableHeaderH - rows.length * rowH },
        thickness: 1,
        color: rgb(0.78, 0.84, 0.9),
      });
    }

    drawRTL(page, 'שירות',  tableRight - 10, tableTop - 22, 10, WHITE, 'rtl');
    drawRTL(page, 'ת.ז',    div1X      - 10, tableTop - 22, 10, WHITE, 'rtl');
    drawRTL(page, 'שם מלא', div2X      - 10, tableTop - 22, 10, WHITE, 'rtl');

    let rowTop = tableTop - tableHeaderH;
    rows.forEach((row, idx) => {
      page.drawRectangle({
        x: margin + 1,
        y: rowTop - rowH,
        width: innerW - 2,
        height: rowH,
        color: row.isPrimary ? OPAL_GOLD_30 : (idx % 2 ? ALT_ROW : OFF_WHITE),
      });
      page.drawLine({
        start: { x: margin + 1, y: rowTop - rowH },
        end:   { x: pageW - margin - 1, y: rowTop - rowH },
        thickness: 0.8,
        color: LINE,
      });
      drawRTL(page, row.service,  tableRight - 10, rowTop - 20, 9, TEXT,      'rtl');
      drawRTL(page, row.id,       div1X      - 10, rowTop - 20, 9, OPAL_BLUE, 'ltr');
      drawRTL(page, row.fullName, div2X      - 10, rowTop - 20, 9, TEXT,      'rtl');
      rowTop -= rowH;
    });

    // totals banner
    const totalLabel = 'סה״כ מבוטחים';
    const totalValue = `${rows.length}`;
    page.drawRectangle({
      x: margin,
      y: rowTop - totalsH,
      width: innerW,
      height: totalsH,
      color: OPAL_GOLD_LIGHT,
      borderColor: OPAL_GOLD,
      borderWidth: 1.6,
    });
    drawRTL(page, `${totalLabel}:`, tableRight - 12, rowTop - 26, 12, OPAL_BLUE, 'rtl');
    drawRTL(page, totalValue, tableRight - 140, rowTop - 26, 13, OPAL_BLUE, 'ltr');
    drawStatusBadge(page, 'סיכום פיננסי', margin + 122, rowTop - 8, 'default');

    yRef.current -= tableH + 18;
  }

  yRef.current = sectionHead(page, 'פרטי מוטבים', yRef.current);
  itemsTable(tableRows);

  /* ── service / claims box ────────────────────────────────────────────── */
  const ctaH     = 90;
  const ctaPhone = normalizeText(process.env.MEDICAL_SERVICES_PHONE || '054-4261369');
  const claims   = normalizeText(process.env.CLAIMS_ONLINE_URL || 'https://medi-care.org.il/online-claim/#elementor-action%3Aaction%3Dpopup%3Aopen%26settings%3DeyJpZCI6IjQzNiIsInRvZ2dsZSI6ZmFsc2V9');

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
