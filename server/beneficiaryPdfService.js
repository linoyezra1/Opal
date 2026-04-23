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

/** Brand colors — aligned with `src/NEW/components/email/order-form-pdf.tsx` */
const OPAL_BLUE = rgb(26 / 255, 54 / 255, 93 / 255);
const OPAL_GOLD = rgb(197 / 255, 160 / 255, 89 / 255);
const OPAL_GOLD_30 = rgb(0.92, 0.88, 0.8);
const TEXT = rgb(0.12, 0.14, 0.16);
const MUTED = rgb(0.45, 0.48, 0.52);
const WHITE = rgb(1, 1, 1);
const LINE = rgb(0.82, 0.84, 0.88);
const bidi = bidiFactory();

function line(text, fallback = '—') {
  const t = String(text || '').trim();
  return t || fallback;
}

export function buildBeneficiaryPdfModel(input = {}) {
  const primary = input.primaryBeneficiary || {};
  const secondary = Array.isArray(input.secondaryBeneficiaries) ? input.secondaryBeneficiaries : [];
  return {
    orderNumber: line(input.orderNumber, ''),
    orderDate: line(input.orderDate, ''),
    numerator: line(input.numerator, '—'),
    customerName: line(input.customerName),
    customerId: line(input.customerId),
    subscriptionStartDate: line(input.subscriptionStartDate),
    address: line(input.address),
    phone: line(input.phone),
    email: line(input.email),
    lastFourDigits: line(input.lastFourDigits, '—'),
    transactionDescription: line(input.transactionDescription, input.productName),
    serviceDocumentName: line(input.serviceDocumentName, 'רופא עד הבית'),
    productName: line(input.productName),
    monthlyTotal: Number(input.monthlyTotal || 0),
    primaryBeneficiary: {
      fullName: line(primary.fullName || [primary.firstName, primary.lastName].filter(Boolean).join(' ')),
      idNumber: line(primary.idNumber || primary.id),
      dateOfBirth: line(primary.dateOfBirth),
      maritalStatus: line(primary.maritalStatus),
      healthFund: line(primary.healthFund),
      supplementalInsurance: line(primary.supplementalInsurance),
    },
    secondaryBeneficiaries: secondary.map((b) => ({
      fullName: line(b.fullName || [b.firstName, b.lastName].filter(Boolean).join(' ')),
      idNumber: line(b.idNumber || b.id),
      dateOfBirth: line(b.dateOfBirth),
      maritalStatus: line(b.maritalStatus),
      healthFund: line(b.healthFund),
      supplementalInsurance: line(b.supplementalInsurance),
    })),
  };
}

