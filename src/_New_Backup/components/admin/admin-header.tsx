'use client'

import { usePathname } from 'next/navigation'
import { Bell, Search } from 'lucide-react'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Separator } from '@/components/ui/separator'

const pageTitles: Record<string, string> = {
  '/admin': 'לוח בקרה',
  '/admin/products': 'מוצרים',
  '/admin/vendors': 'ספקים',
  '/admin/agents': 'סוכנים',
  '/admin/price-lists': 'מחירונים',
  '/admin/subscribers': 'מנויים',
  '/admin/settings': 'הגדרות',
}

export function AdminHeader() {
  const pathname = usePathname()
  const currentPage = pageTitles[pathname] || 'לוח בקרה'
  const isSubPage = pathname !== '/admin' && pathname.startsWith('/admin/')

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <SidebarTrigger className="md:hidden" />
      
      <Breadcrumb className="hidden md:flex">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/admin">ראשי</BreadcrumbLink>
          </BreadcrumbItem>
          {isSubPage && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{currentPage}</BreadcrumbPage>
              </BreadcrumbItem>
            </>
          )}
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        <div className="relative hidden md:block">
          <Search className="absolute start-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="חיפוש..."
            className="w-64 ps-8"
          />
        </div>
        
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="size-4" />
          <span className="absolute -top-0.5 -start-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
            3
          </span>
          <span className="sr-only">התראות</span>
        </Button>
      </div>
    </header>
  )
}
