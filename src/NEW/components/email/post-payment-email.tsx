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
      {/* Logo above headline (not inside navy band) */}
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
            margin: 0,
            color: 'white',
            fontSize: '20px',
            fontWeight: 600,
            textAlign: 'center',
            direction: 'rtl',
          }}
        >
          שמחים על הצטרפותך למנוי {productName}
        </h1>
      </div>

      {/* Content */}
      <div dir="rtl" style={{ padding: '28px 32px', textAlign: 'right', direction: 'rtl' }}>
        {/* Greeting */}
        <p
          style={{
            fontSize: '15px',
            color: '#333',
            marginTop: 0,
            marginBottom: '16px',
            lineHeight: 1.7,
            textAlign: 'right',
            direction: 'rtl',
          }}
        >
          שלום {customerName}, כתב השירות וגילוי הנאות מצורפים למייל זה.
        </p>

        {/* Order Summary */}
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
                style={{
                  padding: '10px 0',
                  color: '#666',
                  fontSize: '14px',
                  borderBottom: '1px solid #eee',
                  textAlign: 'right',
                  direction: 'rtl',
                }}
              >
                מספר הזמנה
              </td>
              <td
                align="right"
                style={{
                  padding: '10px 0',
                  color: OPAL_BLUE,
                  fontSize: '14px',
                  fontWeight: 600,
                  borderBottom: '1px solid #eee',
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
                style={{
                  padding: '10px 0',
                  color: '#666',
                  fontSize: '14px',
                  borderBottom: '1px solid #eee',
                  textAlign: 'right',
                  direction: 'rtl',
                }}
              >
                תאריך
              </td>
              <td
                align="right"
                style={{
                  padding: '10px 0',
                  color: OPAL_BLUE,
                  fontSize: '14px',
                  borderBottom: '1px solid #eee',
                  textAlign: 'right',
                  direction: 'rtl',
                }}
              >
                <span dir="ltr" style={{ unicodeBidi: 'embed' }}>
                  {orderDate}
                </span>
              </td>
            </tr>
            <tr>
              <td
                align="right"
                style={{
                  padding: '12px 0',
                  color: OPAL_BLUE,
                  fontSize: '15px',
                  fontWeight: 600,
                  textAlign: 'right',
                  direction: 'rtl',
                }}
              >
                תשלום חודשי
              </td>
              <td
                align="right"
                style={{
                  padding: '12px 0',
                  color: OPAL_GOLD,
                  fontSize: '18px',
                  fontWeight: 700,
                  textAlign: 'right',
                  direction: 'rtl',
                }}
              >
                <span dir="ltr" style={{ unicodeBidi: 'embed' }}>
                  {monthlyTotal}
                </span>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Beneficiary Notice */}
        <div
          dir="rtl"
          style={{
            borderRight: `3px solid ${OPAL_GOLD}`,
            paddingRight: '16px',
            marginBottom: '28px',
            textAlign: 'right',
          }}
        >
          <p
            style={{
              fontSize: '14px',
              color: OPAL_BLUE,
              margin: 0,
              marginBottom: '8px',
              fontWeight: 600,
              textAlign: 'right',
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
              textAlign: 'right',
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
        <div dir="rtl" style={{ fontSize: '14px', color: '#555', lineHeight: 1.8, textAlign: 'right' }}>
          <p style={{ margin: 0, marginBottom: '6px', textAlign: 'right' }}>
            <span style={{ color: OPAL_BLUE, fontWeight: 500 }}>הזמנת שירותים רפואיים:</span>{' '}
            <span dir="ltr" style={{ unicodeBidi: 'embed' }}>
              {servicePhone}
            </span>
          </p>
          <p style={{ margin: 0, marginBottom: '6px', textAlign: 'right' }}>
            <span style={{ color: OPAL_BLUE, fontWeight: 500 }}>הגשת מסמכים:</span>{' '}
            <a href={claimsLink} style={{ color: OPAL_GOLD, textDecoration: 'none' }}>
              תביעה און ליין
            </a>
          </p>
          <p style={{ margin: 0, textAlign: 'right' }}>
            <span style={{ color: OPAL_BLUE, fontWeight: 500 }}>מכירות:</span>{' '}
            <span dir="ltr" style={{ unicodeBidi: 'embed' }}>
              {salesPhone}
            </span>
          </p>
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
            fontSize: '12px',
            color: '#666',
            margin: 0,
            marginBottom: '4px',
            textAlign: 'center',
            direction: 'rtl',
          }}
        >
          החיוב החודשי דרך חברת אופאל תקשורת בע״מ
        </p>
        <p dir="ltr" style={{ fontSize: '12px', color: '#888', margin: 0, textAlign: 'center' }}>
          {salesPhone} | {contactEmail}
        </p>
      </div>
    </div>
  )
}
