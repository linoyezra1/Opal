import Link from 'next/link'
import { CheckCircle, Phone, Mail, ExternalLink, FileText, Users, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

export default function CheckoutSuccessPage() {
  return (
    <div className="container py-12 max-w-3xl">
      {/* Success Header */}
      <div className="text-center mb-8">
        <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-success/10">
          <CheckCircle className="size-10 text-success" />
        </div>
        <h1 className="text-3xl font-bold mb-3">שמחים על הצטרפותך למנוי רופא עד הבית</h1>
        <p className="text-lg text-muted-foreground">
          הזמנתך בצרוף כתב השרות ישלחו אליך בדקות הקרובות למייל
        </p>
      </div>

      {/* Important Notice - Beneficiaries */}
      <Alert className="mb-8 border-warning bg-warning/10">
        <AlertCircle className="size-5 text-warning" />
        <AlertTitle className="text-warning font-bold">חשוב מאד</AlertTitle>
        <AlertDescription className="mt-2">
          <p className="mb-3">בכדי להפעיל את השרות יש למלא את פרטי המוטבים בלינק המצורף.</p>
          <p className="font-semibold text-foreground">ללא קבלת פרטי המוטבים לא יהיה ניתן לקבל את השרות</p>
          <Button className="mt-4" asChild>
            <Link href="#">
              <Users className="size-4 me-2" />
              מילוי פרטי מוטבים
            </Link>
          </Button>
        </AlertDescription>
      </Alert>

      {/* Contact Cards */}
      <div className="grid gap-4 md:grid-cols-2 mb-8">
        {/* Medical Services Phone */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Phone className="size-5 text-primary" />
              הזמנת שרותים רפואיים
            </CardTitle>
          </CardHeader>
          <CardContent>
            <a 
              href="tel:00-00000" 
              className="text-2xl font-bold text-primary hover:underline"
              dir="ltr"
            >
              00-00000
            </a>
          </CardContent>
        </Card>

        {/* Medical Documents Link */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="size-5 text-primary" />
              הגשת מסמכים רפואיים
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild>
              <Link href="#">
                <ExternalLink className="size-4 me-2" />
                תביעה און ליין
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Sales Department */}
      <Card className="mb-8">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">מחלקת מכירות</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
          <a 
            href="tel:0544261369" 
            className="flex items-center gap-2 text-primary hover:underline"
          >
            <Phone className="size-4" />
            <span dir="ltr">054-426-1369</span>
          </a>
        </CardContent>
      </Card>

      {/* Important Billing Notice */}
      <Card className="border-primary/20 bg-primary/5 mb-8">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="size-5 text-primary shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold mb-2">שים לב</h3>
              <p className="text-sm text-muted-foreground mb-3">
                חיוב החודשי של המנוי דרך <span className="font-medium text-foreground">חברת אופאל תקשורת בע"מ</span>
              </p>
              <div className="text-sm space-y-1">
                <p className="flex items-center gap-2">
                  <Phone className="size-4 text-muted-foreground" />
                  <span>לפניות וברורים: </span>
                  <a href="tel:0544261369" className="text-primary hover:underline" dir="ltr">054-4261369</a>
                </p>
                <p className="flex items-center gap-2">
                  <Mail className="size-4 text-muted-foreground" />
                  <span>דואל: </span>
                  <a href="mailto:opal2000@zahav.net.il" className="text-primary hover:underline" dir="ltr">opal2000@zahav.net.il</a>
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Warm Message */}
      <div className="text-center p-8 bg-gradient-to-b from-primary/5 to-background rounded-xl border">
        <p className="text-lg font-medium text-primary mb-2">
          משהו חם הוא ענק
        </p>
        <p className="text-muted-foreground">
          מנוי של רופא עד הבית - כי הבריאות שלך חשובה לנו
        </p>
      </div>

      {/* Back to Home */}
      <div className="text-center mt-8">
        <Button variant="outline" asChild>
          <Link href="/">
            חזור לדף הבית
          </Link>
        </Button>
      </div>
    </div>
  )
}
