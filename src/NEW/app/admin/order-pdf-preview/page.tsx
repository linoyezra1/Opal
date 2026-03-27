'use client'

import { OrderFormPDFPreview } from '@/components/email/order-form-pdf'

export default function OrderPDFPreviewPage() {
  // Sample data for preview
  const sampleOrder = {
    orderNumber: '10025',
    numerator: '1',
    orderDate: '27/03/2026',
    customerName: 'ישראל ישראלי',
    customerId: '123456789',
    subscriptionStartDate: '01/04/2026',
    address: 'רחוב הרצל 15, תל אביב',
    phone: '054-1234567',
    email: 'israel@example.com',
    lastFourDigits: '4532',
    transactionDescription: 'מנוי רופא עד הבית - תשלום חודשי',
    serviceDocumentName: 'כתב שרות רפואי מקיף',
    productName: 'רופא עד הבית',
    monthlyTotal: 89,
    primaryBeneficiary: {
      fullName: 'ישראל ישראלי',
      idNumber: '123456789',
    },
    secondaryBeneficiaries: [
      { fullName: 'שרה ישראלי', idNumber: '987654321' },
      { fullName: 'דוד ישראלי', idNumber: '456789123' },
    ],
    servicePhone: '00-0000000',
    claimsLink: 'https://opal-medical.co.il/claims',
  }

  return <OrderFormPDFPreview {...sampleOrder} />
}
