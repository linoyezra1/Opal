'use client'

import { cn } from '@/lib/utils'

interface Beneficiary {
  fullName: string
  idNumber: string
  birthDate?: string
}

interface OrderFormPDFProps {
  orderNumber: string
  numerator: string
  orderDate: string
  customerName: string
  customerId: string
  subscriptionStartDate: string
  address: string
  phone: string
  email: string
  lastFourDigits: string
  transactionDescription: string
  serviceDocumentName: string
  productName: string
  monthlyTotal: number
  primaryBeneficiary: Beneficiary
  secondaryBeneficiaries?: Beneficiary[]
  servicePhone?: string
  claimsLink?: string
}

export function OrderFormPDF({
  orderNumber,
  numerator,
  orderDate,
  customerName,
  customerId,
  subscriptionStartDate,
  address,
  phone,
  email,
  lastFourDigits,
  transactionDescription,
  serviceDocumentName,
  productName,
  monthlyTotal,
  primaryBeneficiary,
  secondaryBeneficiaries = [],
  servicePhone = '00-0000000',
  claimsLink = 'https://opal-medical.co.il/claims',
}: OrderFormPDFProps) {
  // Ensure we have exactly 5 secondary beneficiary rows
  const filledSecondaryBeneficiaries = [...secondaryBeneficiaries]
  while (filledSecondaryBeneficiaries.length < 5) {
    filledSecondaryBeneficiaries.push({ fullName: '', idNumber: '' })
  }

  return (
    <div 
      className="bg-white text-foreground font-sans print:text-black"
      style={{ 
        width: '210mm', 
        minHeight: '297mm',
        padding: '15mm 20mm',
        direction: 'rtl',
      }}
    >
      {/* Header Notice */}
      <p className="text-xs text-muted-foreground text-center mb-4">
        טופס הזמנה שנשלח למייל של הלקוח ולאופאל כולל כתב השרות וצילומי ת.ז.
      </p>

      {/* Order Number Header */}
      <div className="flex justify-center mb-6">
        <div className="flex items-stretch border border-border rounded overflow-hidden">
          <div className="px-6 py-3 bg-[#E8B88A] text-foreground font-bold text-lg">
            מס הזמנה
          </div>
          <div className="flex items-center">
            <div className="px-4 py-3 border-s border-border bg-muted/30">
              <span className="text-xs text-muted-foreground ms-1">ממררטור</span>
              <span className="font-mono font-semibold ms-2">{numerator}</span>
            </div>
            <div className="px-4 py-3 border-s border-border bg-muted/30">
              <span className="text-xs text-muted-foreground ms-1">תאריך הזמנה</span>
              <span className="font-mono font-semibold ms-2">{orderDate}</span>
            </div>
            <div className="px-6 py-3 border-s border-border bg-white font-mono text-lg font-bold">
              {orderNumber}
            </div>
          </div>
        </div>
      </div>

      {/* Customer Details Table */}
      <table className="w-full border-collapse mb-4">
        <tbody>
          {/* Row 1: Customer Name, ID, Subscription Start */}
          <tr>
            <td className="border border-border p-2 text-sm bg-muted/20 w-28 text-start">שם לקוח</td>
            <td className="border border-border p-2 font-medium" colSpan={3}>{customerName}</td>
            <td className="border border-border p-2 text-sm bg-muted/20 w-16 text-start">ת.ז</td>
            <td className="border border-border p-2 font-mono w-32">{customerId}</td>
            <td className="border border-border p-2 text-sm bg-muted/20 w-28 text-start">תאריך תחילת מנוי</td>
            <td className="border border-border p-2 font-mono w-28">{subscriptionStartDate}</td>
          </tr>
          
          {/* Row 2: Address, Phone, Email */}
          <tr>
            <td className="border border-border p-2 text-sm bg-muted/20 text-start">כתובת הלקוח</td>
            <td className="border border-border p-2" colSpan={3}>{address}</td>
            <td className="border border-border p-2 text-sm bg-muted/20 text-start">טלפון</td>
            <td className="border border-border p-2 font-mono" dir="ltr">{phone}</td>
            <td className="border border-border p-2 text-sm bg-muted/20 text-start">מייל</td>
            <td className="border border-border p-2 text-xs" dir="ltr">{email}</td>
          </tr>
          
          {/* Row 3: Last 4 Credit Card Digits */}
          <tr>
            <td className="border border-border p-2 text-sm bg-muted/20 text-start" colSpan={2}>
              ארבע ספרות אחרונות בכרטיס האשראי
            </td>
            <td className="border border-border p-2 font-mono text-center" colSpan={6}>
              **** **** **** {lastFourDigits}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Subscription Type Table */}
      <table className="w-full border-collapse mb-4">
        <tbody>
          <tr>
            <td className="border border-border p-2 text-sm bg-muted/20 w-24 text-start">סוג המנוי</td>
            <td className="border border-border p-2 text-sm bg-muted/20 w-24 text-start">תאור העסקה</td>
            <td className="border border-border p-2" colSpan={2}>{transactionDescription}</td>
          </tr>
          <tr>
            <td className="border border-border p-2" rowSpan={2}></td>
            <td className="border border-border p-2 text-sm bg-muted/20 text-start">שם כתב השרות</td>
            <td className="border border-border p-2">{serviceDocumentName}</td>
            <td className="border border-border p-2 bg-[#E8B88A] font-bold text-center w-32">
              {productName}
            </td>
          </tr>
          <tr>
            <td className="border border-border p-2 text-sm bg-muted/20 text-start">סה״כ תש׳ חודשי</td>
            <td className="border border-border p-2 font-bold text-lg" colSpan={2}>
              {monthlyTotal.toLocaleString('he-IL')} ₪
            </td>
          </tr>
        </tbody>
      </table>

      {/* Beneficiaries Table */}
      <table className="w-full border-collapse mb-4">
        <tbody>
          {/* Primary Beneficiary */}
          <tr>
            <td className="border border-border p-2 text-sm bg-[#E8B88A]/50 w-36 text-start font-medium">
              שם המבוטח העיקרי
            </td>
            <td className="border border-border p-2 font-medium">{primaryBeneficiary.fullName}</td>
            <td className="border border-border p-2 text-sm bg-muted/20 w-12 text-center">ת.ז</td>
            <td className="border border-border p-2 font-mono w-32">{primaryBeneficiary.idNumber}</td>
          </tr>
          
          {/* Secondary Beneficiaries */}
          {filledSecondaryBeneficiaries.map((beneficiary, index) => (
            <tr key={index}>
              <td className="border border-border p-2 text-sm bg-muted/20 text-start">
                שם המבוטח המשני
              </td>
              <td className="border border-border p-2">{beneficiary.fullName || ''}</td>
              <td className="border border-border p-2 text-sm bg-muted/20 text-center">ת.ז</td>
              <td className="border border-border p-2 font-mono">{beneficiary.idNumber || ''}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Service Provider Details */}
      <div className="border border-border rounded overflow-hidden mb-4">
        <div className="bg-[#E8B88A] px-4 py-2 text-center font-bold">
          פרטי נותן השרות
        </div>
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-center gap-4">
            <span className="text-sm">טלפונים להזמנת שרותים רפואיים</span>
            <span className="font-mono font-bold text-lg" dir="ltr">{servicePhone}</span>
          </div>
          <div className="flex items-center justify-center gap-4">
            <span className="text-sm">לינק להגשת מסמכים רפואיים - תביעה און ליין</span>
            <a 
              href={claimsLink} 
              className="text-primary underline font-medium"
              target="_blank"
              rel="noopener noreferrer"
            >
              לינק
            </a>
          </div>
        </div>
      </div>

      {/* Notice Section */}
      <div className="border-2 border-primary/30 rounded p-4 mb-4 bg-primary/5">
        <div className="flex items-start gap-3">
          <div className="bg-[#E8B88A] text-foreground px-3 py-1 rounded font-bold text-sm shrink-0">
            שים לב
          </div>
          <div className="space-y-2 text-sm">
            <p>
              <strong>חיוב החודשי של המנוי דרך חברת אופאל תקשורת בע״מ</strong>
            </p>
            <p>
              לפניות וברורים: {' '}
              <span className="font-mono" dir="ltr">054-4261369</span>
              {' '} דואל: {' '}
              <a href="mailto:opal2000@zahav.net.il" className="text-primary underline">
                opal2000@zahav.net.il
              </a>
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-muted-foreground border-t border-border pt-4">
        <p>המנוי כפוף לכתב השרות ולצילומי ת.ז.</p>
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          @page {
            size: A4;
            margin: 0;
          }
        }
      `}</style>
    </div>
  )
}

// Preview wrapper with print button
export function OrderFormPDFPreview(props: OrderFormPDFProps) {
  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="min-h-screen bg-muted/50 py-8">
      <div className="container max-w-4xl">
        {/* Actions Bar */}
        <div className="flex items-center justify-between mb-6 print:hidden">
          <h1 className="text-xl font-bold">תצוגה מקדימה - טופס הזמנה</h1>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            הדפס / שמור PDF
          </button>
        </div>

        {/* PDF Preview */}
        <div className="bg-white shadow-xl rounded-lg overflow-hidden print:shadow-none print:rounded-none">
          <OrderFormPDF {...props} />
        </div>
      </div>
    </div>
  )
}
