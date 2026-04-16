'use client'

import { Users, Package, Receipt, TrendingUp, Building2, UserCheck, Bell, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { StatsCard } from '@/components/admin/stats-card'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RevenueChart } from '@/components/admin/charts/revenue-chart'
import { CancellationChart } from '@/components/admin/charts/cancellation-chart'

// Mock data - replace with actual API calls
const stats = {
  totalRevenue: 125400,
  totalNetProfit: 42300,
  activeSubscribers: 1247,
  newDealsThisMonth: 89,
}

const quickActions = [
  { label: 'הוסף מוצר', href: '/admin/products', icon: Package },
  { label: 'הוסף ספק', href: '/admin/vendors', icon: Building2 },
  { label: 'הוסף סוכן', href: '/admin/agents', icon: Users },
  { label: 'צור מחירון', href: '/admin/price-lists', icon: Receipt },
]

const recentActivity = [
  { id: 1, action: 'מנוי חדש נרשם', entity: 'ישראל ישראלי', time: 'לפני 5 דקות' },
  { id: 2, action: 'מחירון עודכן', entity: 'מחירון ארגון א', time: 'לפני 15 דקות' },
  { id: 3, action: 'סוכן נוסף', entity: 'דוד כהן', time: 'לפני שעה' },
  { id: 4, action: 'מוצר חדש', entity: 'ביטוח בריאות פרימיום', time: 'לפני 2 שעות' },
]

const alerts = [
  { id: 1, type: 'warning', message: '5 מנויים לא השלימו פרטי מוטבים', link: '/admin/alerts' },
  { id: 2, type: 'error', message: '2 עסקאות עם פיגור בתשלום', link: '/admin/alerts' },
  { id: 3, type: 'info', message: '3 פניות חדשות ממתינות לטיפול', link: '/admin/contacts' },
]

export default function AdminDashboard() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">לוח בקרה</h1>
          <p className="text-muted-foreground">סקירה כללית של פעילות המערכת</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin/alerts">
            <Bell className="size-4 me-2" />
            התראות
            <Badge variant="destructive" className="ms-2 size-5 p-0 flex items-center justify-center text-xs">
              {alerts.length}
            </Badge>
          </Link>
        </Button>
      </div>

      {/* Alerts Banner */}
      {alerts.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-amber-800">יש פריטים הדורשים תשומת לב</p>
              <ul className="mt-2 space-y-1">
                {alerts.map((alert) => (
                  <li key={alert.id}>
                    <Link 
                      href={alert.link} 
                      className="text-sm text-amber-700 hover:text-amber-900 hover:underline"
                    >
                      {alert.message}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <Button variant="outline" size="sm" className="border-amber-300 text-amber-700 hover:bg-amber-100" asChild>
              <Link href="/admin/alerts">צפה בהתראות</Link>
            </Button>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="הכנסות כוללות"
          value={`₪${stats.totalRevenue.toLocaleString()}`}
          icon={TrendingUp}
          trend={{ value: 12.5, label: 'מהחודש שעבר' }}
        />
        <StatsCard
          title="רווח נקי"
          value={`₪${stats.totalNetProfit.toLocaleString()}`}
          icon={Receipt}
          trend={{ value: 8.2, label: 'מהחודש שעבר' }}
        />
        <StatsCard
          title="מנויים פעילים"
          value={stats.activeSubscribers.toLocaleString()}
          icon={UserCheck}
          trend={{ value: 4.1, label: 'מהחודש שעבר' }}
        />
        <StatsCard
          title="עסקאות החודש"
          value={stats.newDealsThisMonth}
          icon={Package}
          trend={{ value: -2.3, label: 'מהחודש שעבר' }}
        />
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <RevenueChart />
        <CancellationChart />
      </div>

      {/* Quick Actions + Recent Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>פעולות מהירות</CardTitle>
            <CardDescription>גישה מהירה לפעולות נפוצות</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {quickActions.map((action) => (
                <Button
                  key={action.href}
                  variant="outline"
                  className="h-auto flex-col gap-2 py-4"
                  asChild
                >
                  <Link href={action.href}>
                    <action.icon className="size-5 text-primary" />
                    <span>{action.label}</span>
                  </Link>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>פעילות אחרונה</CardTitle>
            <CardDescription>עדכונים אחרונים במערכת</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((item) => (
                <div key={item.id} className="flex items-center justify-between border-b border-border pb-3 last:border-0 last:pb-0">
                  <div>
                    <p className="text-sm font-medium">{item.action}</p>
                    <p className="text-sm text-muted-foreground">{item.entity}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{item.time}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
