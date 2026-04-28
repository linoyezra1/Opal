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

/*
  ─── Design tokens ────────────────────────────────────────────────────────────
  Background:   pure white
  Navy:         #1a365d  — headings, labels, table header bg
  Gold:         #c5a059  — top stripe, section underline, totals border
  Gold-light:   #f5f0e5  — totals banner, primary beneficiary row
  Body text:    #1f2937
  Muted:        #6b7280
  Border:       #d1d5db
  Alt row:      #f9fafb
  ─────────────────────────────────────────────────────────────────────────── */
const NAVY       = rgb(26  / 255, 54  / 255, 93  / 255);
const GOLD       = rgb(197 / 255, 160 / 255, 89  / 255);
const GOLD_LIGHT = rgb(245 / 255, 240 / 255, 229 / 255);
const BODY       = rgb(31  / 255, 41  / 255, 55  / 255);
const MUTED      = rgb(107 / 255, 113 / 255, 128 / 255);
const BORDER     = rgb(209 / 255, 213 / 255, 219 / 255);
const ALT_ROW    = rgb(249 / 255, 250 / 255, 251 / 255);
const WHITE      = rgb(1, 1, 1);

/* ─── bidi-js ────────────────────────────────────────────────────────────── */
const bidi = bidiFactory();

function bidiV(text) {
  const s = String(text ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (!s) return s;
  if (!/[֐-׿؀-ۿיִ-ﭏ]/.test(s)) return s;
  try {
    const lv  = bidi.getEmbeddingLevels(s, 'rtl');
    const seg = bidi.getReorderSegments(s, lv);
    let out = '';
    for (const [a, b] of seg) {
      const ch = s.slice(a, b + 1);
      out += (lv[a] ?? 0) % 2 === 1 ? [...ch].reverse().join('') : ch;
    }
    return out;
  } catch {
    return s.split(/(\s+)/).reverse().join('');
  }
}

/* ─── micro-helpers ──────────────────────────────────────────────────────── */
function norm(v)        { return String(v ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim(); }
function safe(v, f='—') { const t = norm(v); return t || f; }

function fmtDate(v) {
  const r = norm(v);
  if (!r || r === '—') return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(r);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const d = new Date(r);
  if (isNaN(d.getTime())) return r;
  return [
    String(d.getDate()).padStart(2, '0'),
    String(d.getMonth() + 1).padStart(2, '0'),
    d.getFullYear(),
  ].join('/');
}

/* ─── model builder ─────────────────────────────────────────────────────── */
export function buildBeneficiaryPdfModel(input = {}) {
  const p  = input.primaryBeneficiary   || {};
  const ss = Array.isArray(input.secondaryBeneficiaries) ? input.secondaryBeneficiaries : [];
  const purchaseDate = safe(
    input.purchaseDate ||
    input.orderDate ||
    input.createdAt ||
    input.dealCreatedAt,
    ''
  );
  const subscriptionStartDate = safe(
    input.subscriptionStartDate ||
    input.beneficiarySubmittedAt ||
    input.beneficiaryCompletionDate ||
    input.beneficiaryUpdateSubmittedAt,
    ''
  );
  return {
    orderNumber:            safe(input.orderNumber, ''),
    orderDate:              purchaseDate,
    numerator:              safe(input.numerator, '—'),
    customerName:           safe(input.customerName),
    customerId:             safe(input.customerId),
    subscriptionStartDate:  subscriptionStartDate,
    address:                safe(input.address),
    phone:                  safe(input.phone),
    email:                  safe(input.email),
    lastFourDigits:         safe(input.lastFourDigits, '—'),
    transactionDescription: safe(input.transactionDescription, input.productName),
    serviceDocumentName:    'רופא עד הבית',
    productName:            safe(input.productName),
    monthlyTotal:           Number(input.monthlyTotal || 0),
    primaryBeneficiary: {
      fullName:              safe(p.fullName || [p.firstName, p.lastName].filter(Boolean).join(' ')),
      idNumber:              safe(p.idNumber || p.id),
      dateOfBirth:           safe(p.dateOfBirth),
      maritalStatus:         safe(p.maritalStatus),
      healthFund:            safe(p.healthFund),
      supplementalInsurance: safe(p.supplementalInsurance),
    },
    secondaryBeneficiaries: ss.map((b) => ({
      fullName:              safe(b.fullName || [b.firstName, b.lastName].filter(Boolean).join(' ')),
      idNumber:              safe(b.idNumber || b.id),
      dateOfBirth:           safe(b.dateOfBirth),
      maritalStatus:         safe(b.maritalStatus),
      healthFund:            safe(b.healthFund),
      supplementalInsurance: safe(b.supplementalInsurance),
    })),
  };
}

/* ─── logo ───────────────────────────────────────────────────────────────── */
async function tryEmbedLogo(pdfDoc) {
  try {
    const { buffer } = await readFirstExistingFile(
      candidateServerAssetPaths('branding', 'opal-logo.jpeg'),
      'opal-logo.jpeg'
    );
    return await pdfDoc.embedJpg(buffer);
  } catch {
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN GENERATOR
   ═══════════════════════════════════════════════════════════════════════════ */
export async function generateBeneficiarySummaryPdfBuffer(modelInput = {}) {
  const model = buildBeneficiaryPdfModel(modelInput);

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const { buffer: fontBytes } = await readFirstExistingFile(
    candidateServerAssetPaths('fonts', 'Heebo-Regular.ttf'),
    'Heebo-Regular.ttf'
  );
  const font = await pdfDoc.embedFont(fontBytes);
  const logo = await tryEmbedLogo(pdfDoc);

  /* A4 */
  const W = 595, H = 842;
  const ML = 36, MR = 36;
  const CW = W - ML - MR;   // 523 pt
  const PAD = 10;            // inner padding for cards/grids

  let page; // assigned by newPage() — do NOT add a page here or the first page will be blank.

  /* ── primitives ─────────────────────────────────────────────────────── */

  function rtl(pg, raw, xRight, y, sz, col = BODY) {
    const v = bidiV(norm(raw) || '—');
    pg.drawText(v, { x: xRight - font.widthOfTextAtSize(v, sz), y, size: sz, font, color: col });
  }

  function ltr(pg, raw, xLeft, y, sz, col = BODY) {
    const v = norm(raw);
    if (!v) return;
    pg.drawText(v, { x: xLeft, y, size: sz, font, color: col });
  }

  function ctr(pg, v, y, sz, col = BODY) {
    pg.drawText(v, { x: (W - font.widthOfTextAtSize(v, sz)) / 2, y, size: sz, font, color: col });
  }

  function hline(pg, x1, x2, y, col = BORDER, th = 0.5) {
    pg.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: th, color: col });
  }

  function vline(pg, x, y1, y2, col = BORDER, th = 0.5) {
    pg.drawLine({ start: { x, y: y1 }, end: { x, y: y2 }, thickness: th, color: col });
  }

  function rect(pg, x, y, w, h, col, borderCol = null, borderTh = 0.5) {
    pg.drawRectangle({
      x, y, width: w, height: h, color: col,
      ...(borderCol ? { borderColor: borderCol, borderWidth: borderTh } : {}),
    });
  }

  /* ── HEADER ──────────────────────────────────────────────────────────
     Logo → TOP-LEFT
     Title / company / order-number / date → TOP-RIGHT
  ─────────────────────────────────────────────────────────────────────── */
  function drawHeader(pg, yTop) {
    const cardH = 76;
    // Card outline
    rect(pg, ML, yTop - cardH, CW, cardH, WHITE, BORDER, 0.6);
    // 2-pt gold top stripe
    rect(pg, ML, yTop - 2, CW, 2, GOLD);

    // Logo — top-left
    if (logo) {
      const lw = 68;
      const lh = (logo.height / logo.width) * lw;
      pg.drawImage(logo, {
        x: ML + PAD,
        y: yTop - cardH + (cardH - lh) / 2,
        width: lw,
        height: lh,
      });
    }

    // Right side: title + company + order + date
    const xR = ML + CW - PAD;

    // Title
    const titleV = bidiV('סיכום הזמנה');
    pg.drawText(titleV, {
      x: xR - font.widthOfTextAtSize(titleV, 16),
      y: yTop - 22,
      size: 16, font, color: NAVY,
    });

    // Company sub-label
    const coV = bidiV('אופאל תקשורת שיווקית בע״מ');
    pg.drawText(coV, {
      x: xR - font.widthOfTextAtSize(coV, 8),
      y: yTop - 36,
      size: 8, font, color: MUTED,
    });

    // Order number  label + value (right-anchored pair)
    const ordLV  = bidiV('מס׳ הזמנה:');
    const ordLW  = font.widthOfTextAtSize(ordLV, 8);
    const ordVal = norm(model.orderNumber) || '—';
    const ordVW  = font.widthOfTextAtSize(ordVal, 8.5);
    pg.drawText(ordLV,  { x: xR - ordLW,              y: yTop - 50, size: 8,   font, color: MUTED });
    pg.drawText(ordVal, { x: xR - ordLW - 4 - ordVW,  y: yTop - 50, size: 8.5, font, color: NAVY  });

    // Date  label + value
    const dateLV  = bidiV('תאריך:');
    const dateLW  = font.widthOfTextAtSize(dateLV, 8);
    const dateVal = fmtDate(model.orderDate);
    const dateVW  = font.widthOfTextAtSize(dateVal, 8.5);
    pg.drawText(dateLV,  { x: xR - dateLW,               y: yTop - 62, size: 8,   font, color: MUTED });
    pg.drawText(dateVal, { x: xR - dateLW - 4 - dateVW,  y: yTop - 62, size: 8.5, font, color: BODY  });

    hline(pg, ML + 8, ML + CW - 8, yTop - cardH + 1);
    return yTop - cardH - 8;
  }

  /* ── SECTION HEADER ──────────────────────────────────────────────────
     Clean navy bold text right-aligned + thin gold underline. No icons.
  ─────────────────────────────────────────────────────────────────────── */
  function sectionHead(pg, label, y) {
    const lv = bidiV(label);
    pg.drawText(lv, {
      x: ML + CW - font.widthOfTextAtSize(lv, 11),
      y: y - 13,
      size: 11, font, color: NAVY,
    });
    // Thin gold underline directly below text
    hline(pg, ML, ML + CW, y - 17, GOLD, 0.8);
    return y - 22;
  }

  /* ── INFO GRID ───────────────────────────────────────────────────────
     2-column, label above value. ROW_H tightened for single-page fit.
  ─────────────────────────────────────────────────────────────────────── */
  function infoGrid(pg, fields, y) {
    const ROW_H  = 30;
    const GAP    = 10;
    const halfCW = (CW - GAP) / 2;

    const rows = [];
    let cur = [];
    for (const f of fields) {
      if (f.span2) {
        if (cur.length) { rows.push(cur); cur = []; }
        rows.push([f]);
      } else {
        cur.push(f);
        if (cur.length === 2) { rows.push(cur); cur = []; }
      }
    }
    if (cur.length) rows.push(cur);

    const gridH = rows.length * ROW_H + PAD * 2;
    rect(pg, ML, y - gridH, CW, gridH, ALT_ROW, BORDER, 0.4);

    let gy = y - PAD;
    for (const row of rows) {
      row.forEach((f, ci) => {
        const colW = f.span2 ? CW : halfCW;
        // col 0 = right half, col 1 = left half (RTL layout)
        const cx = f.span2 ? ML : (ci === 0 ? ML + halfCW + GAP : ML);

        const lv = bidiV(f.label);
        pg.drawText(lv, {
          x: cx + colW - PAD - font.widthOfTextAtSize(lv, 7.5),
          y: gy - 7,
          size: 7.5, font, color: MUTED,
        });

        const dir  = f.dir ?? 'rtl';
        const vRaw = norm(f.value) || '—';
        const vV   = dir === 'rtl' ? bidiV(vRaw) : vRaw;
        pg.drawText(vV, {
          x: cx + colW - PAD - font.widthOfTextAtSize(vV, 9.5),
          y: gy - 19,
          size: 9.5, font, color: BODY,
        });
      });
      gy -= ROW_H;
    }
    return y - gridH - 6;
  }

  /* ── BENEFICIARIES TABLE ─────────────────────────────────────────────
     2 columns only: שם מלא (right, 60%) | ת.ז (left, 40%)
  ─────────────────────────────────────────────────────────────────────── */
  function itemsTable(pg, rows, y) {
    const HDR_H  = 26;
    const ROW_H  = 24;
    const tableH = HDR_H + rows.length * ROW_H;

    rect(pg, ML, y - tableH, CW, tableH, WHITE, BORDER, 0.6);
    rect(pg, ML, y - HDR_H,  CW, HDR_H,  NAVY);

    // Column split: שם מלא 60% | ת.ז 40%
    const xR = ML + CW;
    const d1 = xR - CW * 0.60;   // single divider

    // Header labels
    const hy = y - HDR_H + 8;
    rtl(pg, 'שם מלא', xR - 8, hy, 9, WHITE);
    rtl(pg, 'ת.ז',    d1 - 8, hy, 9, WHITE);

    // Column divider
    vline(pg, d1, y, y - tableH, rgb(0.55, 0.65, 0.80), 0.4);

    // Data rows
    let ry = y - HDR_H;
    rows.forEach((row, i) => {
      const bg = row.isPrimary ? GOLD_LIGHT : (i % 2 === 0 ? WHITE : ALT_ROW);
      rect(pg, ML + 0.3, ry - ROW_H, CW - 0.6, ROW_H, bg);
      hline(pg, ML, ML + CW, ry, BORDER, 0.3);

      rtl(pg, row.fullName, xR - 8,  ry - 15, 9, BODY);
      const idV = norm(row.idNumber) || '—';
      pg.drawText(idV, {
        x: d1 - 8 - font.widthOfTextAtSize(idV, 9),
        y: ry - 15,
        size: 9,
        font,
        color: BODY,
      });

      ry -= ROW_H;
    });

    return y - tableH - 6;
  }



  /* ── SERVICE BOX ─────────────────────────────────────────────────────── */
  function serviceBox(pg, y) {
    const bh = 60;
    rect(pg, ML, y - bh, CW, bh, WHITE, BORDER, 0.6);
    rect(pg, ML, y - bh, 3, bh, GOLD);   // gold left accent

    const svcPhone = norm(process.env.MEDICAL_SERVICES_PHONE || '054-4261369');
    // Full URL kept for potential link annotations; only the short form is drawn.
    const displayClaims = 'medi-care.org.il/online-claim';

    rtl(pg, 'לשרות רפואי חייג:',   ML + CW - PAD - 4, y - 14, 9, NAVY);
    ltr(pg, svcPhone,               ML + 10,            y - 14, 10, NAVY);

    rtl(pg, 'הגשת תביעה מקוונת:',  ML + CW - PAD - 4, y - 30, 8.5, NAVY);
    ltr(pg, displayClaims,          ML + 10,            y - 30, 8.5, GOLD);

    hline(pg, ML + 8, ML + CW - 8, y - 40, BORDER, 0.4);

    rtl(pg, 'המנוי כפוף לכתב השרות ולגילוי הנאות.', ML + CW - PAD - 4, y - 52, 7.5, MUTED);

    return y - bh - 6;
  }

  /* ── FOOTER ──────────────────────────────────────────────────────────── */
  function drawFooter(pg) {
    const fy = 44;
    rect(pg, ML, fy + 18, CW, 1.5, GOLD);


    const l1V = bidiV('רחוב פולג 31 , אלפ"ש');
    ctr(pg, l1V, fy + 7, 7.5, NAVY);

    ctr(pg, '054-4261369  ·  opal2000@zahav.net.il  ·  opal4u.co.il', fy - 5, 7, MUTED);

  }

  /* ── PAGE MANAGEMENT ─────────────────────────────────────────────────── */
  const yRef = { current: 0 };

  function newPage() {
    if (yRef.current > 0) drawFooter(page);
    page = pdfDoc.addPage([W, H]);
    yRef.current = H - 16;
  }

  function need(h) {
    if (yRef.current - h < 60) newPage();
  }

  /* ─── RENDER ─────────────────────────────────────────────────────────── */
  newPage();

  /* 1. HEADER */
  need(84);
  yRef.current = drawHeader(page, yRef.current);

  /* 2. CUSTOMER DETAILS */
  need(22);
  yRef.current = sectionHead(page, 'פרטי לקוח', yRef.current);
  need(116);
  yRef.current = infoGrid(page, [
    { label: 'שם מלא',    value: model.customerName, dir: 'rtl' },
    { label: 'ת.ז / ח.פ', value: model.customerId,   dir: 'ltr' },
    { label: 'טלפון',      value: model.phone,        dir: 'ltr' },
    { label: 'דוא״ל',      value: model.email,        dir: 'ltr' },
    { label: 'כתובת',      value: model.address,      dir: 'rtl', span2: true },
  ], yRef.current);

  /* 3. SUBSCRIPTION DETAILS */
  need(22);
  yRef.current = sectionHead(page, 'פרטי המנוי', yRef.current);
  need(86);
  yRef.current = infoGrid(page, [
    { label: 'מוצר / שירות',     value: model.productName,                     dir: 'rtl' },
    { label: 'תאריך תחילת מנוי', value: fmtDate(model.subscriptionStartDate),  dir: 'ltr' },
    { label: 'כתב שירות',        value: model.serviceDocumentName,             dir: 'rtl' },
  ], yRef.current);

  /* 4. BENEFICIARIES TABLE */
  need(22);
  yRef.current = sectionHead(page, 'פרטי המוטבים', yRef.current);
  const benRows = [
    { fullName: model.primaryBeneficiary.fullName, idNumber: model.primaryBeneficiary.idNumber, isPrimary: true  },
    ...model.secondaryBeneficiaries.map((b) => ({
      fullName: b.fullName, idNumber: b.idNumber, isPrimary: false,
    })),
  ];
  const tableH = 26 + benRows.length * 24;
  need(tableH + 4);
  yRef.current = itemsTable(page, benRows, yRef.current);

  /* 5. TOTALS BANNER */
  need(36);
  yRef.current = totalsBanner(page, yRef.current);

  /* 6. PAYMENT DETAILS */
  need(22);
  yRef.current = sectionHead(page, 'פרטי תשלום', yRef.current);
  need(102);
  yRef.current = infoGrid(page, [
    { label: 'אמצעי תשלום',       value: 'כרטיס אשראי',                  dir: 'rtl' },
    { label: '4 ספרות אחרונות',   value: `•••• ${model.lastFourDigits || '----'}`, dir: 'ltr' },
    {
      label: 'שים לב',
      value: 'החיוב החודשי מתבצע דרך אופאל תקשורת שיווקית בע״מ',
      dir: 'rtl',
      span2: true,
    },
  ], yRef.current);
/* ── TOTALS BANNER ───────────────────────────────────────────────────── */
  function totalsBanner(pg, y) {
    const bh = 30;
    rect(pg, ML, y - bh, CW, bh, GOLD_LIGHT, GOLD, 0.5);

    const amtStr = `₪${Number(model.monthlyTotal || 0).toLocaleString('he-IL')}`;
    ltr(pg, amtStr, ML + PAD, y - 20, 13, NAVY);

    const lbV = bidiV('סה״כ תשלום חודשי');
    pg.drawText(lbV, {
      x: ML + CW - font.widthOfTextAtSize(lbV, 10) - PAD,
      y: y - 20,
      size: 10, font, color: NAVY,
    });

    return y - bh - 6;
  }





  /* 7. SERVICE CONTACT */
  need(22);
  yRef.current = sectionHead(page, 'פרטי נותן השירות', yRef.current);
  need(66);
  yRef.current = serviceBox(page, yRef.current);

  drawFooter(page);
  return Buffer.from(await pdfDoc.save());
}

/* ─── disk save ──────────────────────────────────────────────────────────── */
export async function saveBeneficiarySummaryPdfToDisk({ transactionId, buffer }) {
  const fileName = `beneficiary-summary-${norm(transactionId) || 'unknown'}.pdf`;
  const outDir   = getGeneratedPdfDir();
  await fs.mkdir(outDir, { recursive: true });
  const fullPath = path.resolve(outDir, fileName);
  await fs.writeFile(fullPath, buffer);
  return { fileName, fullPath };
}
