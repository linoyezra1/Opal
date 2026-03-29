'use client'

// Opal Brand Colors
const OPAL_BLUE = '#1A365D'
const OPAL_GOLD = '#C5A059'

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

  const cellStyle: React.CSSProperties = {
    borderTop: `1px solid ${OPAL_BLUE}30`,
    borderRight: `1px solid ${OPAL_BLUE}30`,
    borderBottom: `1px solid ${OPAL_BLUE}30`,
    borderLeft: `1px solid ${OPAL_BLUE}30`,
    padding: '5px 8px',
    fontSize: '11px',
  }

  const labelCellStyle: React.CSSProperties = {
    ...cellStyle,
    backgroundColor: OPAL_BLUE,
    fontWeight: 600,
    color: 'white',
    whiteSpace: 'nowrap',
    fontSize: '10px',
  }

  const valueCellStyle: React.CSSProperties = {
    ...cellStyle,
    backgroundColor: 'white',
    color: OPAL_BLUE,
    fontSize: '11px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  }

  const sectionHeaderStyle: React.CSSProperties = {
    backgroundColor: OPAL_GOLD,
    color: 'white',
    padding: '8px 12px',
    fontWeight: 700,
    fontSize: '12px',
    textAlign: 'center' as const,
  }

  return (
    <div 
      style={{ 
        width: '210mm', 
        minHeight: '200mm',
        padding: '10mm 15mm',
        direction: 'rtl',
        fontFamily: 'Heebo, Arial, sans-serif',
        backgroundColor: 'white',
        color: OPAL_BLUE,
      }}
    >
      {/* Order Number Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        marginBottom: '16px',
      }}>
        <table style={{ borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{
                backgroundColor: OPAL_GOLD,
                color: 'white',
                padding: '8px 16px',
                fontWeight: 700,
                fontSize: '14px',
                borderTop: `1px solid ${OPAL_GOLD}`,
                borderRight: `1px solid ${OPAL_GOLD}`,
                borderBottom: `1px solid ${OPAL_GOLD}`,
                borderLeft: `1px solid ${OPAL_GOLD}`,
              }}>
                מס הזמנה
              </td>
              <td style={{
                backgroundColor: `${OPAL_GOLD}30`,
                padding: '8px 10px',
                borderTop: `1px solid ${OPAL_BLUE}30`,
                borderRight: `1px solid ${OPAL_BLUE}30`,
                borderBottom: `1px solid ${OPAL_BLUE}30`,
                borderLeft: `1px solid ${OPAL_BLUE}30`,
                fontWeight: 600,
                fontSize: '11px',
              }}>
                <span style={{ fontSize: '9px', color: `${OPAL_BLUE}99`, marginLeft: '4px' }}>נומרטור</span>
                <span style={{ fontFamily: 'monospace' }}>{numerator}</span>
              </td>
              <td style={{
                backgroundColor: 'white',
                padding: '8px 10px',
                borderTop: `1px solid ${OPAL_BLUE}30`,
                borderRight: `1px solid ${OPAL_BLUE}30`,
                borderBottom: `1px solid ${OPAL_BLUE}30`,
                borderLeft: `1px solid ${OPAL_BLUE}30`,
                fontWeight: 600,
                fontSize: '11px',
              }}>
                <span style={{ fontSize: '9px', color: `${OPAL_BLUE}99`, marginLeft: '4px' }}>תאריך הזמנה</span>
                <span style={{ fontFamily: 'monospace' }}>{orderDate}</span>
              </td>
              <td style={{
                backgroundColor: 'white',
                padding: '8px 16px',
                borderTop: `1px solid ${OPAL_BLUE}30`,
                borderRight: `1px solid ${OPAL_BLUE}30`,
                borderBottom: `1px solid ${OPAL_BLUE}30`,
                borderLeft: `1px solid ${OPAL_BLUE}30`,
                fontFamily: 'monospace',
                fontSize: '14px',
                fontWeight: 700,
              }}>
                {orderNumber}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Customer Details Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '12px' }}>
        <tbody>
          {/* Row 1: Customer Name, ID, Subscription Start */}
          <tr>
            <td style={labelCellStyle}>שם לקוח</td>
            <td style={{ ...valueCellStyle, width: '22%' }}>{customerName}</td>
            <td style={labelCellStyle}>ת.ז</td>
            <td style={{ ...valueCellStyle, fontFamily: 'monospace', width: '14%' }}>{customerId}</td>
            <td style={labelCellStyle}>תאריך תחילת מנוי</td>
            <td style={{ ...valueCellStyle, fontFamily: 'monospace', width: '10%' }}>{subscriptionStartDate}</td>
          </tr>
          
          {/* Row 2: Address, Phone, Email */}
          <tr>
            <td style={labelCellStyle}>כתובת הלקוח</td>
            <td style={valueCellStyle}>{address}</td>
            <td style={labelCellStyle}>טלפון</td>
            <td style={{ ...valueCellStyle, fontFamily: 'monospace', fontSize: '10px', direction: 'ltr', textAlign: 'right' }}>{phone}</td>
            <td style={labelCellStyle}>מייל</td>
            <td style={{ ...valueCellStyle, fontSize: '9px', direction: 'ltr', textAlign: 'right' }}>{email}</td>
          </tr>
          
          {/* Row 3: Last 4 Credit Card Digits */}
          <tr>
            <td style={labelCellStyle} colSpan={2}>ארבע ספרות אחרונות בכרטיס האשראי</td>
            <td style={{ ...valueCellStyle, fontFamily: 'monospace', textAlign: 'center' }} colSpan={4}>
              {lastFourDigits}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Subscription Type Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '12px' }}>
        <tbody>
          <tr>
            <td style={{ ...labelCellStyle, width: '70px' }}>סוג המנוי</td>
            <td style={{ ...valueCellStyle, fontSize: '10px' }}>{transactionDescription}</td>
            <td style={labelCellStyle}>שם כתב השרות</td>
            <td style={{ ...valueCellStyle, fontSize: '10px' }}>{serviceDocumentName}</td>
            <td style={{
              ...valueCellStyle,
              backgroundColor: `${OPAL_GOLD}20`,
              fontWeight: 700,
              color: OPAL_BLUE,
              textAlign: 'center',
              width: '100px',
              fontSize: '10px',
            }}>
              {productName}
            </td>
            <td style={labelCellStyle}>סה״כ תש׳ חודשי</td>
            <td style={{
              ...valueCellStyle,
              fontWeight: 700,
              fontSize: '13px',
              width: '60px',
            }}>
              {monthlyTotal}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Transaction Description Header */}
      <div style={sectionHeaderStyle}>
        תאור העסקה
      </div>

      {/* Beneficiaries Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '14px' }}>
        <tbody>
          {/* Primary Beneficiary */}
          <tr>
            <td style={{
              ...labelCellStyle,
              backgroundColor: OPAL_GOLD,
              fontWeight: 700,
              width: '110px',
            }}>
              שם המבוטח העיקרי
            </td>
            <td style={{ ...valueCellStyle, fontWeight: 600, fontSize: '11px' }}>{primaryBeneficiary.fullName}</td>
            <td style={{ ...labelCellStyle, width: '40px', textAlign: 'center' }}>ת.ז</td>
            <td style={{ ...valueCellStyle, fontFamily: 'monospace', width: '100px', fontSize: '10px' }}>{primaryBeneficiary.idNumber}</td>
          </tr>
          
          {/* Secondary Beneficiaries */}
          {filledSecondaryBeneficiaries.map((beneficiary, index) => (
            <tr key={index}>
              <td style={labelCellStyle}>שם המבוטח המשני</td>
              <td style={{ ...valueCellStyle, fontSize: '10px' }}>{beneficiary.fullName || ''}</td>
              <td style={{ ...labelCellStyle, textAlign: 'center' }}>ת.ז</td>
              <td style={{ ...valueCellStyle, fontFamily: 'monospace', fontSize: '10px' }}>{beneficiary.idNumber || ''}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Service Provider Details */}
      <div style={{ marginBottom: '12px' }}>
        <div style={sectionHeaderStyle}>
          פרטי נותן השרות
        </div>
        <div style={{
          backgroundColor: 'white',
          padding: '10px 16px',
          borderLeft: `1px solid ${OPAL_BLUE}30`,
          borderRight: `1px solid ${OPAL_BLUE}30`,
          borderBottom: `1px solid ${OPAL_BLUE}30`,
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            gap: '12px',
            marginBottom: '8px',
            fontSize: '12px',
          }}>
            <span style={{ color: OPAL_BLUE }}>טלפונים להזמנת שרותים רפואיים</span>
            <span style={{ 
              fontFamily: 'monospace', 
              fontWeight: 700, 
              fontSize: '14px',
              color: OPAL_BLUE,
              direction: 'ltr',
            }}>
              {servicePhone}
            </span>
          </div>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            gap: '12px',
            fontSize: '12px',
          }}>
            <span style={{ color: OPAL_BLUE }}>לינק להגשת מסמכים רפואיים - תביעה און ליין</span>
            <a 
              href={claimsLink}
              style={{ 
                color: OPAL_GOLD, 
                fontWeight: 700,
                textDecoration: 'underline',
              }}
            >
              לינק
            </a>
          </div>
        </div>
      </div>

      {/* Notice Section */}
      <div style={{
        backgroundColor: 'white',
        borderTop: `2px solid ${OPAL_GOLD}`,
        borderRight: `2px solid ${OPAL_GOLD}`,
        borderBottom: `2px solid ${OPAL_GOLD}`,
        borderLeft: `2px solid ${OPAL_GOLD}`,
        borderRadius: '4px',
        padding: '10px 14px',
        marginBottom: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <div style={{
            backgroundColor: OPAL_GOLD,
            color: 'white',
            padding: '4px 10px',
            borderRadius: '3px',
            fontWeight: 700,
            fontSize: '11px',
            whiteSpace: 'nowrap',
          }}>
            שים לב
          </div>
          <div style={{ fontSize: '11px', lineHeight: 1.5 }}>
            <p style={{ margin: 0, marginBottom: '4px', fontWeight: 600, color: OPAL_BLUE }}>
              חיוב החודשי של המנוי דרך חברת אופאל תקשורת בע״מ
            </p>
            <p style={{ margin: 0, color: `${OPAL_BLUE}CC`, fontSize: '10px' }}>
              לפניות וברורים:{' '}
              <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>054-4261369</span>
              {' '}דואל:{' '}
              <a href="mailto:opal2000@zahav.net.il" style={{ color: OPAL_GOLD, fontWeight: 600 }}>
                opal2000@zahav.net.il
              </a>
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        textAlign: 'center',
        fontSize: '10px',
        color: `${OPAL_BLUE}99`,
        borderTop: `1px solid ${OPAL_BLUE}20`,
        paddingTop: '8px',
      }}>
        <p style={{ margin: 0 }}>המנוי כפוף לכתב השרות ולצילומי ת.ז.</p>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          @page {
            size: A4;
            margin: 10mm;
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
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#f1f5f9', 
      padding: '32px 16px',
    }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        {/* Actions Bar */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          marginBottom: '24px',
        }} className="print:hidden">
          <h1 style={{ 
            fontSize: '20px', 
            fontWeight: 700,
            color: OPAL_BLUE,
            margin: 0,
          }}>
            תצוגה מקדימה - טופס הזמנה
          </h1>
          <button
            onClick={handlePrint}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              backgroundColor: OPAL_BLUE,
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <svg style={{ width: '18px', height: '18px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            הדפס / שמור PDF
          </button>
        </div>

        {/* PDF Preview */}
        <div style={{ 
          backgroundColor: 'white', 
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          borderRadius: '8px',
          overflow: 'hidden',
        }} className="print:shadow-none print:rounded-none">
          <OrderFormPDF {...props} />
        </div>
      </div>
    </div>
  )
}
