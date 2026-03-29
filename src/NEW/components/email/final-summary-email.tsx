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
        textAlign: 'right',
        direction: 'rtl',
      }}
    >
      {/* Logo above headline — matches post-payment-email */}
      <div
        dir="rtl"
        style={{
          padding: '24px 32px 16px',
          textAlign: 'center',
          backgroundColor: 'white',
        }}
      >
        <img
          src="/images/opal-logo.jpeg"
          alt="אופאל"
          width={150}
          height="auto"
          style={{
            display: 'block',
            margin: '0 auto',
            width: '150px',
            maxWidth: '150px',
            height: 'auto',
            backgroundColor: 'white',
            borderRadius: '4px',
            padding: '4px 8px',
            objectFit: 'contain',
            border: 0,
            lineHeight: 0,
          }}
        />
      </div>
      <div
        dir="rtl"
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
            textAlign: 'center',
            direction: 'rtl',
          }}
        >
          סיכום הצטרפות ופרטי מנוי
        </h1>
        <p
          style={{
            color: 'rgba(255, 255, 255, 0.8)',
            fontSize: '14px',
            margin: '8px 0 0',
            textAlign: 'center',
            direction: 'rtl',
          }}
        >
          אופאל - רופא עד הבית
        </p>
      </div>

      {/* Content */}
      <div dir="rtl" style={{ padding: '28px 32px', textAlign: 'right', direction: 'rtl' }}>
        {/* Order Info */}
        <table
          dir="rtl"
          align="right"
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            marginBottom: '24px',
            direction: 'rtl',
            textAlign: 'right',
          }}
        >
          <tbody>
            <tr>
              <td
                align="right"
                style={{ padding: '8px 0', color: '#666', fontSize: '14px', textAlign: 'right', direction: 'rtl' }}
              >
                מספר הזמנה
              </td>
              <td
                align="right"
                style={{
                  padding: '8px 0',
                  color: OPAL_BLUE,
                  fontSize: '14px',
                  fontWeight: 600,
                  textAlign: 'right',
                  direction: 'rtl',
                }}
              >
                <span dir="ltr" style={{ unicodeBidi: 'embed' }}>
                  {orderId}
                </span>
              </td>
            </tr>
            <tr>
              <td
                align="right"
                style={{ padding: '8px 0', color: '#666', fontSize: '14px', textAlign: 'right', direction: 'rtl' }}
              >
                תאריך
              </td>
              <td
                align="right"
                style={{ padding: '8px 0', color: OPAL_BLUE, fontSize: '14px', textAlign: 'right', direction: 'rtl' }}
              >
                <span dir="ltr" style={{ unicodeBidi: 'embed' }}>
                  {orderDate}
                </span>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Primary Insured */}
        <div
          dir="rtl"
          style={{
            backgroundColor: '#F8F9FA',
            borderRight: `4px solid ${OPAL_GOLD}`,
            padding: '16px',
            marginBottom: '20px',
            textAlign: 'right',
          }}
        >
          <div
            style={{
              fontSize: '11px',
              color: OPAL_GOLD,
              fontWeight: 600,
              marginBottom: '8px',
              textTransform: 'uppercase',
              textAlign: 'right',
            }}
          >
            מבוטח ראשי
          </div>
          <table
            dir="rtl"
            align="right"
            style={{ width: '100%', borderCollapse: 'collapse', direction: 'rtl', textAlign: 'right' }}
          >
            <tbody>
              <tr>
                <td align="right" style={{ textAlign: 'right', direction: 'rtl' }}>
                  <span style={{ color: OPAL_BLUE, fontSize: '16px', fontWeight: 600 }}>{primaryInsuredName}</span>
                </td>
                <td align="right" style={{ textAlign: 'right', direction: 'rtl', whiteSpace: 'nowrap' }}>
                  <span dir="ltr" style={{ unicodeBidi: 'embed', color: '#666', fontSize: '14px' }}>
                    {primaryId}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Beneficiaries */}
        {beneficiaries.length > 0 && (
          <div dir="rtl" style={{ marginBottom: '24px', textAlign: 'right' }}>
            <div
              style={{
                fontSize: '14px',
                color: OPAL_BLUE,
                fontWeight: 600,
                marginBottom: '12px',
                paddingBottom: '8px',
                borderBottom: '1px solid #eee',
                textAlign: 'right',
              }}
            >
              מוטבים נוספים
            </div>
            <table
              dir="rtl"
              align="right"
              style={{ width: '100%', borderCollapse: 'collapse', direction: 'rtl', textAlign: 'right' }}
            >
              <tbody>
                {beneficiaries.map((beneficiary, index) => (
                  <tr key={index}>
                    <td
                      align="right"
                      style={{
                        padding: '10px 0',
                        color: '#333',
                        fontSize: '14px',
                        borderBottom: index < beneficiaries.length - 1 ? '1px solid #eee' : 'none',
                        textAlign: 'right',
                        direction: 'rtl',
                      }}
                    >
                      {beneficiary.name}
                    </td>
                    <td
                      align="right"
                      style={{
                        padding: '10px 0',
                        color: '#666',
                        fontSize: '14px',
                        borderBottom: index < beneficiaries.length - 1 ? '1px solid #eee' : 'none',
                        textAlign: 'right',
                        direction: 'rtl',
                      }}
                    >
                      <span dir="ltr" style={{ unicodeBidi: 'embed' }}>
                        {beneficiary.id}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Subscription Summary */}
        <div
          dir="rtl"
          style={{
            backgroundColor: '#F8F9FA',
            padding: '16px',
            marginBottom: '24px',
            textAlign: 'right',
          }}
        >
          <div style={{ color: '#666', fontSize: '13px', marginBottom: '4px', textAlign: 'right' }}>סוג מנוי</div>
          <div
            style={{ color: OPAL_BLUE, fontSize: '15px', fontWeight: 600, marginBottom: '12px', textAlign: 'right' }}
          >
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
              textAlign: 'center',
              direction: 'rtl',
            }}
          >
            <span dir="ltr" style={{ unicodeBidi: 'embed' }}>
              {monthlyTotal}
            </span>{' '}
            לחודש
          </div>
        </div>

        {/* Divider */}
        <div style={{ borderTop: '1px solid #eee', marginBottom: '20px' }} />

        {/* Medical Services */}
        <div dir="rtl" style={{ textAlign: 'right', marginBottom: '24px' }}>
          <div style={{ color: '#666', fontSize: '13px', marginBottom: '8px', textAlign: 'right' }}>
            טלפונים להזמנת שירותים רפואיים
          </div>
          <a
            href={`tel:${medicalServicesPhone.replace(/-/g, '')}`}
            style={{
              color: OPAL_BLUE,
              fontSize: '20px',
              fontWeight: 700,
              textDecoration: 'none',
              display: 'inline-block',
              textAlign: 'right',
            }}
          >
            <span dir="ltr" style={{ unicodeBidi: 'embed' }}>
              {medicalServicesPhone}
            </span>
          </a>
          <div style={{ marginTop: '16px', textAlign: 'right' }}>
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
          dir="rtl"
          style={{
            borderRight: `3px solid ${OPAL_GOLD}`,
            paddingRight: '12px',
            fontSize: '13px',
            color: '#555',
            lineHeight: 1.6,
            textAlign: 'right',
          }}
        >
          <strong style={{ color: OPAL_BLUE }}>שים לב:</strong> החיוב החודשי דרך חברת אופאל תקשורת בע״מ.
          <br />
          לפניות:{' '}
          <span dir="ltr" style={{ unicodeBidi: 'embed' }}>
            054-4261369
          </span>{' '}
          |{' '}
          <span dir="ltr" style={{ unicodeBidi: 'embed' }}>
            opal2000@zahav.net.il
          </span>
        </div>
      </div>

      {/* Footer */}
      <div
        dir="rtl"
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
            textAlign: 'center',
            direction: 'rtl',
          }}
        >
          המנוי כפוף לכתב השירות ולגילוי נאות המצורפים למייל זה.
        </p>
      </div>
    </div>
  )
}
