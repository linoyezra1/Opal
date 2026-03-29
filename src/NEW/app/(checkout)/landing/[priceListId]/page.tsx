'use client'

import { use } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { CheckCircle, Phone, Mail, Clock, Heart, Shield, Star, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { LandingPageContent } from '@/lib/api'

// Opal Brand Colors
const OPAL_BLUE = '#1A365D'
const OPAL_GOLD = '#C5A059'

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
    <div className="min-h-screen">
      {/* Header with Logo */}
      <header 
        className="py-4 border-b"
        style={{ backgroundColor: OPAL_BLUE }}
      >
        <div className="container flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/images/opal-logo.jpeg"
              alt="אופאל - תקשורת שיווקית"
              width={180}
              height={60}
              className="h-12 w-auto bg-white rounded p-1"
            />
          </div>
          <a 
            href="tel:0544261369" 
            className="flex items-center gap-2 text-white/90 hover:text-white transition-colors"
          >
            <Phone className="size-4" />
            <span className="font-medium hidden sm:inline" dir="ltr">054-426-1369</span>
          </a>
        </div>
      </header>

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
          <div 
            className="absolute inset-0"
            style={{ 
              background: `linear-gradient(to top, white, ${OPAL_BLUE}33 50%, transparent)` 
            }}
          />
        </section>
      )}

      {/* Hero Section */}
      <section className={cn(
        "relative py-16 md:py-24 overflow-hidden",
        content.imageUrl ? "-mt-32 md:-mt-48 relative z-10" : ""
      )}>
        {!content.imageUrl && (
          <div 
            className="absolute inset-0"
            style={{ 
              background: `linear-gradient(to bottom, ${OPAL_BLUE}08, ${OPAL_BLUE}03, transparent)` 
            }}
          />
        )}
        
        <div className="container relative">
          <div className={cn(
            "max-w-3xl mx-auto text-center",
            content.imageUrl && "bg-white/95 backdrop-blur-sm rounded-2xl p-8 md:p-12 shadow-xl border"
          )}>
            <Badge 
              className="mb-4 inline-flex border-0"
              style={{ 
                backgroundColor: `${OPAL_GOLD}20`,
                color: OPAL_BLUE 
              }}
            >
              {content.subtitle}
            </Badge>
            <h1 
              className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6 text-balance leading-tight"
              style={{ color: OPAL_BLUE }}
            >
              {content.title}
            </h1>
            <p className="text-lg text-gray-600 mb-8 text-pretty leading-relaxed max-w-2xl mx-auto">
              {content.content}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                asChild
                className="border-0"
                style={{ backgroundColor: OPAL_GOLD, color: OPAL_BLUE }}
              >
                <a href="#plans">
                  הצטרף עכשיו
                  <ArrowLeft className="size-4 ms-2" />
                </a>
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                asChild
                style={{ borderColor: OPAL_BLUE, color: OPAL_BLUE }}
              >
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
      <section 
        className="py-12 border-y"
        style={{ backgroundColor: `${OPAL_BLUE}05` }}
      >
        <div className="container">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map((benefit) => (
              <div 
                key={benefit.title} 
                className="flex items-center gap-4 p-4 rounded-lg bg-white border shadow-sm"
              >
                <div 
                  className="flex size-12 shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: `${OPAL_GOLD}20` }}
                >
                  <benefit.icon className="size-6" style={{ color: OPAL_GOLD }} />
                </div>
                <div>
                  <h3 className="font-semibold" style={{ color: OPAL_BLUE }}>{benefit.title}</h3>
                  <p className="text-sm text-gray-500">{benefit.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-16 bg-white">
        <div className="container">
          <div className="text-center mb-12">
            <h2 
              className="text-3xl font-bold mb-4"
              style={{ color: OPAL_BLUE }}
            >
              מה כולל השירות?
            </h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              כל מה שאתם צריכים לבריאות המשפחה, במקום אחד
            </p>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2 max-w-3xl mx-auto">
            {servicesList.map((service, i) => (
              <div 
                key={i} 
                className="flex items-start gap-3 p-4 rounded-lg border bg-white hover:shadow-sm transition-shadow"
              >
                <CheckCircle 
                  className="size-5 shrink-0 mt-0.5" 
                  style={{ color: OPAL_GOLD }}
                />
                <span className="text-sm leading-relaxed text-gray-700">{service.trim()}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Plans Section */}
      <section 
        id="plans" 
        className="py-16"
        style={{ backgroundColor: `${OPAL_BLUE}05` }}
      >
        <div className="container">
          <div className="text-center mb-12">
            <h2 
              className="text-3xl font-bold mb-4"
              style={{ color: OPAL_BLUE }}
            >
              בחר את המסלול שלך
            </h2>
            <p className="text-gray-500">
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
                  "relative transition-all hover:shadow-lg bg-white",
                  product.popular && "shadow-lg scale-[1.02]"
                )}
                style={{ 
                  borderColor: product.popular ? OPAL_GOLD : undefined,
                  borderWidth: product.popular ? 2 : undefined
                }}
              >
                {product.popular && (
                  <Badge 
                    className="absolute -top-3 start-1/2 -translate-x-1/2 border-0"
                    style={{ backgroundColor: OPAL_GOLD, color: OPAL_BLUE }}
                  >
                    הכי פופולרי
                  </Badge>
                )}
                <CardHeader className="text-center pb-4">
                  <CardTitle 
                    className="text-xl"
                    style={{ color: OPAL_BLUE }}
                  >
                    {product.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 text-center">
                  <div>
                    <span 
                      className="text-4xl font-bold"
                      style={{ color: OPAL_BLUE }}
                    >
                      ₪{product.price}
                    </span>
                    <span className="text-gray-500">/חודש</span>
                  </div>

                  <Button 
                    className="w-full border-0" 
                    size="lg"
                    asChild
                    style={{ 
                      backgroundColor: product.popular ? OPAL_GOLD : OPAL_BLUE,
                      color: product.popular ? OPAL_BLUE : 'white'
                    }}
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
      <section 
        id="contact" 
        className="py-16 text-white"
        style={{ backgroundColor: OPAL_BLUE }}
      >
        <div className="container">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-4">צור קשר</h2>
            <p className="text-white/80 mb-8 text-lg">
              אופאל - בית ליזמות רפואית, המושתת על מקצועיות, מצוינות וחווית שירות פרטית.
            </p>
            
            <div className="grid gap-4 sm:grid-cols-2 max-w-md mx-auto">
              <a 
                href="tel:0544261369" 
                className="flex items-center justify-center gap-3 p-4 rounded-lg transition-colors"
                style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
              >
                <Phone className="size-5" />
                <span className="font-medium" dir="ltr">054-426-1369</span>
              </a>
              <a 
                href="mailto:opal2000@zahav.net.il" 
                className="flex items-center justify-center gap-3 p-4 rounded-lg transition-colors"
                style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
              >
                <Mail className="size-5" />
                <span className="font-medium text-sm" dir="ltr">opal2000@zahav.net.il</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer 
        className="py-6 border-t"
        style={{ backgroundColor: `${OPAL_BLUE}08` }}
      >
        <div className="container">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <Image
              src="/images/opal-logo.jpeg"
              alt="אופאל - תקשורת שיווקית"
              width={120}
              height={40}
              className="h-8 w-auto"
            />
            <p className="text-sm text-gray-500 text-center">
              כל הזכויות שמורות לאופאל תקשורת שיווקית בע״מ
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
