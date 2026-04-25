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
  Background:   #f8f7f4  — warm off-white page
  Card surface: #ffffff
  Navy:         #1a365d  — headings, labels, table header bg
  Gold:         #c5a059  — 2-pt top stripe, section icon accent
  Gold-light:   #f5f0e5  — totals area, icon bg
  Body text:    #1f2937
  Muted:        #6b7280
  Border:       #d1d5db
  Alt row:      #f9fafb
  ─────────────────────────────────────────────────────────────────────────── */
const NAVY       = rgb(26  / 255, 54  / 255, 93  / 255);  // #1a365d
const GOLD       = rgb(197 / 255, 160 / 255, 89  / 255);  // #c5a059
const GOLD_LIGHT = rgb(245 / 255, 240 / 255, 229 / 255);  // #f5f0e5
const BG         = rgb(248 / 255, 247 / 255, 244 / 255);  // #f8f7f4
const BODY       = rgb(31  / 255, 41  / 255, 55  / 255);  // #1f2937
const MUTED      = rgb(107 / 255, 113 / 255, 128 / 255);  // #6b7280
const BORDER     = rgb(209 / 255, 213 / 255, 219 / 255);  // #d1d5db
const ALT_ROW    = rgb(249 / 255, 250 / 255, 251 / 255);  // #f9fafb
const WHITE      = rgb(1, 1, 1);
const EMERALD    = rgb(4   / 255, 120 / 255, 87  / 255);  // emerald-700
const EMERALD_BG = rgb(236 / 255, 253 / 255, 245 / 255);  // emerald-50

/* ─── bidi-js ────────────────────────────────────────────────────────────── */
const bidi = bidiFactory();

/**
 * Converts logical Hebrew text to visual order for pdf-lib.
 * pdf-lib places characters left→right in string order, so we must
 * visually reorder RTL runs before drawing.
 */
