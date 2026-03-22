'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Package,
  Building2,
  Users,
  Receipt,
  UserCheck,
  Settings,
  LogOut,
  ChevronLeft,
  Gem,
  FileText,
} from 'lucide-react'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const navigationItems = [
  {
    title: 'ניהול',
    items: [
      { label: 'לוח בקרה', href: '/admin', icon: LayoutDashboard },
      { label: 'מוצרים', href: '/admin/products', icon: Package },
      { label: 'ספקים', href: '/admin/vendors', icon: Building2 },
      { label: 'סוכנים', href: '/admin/agents', icon: Users },
      { label: 'מחירונים', href: '/admin/price-lists', icon: Receipt },
      { label: 'דפי נחיתה', href: '/admin/landing-pages', icon: FileText },
    ],
  },
  {
    title: 'דוחות',
    items: [
      { label: 'מנויים', href: '/admin/subscribers', icon: UserCheck },
    ],
  },
  {
    title: 'הגדרות',
    items: [
      { label: 'הגדרות מערכת', href: '/admin/settings', icon: Settings },
    ],
  },
]

export function AdminSidebar() {
  const pathname = usePathname()
  const { state } = useSidebar()

  return (
    <Sidebar side="right" collapsible="icon" className="border-s">
      <SidebarHeader className="border-b border-sidebar-border">
        <Link 
          href="/admin" 
          className={cn(
            "flex items-center gap-3 px-2 py-1.5 transition-all",
            state === 'collapsed' && "justify-center"
          )}
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Gem className="size-4" />
          </div>
          {state !== 'collapsed' && (
            <div className="flex flex-col">
              <span className="font-semibold text-foreground">Opal</span>
              <span className="text-xs text-muted-foreground">ניהול מנויים</span>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {navigationItems.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const isActive = pathname === item.href || 
                    (item.href !== '/admin' && pathname.startsWith(item.href))
                  
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={item.label}
                      >
                        <Link href={item.href}>
                          <item.icon className="size-4" />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="התנתק" className="text-destructive hover:text-destructive">
              <LogOut className="size-4" />
              <span>התנתק</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}

export function SidebarCollapseButton() {
  const { toggleSidebar, state } = useSidebar()
  
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-8"
      onClick={toggleSidebar}
    >
      <ChevronLeft className={cn(
        "size-4 transition-transform",
        state === 'collapsed' && "rotate-180"
      )} />
      <span className="sr-only">Toggle Sidebar</span>
    </Button>
  )
}
