import React from 'react';
import { Card, CardContent, CardHeader } from '../ui/card.jsx';
import { Badge } from '../ui/badge.jsx';
import { Phone, Mail, FileText, CreditCard, User, Users, Calendar, MapPin, Hash, Stethoscope } from 'lucide-react';

export function OrderConfirmationEmail({ data }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/30 to-background p-4 md:p-8" dir="rtl">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center size-16 rounded-full bg-primary/10 mx-auto">
            <Stethoscope className="size-8 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">אישור הזמנה</h1>
            <p className="text-muted-foreground">תודה שבחרת באופאל - רופא עד הבית</p>
          </div>
        </div>

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
              <Badge variant="secondary" className="text-xs">אישור אוטומטי</Badge>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-2 text-primary font-semibold">
                <User className="size-4" />
                <span>פרטי הלקוח</span>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div><p className="text-xs text-muted-foreground">שם מלא</p><p className="font-medium">{data.customerName}</p></div>
                <div><p className="text-xs text-muted-foreground">תעודת זהות</p><p className="font-medium font-mono" dir="ltr">{data.customerId}</p></div>
                <div className="flex gap-2"><Phone className="size-4 text-muted-foreground mt-0.5" /><div><p className="text-xs text-muted-foreground">טלפון</p><p className="font-medium font-mono" dir="ltr">{data.phone}</p></div></div>
                <div className="flex gap-2"><Mail className="size-4 text-muted-foreground mt-0.5" /><div><p className="text-xs text-muted-foreground">דוא"ל</p><p className="font-medium text-sm" dir="ltr">{data.email}</p></div></div>
                <div className="md:col-span-2 flex gap-2"><MapPin className="size-4 text-muted-foreground mt-0.5" /><div><p className="text-xs text-muted-foreground">כתובת</p><p className="font-medium">{data.address}</p></div></div>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border">
                <CreditCard className="size-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">4 ספרות אחרונות:</span>
                <span className="font-mono font-bold" dir="ltr">•••• {data.lastFourDigits}</span>
              </div>
            </div>
            <div className="border-t border-border" />
            <div className="p-6 space-y-4 bg-primary/[0.02]">
              <div className="flex items-center gap-2 text-primary font-semibold">
                <FileText className="size-4" />
                <span>פרטי המנוי</span>
              </div>
              <div className="flex items-center justify-between p-4 rounded-xl bg-background border">
                <div><p className="text-xs text-muted-foreground">סוג מנוי</p><p className="font-semibold text-lg">{data.subscriptionType}</p></div>
                <div className="text-left"><p className="text-xs text-muted-foreground">תשלום חודשי</p><p className="font-bold text-2xl text-primary">₪{Number(data.monthlyTotal || 0).toLocaleString('he-IL')}</p></div>
              </div>
            </div>
            <div className="border-t border-border" />
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-2 text-primary font-semibold"><Users className="size-4" /><span>פרטי מוטבים</span></div>
              <div className="p-4 rounded-xl border-2 border-primary/30 bg-primary/5">
                <p className="text-xs text-muted-foreground">מוטב ראשי</p>
                <p className="font-semibold text-lg">{data.primaryBeneficiary.name}</p>
                <p className="font-mono" dir="ltr">{data.primaryBeneficiary.idNumber}</p>
              </div>
              {Array.isArray(data.secondaryBeneficiaries) && data.secondaryBeneficiaries.length > 0 ? (
                <div className="grid gap-3">
                  {data.secondaryBeneficiaries.map((b, i) => (
                    <div key={`${b.idNumber || i}`} className="p-4 rounded-xl border bg-muted/30">
                      <p className="text-xs text-muted-foreground">מוטב משני {i + 1}</p>
                      <p className="font-medium">{b.name}</p>
                      <p className="font-mono text-sm" dir="ltr">{b.idNumber}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function OrderConfirmationEmailPreview() {
  const sample = {
    orderNumber: '10234',
    orderDate: '23/03/2026',
    customerName: 'ישראל ישראלי',
    customerId: '012345678',
    address: 'רחוב הרצל 15, תל אביב',
    phone: '054-1234567',
    email: 'israel@example.com',
    lastFourDigits: '4532',
    subscriptionType: 'משפחתי פרימיום',
    monthlyTotal: 149,
    primaryBeneficiary: { name: 'ישראל ישראלי', idNumber: '012345678' },
    secondaryBeneficiaries: [
      { name: 'שרה ישראלי', idNumber: '012345679' },
      { name: 'דוד ישראלי', idNumber: '012345680' },
    ],
  };
  return <OrderConfirmationEmail data={sample} />;
}

