"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PostPaymentEmail } from "@/components/email/post-payment-email"
import { FinalSummaryEmail } from "@/components/email/final-summary-email"
import { AdminHeader } from "@/components/admin/admin-header"

export default function EmailsPreviewPage() {
  const [activeTab, setActiveTab] = useState("post-payment")

  return (
    <div className="flex flex-col min-h-screen">
      <AdminHeader title="תצוגה מקדימה - תבניות מייל" />

      <div className="flex-1 p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="post-payment">מייל לאחר תשלום</TabsTrigger>
            <TabsTrigger value="final-summary">מייל סיכום סופי</TabsTrigger>
          </TabsList>

          <TabsContent value="post-payment" className="mt-0">
            <div className="bg-muted rounded-lg overflow-hidden">
              <PostPaymentEmail
                orderId="ORD-2026-00123"
                orderDate="29/03/2026"
                customerName="ישראל ישראלי"
                customerId="123456789"
                startDate="01/04/2026"
                address="רחוב הרצל 15, תל אביב"
                phone="054-1234567"
                email="israel@example.com"
                last4Digits="4532"
                subscriptionType="רופא עד הבית - מנוי משפחתי"
                monthlyTotal="₪149"
                beneficiaryLink="https://opal.co.il/beneficiaries/abc123"
              />
            </div>
          </TabsContent>

          <TabsContent value="final-summary" className="mt-0">
            <div className="bg-muted rounded-lg overflow-hidden">
              <FinalSummaryEmail
                orderId="ORD-2026-00123"
                orderDate="29/03/2026"
                primaryInsuredName="ישראל ישראלי"
                primaryId="123456789"
                beneficiaries={[
                  { name: "שרה ישראלי", id: "987654321" },
                  { name: "דוד ישראלי", id: "456789123" },
                  { name: "מיכל ישראלי", id: "321654987" },
                ]}
                subscriptionType="רופא עד הבית - מנוי משפחתי"
                monthlyTotal="₪149"
                medicalServicesPhone="00-0000000"
                claimsLink="https://opal.co.il/claims"
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
