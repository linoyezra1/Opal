"use client"

interface PostPaymentEmailProps {
  orderId: string
  orderDate: string
  customerName: string
  customerId: string
  startDate: string
  address: string
  phone: string
  email: string
  last4Digits: string
  subscriptionType: string
  monthlyTotal: string
  beneficiaryLink: string
}

export function PostPaymentEmail({
  orderId = "12345",
  orderDate = "01/01/2026",
  customerName = "ישראל ישראלי",
  customerId = "123456789",
  startDate = "01/02/2026",
  address = "רחוב הרצל 1, תל אביב",
  phone = "054-1234567",
  email = "israel@example.com",
  last4Digits = "1234",
  subscriptionType = "רופא עד הבית - מנוי משפחתי",
  monthlyTotal = "₪99",
  beneficiaryLink = "#",
}: PostPaymentEmailProps) {
  return (
    <div
      dir="rtl"
      style={{
        fontFamily: "'Heebo', 'Arial', sans-serif",
        backgroundColor: "#f5f7fa",
        padding: "40px 20px",
        minHeight: "100vh",
      }}
    >
      {/* Email Container */}
      <div
        style={{
          maxWidth: "600px",
          margin: "0 auto",
          backgroundColor: "#ffffff",
          borderRadius: "12px",
          overflow: "hidden",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.08)",
        }}
      >
        {/* Header */}
        <div
          style={{
            background: "linear-gradient(135deg, #0d7377 0%, #14919b 100%)",
            padding: "32px 24px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: "64px",
              height: "64px",
              backgroundColor: "rgba(255, 255, 255, 0.2)",
              borderRadius: "50%",
              margin: "0 auto 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ fontSize: "32px" }}>&#x2714;</span>
          </div>
          <h1
            style={{
              color: "#ffffff",
              fontSize: "24px",
              fontWeight: "700",
              margin: "0 0 8px",
              lineHeight: "1.4",
            }}
          >
            שמחים על הצטרפותך למנוי רופא עד הבית
          </h1>
          <p
            style={{
              color: "rgba(255, 255, 255, 0.9)",
              fontSize: "16px",
              margin: "0",
            }}
          >
            הזמנתך התקבלה בהצלחה
          </p>
        </div>

        {/* Content */}
        <div style={{ padding: "32px 24px" }}>
          {/* Critical Notice */}
          <div
            style={{
              backgroundColor: "#fef2f2",
              border: "2px solid #ef4444",
              borderRadius: "8px",
              padding: "20px",
              marginBottom: "24px",
            }}
          >
            <p
              style={{
                color: "#dc2626",
                fontSize: "15px",
                fontWeight: "700",
                margin: "0 0 12px",
                lineHeight: "1.6",
              }}
            >
              חשוב מאד - בכדי להפעיל את השרות יש למלא את פרטי המוטבים.
              <br />
              ללא קבלת פרטי המוטבים לא יהיה ניתן לקבל את השרות.
            </p>
            <a
              href={beneficiaryLink}
              style={{
                display: "inline-block",
                backgroundColor: "#dc2626",
                color: "#ffffff",
                fontSize: "16px",
                fontWeight: "600",
                padding: "14px 32px",
                borderRadius: "8px",
                textDecoration: "none",
              }}
            >
              לחץ כאן להשלמת פרטי המוטבים
            </a>
          </div>

          {/* Order Details */}
          <div
            style={{
              backgroundColor: "#f8fafc",
              borderRadius: "8px",
              padding: "24px",
              marginBottom: "24px",
            }}
          >
            <h2
              style={{
                color: "#0d7377",
                fontSize: "18px",
                fontWeight: "600",
                margin: "0 0 20px",
                paddingBottom: "12px",
                borderBottom: "2px solid #e2e8f0",
              }}
            >
              סיכום הזמנה
            </h2>

            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
              }}
            >
              <tbody>
                <tr>
                  <td
                    style={{
                      padding: "10px 0",
                      color: "#64748b",
                      fontSize: "14px",
                      width: "40%",
                    }}
                  >
                    מספר הזמנה:
                  </td>
                  <td
                    style={{
                      padding: "10px 0",
                      color: "#1e293b",
                      fontSize: "14px",
                      fontWeight: "600",
                    }}
                  >
                    {orderId}
                  </td>
                </tr>
                <tr>
                  <td
                    style={{
                      padding: "10px 0",
                      color: "#64748b",
                      fontSize: "14px",
                    }}
                  >
                    תאריך הזמנה:
                  </td>
                  <td
                    style={{
                      padding: "10px 0",
                      color: "#1e293b",
                      fontSize: "14px",
                      fontWeight: "600",
                    }}
                  >
                    {orderDate}
                  </td>
                </tr>
                <tr>
                  <td
                    style={{
                      padding: "10px 0",
                      color: "#64748b",
                      fontSize: "14px",
                    }}
                  >
                    שם לקוח:
                  </td>
                  <td
                    style={{
                      padding: "10px 0",
                      color: "#1e293b",
                      fontSize: "14px",
                      fontWeight: "600",
                    }}
                  >
                    {customerName}
                  </td>
                </tr>
                <tr>
                  <td
                    style={{
                      padding: "10px 0",
                      color: "#64748b",
                      fontSize: "14px",
                    }}
                  >
                    ת.ז:
                  </td>
                  <td
                    style={{
                      padding: "10px 0",
                      color: "#1e293b",
                      fontSize: "14px",
                      fontWeight: "600",
                      direction: "ltr",
                      textAlign: "right",
                    }}
                  >
                    {customerId}
                  </td>
                </tr>
                <tr>
                  <td
                    style={{
                      padding: "10px 0",
                      color: "#64748b",
                      fontSize: "14px",
                    }}
                  >
                    תאריך תחילת מנוי:
                  </td>
                  <td
                    style={{
                      padding: "10px 0",
                      color: "#1e293b",
                      fontSize: "14px",
                      fontWeight: "600",
                    }}
                  >
                    {startDate}
                  </td>
                </tr>
                <tr>
                  <td
                    style={{
                      padding: "10px 0",
                      color: "#64748b",
                      fontSize: "14px",
                    }}
                  >
                    כתובת:
                  </td>
                  <td
                    style={{
                      padding: "10px 0",
                      color: "#1e293b",
                      fontSize: "14px",
                      fontWeight: "600",
                    }}
                  >
                    {address}
                  </td>
                </tr>
                <tr>
                  <td
                    style={{
                      padding: "10px 0",
                      color: "#64748b",
                      fontSize: "14px",
                    }}
                  >
                    טלפון:
                  </td>
                  <td
                    style={{
                      padding: "10px 0",
                      color: "#1e293b",
                      fontSize: "14px",
                      fontWeight: "600",
                      direction: "ltr",
                      textAlign: "right",
                    }}
                  >
                    {phone}
                  </td>
                </tr>
                <tr>
                  <td
                    style={{
                      padding: "10px 0",
                      color: "#64748b",
                      fontSize: "14px",
                    }}
                  >
                    מייל:
                  </td>
                  <td
                    style={{
                      padding: "10px 0",
                      color: "#1e293b",
                      fontSize: "14px",
                      fontWeight: "600",
                      direction: "ltr",
                      textAlign: "right",
                    }}
                  >
                    {email}
                  </td>
                </tr>
                <tr>
                  <td
                    style={{
                      padding: "10px 0",
                      color: "#64748b",
                      fontSize: "14px",
                    }}
                  >
                    אמצעי תשלום:
                  </td>
                  <td
                    style={{
                      padding: "10px 0",
                      color: "#1e293b",
                      fontSize: "14px",
                      fontWeight: "600",
                    }}
                  >
                    כרטיס המסתיים ב-{last4Digits}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Subscription Details */}
          <div
            style={{
              backgroundColor: "#f0fdfa",
              border: "1px solid #99f6e4",
              borderRadius: "8px",
              padding: "24px",
              marginBottom: "24px",
            }}
          >
            <h2
              style={{
                color: "#0d7377",
                fontSize: "18px",
                fontWeight: "600",
                margin: "0 0 16px",
              }}
            >
              פרטי המנוי
            </h2>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
              }}
            >
              <tbody>
                <tr>
                  <td
                    style={{
                      padding: "8px 0",
                      color: "#64748b",
                      fontSize: "14px",
                      width: "40%",
                    }}
                  >
                    סוג מנוי:
                  </td>
                  <td
                    style={{
                      padding: "8px 0",
                      color: "#1e293b",
                      fontSize: "14px",
                      fontWeight: "600",
                    }}
                  >
                    {subscriptionType}
                  </td>
                </tr>
                <tr>
                  <td
                    style={{
                      padding: "8px 0",
                      color: "#64748b",
                      fontSize: "14px",
                    }}
                  >
                    שם כתב שירות:
                  </td>
                  <td
                    style={{
                      padding: "8px 0",
                      color: "#1e293b",
                      fontSize: "14px",
                      fontWeight: "600",
                    }}
                  >
                    רופא עד הבית
                  </td>
                </tr>
                <tr>
                  <td
                    style={{
                      padding: "12px 0",
                      color: "#0d7377",
                      fontSize: "16px",
                      fontWeight: "700",
                    }}
                  >
                    סה"כ תשלום חודשי:
                  </td>
                  <td
                    style={{
                      padding: "12px 0",
                      color: "#0d7377",
                      fontSize: "20px",
                      fontWeight: "700",
                    }}
                  >
                    {monthlyTotal}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Contact Info */}
          <div
            style={{
              textAlign: "center",
              padding: "20px",
              backgroundColor: "#f8fafc",
              borderRadius: "8px",
            }}
          >
            <p
              style={{
                color: "#64748b",
                fontSize: "14px",
                margin: "0 0 8px",
              }}
            >
              לשאלות ובירורים:
            </p>
            <p
              style={{
                color: "#1e293b",
                fontSize: "16px",
                fontWeight: "600",
                margin: "0",
              }}
            >
              054-4261369 | opal2000@zahav.net.il
            </p>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            backgroundColor: "#1e293b",
            padding: "24px",
            textAlign: "center",
          }}
        >
          <p
            style={{
              color: "#94a3b8",
              fontSize: "13px",
              margin: "0 0 8px",
              lineHeight: "1.6",
            }}
          >
            שים לב: החיוב החודשי של המנוי דרך חברת אופאל תקשורת בע"מ
          </p>
          <p
            style={{
              color: "#64748b",
              fontSize: "12px",
              margin: "0",
            }}
          >
            אופאל - בית ליזמות רפואית
          </p>
        </div>
      </div>
    </div>
  )
}
