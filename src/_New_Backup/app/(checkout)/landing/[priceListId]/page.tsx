'use client'

import { use } from 'react'
import Link from 'next/link'
import { CheckCircle, Shield, Heart, Star, Phone, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// Mock price list data - in real app, fetch from API
const mockPriceLists: Record<string, {
  name: string
  organizationName: string
  plans: Array<{
    id: string
    name: string
    description: string
    price: number
    features: string[]
    popular?: boolean
  }>
}> = {
  '1': {
    name: 'מחירון ארגון א',
    organizationName: 'חברת היי-טק בע"מ',
    plans: [
      {
        id: '1',
        name: 'ביטוח בריאות בסיסי',
        description: 'כיסוי בריאותי מקיף לכל המשפחה',
        price: 250,
        features: ['כיסוי אשפוז מלא', 'ניתוחים בחו"ל', 'תרופות מיוחדות'],
      },
      {
        id: '2',
        name: 'ביטוח חיים פרימיום',
        description: 'הגנה מקסימלית למשפחה שלך',
        price: 350,
        features: ['כיסוי מוות מכל סיבה', 'נכות מלאה', 'מחלות קשות', 'פיצוי חד פעמי'],
        popular: true,
      },
    ],
  },
  '2': {
    name: 'מחירון כללי',
    organizationName: 'לקוחות פרטיים',
    plans: [
      {
        id: '3',
        name: 'ביטוח סיעודי',
        description: 'ביטחון כלכלי לגיל הזהב',
        price: 300,
        features: ['קצבה חודשית', 'סיוע בבית', 'טיפול במוסד'],
      },
    ],
  },
}

const benefits = [
  {
    icon: Shield,
    title: 'הגנה מקסימלית',
    description: 'כיסוי מקיף ורחב לכל תרחיש',
  },
  {
    icon: Heart,
    title: 'שירות אישי',
    description: 'ליווי צמוד לאורך כל הדרך',
  },
  {
    icon: Star,
    title: 'מחירים הוגנים',
    description: 'תנאים מיוחדים לעובדי הארגון',
  },
]

export default function LandingPage({ 
  params 
}: { 
  params: Promise<{ priceListId: string }> 
}) {
  const { priceListId } = use(params)
  const priceList = mockPriceLists[priceListId]

  if (!priceList) {
    return (
      <div className="container py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">מחירון לא נמצא</h1>
        <p className="text-muted-foreground mb-8">
          המחירון המבוקש אינו קיים או שפג תוקפו
        </p>
        <Button asChild>
          <Link href="/">חזור לדף הבית</Link>
        </Button>
      </div>
    )
  }

  return (
    <div>
      {/* Hero Section */}
      <section className="bg-gradient-to-b from-primary/5 to-background py-16 md:py-24">
        <div className="container text-center">
          <Badge className="mb-4">{priceList.organizationName}</Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-6 text-balance">
            ביטוח שמגן על מה שחשוב לך
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8 text-pretty">
            הצטרף לאלפי מבוטחים מרוצים ותיהנה מכיסוי ביטוחי מקיף במחירים מיוחדים לעובדי הארגון
          </p>
          <Button size="lg" asChild>
            <a href="#plans">
              צפה בתוכניות
              <ArrowLeft className="size-4 ms-2" />
            </a>
          </Button>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-16 bg-muted/30">
        <div className="container">
          <div className="grid gap-8 md:grid-cols-3">
            {benefits.map((benefit) => (
              <div key={benefit.title} className="text-center">
                <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <benefit.icon className="size-6" />
                </div>
                <h3 className="font-semibold mb-2">{benefit.title}</h3>
                <p className="text-sm text-muted-foreground">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Plans */}
      <section id="plans" className="py-16">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">התוכניות שלנו</h2>
            <p className="text-muted-foreground">
              בחר את התוכנית המתאימה לצרכים שלך
            </p>
          </div>

          <div className={cn(
            "grid gap-8 max-w-4xl mx-auto",
            priceList.plans.length === 1 ? "md:grid-cols-1 max-w-md" : 
            priceList.plans.length === 2 ? "md:grid-cols-2" : 
            "md:grid-cols-3"
          )}>
            {priceList.plans.map((plan) => (
              <Card 
                key={plan.id} 
                className={cn(
                  "relative",
                  plan.popular && "border-primary shadow-lg"
                )}
              >
                {plan.popular && (
                  <Badge className="absolute -top-3 start-4">
                    הכי פופולרי
                  </Badge>
                )}
                <CardHeader>
                  <CardTitle>{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="text-3xl font-bold">
                    ₪{plan.price}
                    <span className="text-sm font-normal text-muted-foreground">/חודש</span>
                  </div>

                  <ul className="space-y-3">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <CheckCircle className="size-4 text-success shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <Button 
                    className="w-full" 
                    variant={plan.popular ? 'default' : 'outline'}
                    asChild
                  >
                    <Link href={`/checkout?plan=${plan.id}&priceList=${priceListId}`}>
                      בחר תוכנית
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-primary text-primary-foreground">
        <div className="container text-center">
          <h2 className="text-3xl font-bold mb-4">יש לך שאלות?</h2>
          <p className="text-primary-foreground/80 mb-8 max-w-xl mx-auto">
            הצוות שלנו זמין לענות על כל שאלה ולעזור לך לבחור את התוכנית המתאימה
          </p>
          <Button size="lg" variant="secondary">
            <Phone className="size-4 me-2" />
            דבר איתנו: 03-1234567
          </Button>
        </div>
      </section>
    </div>
  )
}
