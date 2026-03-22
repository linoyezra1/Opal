import Image from "next/image"

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <a href="#" className="flex items-center gap-3">
          <Image 
            src="/images/opal-logo.jpg" 
            alt="OPAL - בית ליזמות רפואית" 
            width={120} 
            height={40}
            className="h-10 w-auto object-contain"
          />
          <span className="text-sm text-muted-foreground">בית ליזמות רפואית</span>
        </a>
        <nav className="hidden items-center gap-6 md:flex">
          <a href="#services" className="text-sm font-medium text-foreground transition-colors hover:text-primary">
            שירותים
          </a>
          <a href="#pricing" className="text-sm font-medium text-foreground transition-colors hover:text-primary">
            מחירים
          </a>
          <a href="#contact" className="text-sm font-medium text-foreground transition-colors hover:text-primary">
            צור קשר
          </a>
        </nav>
      </div>
    </header>
  )
}
