'use client'

// Opal Brand Colors
const OPAL_BLUE = '#1A365D'
const OPAL_GOLD = '#C5A059'

interface Beneficiary {
  name: string
  id: string
}

interface FinalSummaryEmailProps {
  orderId: string
  orderDate: string
  primaryInsuredName: string
  primaryId: string
  beneficiaries: Beneficiary[]
  subscriptionType: string
  monthlyTotal: string
  medicalServicesPhone: string
  claimsLink: string
}

export function FinalSummaryEmail({
  orderId = '12345',
  orderDate = '29/03/2026',
  primaryInsuredName = 'ישראל ישראלי',
  primaryId = '123456789',
  beneficiaries = [
    { name: 'שרה ישראלי', id: '987654321' },
    { name: 'דוד ישראלי', id: '456789123' },
  ],
  subscriptionType = 'רופא עד הבית - מנוי משפחתי',
  monthlyTotal = '₪99',
  medicalServicesPhone = '00-0000000',
  claimsLink = '#',
}: FinalSummaryEmailProps) {
  return (
    <div
      dir="rtl"
      style={{
        fontFamily: 'Heebo, Arial, sans-serif',
        maxWidth: '560px',
        margin: '0 auto',
        backgroundColor: 'white',
      }}
    >
      {/* Logo above headline — matches post-payment-email */}
      <div
        style={{
          padding: '24px 32px 16px',
          textAlign: 'center',
          backgroundColor: 'white',
        }}
      >
        <img
          src="/images/opal-logo.jpeg"
          alt="אופאל"
          style={{
            height: '40px',
            backgroundColor: 'white',
            borderRadius: '4px',
            padding: '4px 8px',
            objectFit: 'contain',
          }}
        />
      </div>
      <div
        style={{
          backgroundColor: OPAL_BLUE,
          padding: '20px 32px',
          textAlign: 'center',
        }}
      >
        <h1
          style={{
            color: 'white',
            fontSize: '20px',
            fontWeight: 600,
            margin: 0,
          }}
        >
          סיכום הצטרפות ופרטי מנוי
        </h1>
        <p
          style={{
            color: 'rgba(255, 255, 255, 0.8)',
            fontSize: '14px',
            margin: '8px 0 0',
          }}
        >
          אופאל - רופא עד הבית
        </p>
      </div>

      {/* Content */}
      <div style={{ padding: '28px 32px' }}>
        {/* Order Info */}
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            marginBottom: '24px',
          }}
        >
          <tbody>
            <tr>
              <td style={{ padding: '8px 0', color: '#666', fontSize: '14px' }}>מספר הזמנה</td>
              <td style={{ padding: '8px 0', color: OPAL_BLUE, fontSize: '14px', fontWeight: 600, textAlign: 'left' }}>{orderId}</td>
            </tr>
            <tr>
              <td style={{ padding: '8px 0', color: '#666', fontSize: '14px' }}>תאריך</td>
              <td style={{ padding: '8px 0', color: OPAL_BLUE, fontSize: '14px', textAlign: 'left' }}>{orderDate}</td>
            </tr>
          </tbody>
        </table>

        {/* Primary Insured */}
        <div
          style={{
            backgroundColor: '#F8F9FA',
            borderRight: `4px solid ${OPAL_GOLD}`,
            padding: '16px',
            marginBottom: '20px',
          }}
        >
          <div
            style={{
              fontSize: '11px',
              color: OPAL_GOLD,
              fontWeight: 600,
              marginBottom: '8px',
              textTransform: 'uppercase',
            }}
          >
            מבוטח ראשי
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: OPAL_BLUE, fontSize: '16px', fontWeight: 600 }}>{primaryInsuredName}</span>
            <span style={{ color: '#666', fontSize: '14px', direction: 'ltr' }}>{primaryId}</span>
          </div>
        </div>

        {/* Beneficiaries */}
        {beneficiaries.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <div
              style={{
                fontSize: '14px',
                color: OPAL_BLUE,
                fontWeight: 600,
                marginBottom: '12px',
                paddingBottom: '8px',
                borderBottom: '1px solid #eee',
              }}
            >
              מוטבים נוספים
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {beneficiaries.map((beneficiary, index) => (
                  <tr key={index}>
                    <td
                      style={{
                        padding: '10px 0',
                        color: '#333',
                        fontSize: '14px',
                        borderBottom: index < beneficiaries.length - 1 ? '1px solid #eee' : 'none',
                      }}
                    >
                      {beneficiary.name}
                    </td>
                    <td
                      style={{
                        padding: '10px 0',
                        color: '#666',
                        fontSize: '14px',
                        textAlign: 'left',
                        direction: 'ltr',
                        borderBottom: index < beneficiaries.length - 1 ? '1px solid #eee' : 'none',
                      }}
                    >
                      {beneficiary.id}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Subscription Summary */}
        <div
          style={{
            backgroundColor: '#F8F9FA',
            padding: '16px',
            marginBottom: '24px',
            textAlign: 'center',
          }}
        >
          <div style={{ color: '#666', fontSize: '13px', marginBottom: '4px' }}>סוג מנוי</div>
          <div style={{ color: OPAL_BLUE, fontSize: '15px', fontWeight: 600, marginBottom: '12px' }}>
            {subscriptionType}
          </div>
          <div
            style={{
              display: 'inline-block',
              backgroundColor: OPAL_BLUE,
              color: 'white',
              fontSize: '18px',
              fontWeight: 700,
              padding: '10px 24px',
              borderRadius: '4px',
            }}
          >
            {monthlyTotal} לחודש
          </div>
        </div>

        {/* Divider */}
        <div style={{ borderTop: '1px solid #eee', marginBottom: '20px' }} />

        {/* Medical Services */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ color: '#666', fontSize: '13px', marginBottom: '8px' }}>
            טלפונים להזמנת שירותים רפואיים
          </div>
          <a
            href={`tel:${medicalServicesPhone.replace(/-/g, '')}`}
            style={{
              color: OPAL_BLUE,
              fontSize: '20px',
              fontWeight: 700,
              textDecoration: 'none',
              direction: 'ltr',
              display: 'inline-block',
            }}
          >
            {medicalServicesPhone}
          </a>
          <div style={{ marginTop: '16px' }}>
            <a
              href={claimsLink}
              style={{
                color: OPAL_GOLD,
                fontSize: '14px',
                fontWeight: 500,
                textDecoration: 'none',
              }}
            >
              להגשת מסמכים רפואיים - תביעה און ליין
            </a>
          </div>
        </div>

        {/* Notice */}
        <div
          style={{
            borderRight: `3px solid ${OPAL_GOLD}`,
            paddingRight: '12px',
            fontSize: '13px',
            color: '#555',
            lineHeight: 1.6,
          }}
        >
          <strong style={{ color: OPAL_BLUE }}>שים לב:</strong> החיוב החודשי דרך חברת אופאל תקשורת בע״מ.
          <br />
          לפניות: 054-4261369 | opal2000@zahav.net.il
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          backgroundColor: '#F5F5F5',
          padding: '16px 32px',
          textAlign: 'center',
        }}
      >
        <p
          style={{
            fontSize: '11px',
            color: '#888',
            margin: 0,
          }}
        >
          המנוי כפוף לכתב השירות ולגילוי נאות המצורפים למייל זה.
        </p>
      </div>
    </div>
  )
}
