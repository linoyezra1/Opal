'use client'

import { use } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { CheckCircle, Phone, Mail, Clock, Heart, Shield, Star, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { LandingPageContent } from '@/lib/api'

// Default landing page content template
const defaultLandingContent: LandingPageContent = {
  title: 'מנוי רופא פרטי עד הבית 24/7 בפחות משקל ליום',
  subtitle: 'יעוץ טלפוני בתחום רפואת המשפחה',
  content: `כשאתה צריך רופא, אתה צריך אותו עכשיו. במקום להמתין ימים ארוכים בתסכול, אצלנו תקבל ביטחון וטיפול מקצועי ומנוסה אצלך בבית עוד היום.. ללא עיכובים מיותרים`,
  subContent: `מוקד שרות רפואי 24/7
יעוץ רפואי טלפוני
מתן תעודה רפואית
הפניה להמשך טיפול אצל רופא מומחה
בדיקה גופנית וקבלת הבחנה רפואית
מתן מרשמים ותרופות
זריקת וולטרן, פרמין ועוד
קבלת אנמנזה רפואית
מתן הפנייה במקרה הצורך לחדר מיון (טופס 17)
בתום הייעוץ יישלח למנוי סיכום הייעוץ הרפואי`,
  imageUrl: '',
}

// Mock price list data - in real app, fetch from API
const mockPriceLists: Record<string, {
  name: string
  organizationName: string
  landingPageContent?: LandingPageContent
  products: Array<{
    id: string
    name: string
    price: number
    popular?: boolean
  }>
}> = {
  '1': {
    name: 'מחירון ארגון א',
    organizationName: 'חברת היי-טק בע"מ',
    landingPageContent: { ...defaultLandingContent },
    products: [
      {
        id: '1',
        name: 'מנוי בסיסי - יעוץ טלפוני',
        price: 49,
      },
      {
        id: '2',
        name: 'מנוי פרימיום - ביקור בית',
        price: 99,
        popular: true,
      },
      {
        id: '3',
        name: 'מנוי משפחתי - עד 5 נפשות',
        price: 149,
      },
    ],
  },
  '2': {
    name: 'מחירון כללי',
    organizationName: 'לקוחות פרטיים',
    landingPageContent: { ...defaultLandingContent },
    products: [
      {
        id: '3',
        name: 'מנוי יחיד',
        price: 59,
      },
      {
        id: '4',
        name: 'מנוי זוגי',
        price: 89,
        popular: true,
      },
    ],
  },
}

const benefits = [
  {
    icon: Clock,
    title: 'זמינות 24/7',
    description: 'שירות רפואי בכל שעה, כל יום',
  },
  {
    icon: Heart,
    title: 'טיפול אישי',
    description: 'רופאים מנוסים עד הבית',
  },
  {
    icon: Shield,
    title: 'מקצועיות',
    description: 'צוות רפואי מוסמך ואמין',
  },
  {
    icon: Star,
    title: 'מחיר הוגן',
    description: 'פחות משקל ליום',
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

  const content = priceList.landingPageContent || defaultLandingContent
  const servicesList = content.subContent.split('\n').filter(line => line.trim())

  return (
    <div>
      {/* Hero Image (Full Width when exists) */}
      {content.imageUrl && (
        <section className="relative h-[300px] md:h-[400px] w-full">
          <Image
            src={content.imageUrl}
            alt="שירות רפואי"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        </section>
      )}

      {/* Hero Section */}
      <section className={cn(
        "relative py-16 md:py-24 overflow-hidden",
        content.imageUrl ? "-mt-32 md:-mt-48 relative z-10" : "bg-gradient-to-b from-primary/5 via-primary/3 to-background"
      )}>
        {!content.imageUrl && (
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
        )}
        
        <div className="container relative">
          <div className={cn(
            "max-w-3xl mx-auto text-center",
            content.imageUrl && "bg-background/95 backdrop-blur-sm rounded-2xl p-8 md:p-12 shadow-xl border"
          )}>
            <Badge className="mb-4 inline-flex">{content.subtitle}</Badge>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6 text-balance leading-tight">
              {content.title}
            </h1>
            <p className="text-lg text-muted-foreground mb-8 text-pretty leading-relaxed max-w-2xl mx-auto">
              {content.content}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" asChild>
                <a href="#plans">
                  הצטרף עכשיו
                  <ArrowLeft className="size-4 ms-2" />
                </a>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="#contact">
                  <Phone className="size-4 me-2" />
                  צור קשר
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-12 bg-muted/30 border-y">
        <div className="container">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map((benefit) => (
              <div key={benefit.title} className="flex items-center gap-4 p-4 rounded-lg bg-background border">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <benefit.icon className="size-6" />
                </div>
                <div>
                  <h3 className="font-semibold">{benefit.title}</h3>
                  <p className="text-sm text-muted-foreground">{benefit.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-16">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">מה כולל השירות?</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              כל מה שאתם צריכים לבריאות המשפחה, במקום אחד
            </p>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2 max-w-3xl mx-auto">
            {servicesList.map((service, i) => (
              <div 
                key={i} 
                className="flex items-start gap-3 p-4 rounded-lg border bg-card hover:shadow-sm transition-shadow"
              >
                <CheckCircle className="size-5 text-success shrink-0 mt-0.5" />
                <span className="text-sm leading-relaxed">{service.trim()}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Plans Section */}
      <section id="plans" className="py-16 bg-muted/30">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">בחר את המסלול שלך</h2>
            <p className="text-muted-foreground">
              מחירים מיוחדים לעובדי {priceList.organizationName}
            </p>
          </div>

          <div className={cn(
            "grid gap-6 max-w-4xl mx-auto",
            priceList.products.length === 1 ? "md:grid-cols-1 max-w-md" : 
            priceList.products.length === 2 ? "md:grid-cols-2" : 
            "md:grid-cols-3"
          )}>
            {priceList.products.map((product) => (
              <Card 
                key={product.id} 
                className={cn(
                  "relative transition-all hover:shadow-lg",
                  product.popular && "border-primary shadow-lg scale-[1.02]"
                )}
              >
                {product.popular && (
                  <Badge className="absolute -top-3 start-1/2 -translate-x-1/2">
                    הכי פופולרי
                  </Badge>
                )}
                <CardHeader className="text-center pb-4">
                  <CardTitle className="text-xl">{product.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 text-center">
                  <div>
                    <span className="text-4xl font-bold">₪{product.price}</span>
                    <span className="text-muted-foreground">/חודש</span>
                  </div>

                  <Button 
                    className="w-full" 
                    size="lg"
                    variant={product.popular ? 'default' : 'outline'}
                    asChild
                  >
                    <Link href={`/checkout?plan=${product.id}&priceList=${priceListId}`}>
                      הצטרף עכשיו
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-16 bg-primary text-primary-foreground">
        <div className="container">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-4">צור קשר</h2>
            <p className="text-primary-foreground/90 mb-8 text-lg">
              אופאל - בית ליזמות רפואית, המושתת על מקצועיות, מצוינות וחווית שירות פרטית.
            </p>
            
            <div className="grid gap-4 sm:grid-cols-2 max-w-md mx-auto">
              <a 
                href="tel:0544261369" 
                className="flex items-center justify-center gap-3 p-4 rounded-lg bg-primary-foreground/10 hover:bg-primary-foreground/20 transition-colors"
              >
                <Phone className="size-5" />
                <span className="font-medium" dir="ltr">054-426-1369</span>
              </a>
              <a 
                href="mailto:opal2000@zahav.net.il" 
                className="flex items-center justify-center gap-3 p-4 rounded-lg bg-primary-foreground/10 hover:bg-primary-foreground/20 transition-colors"
              >
                <Mail className="size-5" />
                <span className="font-medium text-sm" dir="ltr">opal2000@zahav.net.il</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t bg-muted/30">
        <div className="container text-center">
          <p className="text-sm text-muted-foreground">
            כל הזכויות שמורות לאופאל - בית ליזמות רפואית
          </p>
        </div>
      </footer>
    </div>
  )
}
