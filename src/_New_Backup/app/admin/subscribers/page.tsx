'use client'

import { useState } from 'react'
import { UserCheck, Filter, Download, TrendingUp, Receipt, Users, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { Empty, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { Badge } from '@/components/ui/badge'
import { StatsCard } from '@/components/admin/stats-card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import type { Subscriber } from '@/lib/api'

// Mock data
const mockProducts = [
  { id: '1', name: 'ביטוח בריאות בסיסי' },
  { id: '2', name: 'ביטוח חיים פרימיום' },
  { id: '3', name: 'ביטוח סיעודי' },
]

const mockAgents = [
  { id: '1', name: 'דוד כהן' },
  { id: '2', name: 'שרה לוי' },
]

const mockOrganizations = [
  'חברת היי-טק בע"מ',
  'לקוחות פרטיים',
  'עיריית תל אביב',
]

const mockSubscribers: Subscriber[] = [
  {
    id: '1',
    firstName: 'ישראל',
    lastName: 'ישראלי',
    idNumber: '123456789',
    phone: '050-1234567',
    email: 'israel@email.com',
    productId: '1',
    productName: 'ביטוח בריאות בסיסי',
    agentId: '1',
    agentName: 'דוד כהן',
    organizationName: 'חברת היי-טק בע"מ',
    revenue: 250,
    vendorCost: 150,
    agentCommission: 50,
    netProfit: 50,
    status: 'active',
    createdAt: '2024-03-15',
    createdBy: 'דוד כהן',
  },
  {
    id: '2',
    firstName: 'רחל',
    lastName: 'כהן',
    idNumber: '987654321',
    phone: '050-9876543',
    email: 'rachel@email.com',
    productId: '2',
    productName: 'ביטוח חיים פרימיום',
    agentId: '2',
    agentName: 'שרה לוי',
    organizationName: 'לקוחות פרטיים',
    revenue: 350,
    vendorCost: 200,
    agentCommission: 75,
    netProfit: 75,
    status: 'active',
    createdAt: '2024-03-18',
    createdBy: 'שרה לוי',
  },
  {
    id: '3',
    firstName: 'משה',
    lastName: 'לוי',
    idNumber: '456789123',
    phone: '050-4567891',
    email: 'moshe@email.com',
    productId: '3',
    productName: 'ביטוח סיעודי',
    agentId: '1',
    agentName: 'דוד כהן',
    organizationName: 'עיריית תל אביב',
    revenue: 300,
    vendorCost: 180,
    agentCommission: 60,
    netProfit: 60,
    status: 'pending',
    createdAt: '2024-03-20',
    createdBy: 'דוד כהן',
  },
]

interface Filters {
  productId: string
  agentId: string
  organizationName: string
  dateFrom: string
  dateTo: string
}

export default function SubscribersPage() {
  const [subscribers] = useState<Subscriber[]>(mockSubscribers)
  const [filters, setFilters] = useState<Filters>({
    productId: '',
    agentId: '',
    organizationName: '',
    dateFrom: '',
    dateTo: '',
  })
  const [isFilterOpen, setIsFilterOpen] = useState(false)

  // Apply filters
  const filteredSubscribers = subscribers.filter((sub) => {
    if (filters.productId && sub.productId !== filters.productId) return false
    if (filters.agentId && sub.agentId !== filters.agentId) return false
    if (filters.organizationName && sub.organizationName !== filters.organizationName) return false
    if (filters.dateFrom && sub.createdAt && sub.createdAt < filters.dateFrom) return false
    if (filters.dateTo && sub.createdAt && sub.createdAt > filters.dateTo) return false
    return true
  })

  // Calculate stats
  const stats = {
    totalRevenue: filteredSubscribers.reduce((sum, s) => sum + s.revenue, 0),
    totalNetProfit: filteredSubscribers.reduce((sum, s) => sum + s.netProfit, 0),
    totalDeals: filteredSubscribers.length,
    activeCount: filteredSubscribers.filter(s => s.status === 'active').length,
  }

  const clearFilters = () => {
    setFilters({
      productId: '',
      agentId: '',
      organizationName: '',
      dateFrom: '',
      dateTo: '',
    })
  }

  const hasActiveFilters = Object.values(filters).some(v => v !== '')

  const getStatusBadge = (status: Subscriber['status']) => {
    const variants = {
      active: { variant: 'default' as const, label: 'פעיל' },
      pending: { variant: 'secondary' as const, label: 'ממתין' },
      cancelled: { variant: 'destructive' as const, label: 'מבוטל' },
    }
    const { variant, label } = variants[status]
    return <Badge variant={variant}>{label}</Badge>
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('he-IL')
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">מנויים</h1>
          <p className="text-muted-foreground">צפייה בעסקאות ומנויים</p>
        </div>
        <div className="flex items-center gap-2">
          <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
            <SheetTrigger asChild>
              <Button variant="outline">
                <Filter className="size-4 me-2" />
                סינון
                {hasActiveFilters && (
                  <Badge variant="secondary" className="ms-2">
                    פעיל
                  </Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="left">
              <SheetHeader>
                <SheetTitle>סינון מנויים</SheetTitle>
                <SheetDescription>
                  הגדר פילטרים להצגת מנויים ספציפיים
                </SheetDescription>
              </SheetHeader>
              
              <div className="mt-6 space-y-6">
                <FieldGroup>
                  <Field>
                    <FieldLabel>מוצר</FieldLabel>
                    <Select
                      value={filters.productId}
                      onValueChange={(value) => setFilters({ ...filters, productId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="כל המוצרים" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">כל המוצרים</SelectItem>
                        {mockProducts.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field>
                    <FieldLabel>סוכן</FieldLabel>
                    <Select
                      value={filters.agentId}
                      onValueChange={(value) => setFilters({ ...filters, agentId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="כל הסוכנים" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">כל הסוכנים</SelectItem>
                        {mockAgents.map((agent) => (
                          <SelectItem key={agent.id} value={agent.id}>
                            {agent.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field>
                    <FieldLabel>ארגון</FieldLabel>
                    <Select
                      value={filters.organizationName}
                      onValueChange={(value) => setFilters({ ...filters, organizationName: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="כל הארגונים" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">כל הארגונים</SelectItem>
                        {mockOrganizations.map((org) => (
                          <SelectItem key={org} value={org}>
                            {org}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field>
                    <FieldLabel>מתאריך</FieldLabel>
                    <Input
                      type="date"
                      value={filters.dateFrom}
                      onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                    />
                  </Field>

                  <Field>
                    <FieldLabel>עד תאריך</FieldLabel>
                    <Input
                      type="date"
                      value={filters.dateTo}
                      onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                    />
                  </Field>
                </FieldGroup>

                <div className="flex gap-2">
                  <Button onClick={() => setIsFilterOpen(false)} className="flex-1">
                    החל
                  </Button>
                  <Button variant="outline" onClick={clearFilters}>
                    נקה
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
          
          <Button variant="outline">
            <Download className="size-4 me-2" />
            ייצוא
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="סה״כ הכנסות"
          value={`₪${stats.totalRevenue.toLocaleString()}`}
          icon={TrendingUp}
        />
        <StatsCard
          title="רווח נקי"
          value={`₪${stats.totalNetProfit.toLocaleString()}`}
          icon={Receipt}
        />
        <StatsCard
          title="סה״כ עסקאות"
          value={stats.totalDeals}
          icon={Users}
        />
        <StatsCard
          title="מנויים פעילים"
          value={stats.activeCount}
          icon={UserCheck}
        />
      </div>

      {/* Subscribers Table */}
      <Card>
        <CardHeader>
          <CardTitle>רשימת מנויים</CardTitle>
          <CardDescription>
            {filteredSubscribers.length} מנויים 
            {hasActiveFilters && ' (מסונן)'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredSubscribers.length === 0 ? (
            <Empty>
              <EmptyMedia variant="icon">
                <UserCheck className="size-8" />
              </EmptyMedia>
              <EmptyTitle>אין מנויים להצגה</EmptyTitle>
              <EmptyDescription>
                {hasActiveFilters 
                  ? 'נסה לשנות את הפילטרים'
                  : 'מנויים חדשים יופיעו כאן לאחר הרשמה'}
              </EmptyDescription>
              {hasActiveFilters && (
                <Button variant="outline" onClick={clearFilters} className="mt-4">
                  נקה פילטרים
                </Button>
              )}
            </Empty>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>מנוי</TableHead>
                    <TableHead>מוצר</TableHead>
                    <TableHead>סוכן</TableHead>
                    <TableHead>ארגון</TableHead>
                    <TableHead>הכנסה</TableHead>
                    <TableHead>רווח נקי</TableHead>
                    <TableHead>סטטוס</TableHead>
                    <TableHead>תאריך</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubscribers.map((subscriber) => (
                    <TableRow key={subscriber.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {subscriber.firstName} {subscriber.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground" dir="ltr">
                            {subscriber.phone}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{subscriber.productName}</TableCell>
                      <TableCell>{subscriber.agentName || '-'}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {subscriber.organizationName || '-'}
                      </TableCell>
                      <TableCell>₪{subscriber.revenue}</TableCell>
                      <TableCell className="text-success">
                        ₪{subscriber.netProfit}
                      </TableCell>
                      <TableCell>{getStatusBadge(subscriber.status)}</TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm">{formatDate(subscriber.createdAt)}</p>
                          {subscriber.createdBy && (
                            <p className="text-xs text-muted-foreground">
                              נוצר ע״י: {subscriber.createdBy}
                            </p>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
