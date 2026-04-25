import fs from 'fs/promises';
import { generateBeneficiarySummaryPdfBuffer } from './server/beneficiaryPdfService.js';

const mockInput = {
  orderNumber:           'TXN-2026-004817',
  orderDate:             '26/04/2026',
  numerator:             '004817',

  customerName:          'יוסי לוי',
  customerId:            '034567891',
  address:               'רחוב הרצל 45, תל אביב-יפו 6578901',
  phone:                 '054-9871234',
  email:                 'yossi.levi@gmail.com',

  subscriptionStartDate: '2026-05-01',
  productName:           'רופא עד הבית — פרימיום',
  serviceDocumentName:   'רופא עד הבית',
  monthlyTotal:          349,
  lastFourDigits:        '7842',

  primaryBeneficiary: {
    fullName:              'יוסי לוי',
    idNumber:              '034567891',
    dateOfBirth:           '1985-03-12',
    maritalStatus:         'נשוי/אה',
    healthFund:            'מכבי',
    supplementalInsurance: 'זהב',
  },

  secondaryBeneficiaries: [
    {
      fullName:              'מיכל לוי',
      idNumber:              '048231765',
      dateOfBirth:           '1988-07-24',
      maritalStatus:         'נשוי/אה',
      healthFund:            'מכבי',
      supplementalInsurance: 'זהב',
    },
    {
      fullName:              'נועם לוי',
      idNumber:              '327654120',
      dateOfBirth:           '2015-11-03',
      maritalStatus:         'רווק/ה',
      healthFund:            'כללית',
      supplementalInsurance: 'כסף',
    },
  ],
};

const OUT = 'sample-premium-summary.pdf';

try {
  const buffer = await generateBeneficiarySummaryPdfBuffer(mockInput);
  await fs.writeFile(OUT, buffer);
  console.log(`\n✅  PDF נוצר בהצלחה`);
  console.log(`📄  פתח את הקובץ: ${OUT}\n`);
} catch (err) {
  console.error('❌  שגיאה ביצירת PDF:', err);
  process.exit(1);
}