function bidiV(text) {
  const s = String(text ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (!s) return s;
  // Pure LTR (no Hebrew/Arabic) — no reordering needed
  if (!/[֐-׿؀-ۿיִ-ﭏ]/.test(s)) return s;
  try {
    const lv  = bidi.getEmbeddingLevels(s, 'rtl');
    const seg = bidi.getReorderSegments(s, lv);
    let out = '';
    for (const [a, b] of seg) {
      const ch = s.slice(a, b + 1);
      // Odd level = RTL run → reverse the characters
      out += (lv[a] ?? 0) % 2 === 1 ? [...ch].reverse().join('') : ch;
    }
    return out;
  } catch {
    // Safe fallback: reverse words
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
  return {
    orderNumber:            safe(input.orderNumber, ''),
    orderDate:              safe(input.orderDate, ''),
    numerator:              safe(input.numerator, '—'),
    customerName:           safe(input.customerName),
    customerId:             safe(input.customerId),
    subscriptionStartDate:  safe(input.subscriptionStartDate),
    address:                safe(input.address),
    phone:                  safe(input.phone),
    email:                  safe(input.email),
    lastFourDigits:         safe(input.lastFourDigits, '—'),
    transactionDescription: safe(input.transactionDescription, input.productName),
    serviceDocumentName:    safe(input.serviceDocumentName, 'רופא עד הבית'),
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

  /* A4 dimensions */
  const W = 595, H = 842;
  const ML = 36, MR = 36;
  const CW = W - ML - MR;    // 523 pt usable width
  const CARD_PAD = 14;

  let page = pdfDoc.addPage([W, H]);

  /* ── primitive helpers ──────────────────────────────────────────────── */

  /** RTL text: right-edge anchored at xRight */
  function rtl(pg, raw, xRight, y, sz, col = BODY) {
    const v = bidiV(norm(raw) || '—');
    const w = font.widthOfTextAtSize(v, sz);
    pg.drawText(v, { x: xRight - w, y, size: sz, font, color: col });
  }

  /** LTR text: left-edge anchored at xLeft (numbers, emails, dates) */
  function ltr(pg, raw, xLeft, y, sz, col = BODY) {
    const v = norm(raw);
    if (!v) return;
    pg.drawText(v, { x: xLeft, y, size: sz, font, color: col });
  }

  /** Centered text (pre-processed visual string) */
  function ctr(pg, v, y, sz, col = BODY) {
    const w = font.widthOfTextAtSize(v, sz);
    pg.drawText(v, { x: (W - w) / 2, y, size: sz, font, color: col });
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

  /** White card with a 1-px subtle shadow beneath */
  function drawCard(pg, x, y, w, h) {
    rect(pg, x + 1, y - 1, w, h, rgb(0.88, 0.89, 0.91));   // shadow
    rect(pg, x, y, w, h, WHITE, BORDER, 0.6);               // card
  }

  /* ── HEADER ─────────────────────────────────────────────────────────── */
  function drawHeader(pg, yTop) {
    const cardH = 92;
    drawCard(pg, ML, yTop - cardH, CW, cardH);
    // 2-pt gold top stripe
    rect(pg, ML, yTop - 2, CW, 2, GOLD);

    // Logo — top-right inside card
    if (logo) {
      const lw = 52;
      const lh = (logo.height / logo.width) * lw;
      pg.drawImage(logo, {
        x: ML + CW - lw - CARD_PAD,
        y: yTop - cardH + (cardH - lh) / 2,
        width: lw, height: lh,
      });
    }

    const textRight = ML + CW - (logo ? 60 : CARD_PAD) - 8;

    // Company name (top-right below logo)
    const coV = bidiV('אופאל תקשורת');
    pg.drawText(coV, { x: textRight - font.widthOfTextAtSize(coV, 14), y: yTop - 26, size: 14, font, color: NAVY });
    const subV = bidiV('שיווקית בע״מ');
    pg.drawText(subV, { x: textRight - font.widthOfTextAtSize(subV, 8.5), y: yTop - 40, size: 8.5, font, color: MUTED });

    // Document title — left side
    const titleV = bidiV('סיכום הזמנה');
    pg.drawText(titleV, { x: ML + CARD_PAD, y: yTop - 26, size: 16, font, color: NAVY });

    // Order number
    const ordLV = bidiV('מס׳ הזמנה:');
    pg.drawText(ordLV, { x: ML + CARD_PAD, y: yTop - 44, size: 8.5, font, color: MUTED });
    ltr(pg, model.orderNumber, ML + CARD_PAD + font.widthOfTextAtSize(ordLV, 8.5) + 4, yTop - 44, 10, NAVY);

    // Order date
    const dateLV = bidiV('תאריך:');
    pg.drawText(dateLV, { x: ML + CARD_PAD, y: yTop - 58, size: 8.5, font, color: MUTED });
    ltr(pg, model.orderDate, ML + CARD_PAD + font.widthOfTextAtSize(dateLV, 8.5) + 4, yTop - 58, 8.5, BODY);

    hline(pg, ML + 8, ML + CW - 8, yTop - cardH + 1);
    return yTop - cardH - 10;
  }

  /* ── STATUS BADGE ────────────────────────────────────────────────────── */
  function drawStatusBadge(pg, y) {
    const label = bidiV('הזמנה אושרה');
    const lw    = font.widthOfTextAtSize(label, 9);
    const bw    = lw + 26;
    const bh    = 20;
    const bx    = W - MR - bw;
    rect(pg, bx, y - bh, bw, bh, EMERALD_BG, rgb(0.167, 0.8, 0.604), 0.6);
    pg.drawCircle({ x: bx + bw - 10, y: y - bh / 2, size: 3.5, color: EMERALD });
    pg.drawText(label, { x: bx + 6, y: y - 13, size: 9, font, color: EMERALD });
    return y - bh - 10;
  }

  /* ── SECTION HEADER ──────────────────────────────────────────────────── */
  function sectionHead(pg, label, y) {
    const iconSz = 20;
    // Icon background square
    rect(pg, W - MR - iconSz, y - iconSz, iconSz, iconSz, GOLD_LIGHT, GOLD, 0.4);
    pg.drawCircle({ x: W - MR - iconSz / 2, y: y - iconSz / 2, size: 3, color: GOLD });
    // Section label
    const lv = bidiV(label);
    pg.drawText(lv, { x: W - MR - iconSz - 8 - font.widthOfTextAtSize(lv, 11), y: y - 14, size: 11, font, color: NAVY });
    return y - iconSz - 8;
  }

  /* ── INFO GRID ───────────────────────────────────────────────────────── */
  /*
    2-column grid with label above value.
    fields: [{ label, value, dir?, span2? }]
    RTL layout: col 0 = right half, col 1 = left half.
  */
  function infoGrid(pg, fields, y) {
    const ROW_H  = 38;
    const GAP    = 12;
    const halfCW = (CW - GAP) / 2;

    // Arrange into rows of 2
    const rows = [];
    let cur    = [];
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

    const gridH = rows.length * ROW_H + CARD_PAD * 2;
    rect(pg, ML, y - gridH, CW, gridH, BG, BORDER, 0.4);

    let gy = y - CARD_PAD;
    for (const row of rows) {
      row.forEach((f, ci) => {
        const colW = f.span2 ? CW : halfCW;
        // col 0 = right side, col 1 = left side (RTL)
        const cx = f.span2 ? ML : (ci === 0 ? ML + halfCW + GAP : ML);

        // Label (muted, small)
        const lv = bidiV(f.label);
        pg.drawText(lv, { x: cx + colW - font.widthOfTextAtSize(lv, 7.5), y: gy - 8, size: 7.5, font, color: MUTED });

        // Value
        const dir  = f.dir ?? 'rtl';
        const vRaw = norm(f.value) || '—';
        const vV   = dir === 'rtl' ? bidiV(vRaw) : vRaw;
        pg.drawText(vV, { x: cx + colW - font.widthOfTextAtSize(vV, 9.5), y: gy - 21, size: 9.5, font, color: BODY });
      });
      gy -= ROW_H;
    }
    return y - gridH - 10;
  }

  /* ── BENEFICIARIES TABLE ─────────────────────────────────────────────── */
  /*
    Navy header, alternating white/ALT_ROW body, GOLD_LIGHT for primary row.
    Columns (RTL order): שם מלא | ת.ז | שירות
  */
  function itemsTable(pg, rows, y) {
    const HDR_H = 28;
    const ROW_H = 26;
    const tableH = HDR_H + rows.length * ROW_H;

    rect(pg, ML, y - tableH, CW, tableH, WHITE, BORDER, 0.6);
    rect(pg, ML, y - HDR_H, CW, HDR_H, NAVY);

    // Column widths
    const cName = CW * 0.46;
    const cId   = CW * 0.26;
    // cSvc = remaining 0.28
    const xR = ML + CW;
    const d1 = xR - cName;      // name | id divider
    const d2 = d1 - cId;        // id   | service divider

    // Header labels
    const hy = y - HDR_H + 9;
    rtl(pg, 'שם מלא', xR - 8, hy, 9, WHITE);
    rtl(pg, 'ת.ז',    d1 - 8, hy, 9, WHITE);
    rtl(pg, 'שירות',  d2 - 8, hy, 9, WHITE);

    // Column dividers
    for (const dx of [d1, d2]) {
      vline(pg, dx, y, y - tableH, rgb(0.55, 0.65, 0.80), 0.4);
    }

    // Data rows
    let ry = y - HDR_H;
    rows.forEach((row, i) => {
      const bg = row.isPrimary ? GOLD_LIGHT : (i % 2 === 0 ? WHITE : ALT_ROW);
      rect(pg, ML + 0.3, ry - ROW_H, CW - 0.6, ROW_H, bg);
      hline(pg, ML, ML + CW, ry, BORDER, 0.3);

      rtl(pg, row.fullName, xR - 8, ry - 17, 9, BODY);
      ltr(pg, row.idNumber, d1 + 6,           ry - 17, 9, BODY);    // ID = LTR
      rtl(pg, row.service,  d2 - 8,           ry - 17, 8, MUTED);

      ry -= ROW_H;
    });

    return y - tableH - 10;
  }

  /* ── TOTALS BANNER ───────────────────────────────────────────────────── */
  function totalsBanner(pg, y) {
    const bh = 36;
    rect(pg, ML, y - bh, CW, bh, GOLD_LIGHT, GOLD, 0.5);

    const amtStr = `₪${Number(model.monthlyTotal || 0).toLocaleString('he-IL')}`;
    ltr(pg, amtStr, ML + CARD_PAD, y - 23, 14, NAVY);

    const lbV = bidiV('סה״כ תשלום חודשי');
    pg.drawText(lbV, { x: ML + CW - font.widthOfTextAtSize(lbV, 10) - CARD_PAD, y: y - 23, size: 10, font, color: NAVY });

    return y - bh - 10;
  }

  /* ── SERVICE BOX ─────────────────────────────────────────────────────── */
  function serviceBox(pg, y) {
    const bh = 72;
    drawCard(pg, ML, y - bh, CW, bh);
    // Gold left accent strip
    rect(pg, ML, y - bh, 3, bh, GOLD);

    const svcPhone = norm(process.env.MEDICAL_SERVICES_PHONE || '054-4261369');
    const claims   = norm(
      process.env.CLAIMS_ONLINE_URL ||
      'https://medi-care.org.il/online-claim/#elementor-action%3Aaction%3Dpopup%3Aopen%26settings%3DeyJpZCI6IjQzNiIsInRvZ2dsZSI6ZmFsc2V9'
    );

    rtl(pg, 'לשרות רפואי חייג:',   ML + CW - CARD_PAD - 4, y - 16, 9.5, NAVY);
    ltr(pg, svcPhone,               ML + 12,                 y - 16, 11,  NAVY);

    rtl(pg, 'הגשת תביעה מקוונת:',  ML + CW - CARD_PAD - 4, y - 36, 9,   NAVY);
    ltr(pg, claims,                 ML + 12,                 y - 36, 7.5, GOLD);

    hline(pg, ML + 8, ML + CW - 8, y - 46, BORDER, 0.4);

    rtl(pg,
      'שים לב: החיוב החודשי מתבצע דרך אופאל תקשורת שיווקית בע״מ.',
      ML + CW - CARD_PAD - 4, y - 58, 8, MUTED
    );

    return y - bh - 10;
  }

  /* ── FOOTER ──────────────────────────────────────────────────────────── */
  function drawFooter(pg) {
    const fy = 50;
    rect(pg, ML, fy + 20, CW, 2, GOLD);   // gold stripe

    // Line 1: company + address
    const l1V = bidiV('אופאל תקשורת שיווקית בע״מ  ·  רחוב פולג 31, אלפ״ש');
    ctr(pg, l1V, fy + 8, 8, NAVY);

    // Line 2: contact details (LTR)
    const l2 = '054-4261369  ·  opal2000@zahav.net.il  ·  opal4u.co.il';
    ctr(pg, l2, fy - 6, 7.5, MUTED);

    // Disclaimer
    const disc = bidiV('המנוי כפוף לכתב השרות ולגילוי הנאות. מסמך זה נוצר אוטומטית.');
    ctr(pg, disc, fy - 18, 6.5, MUTED);
  }

  /* ── PAGE MANAGEMENT ─────────────────────────────────────────────────── */
  const yRef = { current: 0 };

  function newPage() {
    if (yRef.current > 0) drawFooter(page);
    page = pdfDoc.addPage([W, H]);
    rect(page, 0, 0, W, H, BG);
    yRef.current = H - 18;
  }

  function need(h) {
    if (yRef.current - h < 65) newPage();
  }

  /* ─── RENDER ─────────────────────────────────────────────────────────── */
  newPage();

  /* 1. HEADER */
  need(110);
  yRef.current = drawHeader(page, yRef.current);

  /* 2. STATUS BADGE */
  need(30);
  yRef.current = drawStatusBadge(page, yRef.current);

  /* 3. CUSTOMER DETAILS */
  need(30);
  yRef.current = sectionHead(page, 'פרטי לקוח', yRef.current);
  need(130);
  yRef.current = infoGrid(page, [
    { label: 'שם מלא',      value: model.customerName,  dir: 'rtl' },
    { label: 'ת.ז / ח.פ',   value: model.customerId,    dir: 'ltr' },
    { label: 'טלפון',        value: model.phone,         dir: 'ltr' },
    { label: 'דוא״ל',        value: model.email,         dir: 'ltr' },
    { label: 'כתובת',        value: model.address,       dir: 'rtl', span2: true },
  ], yRef.current);

  /* 4. SUBSCRIPTION DETAILS */
  need(30);
  yRef.current = sectionHead(page, 'פרטי המנוי', yRef.current);
  need(100);
  yRef.current = infoGrid(page, [
    { label: 'מוצר / שירות',       value: model.productName,                              dir: 'rtl' },
    { label: 'תאריך תחילת מנוי',   value: fmtDate(model.subscriptionStartDate),           dir: 'ltr' },
    { label: 'כרטיס אשראי',        value: `****${model.lastFourDigits}`,                  dir: 'ltr' },
    { label: 'כתב שירות',          value: model.serviceDocumentName,                      dir: 'rtl' },
  ], yRef.current);

  /* 5. BENEFICIARIES TABLE */
  need(30);
  yRef.current = sectionHead(page, 'פרטי המוטבים', yRef.current);

  const benRows = [
    {
      fullName:  model.primaryBeneficiary.fullName,
      idNumber:  model.primaryBeneficiary.idNumber,
      service:   model.serviceDocumentName,
      isPrimary: true,
    },
    ...model.secondaryBeneficiaries.map((b) => ({
      fullName:  b.fullName,
      idNumber:  b.idNumber,
      service:   model.serviceDocumentName,
      isPrimary: false,
    })),
  ];
  const tableH = 28 + benRows.length * 26;
  need(tableH + 6);
  yRef.current = itemsTable(page, benRows, yRef.current);

  /* 6. TOTALS BANNER */
  need(46);
  yRef.current = totalsBanner(page, yRef.current);

  /* 7. PAYMENT DETAILS */
  need(30);
  yRef.current = sectionHead(page, 'פרטי תשלום', yRef.current);
  need(90);
  yRef.current = infoGrid(page, [
    { label: 'אמצעי תשלום',         value: 'כרטיס אשראי',                        dir: 'rtl' },
    { label: '4 ספרות אחרונות',     value: `•••• ${model.lastFourDigits}`,        dir: 'ltr' },
    { label: 'תשלומים',             value: '1 תשלום',                             dir: 'rtl' },
  ], yRef.current);

  /* 8. SERVICE CONTACT */
  need(30);
  yRef.current = sectionHead(page, 'שירות ותביעות', yRef.current);
  need(82);
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
