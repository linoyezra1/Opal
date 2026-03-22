import { Heart, Phone, Mail } from "lucide-react"

export function Footer() {
  return (
    <footer className="border-t border-border bg-[#D9EAF3]/20 py-12">
      <div className="container mx-auto px-4">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Heart className="h-5 w-5 text-primary" />
              </div>
              <span className="text-xl font-bold text-primary">OPAL</span>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Opal - בית ליזמות רפואית, מתמקדים במקצועיות וחוויית שירות פרטית.
            </p>
          </div>

          <div>
            <h3 className="mb-4 font-semibold text-foreground">קישורים מהירים</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#services" className="text-muted-foreground transition-colors hover:text-primary">
                  השירותים שלנו
                </a>
              </li>
              <li>
                <a href="#pricing" className="text-muted-foreground transition-colors hover:text-primary">
                  מחירון
                </a>
              </li>
              <li>
                <a href="#contact" className="text-muted-foreground transition-colors hover:text-primary">
                  הרשמה
                </a>
              </li>
              <li>
                <a href="#" className="text-muted-foreground transition-colors hover:text-primary">
                  תנאי שימוש
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-4 font-semibold text-foreground">צור קשר</h3>
            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-primary" />
                <a href="tel:0544281389" className="text-muted-foreground transition-colors hover:text-primary" dir="ltr">
                  054-428-1389
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                <a href="mailto:opal2000@zahav.net.il" className="text-muted-foreground transition-colors hover:text-primary" dir="ltr">
                  opal2000@zahav.net.il
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-border pt-8 text-center">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Opal Medical Services. כל הזכויות שמורות.
          </p>
        </div>
      </div>
    </footer>
  )
}
