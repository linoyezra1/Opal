import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';

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
  let page = pdfDoc.addPage([595, 842]); // A4
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let y = 810;
  const left = 40;
  const sectionGap = 14;
  const textColor = rgb(0.15, 0.17, 0.2);
  const muted = rgb(0.35, 0.39, 0.45);

  function drawTitle(title) {
    page.drawText(title, { x: left, y, size: 15, font: bold, color: textColor });
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
    page.drawText(`${label}:`, { x: left, y, size: 10, font: bold, color: muted });
    page.drawText(String(value || '—'), { x: 180, y, size: 10, font, color: textColor });
    y -= 15;
  }

  drawTitle('OPAL - Beneficiary Summary');
  drawRow('Order Number', model.orderNumber);
  drawRow('Order Date', model.orderDate);
  drawRow('Customer Name', model.customerName);
  drawRow('Customer ID', model.customerId);
  drawRow('Subscription Start', model.subscriptionStartDate);
  drawRow('Address', model.address);
  drawRow('Phone', model.phone);
  drawRow('Email', model.email);
  drawRow('Product', model.productName);
  drawRow('Monthly Total (ILS)', model.monthlyTotal.toLocaleString('he-IL'));
  y -= sectionGap;

  drawTitle('Primary Insured');
  drawRow('Full Name', model.primaryBeneficiary.fullName);
  drawRow('ID Number', model.primaryBeneficiary.idNumber);
  drawRow('Date of Birth', model.primaryBeneficiary.dateOfBirth);
  drawRow('Marital Status', model.primaryBeneficiary.maritalStatus);
  drawRow('Health Fund', model.primaryBeneficiary.healthFund);
  drawRow('Supplemental Insurance', model.primaryBeneficiary.supplementalInsurance);
  y -= sectionGap;

  drawTitle('Secondary Beneficiaries');
  if (!model.secondaryBeneficiaries.length) {
    drawRow('Beneficiaries', 'No secondary beneficiaries');
  } else {
    model.secondaryBeneficiaries.forEach((b, idx) => {
      drawRow(`Beneficiary #${idx + 1} Name`, b.fullName);
      drawRow(`Beneficiary #${idx + 1} ID`, b.idNumber);
      drawRow(`Beneficiary #${idx + 1} DOB`, b.dateOfBirth);
      drawRow(`Beneficiary #${idx + 1} Marital`, b.maritalStatus);
      drawRow(`Beneficiary #${idx + 1} Health Fund`, b.healthFund);
      drawRow(`Beneficiary #${idx + 1} Supplemental`, b.supplementalInsurance);
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
  const outDir = path.resolve(process.cwd(), 'assets', 'generated');
  await fs.mkdir(outDir, { recursive: true });
  const fullPath = path.resolve(outDir, fileName);
  await fs.writeFile(fullPath, buffer);
  return { fileName, fullPath };
}
