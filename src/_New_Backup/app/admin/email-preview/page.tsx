'use client'

import { OrderConfirmationEmailPreview } from '@/components/email/order-confirmation-email'
import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'

export default function EmailPreviewPage() {
  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="bg-background border-b sticky top-0 z-10">
        <div className="container py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin">
                <ArrowRight className="size-4 me-2" />
                חזרה לדשבורד
              </Link>
            </Button>
            <div className="h-6 w-px bg-border" />
            <h1 className="font-semibold">תצוגה מקדימה: מייל אישור הזמנה</h1>
          </div>
        </div>
      </div>

      {/* Email Preview */}
      <OrderConfirmationEmailPreview />
    </div>
  )
}
