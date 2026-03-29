"use client"

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
  orderId = "12345",
  orderDate = "01/01/2026",
  primaryInsuredName = "ישראל ישראלי",
  primaryId = "123456789",
  beneficiaries = [
    { name: "שרה ישראלי", id: "987654321" },
    { name: "דוד ישראלי", id: "456789123" },
  ],
  subscriptionType = "רופא עד הבית - מנוי משפחתי",
  monthlyTotal = "₪99",
  medicalServicesPhone = "00-0000000",
  claimsLink = "#",
}: FinalSummaryEmailProps) {
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
            <span style={{ fontSize: "32px", color: "#ffffff" }}>&#128196;</span>
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
            סיכום הצטרפות ופרטי מנוי
          </h1>
          <p
            style={{
              color: "rgba(255, 255, 255, 0.9)",
              fontSize: "16px",
              margin: "0",
            }}
          >
            אופאל - רופא עד הבית
          </p>
        </div>

        {/* Content */}
        <div style={{ padding: "32px 24px" }}>
          {/* Order Info Bar */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              backgroundColor: "#f8fafc",
              borderRadius: "8px",
              padding: "16px 20px",
              marginBottom: "24px",
            }}
          >
            <div>
              <span style={{ color: "#64748b", fontSize: "13px" }}>מספר הזמנה</span>
              <p style={{ color: "#1e293b", fontSize: "16px", fontWeight: "600", margin: "4px 0 0" }}>
                {orderId}
              </p>
            </div>
            <div style={{ textAlign: "left" }}>
              <span style={{ color: "#64748b", fontSize: "13px" }}>תאריך</span>
              <p style={{ color: "#1e293b", fontSize: "16px", fontWeight: "600", margin: "4px 0 0" }}>
                {orderDate}
              </p>
            </div>
          </div>

          {/* Primary Insured */}
          <div
            style={{
              backgroundColor: "#f0fdfa",
              border: "2px solid #0d7377",
              borderRadius: "8px",
              padding: "20px",
              marginBottom: "24px",
            }}
          >
            <div
              style={{
                display: "inline-block",
                backgroundColor: "#0d7377",
                color: "#ffffff",
                fontSize: "12px",
                fontWeight: "600",
                padding: "4px 12px",
                borderRadius: "4px",
                marginBottom: "12px",
              }}
            >
              מבוטח ראשי
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ color: "#1e293b", fontSize: "18px", fontWeight: "700", margin: "0" }}>
                  {primaryInsuredName}
                </p>
              </div>
              <div style={{ textAlign: "left" }}>
                <span style={{ color: "#64748b", fontSize: "13px" }}>ת.ז: </span>
                <span
                  style={{
                    color: "#1e293b",
                    fontSize: "15px",
                    fontWeight: "600",
                    direction: "ltr",
                  }}
                >
                  {primaryId}
                </span>
              </div>
            </div>
          </div>

          {/* Beneficiaries */}
          {beneficiaries.length > 0 && (
            <div style={{ marginBottom: "24px" }}>
              <h2
                style={{
                  color: "#1e293b",
                  fontSize: "16px",
                  fontWeight: "600",
                  margin: "0 0 16px",
                  paddingBottom: "8px",
                  borderBottom: "1px solid #e2e8f0",
                }}
              >
                מוטבים נוספים
              </h2>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  backgroundColor: "#f8fafc",
                  borderRadius: "8px",
                  overflow: "hidden",
                }}
              >
                <thead>
                  <tr style={{ backgroundColor: "#e2e8f0" }}>
                    <th
                      style={{
                        padding: "12px 16px",
                        textAlign: "right",
                        color: "#64748b",
                        fontSize: "13px",
                        fontWeight: "600",
                      }}
                    >
                      שם מלא
                    </th>
                    <th
                      style={{
                        padding: "12px 16px",
                        textAlign: "left",
                        color: "#64748b",
                        fontSize: "13px",
                        fontWeight: "600",
                      }}
                    >
                      ת.ז
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {beneficiaries.map((beneficiary, index) => (
                    <tr
                      key={index}
                      style={{
                        borderBottom: index < beneficiaries.length - 1 ? "1px solid #e2e8f0" : "none",
                      }}
                    >
                      <td
                        style={{
                          padding: "14px 16px",
                          color: "#1e293b",
                          fontSize: "14px",
                          fontWeight: "500",
                        }}
                      >
                        {beneficiary.name}
                      </td>
                      <td
                        style={{
                          padding: "14px 16px",
                          color: "#1e293b",
                          fontSize: "14px",
                          fontWeight: "500",
                          direction: "ltr",
                          textAlign: "left",
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
              backgroundColor: "#fefce8",
              border: "1px solid #fde047",
              borderRadius: "8px",
              padding: "20px",
              marginBottom: "24px",
              textAlign: "center",
            }}
          >
            <p style={{ color: "#64748b", fontSize: "14px", margin: "0 0 4px" }}>סוג מנוי</p>
            <p style={{ color: "#1e293b", fontSize: "16px", fontWeight: "600", margin: "0 0 12px" }}>
              {subscriptionType}
            </p>
            <div
              style={{
                display: "inline-block",
                backgroundColor: "#0d7377",
                color: "#ffffff",
                fontSize: "20px",
                fontWeight: "700",
                padding: "12px 32px",
                borderRadius: "8px",
              }}
            >
              {monthlyTotal} לחודש
            </div>
          </div>

          {/* Medical Services */}
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
                fontSize: "16px",
                fontWeight: "600",
                margin: "0 0 16px",
                textAlign: "center",
              }}
            >
              פרטי נותן השירות
            </h2>
            <div style={{ textAlign: "center" }}>
              <p style={{ color: "#64748b", fontSize: "14px", margin: "0 0 8px" }}>
                טלפונים להזמנת שירותים רפואיים:
              </p>
              <a
                href={`tel:${medicalServicesPhone.replace(/-/g, "")}`}
                style={{
                  color: "#0d7377",
                  fontSize: "24px",
                  fontWeight: "700",
                  textDecoration: "none",
                  direction: "ltr",
                  display: "inline-block",
                }}
              >
                {medicalServicesPhone}
              </a>
            </div>
            <div
              style={{
                marginTop: "20px",
                paddingTop: "20px",
                borderTop: "1px solid #e2e8f0",
                textAlign: "center",
              }}
            >
              <a
                href={claimsLink}
                style={{
                  display: "inline-block",
                  backgroundColor: "#0d7377",
                  color: "#ffffff",
                  fontSize: "14px",
                  fontWeight: "600",
                  padding: "12px 24px",
                  borderRadius: "8px",
                  textDecoration: "none",
                }}
              >
                להגשת מסמכים רפואיים - תביעה און ליין
              </a>
            </div>
          </div>

          {/* Notice */}
          <div
            style={{
              backgroundColor: "#fef3c7",
              border: "1px solid #f59e0b",
              borderRadius: "8px",
              padding: "16px 20px",
            }}
          >
            <p
              style={{
                color: "#92400e",
                fontSize: "14px",
                fontWeight: "600",
                margin: "0 0 8px",
              }}
            >
              שים לב:
            </p>
            <p
              style={{
                color: "#92400e",
                fontSize: "13px",
                margin: "0",
                lineHeight: "1.6",
              }}
            >
              החיוב החודשי של המנוי דרך חברת אופאל תקשורת בע"מ.
              <br />
              לפניות ובירורים: 054-4261369 | דוא"ל: opal2000@zahav.net.il
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
              fontSize: "12px",
              margin: "0 0 8px",
              lineHeight: "1.6",
            }}
          >
            המנוי כפוף לכתב השירות ולגילוי נאות המצורפים למייל זה.
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