function normalizeText(value) {
  return String(value ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
}

function formatDateDDMMYYYY(value) {
  const raw = normalizeText(value);
  if (!raw) return '—';
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  const dd = String(parsed.getDate()).padStart(2, '0');
  const mm = String(parsed.getMonth() + 1).padStart(2, '0');
  const yyyy = String(parsed.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

function reorderVisualBidi(value, baseDirection = 'rtl') {
  const text = normalizeText(value);
  if (!text) return '';

  const embeddingResult = bidi.getEmbeddingLevels(text, baseDirection);
  const { levels } = embeddingResult;

  // Apply character mirroring (e.g. parentheses flip in RTL context)
  const mirrored = bidi.getMirroredCharactersMap(text, embeddingResult);
  const chars = text.split('');
  mirrored.forEach((ch, idx) => { chars[idx] = ch; });

  // Unicode BiDi L2: from the highest embedding level down to the lowest odd
  // level, reverse every maximal contiguous run at that level or higher.
  // Embedded LTR runs (even levels) are never touched, so emails/numbers/URLs
  // that appear inside Hebrew text keep their correct left-to-right character order.
  let maxLevel = 0;
  let minOdd = 256;
  for (const l of levels) {
    if (l > maxLevel) maxLevel = l;
    if (l % 2 !== 0 && l < minOdd) minOdd = l;
  }

  for (let level = maxLevel; level >= minOdd; level--) {
    for (let i = 0; i < chars.length; ) {
      if (levels[i] >= level) {
        let j = i;
        while (j < chars.length && levels[j] >= level) j++;
        for (let lo = i, hi = j - 1; lo < hi; lo++, hi--) {
          [chars[lo], chars[hi]] = [chars[hi], chars[lo]];
        }
        i = j;
      } else {
        i++;
      }
    }
  }

  return chars.join('');
}

async function tryEmbedLogo(pdfDoc) {
  try {
    const candidates = candidateServerAssetPaths('branding', 'opal-logo.jpeg');
    const { buffer } = await readFirstExistingFile(candidates, 'opal-logo.jpeg');
    return await pdfDoc.embedJpg(buffer);
  } catch {
    return null;
  }
}

export async function generateBeneficiarySummaryPdfBuffer(modelInput = {}) {
  const model = buildBeneficiaryPdfModel(modelInput);
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const fontCandidates = candidateServerAssetPaths('fonts', 'Heebo-Regular.ttf');
  const { buffer: fontBytes } = await readFirstExistingFile(
    fontCandidates,
    'Heebo-Regular.ttf (server/assets/fonts)'
  );
  const font = await pdfDoc.embedFont(fontBytes);
  const logoImage = await tryEmbedLogo(pdfDoc);

  const pageW = 595;
  const pageH = 842;
  const margin = 36;
  const innerW = pageW - margin * 2;
  let page = pdfDoc.addPage([pageW, pageH]);
  const footerDisclaimer = normalizeText('המנוי כפוף לכתב השרות ולגילוי הנאות. מסמך זה נוצר אוטומטית מהמערכת.');
  const footerContact = normalizeText('אופאל תקשורת בע״מ  · 054-4261369 · opal2000@zahav.net.il');

  function drawRightText(pg, text, xRight, y, size, color = TEXT, dir = 'rtl') {
    const raw = normalizeText(text) || '—';
    // LTR values (emails, phone numbers, URLs, dates) are drawn as-is — their
    // character order must never be reversed, only their anchor point shifts left
    // by the text width so the right edge sits at xRight.
    const value = dir === 'ltr' ? raw : reorderVisualBidi(raw, 'rtl');
    const w = font.widthOfTextAtSize(value, size);
    pg.drawText(value, { x: xRight - w, y, size, font, color });
  }

  function drawCenterText(pg, text, y, size, color = TEXT) {
    // Footer strings contain Hebrew — run them through BiDi so the characters
    // appear in visual (screen) order rather than logical (storage) order.
    const value = reorderVisualBidi(text, 'rtl');
    const w = font.widthOfTextAtSize(value, size);
    pg.drawText(value, { x: (pageW - w) / 2, y, size, font, color });
  }

  function drawFooter(pg) {
    pg.drawLine({
      start: { x: margin, y: 58 },
      end: { x: pageW - margin, y: 58 },
      thickness: 0.8,
      color: LINE,
    });
    drawCenterText(pg, footerDisclaimer, 40, 7, MUTED);
    drawCenterText(pg, footerContact, 28, 8, MUTED);
  }

  function drawHeader(pg, yTop) {
    const headerH = 78;
    pg.drawRectangle({
      x: margin,
      y: yTop - headerH,
      width: innerW,
      height: headerH,
      color: OPAL_BLUE,
    });
    pg.drawRectangle({
      x: margin,
      y: yTop - headerH,
      width: innerW,
      height: 4,
      color: OPAL_GOLD,
    });
    if (logoImage) {
      const logoW = 70;
      const logoH = (logoImage.height / logoImage.width) * logoW;
      pg.drawImage(logoImage, {
        x: pageW - margin - logoW - 10,
        y: yTop - headerH + (headerH - logoH) / 2,
        width: logoW,
        height: logoH,
      });
    }
    drawRightText(pg, 'אישור הזמנה וסיכום מוטבים', pageW - margin - 92, yTop - 30, 16, WHITE, 'rtl');
    drawRightText(pg, 'מספר הזמנה:', pageW - margin - 92, yTop - 50, 11, WHITE, 'rtl');
    drawRightText(pg, model.orderNumber, pageW - margin - 170, yTop - 50, 11, WHITE, 'ltr');
    drawRightText(pg, 'מוצר:', pageW - margin - 92, yTop - 66, 10, rgb(0.9, 0.93, 0.97), 'rtl');
    drawRightText(pg, model.productName, pageW - margin - 128, yTop - 66, 10, rgb(0.9, 0.93, 0.97), 'rtl');
    return yTop - headerH - 16;
  }

  const yRef = { current: drawHeader(page, pageH - margin) };

  function ensureSpace(neededHeight) {
    if (yRef.current - neededHeight >= 76) return;
    drawFooter(page);
    page = pdfDoc.addPage([pageW, pageH]);
    yRef.current = drawHeader(page, pageH - margin);
  }

  function drawInfoCard(title, items, options = {}) {
    const cardWidth = options.width || innerW;
    const lineGap = 22;
    const cardH = 20 + items.length * lineGap + 16;
    ensureSpace(cardH + 10);
    const x = options.x || margin;
    const yTop = yRef.current;
    page.drawRectangle({
      x,
      y: yTop - cardH,
      width: cardWidth,
      height: cardH,
      color: WHITE,
      borderColor: LINE,
      borderWidth: 1,
    });
    page.drawRectangle({
      x,
      y: yTop - 30,
      width: cardWidth,
      height: 30,
      color: rgb(0.94, 0.97, 1),
    });
    drawRightText(page, title, x + cardWidth - 12, yTop - 20, 11, OPAL_BLUE);
    const labelW = 110;
    let lineY = yTop - 48;
    for (const item of items) {
      drawRightText(page, `${item.label}:`, x + cardWidth - 12, lineY, 10, TEXT, 'rtl');
      drawRightText(page, item.value, x + cardWidth - 12 - labelW, lineY, 10, TEXT, item.dir || 'rtl');
      lineY -= lineGap;
    }
    if (options.advance !== false) yRef.current -= cardH + 12;
    return { x, yTop, cardWidth, cardH };
  }

  const cardGap = 12;
  const halfW = (innerW - cardGap) / 2;
  const customerItems = [
    { label: 'שם לקוח', value: model.customerName, dir: 'rtl' },
    { label: 'טלפון', value: model.phone, dir: 'ltr' },
    { label: 'אימייל', value: model.email, dir: 'ltr' },
  ];
  const subItems = [
    { label: 'תאריך תחילת מנוי', value: formatDateDDMMYYYY(model.subscriptionStartDate), dir: 'ltr' },
    { label: 'אמצעי תשלום', value: `****${model.lastFourDigits}`, dir: 'ltr' },
    { label: 'סכום חודשי', value: `₪${Number(model.monthlyTotal || 0).toLocaleString('he-IL')}`, dir: 'ltr' },
  ];

  const projectedCardH = 20 + Math.max(customerItems.length, subItems.length) * 22 + 16;
  ensureSpace(projectedCardH + 16);
  const rightCard = drawInfoCard('פרטי לקוח', customerItems, {
    width: halfW,
    x: margin + halfW + cardGap,
    advance: false,
  });
  const leftCard = drawInfoCard('פרטי מנוי', subItems, {
    width: halfW,
    x: margin,
    advance: false,
  });
  yRef.current -= Math.max(rightCard.cardH, leftCard.cardH) + 14;

  const tableRows = [
    {
      service: model.serviceDocumentName,
      id: model.primaryBeneficiary.idNumber,
      fullName: model.primaryBeneficiary.fullName,
    },
    ...model.secondaryBeneficiaries.map((b) => ({
      service: model.serviceDocumentName,
      id: b.idNumber,
      fullName: b.fullName,
    })),
  ];
  const tableHeaderH = 32;
  const rowH = 28;
  const tableH = tableHeaderH + tableRows.length * rowH;
  ensureSpace(tableH + 14);

  const colService = innerW * 0.30;
  const colId = innerW * 0.26;
  const colName = innerW * 0.44;
  const tableTop = yRef.current;
  const tableRight = pageW - margin;

  page.drawRectangle({
    x: margin,
    y: tableTop - tableHeaderH,
    width: innerW,
    height: tableHeaderH,
    color: rgb(0.88, 0.94, 1),
    borderColor: LINE,
    borderWidth: 1,
  });

  const serviceX = tableRight - 10;
  const idX = tableRight - colService - 10;
  const nameX = tableRight - colService - colId - 10;
  drawRightText(page, 'שירות', serviceX, tableTop - 21, 10, OPAL_BLUE, 'rtl');
  drawRightText(page, 'ת.ז', idX, tableTop - 21, 10, OPAL_BLUE, 'rtl');
  drawRightText(page, 'שם מלא', nameX, tableTop - 21, 10, OPAL_BLUE, 'rtl');

  page.drawLine({
    start: { x: tableRight - colService, y: tableTop },
    end: { x: tableRight - colService, y: tableTop - tableH },
    thickness: 1,
    color: LINE,
  });
  page.drawLine({
    start: { x: tableRight - colService - colId, y: tableTop },
    end: { x: tableRight - colService - colId, y: tableTop - tableH },
    thickness: 1,
    color: LINE,
  });

  let rowTop = tableTop - tableHeaderH;
  for (const row of tableRows) {
    page.drawRectangle({
      x: margin,
      y: rowTop - rowH,
      width: innerW,
      height: rowH,
      color: WHITE,
      borderColor: LINE,
      borderWidth: 0.8,
    });
    drawRightText(page, row.service, serviceX, rowTop - 18, 9, TEXT, 'rtl');
    drawRightText(page, row.id, idX, rowTop - 18, 9, TEXT, 'ltr');
    drawRightText(page, row.fullName, nameX, rowTop - 18, 9, TEXT, 'rtl');
    rowTop -= rowH;
  }
  yRef.current -= tableH + 16;

  const ctaH = 92;
  ensureSpace(ctaH + 14);
  const ctaTop = yRef.current;
  const ctaPhone = normalizeText(process.env.MEDICAL_SERVICES_PHONE || '054-4261369');
  const claims = normalizeText(process.env.CLAIMS_ONLINE_URL || 'https://opal-medical.co.il/claims');
  page.drawRectangle({
    x: margin,
    y: ctaTop - ctaH,
    width: innerW,
    height: ctaH,
    color: WHITE,
    borderColor: OPAL_GOLD,
    borderWidth: 1.5,
  });
  page.drawRectangle({
    x: margin,
    y: ctaTop - ctaH,
    width: innerW,
    height: 28,
    color: OPAL_GOLD_30,
  });
  drawRightText(page, 'מוקד שירות ותביעות', pageW - margin - 12, ctaTop - 18, 11, OPAL_BLUE, 'rtl');
  drawRightText(page, 'לשירות רפואי חייגו:', pageW - margin - 12, ctaTop - 46, 10, OPAL_BLUE, 'rtl');
  drawRightText(page, ctaPhone, pageW - margin - 140, ctaTop - 46, 10, OPAL_BLUE, 'ltr');
  drawRightText(page, 'קישור להגשת תביעה:', pageW - margin - 12, ctaTop - 68, 9, OPAL_BLUE, 'rtl');
  drawRightText(page, claims, pageW - margin - 132, ctaTop - 68, 9, OPAL_BLUE, 'ltr');
  yRef.current -= ctaH + 14;

  const noticeH = 46;
  ensureSpace(noticeH + 10);
  page.drawRectangle({
    x: margin,
    y: yRef.current - noticeH,
    width: innerW,
    height: noticeH,
    color: rgb(0.99, 0.99, 0.99),
    borderColor: LINE,
    borderWidth: 1,
  });
  drawRightText(page, 'שים לב: החיוב החודשי מתבצע דרך אופאל תקשורת בע״מ.', pageW - margin - 10, yRef.current - 18, 9, TEXT, 'rtl');
  drawRightText(page, 'לשאלות ותמיכה:', pageW - margin - 10, yRef.current - 34, 8, MUTED, 'rtl');
  drawRightText(page, '054-4261369 · opal2000@zahav.net.il', pageW - margin - 92, yRef.current - 34, 8, MUTED, 'ltr');

  drawFooter(page);

  return Buffer.from(await pdfDoc.save());
}

export async function saveBeneficiarySummaryPdfToDisk({ transactionId, buffer }) {
  const fileName = `beneficiary-summary-${String(transactionId || '').trim() || 'unknown'}.pdf`;
  const outDir = getGeneratedPdfDir();
  await fs.mkdir(outDir, { recursive: true });
  const fullPath = path.resolve(outDir, fileName);
  await fs.writeFile(fullPath, buffer);
  return { fileName, fullPath };
}
