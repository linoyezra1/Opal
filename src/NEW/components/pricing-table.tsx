"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Check } from "lucide-react"

interface PricingPlan {
  id: string
  name: string
  regularPrice: number | null
  organizationPrice: number | null
}

const pricingPlans: PricingPlan[] = [
  { id: "adult", name: "מנוי למבוגר", regularPrice: null, organizationPrice: null },
  { id: "spouse", name: "תוספת בן / בת זוג", regularPrice: 35, organizationPrice: null },
  { id: "child-independent", name: "מנוי ילד ללא תלות במבוגר", regularPrice: 35, organizationPrice: null },
  { id: "child-addition", name: "מנוי תוספת ילד כתוספת לבגיר", regularPrice: 14, organizationPrice: null },
  { id: "senior", name: "מנוי יחיד מעל גיל 65+", regularPrice: 56, organizationPrice: null },
  { id: "senior-couple", name: "מנוי לזוג מבוגרים מעל גיל 65", regularPrice: 79, organizationPrice: null }
]

interface PricingTableProps {
  selectedPlan?: string | null
  onSelectPlan?: (planId: string) => void
}

export function PricingTable({ selectedPlan, onSelectPlan }: PricingTableProps) {
  const handleSelect = (planId: string) => {
    if (onSelectPlan) {
      onSelectPlan(planId)
    } else {
      // Scroll to checkout form
      const checkoutSection = document.getElementById("contact")
      if (checkoutSection) {
        checkoutSection.scrollIntoView({ behavior: "smooth" })
      }
    }
  }

  return (
    <section id="pricing" className="bg-[#D9EAF3]/20 py-16 md:py-24">
      <div className="container mx-auto px-4">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-3xl font-bold text-foreground md:text-4xl">
            מחירון שירותים
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            בחרו את התוכנית המתאימה לכם
          </p>
        </div>

        {/* Desktop Table */}
        <Card className="mx-auto hidden max-w-4xl overflow-hidden border-border md:block">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#D9EAF3]/50 hover:bg-[#D9EAF3]/50">
                <TableHead className="text-right font-bold text-foreground">סוג מנוי</TableHead>
                <TableHead className="text-center font-bold text-foreground">מחיר רגיל</TableHead>
                <TableHead className="text-center font-bold text-foreground">מחיר במסגרת הסדר ארגון</TableHead>
                <TableHead className="w-[120px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pricingPlans.map((plan) => (
                <TableRow 
                  key={plan.id} 
                  className={`hover:bg-muted/50 ${selectedPlan === plan.id ? "bg-primary/10" : ""}`}
                >
                  <TableCell className="font-medium text-foreground">
                    {plan.name}
                  </TableCell>
                  <TableCell className="text-center text-foreground">
                    {plan.regularPrice !== null ? `${plan.regularPrice} ₪` : "₪"}
                  </TableCell>
                  <TableCell className="text-center font-semibold text-primary">
                    {plan.organizationPrice !== null ? `${plan.organizationPrice} ₪` : "-"}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant={selectedPlan === plan.id ? "default" : "outline"}
                      className={selectedPlan === plan.id 
                        ? "bg-primary text-primary-foreground" 
                        : "border-primary text-primary hover:bg-primary/10"
                      }
                      onClick={() => handleSelect(plan.id)}
                    >
                      {selectedPlan === plan.id ? (
                        <>
                          <Check className="ml-1 h-4 w-4" />
                          נבחר
                        </>
                      ) : (
                        "בחר"
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        {/* Mobile Cards */}
        <div className="grid gap-4 md:hidden">
          {pricingPlans.map((plan) => (
            <Card 
              key={plan.id} 
              className={`border-border ${selectedPlan === plan.id ? "border-2 border-primary bg-primary/5" : ""}`}
            >
              <CardContent className="p-4">
                <div className="mb-3 font-medium text-foreground">{plan.name}</div>
                <div className="mb-4 flex items-center justify-between text-sm">
                  <div>
                    <span className="text-muted-foreground">מחיר רגיל: </span>
                    <span className="font-medium text-foreground">
                      {plan.regularPrice !== null ? `${plan.regularPrice} ₪` : "₪"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">הסדר ארגון: </span>
                    <span className="font-semibold text-primary">
                      {plan.organizationPrice !== null ? `${plan.organizationPrice} ₪` : "-"}
                    </span>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={selectedPlan === plan.id ? "default" : "outline"}
                  className={`w-full ${selectedPlan === plan.id 
                    ? "bg-primary text-primary-foreground" 
                    : "border-primary text-primary hover:bg-primary/10"
                  }`}
                  onClick={() => handleSelect(plan.id)}
                >
                  {selectedPlan === plan.id ? (
                    <>
                      <Check className="ml-1 h-4 w-4" />
                      נבחר
                    </>
                  ) : (
                    "בחר תוכנית"
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">
            * כל המחירים הינם לחודש. ניתן לבטל בכל עת.
          </p>
        </div>
      </div>
    </section>
  )
}

// Export plans for use in checkout form
export { pricingPlans }
export type { PricingPlan }
