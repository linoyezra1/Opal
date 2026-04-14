'use client'

// Opal Brand Colors
const OPAL_BLUE = '#1A365D'
const OPAL_GOLD = '#C5A059'

interface PostPaymentEmailProps {
  orderId: string
  orderDate: string
  customerName: string
  productName: string
  monthlyTotal: string
  beneficiaryLink: string
  servicePhone?: string
  claimsLink?: string
  salesPhone?: string
  contactEmail?: string
}

export function PostPaymentEmail({
  orderId = '12345',
  orderDate = '29/03/2026',
  customerName = 'ישראל ישראלי',
  productName = 'רופא עד הבית',
  monthlyTotal = '₪49',
  beneficiaryLink = '#',
  servicePhone = '00-0000000',
  claimsLink = '#',
  salesPhone = '054-4261369',
  contactEmail = 'opal2000@zahav.net.il',
}: PostPaymentEmailProps) {
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
      {/* Header with Logo */}
      <div
        style={{
          backgroundColor: OPAL_BLUE,
          padding: '20px 32px',
          textAlign: 'center',
        }}
      >
        <img
          src="/images/opal-logo.jpeg"
          alt="אופאל"
          style={{
            height: '40px',
            marginBottom: '12px',
            backgroundColor: 'white',
            borderRadius: '4px',
            padding: '4px 8px',
          }}
        />
        <h1
          style={{
            margin: 0,
            color: 'white',
            fontSize: '20px',
            fontWeight: 600,
          }}
        >
          שמחים על הצטרפותך למנוי {productName}
        </h1>
      </div>

      {/* Content */}
      <div style={{ padding: '28px 32px' }}>
        {/* Greeting */}
        <p
          style={{
            fontSize: '15px',
            color: '#333',
            marginTop: 0,
            marginBottom: '16px',
            lineHeight: 1.7,
          }}
        >
          שלום {customerName},
          <br />
          טופס הזמנתך מצורף למייל זה.
          <br />
          כתב השירות וגילוי הנאות מצורפים למייל זה.
        </p>

        {/* Order Summary */}
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            marginBottom: '24px',
          }}
        >
          <tbody>
            <tr>
              <td style={{ padding: '10px 0', color: '#666', fontSize: '14px', borderBottom: '1px solid #eee' }}>
                מספר הזמנה
              </td>
              <td style={{ padding: '10px 0', color: OPAL_BLUE, fontSize: '14px', fontWeight: 600, textAlign: 'left', borderBottom: '1px solid #eee' }}>
                {orderId}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '10px 0', color: '#666', fontSize: '14px', borderBottom: '1px solid #eee' }}>
                תאריך
              </td>
              <td style={{ padding: '10px 0', color: OPAL_BLUE, fontSize: '14px', textAlign: 'left', borderBottom: '1px solid #eee' }}>
                {orderDate}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '12px 0', color: OPAL_BLUE, fontSize: '15px', fontWeight: 600 }}>
                תשלום חודשי
              </td>
              <td style={{ padding: '12px 0', color: OPAL_GOLD, fontSize: '18px', fontWeight: 700, textAlign: 'left' }}>
                {monthlyTotal}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Beneficiary Notice */}
        <div
          style={{
            borderRight: `3px solid ${OPAL_GOLD}`,
            paddingRight: '16px',
            marginBottom: '28px',
          }}
        >
          <p
            style={{
              fontSize: '14px',
              color: OPAL_BLUE,
              margin: 0,
              marginBottom: '8px',
              fontWeight: 600,
            }}
          >
            להפעלת השירות יש למלא את פרטי המוטבים
          </p>
          <p
            style={{
              fontSize: '13px',
              color: '#666',
              margin: 0,
              marginBottom: '14px',
            }}
          >
            ללא קבלת פרטי המוטבים לא יהיה ניתן לקבל את השירות
          </p>
          <a
            href={beneficiaryLink}
            style={{
              display: 'inline-block',
              backgroundColor: OPAL_BLUE,
              color: 'white',
              padding: '10px 20px',
              borderRadius: '4px',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: 500,
            }}
          >
            מילוי פרטי מוטבים
          </a>
        </div>

        {/* Divider */}
        <div style={{ borderTop: '1px solid #eee', marginBottom: '20px' }} />

        {/* Contact Info */}
        <div style={{ fontSize: '14px', color: '#555', lineHeight: 1.8 }}>
          <p style={{ margin: 0, marginBottom: '6px' }}>
            <span style={{ color: OPAL_BLUE, fontWeight: 500 }}>הזמנת שירותים רפואיים:</span>{' '}
            <span dir="ltr">{servicePhone}</span>
          </p>
          <p style={{ margin: 0, marginBottom: '6px' }}>
            <span style={{ color: OPAL_BLUE, fontWeight: 500 }}>הגשת מסמכים:</span>{' '}
            <a href={claimsLink} style={{ color: OPAL_GOLD, textDecoration: 'none' }}>
              תביעה און ליין
            </a>
          </p>
          <p style={{ margin: 0 }}>
            <span style={{ color: OPAL_BLUE, fontWeight: 500 }}>מכירות:</span>{' '}
            <span dir="ltr">{salesPhone}</span>
          </p>
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
            fontSize: '12px',
            color: '#666',
            margin: 0,
            marginBottom: '4px',
          }}
        >
          החיוב החודשי דרך חברת אופאל תקשורת בע״מ
        </p>
        <p
          style={{
            fontSize: '12px',
            color: '#888',
            margin: 0,
          }}
        >
          {salesPhone} | {contactEmail}
        </p>
      </div>
    </div>
  )
}
