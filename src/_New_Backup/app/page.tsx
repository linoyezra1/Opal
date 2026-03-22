import Link from 'next/link'
import { 
  Gem, 
  ArrowLeft, 
  CheckCircle, 
  Shield, 
  Users, 
  LayoutDashboard,
  ShoppingCart,
  FileText,
  Building2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const features = [
  {
    icon: LayoutDashboard,
    title: 'לוח בקרה מתקדם',
    description: 'צפייה בנתונים עסקיים, סטטיסטיקות והכנסות בזמן אמת',
  },
  {
    icon: Users,
    title: 'ניהול סוכנים',
    description: 'הגדרת סוכנים, עמלות ופרטי בנק בממשק נוח',
  },
  {
    icon: Building2,
    title: 'ניהול ספקים',
    description: 'מעקב אחר ספקים, מוצרים ועלויות',
  },
  {
    icon: FileText,
    title: 'מחירונים גמישים',
    description: 'יצירת מחירונים מותאמים לארגונים שונים',
  },
  {
    icon: ShoppingCart,
    title: 'דפי נחיתה',
    description: 'דפי נחיתה אוטומטיים לכל מחירון עם תמיכה בתשלומים',
  },
  {
    icon: Shield,
    title: 'אבטחה מתקדמת',
    description: 'הרשאות משתמשים ואבטחת מידע ברמה הגבוהה ביותר',
  },
]

const demoLinks = [
  {
    title: 'פאנל ניהול',
    description: 'כניסה לממשק הניהול המלא',
    href: '/admin',
    variant: 'default' as const,
  },
  {
    title: 'דף נחיתה לדוגמה',
    description: 'צפייה בדף נחיתה למחירון',
    href: '/landing/1',
    variant: 'outline' as const,
  },
  {
    title: 'תהליך רכישה',
    description: 'חוויית הרשמה ותשלום',
    href: '/checkout',
    variant: 'outline' as const,
  },
]

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Gem className="size-4" />
            </div>
            <span className="font-semibold">Opal</span>
          </Link>
          <nav className="flex items-center gap-4">
            <Button variant="ghost" asChild>
              <Link href="/checkout">התחל עכשיו</Link>
            </Button>
            <Button asChild>
              <Link href="/admin">כניסת מנהלים</Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 md:py-32">
        <div className="container text-center">
          <Badge className="mb-6" variant="secondary">
            גרסה 2.0 - עיצוב חדש
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold mb-6 text-balance">
            מערכת ניהול מנויים וספקים
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10 text-pretty">
            פלטפורמה מקצועית לניהול מנויים, ספקים, סוכנים ומחירונים. 
            עם תמיכה מלאה בעברית וממשק RTL מותאם.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Button size="lg" asChild>
              <Link href="/admin">
                התחל לנהל
                <ArrowLeft className="size-4 ms-2" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/landing/1">
                צפה בדוגמה
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 bg-muted/30">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">כל מה שצריך במקום אחד</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              מערכת Opal מספקת את כל הכלים הדרושים לניהול עסק מנויים יעיל ומקצועי
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <Card key={feature.title} className="bg-card">
                <CardHeader>
                  <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-2">
                    <feature.icon className="size-5" />
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Demo Links */}
      <section className="py-16">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">התנסו במערכת</h2>
            <p className="text-muted-foreground">
              בחרו את החלק שברצונכם לראות
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3 max-w-4xl mx-auto">
            {demoLinks.map((link) => (
              <Card key={link.href} className="relative overflow-hidden group hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle>{link.title}</CardTitle>
                  <CardDescription>{link.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant={link.variant} className="w-full" asChild>
                    <Link href={link.href}>
                      פתח
                      <ArrowLeft className="size-4 ms-2" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Highlights */}
      <section className="py-16 bg-primary text-primary-foreground">
        <div className="container">
          <div className="grid gap-8 md:grid-cols-3 text-center">
            <div>
              <div className="text-4xl font-bold mb-2">RTL</div>
              <p className="text-primary-foreground/80">תמיכה מלאה בעברית</p>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">100%</div>
              <p className="text-primary-foreground/80">עיצוב מותאם למובייל</p>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">24/7</div>
              <p className="text-primary-foreground/80">פעילות רציפה</p>
            </div>
          </div>
        </div>
      </section>

      {/* Technical Details */}
      <section className="py-16">
        <div className="container max-w-3xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">שיפורים בגרסה זו</h2>
          </div>

          <div className="space-y-4">
            {[
              'עיצוב מחודש עם ערכת צבעים רפואית-טכנולוגית',
              'תמיכת RTL מלאה עם פונט Heebo לעברית',
              'ממשק ניהול עם סרגל צד מתקפל',
              'טבלאות נתונים עם סינון ומיון',
              'מודלים ליצירה ועריכה עם טאבים',
              'דיאלוגים לאישור מחיקה',
              'מצבי ריק מותאמים עם הנחיות לפעולה',
              'תגיות סטטוס עם חותמות זמן',
              'רמזי ביקורת (נוצר על ידי...)',
              'דפי נחיתה דינמיים לפי מחירון',
              'תהליך רכישה רב-שלבי',
              'דפי הצלחה ושגיאה מעוצבים',
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <CheckCircle className="size-5 text-success shrink-0" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Opal. מערכת ניהול מנויים וספקים.</p>
          <p className="mt-2">
            נבנה עם Next.js 16, shadcn/ui ו-Tailwind CSS
          </p>
        </div>
      </footer>
    </div>
  )
}
