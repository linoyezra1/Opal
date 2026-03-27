'use client'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { 
  Phone, 
  Mail, 
  FileText, 
  CreditCard, 
  User, 
  Users, 
  Calendar,
  MapPin,
  Hash,
  AlertCircle,
  ExternalLink,
  Stethoscope,
  Shield
} from 'lucide-react'

export interface OrderEmailData {
  orderNumber: string
  numerator: string
  orderDate: string
  customerName: string
  customerId: string
  subscriptionStartDate: string
  address: string
  phone: string
  email: string
  lastFourDigits: string
  subscriptionType: string
  serviceDocumentName: string
  productName: string
  monthlyTotal: number
  transactionDescription: string
  primaryBeneficiary: {
    name: string
    idNumber: string
  }
  secondaryBeneficiaries: Array<{
    name: string
    idNumber: string
  }>
}

interface OrderConfirmationEmailProps {
  data: OrderEmailData
}

export function OrderConfirmationEmail({ data }: OrderConfirmationEmailProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/30 to-background p-4 md:p-8" dir="rtl">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center size-16 rounded-full bg-primary/10 mx-auto">
            <Stethoscope className="size-8 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">אישור הזמנה</h1>
            <p className="text-muted-foreground">תודה שבחרת באופאל - רופא עד הבית</p>
          </div>
        </div>

        {/* Order Info Card */}
        <Card className="border-primary/20 shadow-lg overflow-hidden">
          <CardHeader className="bg-primary/5 border-b border-primary/10 pb-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Hash className="size-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">מספר הזמנה</p>
                  <p className="font-bold text-lg">{data.orderNumber}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-muted flex items-center justify-center">
                  <Calendar className="size-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">תאריך הזמנה</p>
                  <p className="font-medium">{data.orderDate}</p>
                </div>
              </div>
              <Badge variant="secondary" className="text-xs">
                נומרטור: {data.numerator}
              </Badge>
            </div>
          </CardHeader>
          
          <CardContent className="p-0">
            {/* Customer Details */}
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-2 text-primary font-semibold">
                <User className="size-4" />
                <span>פרטי הלקוח</span>
              </div>
              
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">שם מלא</p>
                  <p className="font-medium">{data.customerName}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">תעודת זהות</p>
                  <p className="font-medium font-mono" dir="ltr">{data.customerId}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">תאריך תחילת מנוי</p>
                  <p className="font-medium">{data.subscriptionStartDate}</p>
                </div>
                <div className="space-y-1 flex items-start gap-2">
                  <MapPin className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">כתובת</p>
                    <p className="font-medium">{data.address}</p>
                  </div>
                </div>
                <div className="space-y-1 flex items-start gap-2">
                  <Phone className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">טלפון</p>
                    <p className="font-medium font-mono" dir="ltr">{data.phone}</p>
                  </div>
                </div>
                <div className="space-y-1 flex items-start gap-2">
                  <Mail className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">דוא"ל</p>
                    <p className="font-medium text-sm" dir="ltr">{data.email}</p>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border">
                <CreditCard className="size-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">4 ספרות אחרונות:</span>
                <span className="font-mono font-bold" dir="ltr">•••• {data.lastFourDigits}</span>
              </div>
            </div>

            <Separator />

            {/* Subscription Details */}
            <div className="p-6 space-y-4 bg-primary/[0.02]">
              <div className="flex items-center gap-2 text-primary font-semibold">
                <FileText className="size-4" />
                <span>פרטי המנוי</span>
              </div>
              
              <div className="grid gap-4">
                <div className="flex items-center justify-between p-4 rounded-xl bg-background border">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">סוג המנוי</p>
                    <p className="font-semibold text-lg">{data.subscriptionType}</p>
                  </div>
                  <div className="text-left">
                    <p className="text-xs text-muted-foreground">תשלום חודשי</p>
                    <p className="font-bold text-2xl text-primary">
                      {data.monthlyTotal.toLocaleString('he-IL')}
                      <span className="text-sm font-normal text-muted-foreground me-1">₪</span>
                    </p>
                  </div>
                </div>
                
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="p-3 rounded-lg bg-background border space-y-1">
                    <p className="text-xs text-muted-foreground">שם כתב השירות</p>
                    <p className="font-medium">{data.serviceDocumentName}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-background border space-y-1">
                    <p className="text-xs text-muted-foreground">שם המוצר</p>
                    <p className="font-medium">{data.productName}</p>
                  </div>
                </div>
                
                <div className="p-3 rounded-lg bg-background border space-y-1">
                  <p className="text-xs text-muted-foreground">תיאור העסקה</p>
                  <p className="text-sm">{data.transactionDescription}</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Beneficiaries */}
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-2 text-primary font-semibold">
                <Users className="size-4" />
                <span>פרטי המוטבים</span>
              </div>

              {/* Primary Beneficiary */}
              <div className="p-4 rounded-xl border-2 border-primary/30 bg-primary/5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="size-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                    1
                  </div>
                  <Badge className="bg-primary/20 text-primary hover:bg-primary/20 border-0">
                    מוטב ראשי
                  </Badge>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">שם מלא</p>
                    <p className="font-semibold text-lg">{data.primaryBeneficiary.name}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">תעודת זהות</p>
                    <p className="font-medium font-mono" dir="ltr">{data.primaryBeneficiary.idNumber}</p>
                  </div>
                </div>
              </div>

              {/* Secondary Beneficiaries */}
              {data.secondaryBeneficiaries.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground font-medium">מוטבים משניים</p>
                  <div className="grid gap-3">
                    {data.secondaryBeneficiaries.map((beneficiary, index) => (
                      <div 
                        key={index}
                        className="p-4 rounded-xl border bg-muted/30"
                      >
                        <div className="flex items-center gap-2 mb-3">
                          <div className="size-7 rounded-full bg-muted-foreground/20 text-muted-foreground flex items-center justify-center text-sm font-bold">
                            {index + 2}
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            מוטב משני
                          </Badge>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">שם מלא</p>
                            <p className="font-medium">{beneficiary.name}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">תעודת זהות</p>
                            <p className="font-medium font-mono" dir="ltr">{beneficiary.idNumber}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Service Provider Info */}
            <div className="p-6 space-y-4 bg-muted/30">
              <div className="flex items-center gap-2 text-primary font-semibold">
                <Shield className="size-4" />
                <span>פרטי נותן השירות</span>
              </div>
              
              <div className="grid gap-3">
                <a 
                  href="tel:00-0000000" 
                  className="flex items-center gap-3 p-4 rounded-xl bg-background border hover:border-primary/50 transition-colors"
                >
                  <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Phone className="size-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">טלפון להזמנת שירותים רפואיים</p>
                    <p className="font-bold text-lg" dir="ltr">00-0000000</p>
                  </div>
                </a>
                
                <a 
                  href="#" 
                  className="flex items-center justify-between p-4 rounded-xl bg-background border hover:border-primary/50 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-lg bg-accent/10 flex items-center justify-center">
                      <FileText className="size-5 text-accent" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">הגשת מסמכים רפואיים</p>
                      <p className="font-medium">תביעה און ליין</p>
                    </div>
                  </div>
                  <ExternalLink className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </a>
              </div>
            </div>

            {/* Notice */}
            <div className="p-6 space-y-4">
              <div className="p-4 rounded-xl border border-warning/30 bg-warning/5">
                <div className="flex gap-3">
                  <AlertCircle className="size-5 text-warning shrink-0 mt-0.5" />
                  <div className="space-y-2 text-sm">
                    <p className="font-semibold text-warning-foreground">שים לב</p>
                    <p className="text-muted-foreground">
                      החיוב החודשי של המנוי דרך חברת <strong>אופאל תקשורת בע"מ</strong>
                    </p>
                    <div className="flex flex-wrap gap-4 pt-2">
                      <a href="tel:054-4261369" className="flex items-center gap-1.5 text-primary hover:underline">
                        <Phone className="size-3.5" />
                        <span dir="ltr">054-4261369</span>
                      </a>
                      <a href="mailto:opal2000@zahav.net.il" className="flex items-center gap-1.5 text-primary hover:underline">
                        <Mail className="size-3.5" />
                        <span dir="ltr">opal2000@zahav.net.il</span>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center space-y-3 py-4">
          <p className="text-xs text-muted-foreground">
            המנוי כפוף לכתב השירות ולגילוי נאות
          </p>
          <div className="flex items-center justify-center gap-2">
            <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Stethoscope className="size-4 text-primary" />
            </div>
            <span className="font-semibold text-sm">אופאל - בית ליזמות רפואית</span>
          </div>
          <p className="text-xs text-muted-foreground">
            מקצועיות, מצוינות וחווית שירות פרטית
          </p>
        </div>
      </div>
    </div>
  )
}

// Preview component with sample data
export function OrderConfirmationEmailPreview() {
  const sampleData: OrderEmailData = {
    orderNumber: '10234',
    numerator: 'OPL-2024-10234',
    orderDate: '23/03/2026',
    customerName: 'ישראל ישראלי',
    customerId: '012345678',
    subscriptionStartDate: '01/04/2026',
    address: 'רחוב הרצל 15, תל אביב',
    phone: '054-1234567',
    email: 'israel@example.com',
    lastFourDigits: '4532',
    subscriptionType: 'משפחתי פרימיום',
    serviceDocumentName: 'כתב שירות רופא עד הבית',
    productName: 'רופא עד הבית 24/7',
    monthlyTotal: 149,
    transactionDescription: 'מנוי חודשי לשירות רופא עד הבית הכולל ביקור רופא, ייעוץ טלפוני 24/7 ומתן מרשמים',
    primaryBeneficiary: {
      name: 'ישראל ישראלי',
      idNumber: '012345678'
    },
    secondaryBeneficiaries: [
      { name: 'שרה ישראלי', idNumber: '012345679' },
      { name: 'דוד ישראלי', idNumber: '012345680' },
      { name: 'רחל ישראלי', idNumber: '012345681' }
    ]
  }

  return <OrderConfirmationEmail data={sampleData} />
}
