import { Card, CardContent } from "@/components/ui/card"
import { 
  Phone, 
  Users, 
  Pill, 
  Stethoscope, 
  Syringe, 
  FileText 
} from "lucide-react"

const services = [
  {
    icon: Phone,
    title: "ייעוץ רפואי טלפוני 24/7",
    description: "שיחה עם רופא מוסמך בכל שעה ביום ובלילה"
  },
  {
    icon: Users,
    title: "הפניות לרופאים מומחים",
    description: "גישה מהירה לרופאים מומחים בכל התחומים"
  },
  {
    icon: Pill,
    title: "מרשמים ותרופות",
    description: "קבלת מרשמים לתרופות ללא צורך בהמתנה"
  },
  {
    icon: Stethoscope,
    title: "בדיקה גופנית ואבחון",
    description: "בדיקה רפואית מקיפה בנוחות הבית שלך"
  },
  {
    icon: Syringe,
    title: "זריקות (וולטרן, פרמין)",
    description: "מתן זריקות על ידי צוות רפואי מקצועי"
  },
  {
    icon: FileText,
    title: "הפניות לחדר מיון (טופס 17)",
    description: "הנפקת טופס 17 להפניה לחדר מיון במידת הצורך"
  }
]

export function ServicesGrid() {
  return (
    <section id="services" className="py-16 md:py-24">
      <div className="container mx-auto px-4">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-3xl font-bold text-foreground md:text-4xl">
            מה אתם מקבלים?
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            חבילת שירותים רפואיים מקיפה לכל המשפחה
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service, index) => (
            <Card 
              key={index} 
              className="group border-border bg-card transition-all duration-300 hover:border-primary/30 hover:shadow-lg"
            >
              <CardContent className="p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#D9EAF3] transition-colors group-hover:bg-primary/20">
                  <service.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-card-foreground">
                  {service.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {service.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
