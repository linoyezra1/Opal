"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CreditCard, Users, Minus, Plus, AlertCircle } from "lucide-react"
import { pricingPlans, type PricingPlan } from "./pricing-table"

const CHILD_ADDITION_PRICE = 10

interface CheckoutFormProps {
  selectedPlanId?: string | null
  onPlanChange?: (planId: string) => void
}

export function CheckoutForm({ selectedPlanId, onPlanChange }: CheckoutFormProps) {
  const [formData, setFormData] = useState({
    fullName: "",
    idNumber: "",
    phone: "",
    email: "",
    agentName: "",
    organizationName: "",
    additionalBeneficiaries: 0,
    agreedToTerms: false
  })

  const selectedPlan = useMemo(() => {
    return pricingPlans.find(p => p.id === selectedPlanId) || null
  }, [selectedPlanId])

  const totalPrice = useMemo(() => {
    if (!selectedPlan) return 0
    const basePrice = selectedPlan.regularPrice || 0
    return basePrice + (formData.additionalBeneficiaries * CHILD_ADDITION_PRICE)
  }, [selectedPlan, formData.additionalBeneficiaries])

  const handleInputChange = (field: string, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleBeneficiaryChange = (increment: boolean) => {
    setFormData(prev => ({
      ...prev,
      additionalBeneficiaries: increment 
        ? Math.min(prev.additionalBeneficiaries + 1, 5)
        : Math.max(prev.additionalBeneficiaries - 1, 0)
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log("Form submitted:", { ...formData, selectedPlan })
  }

  return (
    <section id="contact" className="py-16 md:py-24">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-2xl">
          <div className="mb-8 text-center">
            <h2 className="mb-4 text-3xl font-bold text-foreground md:text-4xl">
              הרשמה לשירות
            </h2>
            <p className="text-lg text-muted-foreground">
              מלאו את הפרטים והצטרפו למשפחת Opal
            </p>
          </div>

          <Card className="border-border shadow-lg">
            <CardHeader className="border-b border-border bg-[#D9EAF3]/30">
              <CardTitle className="flex items-center gap-2 text-xl text-foreground">
                <CreditCard className="h-5 w-5 text-primary" />
                טופס הרשמה
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Selected Plan Display */}
                {selectedPlan ? (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">תוכנית נבחרת:</p>
                        <p className="font-semibold text-foreground">{selectedPlan.name}</p>
                      </div>
                      <div className="text-left">
                        <p className="text-2xl font-bold text-primary">
                          {selectedPlan.regularPrice !== null ? `${selectedPlan.regularPrice} ₪` : "₪"}
                        </p>
                        <p className="text-xs text-muted-foreground">לחודש</p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="link"
                      className="mt-2 h-auto p-0 text-sm text-primary"
                      onClick={() => {
                        const pricingSection = document.getElementById("pricing")
                        if (pricingSection) {
                          pricingSection.scrollIntoView({ behavior: "smooth" })
                        }
                      }}
                    >
                      שנה תוכנית
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
                    <div>
                      <p className="font-medium text-amber-800">לא נבחרה תוכנית</p>
                      <Button
                        type="button"
                        variant="link"
                        className="h-auto p-0 text-sm text-amber-700 underline"
                        onClick={() => {
                          const pricingSection = document.getElementById("pricing")
                          if (pricingSection) {
                            pricingSection.scrollIntoView({ behavior: "smooth" })
                          }
                        }}
                      >
                        בחרו תוכנית מהמחירון למעלה
                      </Button>
                    </div>
                  </div>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="fullName" className="text-foreground">שם מלא</Label>
                    <Input
                      id="fullName"
                      placeholder="הזן שם מלא"
                      value={formData.fullName}
                      onChange={(e) => handleInputChange("fullName", e.target.value)}
                      className="border-input bg-background text-foreground"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="idNumber" className="text-foreground">תעודת זהות</Label>
                    <Input
                      id="idNumber"
                      placeholder="הזן מספר ת.ז"
                      value={formData.idNumber}
                      onChange={(e) => handleInputChange("idNumber", e.target.value)}
                      className="border-input bg-background text-foreground"
                      required
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-foreground">טלפון</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="הזן מספר טלפון"
                      value={formData.phone}
                      onChange={(e) => handleInputChange("phone", e.target.value)}
                      className="border-input bg-background text-foreground"
                      dir="ltr"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-foreground">דוא״ל</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="הזן כתובת דוא״ל"
                      value={formData.email}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                      className="border-input bg-background text-foreground"
                      dir="ltr"
                      required
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="agentName" className="text-foreground">שם סוכן</Label>
                    <Input
                      id="agentName"
                      placeholder="הזן שם סוכן"
                      value={formData.agentName}
                      onChange={(e) => handleInputChange("agentName", e.target.value)}
                      className="border-input bg-background text-foreground"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="organizationName" className="text-foreground">שם ארגון</Label>
                    <Input
                      id="organizationName"
                      placeholder="הזן שם ארגון"
                      value={formData.organizationName}
                      onChange={(e) => handleInputChange("organizationName", e.target.value)}
                      className="border-input bg-background text-foreground"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-foreground">מוטבים נוספים</Label>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center rounded-lg border border-input bg-background">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 rounded-l-none text-foreground"
                        onClick={() => handleBeneficiaryChange(false)}
                        disabled={formData.additionalBeneficiaries === 0}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-12 text-center font-medium text-foreground">
                        {formData.additionalBeneficiaries}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 rounded-r-none text-foreground"
                        onClick={() => handleBeneficiaryChange(true)}
                        disabled={formData.additionalBeneficiaries === 5}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span>עד 5 מוטבים נוספים</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Checkbox
                    id="terms"
                    checked={formData.agreedToTerms}
                    onCheckedChange={(checked) => handleInputChange("agreedToTerms", checked as boolean)}
                    className="mt-1"
                  />
                  <Label htmlFor="terms" className="text-sm leading-relaxed text-muted-foreground">
                    אני מסכים/ה ל
                    <a href="#" className="text-primary underline hover:no-underline">
                      תנאי השירות
                    </a>
                    {" "}ומאשר/ת את קבלת השירות הרפואי
                  </Label>
                </div>

                <div className="rounded-lg border border-primary/20 bg-[#D9EAF3]/30 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-medium text-foreground">סה״כ לתשלום חודשי:</span>
                    <span className="text-3xl font-bold text-primary">₪{totalPrice}</span>
                  </div>
                  {selectedPlan && formData.additionalBeneficiaries > 0 && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {selectedPlan.name} ({selectedPlan.regularPrice !== null ? `₪${selectedPlan.regularPrice}` : "₪"}) + {formData.additionalBeneficiaries} מוטבים נוספים (₪{formData.additionalBeneficiaries * CHILD_ADDITION_PRICE})
                    </p>
                  )}
                </div>

                <Button 
                  type="submit" 
                  size="lg" 
                  className="w-full bg-primary text-lg text-primary-foreground hover:bg-primary/90"
                  disabled={!formData.agreedToTerms || !selectedPlan}
                >
                  המשך לתשלום
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  )
}
