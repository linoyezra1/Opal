import Link from 'next/link'
import { CheckCircle, ArrowRight, Download, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export default function CheckoutSuccessPage() {
  return (
    <div className="container py-16 max-w-2xl text-center">
      {/* Success Icon */}
      <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-success/10">
        <CheckCircle className="size-10 text-success" />
      </div>

      {/* Message */}
      <h1 className="text-3xl font-bold mb-4">ההרשמה הושלמה בהצלחה!</h1>
      <p className="text-lg text-muted-foreground mb-8">
        תודה על הצטרפותך. פרטי הביטוח נשלחו לכתובת האימייל שלך.
      </p>

      {/* Order Details Card */}
      <Card className="mb-8 text-start">
        <CardContent className="pt-6">
          <h2 className="font-semibold mb-4">פרטי ההזמנה</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">מספר הזמנה</dt>
              <dd className="font-mono">ORD-2024-001234</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">תאריך</dt>
              <dd>{new Date().toLocaleDateString('he-IL')}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">סטטוס</dt>
              <dd className="text-success font-medium">פעיל</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
        <Button variant="outline" asChild>
          <Link href="#">
            <Download className="size-4 me-2" />
            הורד אישור
          </Link>
        </Button>
        <Button asChild>
          <Link href="/">
            <ArrowRight className="size-4 me-2" />
            חזור לדף הבית
          </Link>
        </Button>
      </div>

      {/* Support */}
      <div className="border-t pt-8">
        <h3 className="font-medium mb-2">יש לך שאלות?</h3>
        <p className="text-sm text-muted-foreground mb-4">
          צוות התמיכה שלנו זמין לעזור
        </p>
        <Button variant="ghost" size="sm">
          <Phone className="size-4 me-2" />
          03-1234567
        </Button>
      </div>
    </div>
  )
}
