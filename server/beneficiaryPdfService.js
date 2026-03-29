import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fs from 'fs/promises';
import path from 'path';
import { candidateSrcAssetPaths, readFirstExistingFile, getGeneratedPdfDir } from './repoAssets.js';

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
    customerName: line(input.customerName),
    customerId: line(input.customerId),
    subscriptionStartDate: line(input.subscriptionStartDate),
    address: line(input.address),
    phone: line(input.phone),
    email: line(input.email),
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

export async function generateBeneficiarySummaryPdfBuffer(modelInput = {}) {
  const model = buildBeneficiaryPdfModel(modelInput);
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  let page = pdfDoc.addPage([595, 842]); // A4
  const fontCandidates = candidateSrcAssetPaths('fonts', 'Heebo-Regular.ttf');
  const { buffer: fontBytes } = await readFirstExistingFile(
    fontCandidates,
    'Heebo-Regular.ttf (src/assets/fonts)'
  );
  const font = await pdfDoc.embedFont(fontBytes);
  const bold = font;

  let y = 810;
  const left = 40;
  const sectionGap = 14;
  const textColor = rgb(0.15, 0.17, 0.2);
  const muted = rgb(0.35, 0.39, 0.45);
  const right = 555;

  function reverseRtlText(value) {
    return String(value || '')
      .split('\n')
      .map((lineText) => lineText.split('').reverse().join(''))
      .join('\n');
  }

  function drawRtlText(text, { xRight, yPos, size = 10, useBold = false, color = textColor }) {
    const value = reverseRtlText(text);
    const selectedFont = useBold ? bold : font;
    const width = selectedFont.widthOfTextAtSize(value, size);
    page.drawText(value, {
      x: xRight - width,
      y: yPos,
      size,
      font: selectedFont,
      color,
    });
  }

  function drawTitle(title) {
    drawRtlText(title, { xRight: right, yPos: y, size: 15, useBold: true, color: textColor });
    y -= 20;
    page.drawLine({
      start: { x: left, y: y + 6 },
      end: { x: 555, y: y + 6 },
      thickness: 1,
      color: rgb(0.86, 0.88, 0.9),
    });
    y -= 10;
  }

  function drawRow(label, value) {
    drawRtlText(`${label}:`, { xRight: right, yPos: y, size: 10, useBold: true, color: muted });
    drawRtlText(String(value || '—'), { xRight: right - 210, yPos: y, size: 10, useBold: false, color: textColor });
    y -= 15;
  }

  drawTitle('סיכום טופס מוטבים - OPAL');
  drawRow('מספר הזמנה', model.orderNumber);
  drawRow('תאריך הזמנה', model.orderDate);
  drawRow('שם לקוח', model.customerName);
  drawRow('תעודת זהות', model.customerId);
  drawRow('תאריך תחילת מנוי', model.subscriptionStartDate);
  drawRow('כתובת', model.address);
  drawRow('טלפון', model.phone);
  drawRow('אימייל', model.email);
  drawRow('מוצר', model.productName);
  drawRow('תשלום חודשי', `${model.monthlyTotal.toLocaleString('he-IL')} ₪`);
  y -= sectionGap;

  drawTitle('מבוטח ראשי');
  drawRow('שם מלא', model.primaryBeneficiary.fullName);
  drawRow('תעודת זהות', model.primaryBeneficiary.idNumber);
  drawRow('תאריך לידה', model.primaryBeneficiary.dateOfBirth);
  drawRow('מצב משפחתי', model.primaryBeneficiary.maritalStatus);
  drawRow('קופת חולים', model.primaryBeneficiary.healthFund);
  drawRow('ביטוח משלים', model.primaryBeneficiary.supplementalInsurance);
  y -= sectionGap;

  drawTitle('מוטבים נוספים');
  if (!model.secondaryBeneficiaries.length) {
    drawRow('מוטבים', 'לא הוגדרו מוטבים נוספים');
  } else {
    model.secondaryBeneficiaries.forEach((b, idx) => {
      drawRow(`מוטב ${idx + 1} - שם מלא`, b.fullName);
      drawRow(`מוטב ${idx + 1} - תעודת זהות`, b.idNumber);
      drawRow(`מוטב ${idx + 1} - תאריך לידה`, b.dateOfBirth);
      drawRow(`מוטב ${idx + 1} - מצב משפחתי`, b.maritalStatus);
      drawRow(`מוטב ${idx + 1} - קופת חולים`, b.healthFund);
      drawRow(`מוטב ${idx + 1} - ביטוח משלים`, b.supplementalInsurance);
      y -= 4;
      if (y < 100) {
        y = 810;
        page = pdfDoc.addPage([595, 842]);
      }
    });
  }

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
