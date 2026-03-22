"use client"

import { useState } from "react"
import { Header } from "@/components/header"
import { HeroSection } from "@/components/hero-section"
import { ServicesGrid } from "@/components/services-grid"
import { PricingTable } from "@/components/pricing-table"
import { CheckoutForm } from "@/components/checkout-form"
import { Footer } from "@/components/footer"

export default function Home() {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)

  const handlePlanSelect = (planId: string) => {
    setSelectedPlan(planId)
    // Scroll to checkout form after selection
    setTimeout(() => {
      const checkoutSection = document.getElementById("contact")
      if (checkoutSection) {
        checkoutSection.scrollIntoView({ behavior: "smooth" })
      }
    }, 100)
  }

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <HeroSection />
      <ServicesGrid />
      <PricingTable selectedPlan={selectedPlan} onSelectPlan={handlePlanSelect} />
      <CheckoutForm selectedPlanId={selectedPlan} />
      <Footer />
    </main>
  )
}
