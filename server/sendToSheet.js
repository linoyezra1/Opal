/**
 * Standalone: send a test payload to the sheet (no Cardcom).
 * Usage: set GOOGLE_SHEET_ID, place service-account.json, then: node sendToSheet.js [payload.json]
 */

import 'dotenv/config';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  appendPayerAndBeneficiaries,
  formPayloadToSheetParams,
  loadCredentialsFromFile,
} from './googleSheetsService.js';

const SHEET_ID = process.env.GOOGLE_SHEET_ID;

const defaultPayload = {
  sheetPayload: {
    payer: {
      fullName: 'ישראל ישראלי',
      id: '123456789',
      email: 'test@example.com',
      agentName: 'סוכן דוגמה',
      organizationName: 'ארגון דוגמה',
      planId: 'plan-a',
      planSku: 'MAKAT-A',
    },
    beneficiaries: [
      { firstName: 'משה', lastName: 'כהן', id: '987654321', dateOfBirth: '1990-05-15' },
    ],
  },
  transactionId: 'TXN-TEST-' + Date.now(),
  payerAmount: 59,
};

function loadPayload(path) {
  if (!path) return defaultPayload;
  const data = JSON.parse(readFileSync(path, 'utf8'));
  const sheetPayload = data.sheetPayload ?? { payer: data.payer, beneficiaries: data.beneficiaries ?? [] };
  return {
    sheetPayload,
    transactionId: data.transactionId ?? 'TXN-' + Date.now(),
    payerAmount: data.payerAmount ?? 59,
  };
}

function getAuth() {
  const paths = [
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    resolve(process.cwd(), 'service-account.json'),
    resolve(process.cwd(), '..', 'service-account.json'),
  ].filter(Boolean);
  for (const p of paths) {
    try {
      return loadCredentialsFromFile(p);
    } catch {
      continue;
    }
  }
  throw new Error('service-account.json not found');
}

async function main() {
  if (!SHEET_ID) {
    console.error('Set GOOGLE_SHEET_ID in .env');
    process.exit(1);
  }
  const { sheetPayload, transactionId, payerAmount } = loadPayload(process.argv[2]);
  const auth = getAuth();
  const params = formPayloadToSheetParams(sheetPayload, transactionId, payerAmount);
  const result = await appendPayerAndBeneficiaries({
    spreadsheetId: SHEET_ID,
    auth,
    ...params,
    terminalNumber: 1000,
  });
  if (result.duplicate) {
    console.log('Payment status: TEST - Result: FAILURE (duplicate)');
  } else {
    console.log('Payment status: TEST - Result: SUCCESS');
  }
  console.log('Rows appended:', result.appendedCount, 'Payer row:', result.payerRowIndex);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
