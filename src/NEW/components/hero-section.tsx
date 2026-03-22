import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Stethoscope, Clock } from "lucide-react"

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#D9EAF3]/30 to-background py-16 md:py-24">
      <div className="container mx-auto px-4">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="space-y-6">
            <div className="inline-flex items-center rounded-full bg-[#D9EAF3] px-4 py-1.5 text-sm font-medium text-primary">
              <Clock className="ml-2 h-4 w-4" />
              זמין 24/7
            </div>
            <h1 className="text-balance text-4xl font-bold leading-tight text-foreground md:text-5xl lg:text-6xl">
              רופא פרטי עד הבית 24/7
              <span className="block text-primary">בפחות מ-1 ₪ ליום</span>
            </h1>
            <p className="text-pretty text-lg leading-relaxed text-muted-foreground md:text-xl">
              כשאתה צריך רופא, אתה צריך אותו עכשיו. בלי לחכות ימים בתסכול. 
              טיפול רפואי מקצועי עד פתח הדלת שלך - היום.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row">
              <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90">
                הצטרף עכשיו
              </Button>
              <Button size="lg" variant="outline" className="border-primary text-primary hover:bg-primary/10" asChild>
                <a href="#contact">למידע נוסף</a>
              </Button>
            </div>
            <div className="flex items-center gap-6 pt-4">
              <div className="flex items-center gap-2">
                <Stethoscope className="h-5 w-5 text-primary" />
                <span className="text-sm text-muted-foreground">רופאים מוסמכים</span>
              </div>
            </div>
          </div>
          <div className="relative hidden lg:block">
            <div className="relative aspect-square overflow-hidden rounded-2xl shadow-xl">
              <Image
                src="/images/doctor-home-visit.jpg"
                alt="רופא מודד לחץ דם לאישה מבוגרת בביתה"
                fill
                className="object-cover"
                priority
              />
            </div>
            <div className="absolute -bottom-4 -right-4 h-24 w-24 rounded-full bg-primary/10" />
            <div className="absolute -top-4 -left-4 h-16 w-16 rounded-full bg-[#D9EAF3]" />
          </div>
        </div>
      </div>
    </section>
  )
}
