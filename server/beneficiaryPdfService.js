import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
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

function prepareVisualText(value) {
  return String(value || '')
    .split('\n')
    .map((lineText) => {
      if (!/[\u0590-\u05FF]/.test(lineText)) return lineText;
      const chunks = lineText.match(/[\u0590-\u05FF"'״׳\s]+|[^\u0590-\u05FF]+/g) || [lineText];
      const visual = chunks
        .reverse()
        .map((chunk) => (/[\u0590-\u05FF]/.test(chunk) ? chunk.split('').reverse().join('') : chunk))
        .join('');
      return `\u200F${visual}`;
    })
    .join('\n');
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

/**
 * Letterhead/footer styling inspired by `server/assets/DOC/אופאל נייר מכתבים.doc`
 * (navy + gold band; Word source is not parsed — visual parity only).
 */
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

  const footerText = prepareVisualText('אופאל תקשורת בע״מ · בית ליזמות רפואית · 054-4261369 · opal2000@zahav.net.il');
  const footerDisclaimer = prepareVisualText(
    'המנוי כפוף לכתב השרות ולגילוי הנאות. מסמך זה נוצר אוטומטית מהמערכת.'
  );

  function drawFooter(pg) {
    pg.drawLine({
      start: { x: margin, y: 52 },
      end: { x: pageW - margin, y: 52 },
      thickness: 0.8,
      color: OPAL_GOLD,
    });
    const fw = font.widthOfTextAtSize(footerText, 8);
    pg.drawText(footerText, {
      x: pageW - margin - fw,
      y: 38,
      size: 8,
      font,
      color: MUTED,
    });
    const dw = font.widthOfTextAtSize(footerDisclaimer, 7);
    pg.drawText(footerDisclaimer, {
      x: pageW - margin - dw,
      y: 26,
      size: 7,
      font,
      color: MUTED,
    });
  }

  function drawLetterhead(pg, yTop) {
    let y = yTop;
    pg.drawRectangle({
      x: margin,
      y: y - 3,
      width: innerW,
      height: 3,
      color: OPAL_GOLD,
    });
    y -= 8;
    pg.drawRectangle({
      x: margin,
      y: y - 32,
      width: innerW,
      height: 32,
      color: OPAL_BLUE,
    });
    const title1 = prepareVisualText('אופאל תקשורת בע״מ · בית ליזמות רפואית');
    const title2 = prepareVisualText('רופא עד הבית');
    const t1w = font.widthOfTextAtSize(title1, 11);
    const t2w = font.widthOfTextAtSize(title2, 9);
    pg.drawText(title1, { x: pageW - margin - t1w, y: y - 14, size: 11, font, color: WHITE });
    pg.drawText(title2, { x: pageW - margin - t2w, y: y - 28, size: 9, font, color: rgb(0.85, 0.88, 0.92) });
    if (logoImage) {
      const lw = 56;
      const lh = (logoImage.height / logoImage.width) * lw;
      pg.drawImage(logoImage, { x: margin + 4, y: y - 30, width: lw, height: lh });
    }
    return y - 44;
  }

  function drawRtl(text, xRight, yBaseline, size, color = TEXT, useBold = false) {
    const value = prepareVisualText(text);
    const w = font.widthOfTextAtSize(value, size);
    page.drawText(value, { x: xRight - w, y: yBaseline, size, font, color });
  }

  function ensureSpace(need, yRef) {
    if (yRef.current < need) {
      drawFooter(page);
      page = pdfDoc.addPage([pageW, pageH]);
      yRef.current = drawLetterhead(page, pageH - margin);
    }
  }

  const yRef = { current: drawLetterhead(page, pageH - margin) };

  /* --- Order strip (like order-form-pdf header) --- */
  ensureSpace(40, yRef);
  const stripH = 26;
  const c1 = innerW * 0.18;
  const c2 = innerW * 0.22;
  const c3 = innerW * 0.28;
  const c4 = innerW * 0.32;
  let sx = pageW - margin;
  const cells = [
    { w: c4, bg: WHITE, text: model.orderNumber, size: 12 },
    { w: c3, bg: WHITE, text: model.orderDate, size: 9 },
    { w: c2, bg: OPAL_GOLD_30, text: model.numerator, size: 9, sub: 'נומרטור' },
    { w: c1, bg: OPAL_GOLD, text: 'מס הזמנה', size: 10, light: true },
  ];
  for (const c of cells) {
    sx -= c.w;
    page.drawRectangle({
      x: sx,
      y: yRef.current - stripH,
      width: c.w,
      height: stripH,
      color: c.bg,
      borderColor: LINE,
      borderWidth: 0.5,
    });
    if (c.sub) {
      drawRtl(c.sub, sx + c.w - 4, yRef.current - 9, 7, MUTED, false);
    }
    drawRtl(c.text, sx + c.w - 4, yRef.current - (c.sub ? 20 : 14), c.size, c.light ? WHITE : OPAL_BLUE, !!c.light);
  }
  yRef.current -= stripH + 12;

  /* --- Customer block --- */
  const L = OPAL_BLUE;
  const V = WHITE;
  function cellGrid(rows) {
    for (const r of rows) {
      ensureSpace(28, yRef);
      const h = 22;
      let x = pageW - margin;
      for (let i = r.length - 1; i >= 0; i -= 1) {
        const seg = r[i];
        const w = innerW * seg.w;
        x -= w;
        page.drawRectangle({
          x,
          y: yRef.current - h,
          width: w,
          height: h,
          color: seg.role === 'l' ? L : V,
          borderColor: LINE,
          borderWidth: 0.5,
        });
        drawRtl(
          seg.text,
          x + w - 4,
          yRef.current - h + 6,
          seg.size || 9,
          seg.role === 'l' ? WHITE : OPAL_BLUE,
          seg.role === 'l'
        );
      }
      yRef.current -= h;
    }
    yRef.current -= 6;
  }

  cellGrid([
    [
      { w: 0.1, role: 'l', text: 'תאריך תחילת מנוי', size: 8 },
      { w: 0.12, role: 'v', text: model.subscriptionStartDate, size: 9 },
      { w: 0.08, role: 'l', text: 'ת.ז', size: 8 },
      { w: 0.14, role: 'v', text: model.customerId, size: 9 },
      { w: 0.1, role: 'l', text: 'שם לקוח', size: 8 },
      { w: 0.46, role: 'v', text: model.customerName, size: 9 },
    ],
    [
      { w: 0.1, role: 'l', text: 'מייל', size: 8 },
      { w: 0.28, role: 'v', text: model.email, size: 8 },
      { w: 0.1, role: 'l', text: 'טלפון', size: 8 },
      { w: 0.18, role: 'v', text: model.phone, size: 8 },
      { w: 0.12, role: 'l', text: 'כתובת הלקוח', size: 8 },
      { w: 0.22, role: 'v', text: model.address, size: 8 },
    ],
    [
      { w: 0.28, role: 'l', text: 'ארבע ספרות אחרונות בכרטיס האשראי', size: 8 },
      { w: 0.72, role: 'v', text: model.lastFourDigits, size: 10 },
    ],
  ]);

  /* Subscription row */
  const mt = `${model.monthlyTotal.toLocaleString('he-IL')} ₪`;
  cellGrid([
    [
      { w: 0.1, role: 'l', text: 'סה״כ תש׳ חודשי', size: 8 },
      { w: 0.11, role: 'v', text: mt, size: 11 },
      { w: 0.13, role: 'l', text: 'מוצר', size: 8 },
      { w: 0.16, role: 'v', text: model.productName, size: 8 },
      { w: 0.12, role: 'l', text: 'שם כתב השרות', size: 8 },
      { w: 0.13, role: 'v', text: model.serviceDocumentName, size: 8 },
      { w: 0.11, role: 'l', text: 'סוג המנוי', size: 8 },
      { w: 0.14, role: 'v', text: model.transactionDescription, size: 8 },
    ],
  ]);

  /* Section: תאור העסקה */
  ensureSpace(30, yRef);
  page.drawRectangle({
    x: margin,
    y: yRef.current - 22,
    width: innerW,
    height: 22,
    color: OPAL_GOLD,
  });
  drawRtl('תאור העסקה', pageW - margin - 4, yRef.current - 15, 12, WHITE, true);
  yRef.current -= 28;

  /* Primary + secondary beneficiaries (pad to 5 secondaries like preview) */
  const filled = [...model.secondaryBeneficiaries];
  while (filled.length < 5) {
    filled.push({ fullName: '', idNumber: '' });
  }

  function benRow(labelBg, label, name, idLabel, idVal) {
    ensureSpace(26, yRef);
    const h = 22;
    const wLab = innerW * 0.22;
    const wName = innerW * 0.5;
    const wIdL = innerW * 0.08;
    const wId = innerW * 0.2;
    let x = pageW - margin;
    x -= wId;
    page.drawRectangle({ x, y: yRef.current - h, width: wId, height: h, color: V, borderColor: LINE, borderWidth: 0.5 });
    drawRtl(idVal, x + wId - 4, yRef.current - h + 6, 9, OPAL_BLUE, false);
    x -= wIdL;
    page.drawRectangle({
      x,
      y: yRef.current - h,
      width: wIdL,
      height: h,
      color: labelBg,
      borderColor: LINE,
      borderWidth: 0.5,
    });
    drawRtl(idLabel, x + wIdL - 4, yRef.current - h + 6, 8, WHITE, true);
    x -= wName;
    page.drawRectangle({ x, y: yRef.current - h, width: wName, height: h, color: V, borderColor: LINE, borderWidth: 0.5 });
    drawRtl(name, x + wName - 4, yRef.current - h + 6, 9, OPAL_BLUE, false);
    x -= wLab;
    page.drawRectangle({
      x,
      y: yRef.current - h,
      width: wLab,
      height: h,
      color: labelBg,
      borderColor: LINE,
      borderWidth: 0.5,
    });
    drawRtl(label, x + wLab - 4, yRef.current - h + 6, 8, WHITE, true);
    yRef.current -= h;
  }

  benRow(
    OPAL_GOLD,
    'שם המבוטח העיקרי',
    model.primaryBeneficiary.fullName,
    'ת.ז',
    model.primaryBeneficiary.idNumber
  );
  filled.forEach((b) => {
    benRow(OPAL_BLUE, 'שם המבוטח המשני', b.fullName || '', 'ת.ז', b.idNumber || '');
  });

  yRef.current -= 8;

  /* נותן שירות */
  ensureSpace(80, yRef);
  page.drawRectangle({
    x: margin,
    y: yRef.current - 22,
    width: innerW,
    height: 22,
    color: OPAL_GOLD,
  });
  drawRtl('פרטי נותן השרות', pageW - margin - 4, yRef.current - 15, 12, WHITE, true);
  yRef.current -= 24;
  const svcPhone = process.env.MEDICAL_SERVICES_PHONE || '00-0000000';
  const claims = process.env.CLAIMS_ONLINE_URL || 'https://opal-medical.co.il/claims';
  page.drawRectangle({
    x: margin,
    y: yRef.current - 42,
    width: innerW,
    height: 42,
    color: WHITE,
    borderColor: LINE,
    borderWidth: 0.5,
  });
  const svcLabel = prepareVisualText('טלפונים להזמנת שירותים רפואיים:');
  const wSvc = font.widthOfTextAtSize(svcLabel, 10);
  page.drawText(svcLabel, { x: pageW - margin - wSvc, y: yRef.current - 16, size: 10, font, color: OPAL_BLUE });
  page.drawText(String(svcPhone), { x: margin + 8, y: yRef.current - 16, size: 10, font, color: OPAL_BLUE });
  const docLabel = prepareVisualText('הגשת מסמכים רפואיים (תביעה און ליין):');
  const wDoc = font.widthOfTextAtSize(docLabel, 9);
  page.drawText(docLabel, { x: pageW - margin - wDoc, y: yRef.current - 32, size: 9, font, color: OPAL_BLUE });
  page.drawText(String(claims), { x: margin + 8, y: yRef.current - 32, size: 8, font, color: OPAL_GOLD });
  yRef.current -= 50;

  /* Notice box */
  ensureSpace(56, yRef);
  page.drawRectangle({
    x: margin,
    y: yRef.current - 48,
    width: innerW,
    height: 48,
    color: WHITE,
    borderColor: OPAL_GOLD,
    borderWidth: 1.5,
  });
  drawRtl('שים לב', pageW - margin - 8, yRef.current - 18, 10, OPAL_GOLD, true);
  drawRtl('חיוב החודשי של המנוי דרך חברת אופאל תקשורת בע״מ.', pageW - margin - 8, yRef.current - 32, 9, TEXT, false);
  drawRtl('לפניות: 054-4261369 · opal2000@zahav.net.il', pageW - margin - 8, yRef.current - 44, 8, MUTED, false);
  yRef.current -= 56;

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
