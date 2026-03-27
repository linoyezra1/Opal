import Link from 'next/link'
import { XCircle, ArrowRight, RefreshCw, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function CheckoutErrorPage() {
  return (
    <div className="container py-16 max-w-2xl text-center">
      {/* Error Icon */}
      <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-destructive/10">
        <XCircle className="size-10 text-destructive" />
      </div>

      {/* Message */}
      <h1 className="text-3xl font-bold mb-4">התשלום נכשל</h1>
      <p className="text-lg text-muted-foreground mb-8">
        אירעה שגיאה בעיבוד התשלום. אנא נסה שוב או פנה לתמיכה.
      </p>

      {/* Error Details */}
      <div className="bg-muted rounded-lg p-4 mb-8 text-start">
        <h2 className="font-semibold mb-2 text-sm">סיבות אפשריות:</h2>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>פרטי כרטיס האשראי שגויים</li>
          <li>אין מספיק יתרה בכרטיס</li>
          <li>הכרטיס חסום לעסקאות מקוונות</li>
          <li>בעיית תקשורת זמנית</li>
        </ul>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
        <Button variant="outline" asChild>
          <Link href="/">
            <ArrowRight className="size-4 me-2" />
            חזור לדף הבית
          </Link>
        </Button>
        <Button asChild>
          <Link href="/checkout">
            <RefreshCw className="size-4 me-2" />
            נסה שוב
          </Link>
        </Button>
      </div>

      {/* Support */}
      <div className="border-t pt-8">
        <h3 className="font-medium mb-2">צריך עזרה?</h3>
        <p className="text-sm text-muted-foreground mb-4">
          צוות התמיכה שלנו זמין 24/7
        </p>
        <Button variant="ghost" size="sm">
          <Phone className="size-4 me-2" />
          03-1234567
        </Button>
      </div>
    </div>
  )
}
