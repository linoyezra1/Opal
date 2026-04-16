'use client'

import React, { useState, useMemo } from 'react'
import {
  Bell,
  Users,
  Building2,
  FileText,
  CreditCard,
  Receipt,
  Phone,
  Mail,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Search,
  Send,
  Clock,
  AlertTriangle,
} from 'lucide-react'

import { AdminHeader } from '@/components/admin/admin-header'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Empty, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { cn } from '@/lib/utils'

// Types
interface ContactTask {
  id: string
  kind: 'private' | 'corporate'
  fullName: string
  organizationName?: string
  organizationId?: string
  phone: string
  email: string
  createdAt: string
  isHandled: boolean
}

interface PendingBeneficiary {
  id: string
  transactionId: string
  fullName: string
  phone: string
  amount: number
  createdAt: string
}

interface FailedPayment {
  id: string
  orderId: string
  price: number
  chargeDate: string
  cardcomStatus: string
  customerName: string
  phoneNumber: string
}

interface OrgDebt {
  organizationId: string
  organizationName: string
  activeEmployees: number
  memberPrice: number
  debt: number
}

// Mock Data
const mockContactTasks: ContactTask[] = [
  { id: '1', kind: 'private', fullName: 'יוסי כהן', phone: '054-1234567', email: 'yosi@email.com', createdAt: '2026-04-15T10:30:00', isHandled: false },
  { id: '2', kind: 'private', fullName: 'שרה לוי', phone: '052-9876543', email: 'sara@email.com', createdAt: '2026-04-14T14:20:00', isHandled: false },
  { id: '3', kind: 'corporate', fullName: 'דוד אברהם', organizationName: 'חברת טכנולוגיה בע"מ', organizationId: 'ORG-001', phone: '03-5551234', email: 'david@tech.co.il', createdAt: '2026-04-13T09:15:00', isHandled: false },
  { id: '4', kind: 'corporate', fullName: 'רחל גולן', organizationName: 'מפעלי הצפון', organizationId: 'ORG-002', phone: '04-9998877', email: 'rachel@north.co.il', createdAt: '2026-04-12T16:45:00', isHandled: false },
]

const mockPendingBeneficiaries: PendingBeneficiary[] = [
  { id: '1', transactionId: 'TXN-001', fullName: 'אבי מזרחי', phone: '054-5556677', amount: 149, createdAt: '2026-04-10T12:00:00' },
  { id: '2', transactionId: 'TXN-002', fullName: 'מיכל שמש', phone: '052-3334455', amount: 199, createdAt: '2026-04-09T10:30:00' },
]

const mockFailedPayments: FailedPayment[] = [
  { id: '1', orderId: 'ORD-2026-001', price: 149, chargeDate: '2026-04-01', cardcomStatus: 'כרטיס נדחה', customerName: 'יעקב פרץ', phoneNumber: '054-1112233' },
  { id: '2', orderId: 'ORD-2026-002', price: 199, chargeDate: '2026-04-01', cardcomStatus: 'כרטיס לא תקין', customerName: 'לאה אשכנזי', phoneNumber: '052-4445566' },
  { id: '3', orderId: 'ORD-2026-003', price: 149, chargeDate: '2026-04-01', cardcomStatus: 'שגיאת תקשורת', customerName: 'עמית דוד', phoneNumber: '050-7778899' },
]

const mockOrgDebts: OrgDebt[] = [
  { organizationId: 'ORG-001', organizationName: 'חברת טכנולוגיה בע"מ', activeEmployees: 25, memberPrice: 99, debt: 2475 },
  { organizationId: 'ORG-002', organizationName: 'מפעלי הצפון', activeEmployees: 50, memberPrice: 89, debt: 4450 },
]

// Alert Section Component - same style as Archive page
interface AlertSectionProps {
  title: string
  icon: React.ElementType
  count: number
  severity?: 'normal' | 'warning' | 'critical'
  subtitle?: string
  children: React.ReactNode
  defaultOpen?: boolean
}

function AlertSection({ title, icon: Icon, count, severity = 'normal', subtitle, children, defaultOpen = false }: AlertSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  const severityStyles = {
    normal: 'bg-muted',
    warning: 'bg-amber-100',
    critical: 'bg-red-100',
  }

  const severityIconStyles = {
    normal: 'text-muted-foreground',
    warning: 'text-amber-600',
    critical: 'text-red-600',
  }

  const badgeVariant = {
    normal: 'secondary' as const,
    warning: 'outline' as const,
    critical: 'destructive' as const,
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn("size-10 rounded-lg flex items-center justify-center", severityStyles[severity])}>
                  <Icon className={cn("size-5", severityIconStyles[severity])} />
                </div>
                <div>
                  <CardTitle className="text-lg">{title}</CardTitle>
                  <CardDescription>{subtitle || `${count} פריטים`}</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={badgeVariant[severity]}>{count}</Badge>
                {isOpen ? (
                  <ChevronUp className="size-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="size-5 text-muted-foreground" />
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            {children}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

export default function AlertsPage() {
  const [searchQuery, setSearchQuery] = useState('')

  // Calculate totals
  const privateContacts = mockContactTasks.filter(c => c.kind === 'private')
  const corporateContacts = mockContactTasks.filter(c => c.kind === 'corporate')
  const failedPaymentsTotal = mockFailedPayments.reduce((sum, p) => sum + p.price, 0)
  const totalOrgDebt = mockOrgDebts.reduce((sum, o) => sum + o.debt, 0)
  const totalOpenDebt = failedPaymentsTotal + totalOrgDebt

  // Filter by search
  const filteredPrivate = useMemo(() =>
    privateContacts.filter(c =>
      c.fullName.includes(searchQuery) || c.phone.includes(searchQuery)
    ), [privateContacts, searchQuery]
  )

  const filteredCorporate = useMemo(() =>
    corporateContacts.filter(c =>
      c.fullName.includes(searchQuery) || (c.organizationName && c.organizationName.includes(searchQuery))
    ), [corporateContacts, searchQuery]
  )

  const filteredBeneficiaries = useMemo(() =>
    mockPendingBeneficiaries.filter(b =>
      b.fullName.includes(searchQuery) || b.phone.includes(searchQuery)
    ), [searchQuery]
  )

  const filteredPayments = useMemo(() =>
    mockFailedPayments.filter(p =>
      p.customerName.includes(searchQuery) || p.orderId.includes(searchQuery)
    ), [searchQuery]
  )

  const filteredOrgs = useMemo(() =>
    mockOrgDebts.filter(o =>
      o.organizationName.includes(searchQuery)
    ), [searchQuery]
  )

  const totalAlerts = privateContacts.length + corporateContacts.length + mockPendingBeneficiaries.length + mockFailedPayments.length + mockOrgDebts.length

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('he-IL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('he-IL', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="flex flex-col min-h-screen">
      <AdminHeader
        title="התראות"
        description="מעקב אחר משימות ופניות הדורשות טיפול"
      />

      <main className="flex-1 p-4 md:p-6">
        <div className="container max-w-5xl">
          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-2 mb-6">
            <Card className="bg-muted/30">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="size-14 rounded-xl bg-muted flex items-center justify-center">
                    <Bell className="size-7 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold">{totalAlerts}</p>
                    <p className="text-muted-foreground">סה״כ התראות פתוחות</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-amber-50 border-amber-200">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="size-14 rounded-xl bg-amber-100 flex items-center justify-center">
                    <AlertTriangle className="size-7 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-amber-700">{totalOpenDebt.toLocaleString('he-IL')} ₪</p>
                    <p className="text-amber-600/80">סה״כ חוב פתוח</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search */}
          <div className="mb-6">
            <div className="relative max-w-md">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="חיפוש בהתראות..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="ps-10"
              />
            </div>
          </div>

          {totalAlerts === 0 ? (
            <Card>
              <CardContent className="py-16">
                <Empty>
                  <EmptyMedia variant="icon">
                    <Bell className="size-8" />
                  </EmptyMedia>
                  <EmptyTitle>אין התראות פתוחות</EmptyTitle>
                  <EmptyDescription>
                    כל המשימות טופלו בהצלחה
                  </EmptyDescription>
                </Empty>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Private Contacts */}
              <AlertSection
                title="צור קשר - פרטי"
                icon={Users}
                count={filteredPrivate.length}
                severity={filteredPrivate.length > 5 ? 'critical' : filteredPrivate.length > 2 ? 'warning' : 'normal'}
                subtitle="פניות פרטיות שטרם טופלו"
                defaultOpen={filteredPrivate.length > 0}
              >
                {filteredPrivate.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">אין פניות פרטיות</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>שם מלא</TableHead>
                        <TableHead>טלפון</TableHead>
                        <TableHead>אימייל</TableHead>
                        <TableHead>תאריך</TableHead>
                        <TableHead className="w-32">פעולות</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPrivate.map((contact) => (
                        <TableRow key={contact.id}>
                          <TableCell className="font-medium">{contact.fullName}</TableCell>
                          <TableCell dir="ltr" className="text-start">{contact.phone}</TableCell>
                          <TableCell dir="ltr" className="text-start text-muted-foreground">{contact.email}</TableCell>
                          <TableCell className="text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <Calendar className="size-4" />
                              {formatDateTime(contact.createdAt)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" className="size-8">
                                <Phone className="size-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="size-8">
                                <Mail className="size-4" />
                              </Button>
                              <Button variant="outline" size="sm">
                                <CheckCircle2 className="size-4 me-1" />
                                טופל
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </AlertSection>

              {/* Corporate Contacts */}
              <AlertSection
                title="צור קשר - ארגוני"
                icon={Building2}
                count={filteredCorporate.length}
                severity={filteredCorporate.length > 3 ? 'warning' : 'normal'}
                subtitle="פניות ארגוניות שטרם טופלו"
              >
                {filteredCorporate.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">אין פניות ארגוניות</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>איש קשר</TableHead>
                        <TableHead>ארגון</TableHead>
                        <TableHead>טלפון</TableHead>
                        <TableHead>תאריך</TableHead>
                        <TableHead className="w-32">פעולות</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCorporate.map((contact) => (
                        <TableRow key={contact.id}>
                          <TableCell className="font-medium">{contact.fullName}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{contact.organizationName}</Badge>
                          </TableCell>
                          <TableCell dir="ltr" className="text-start">{contact.phone}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDateTime(contact.createdAt)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" className="size-8">
                                <Phone className="size-4" />
                              </Button>
                              <Button variant="outline" size="sm">
                                <CheckCircle2 className="size-4 me-1" />
                                טופל
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </AlertSection>

              {/* Pending Beneficiaries */}
              <AlertSection
                title="השלמת טפסים"
                icon={FileText}
                count={filteredBeneficiaries.length}
                severity={filteredBeneficiaries.length > 5 ? 'critical' : filteredBeneficiaries.length > 2 ? 'warning' : 'normal'}
                subtitle="מנויים שלא השלימו פרטי מוטבים"
              >
                {filteredBeneficiaries.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">אין טפסים ממתינים</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>שם מנוי</TableHead>
                        <TableHead>מזהה עסקה</TableHead>
                        <TableHead>טלפון</TableHead>
                        <TableHead>סכום</TableHead>
                        <TableHead>תאריך</TableHead>
                        <TableHead className="w-32">פעולות</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredBeneficiaries.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.fullName}</TableCell>
                          <TableCell>
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{item.transactionId}</code>
                          </TableCell>
                          <TableCell dir="ltr" className="text-start">{item.phone}</TableCell>
                          <TableCell className="font-medium">{item.amount} ₪</TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDate(item.createdAt)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" className="size-8">
                                <Phone className="size-4" />
                              </Button>
                              <Button variant="outline" size="sm">
                                <Send className="size-4 me-1" />
                                תזכורת
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </AlertSection>

              {/* Failed Payments */}
              <AlertSection
                title="פיגור תשלום"
                icon={CreditCard}
                count={filteredPayments.length}
                severity={filteredPayments.length > 3 ? 'critical' : filteredPayments.length > 0 ? 'warning' : 'normal'}
                subtitle={`סה״כ ${failedPaymentsTotal.toLocaleString('he-IL')} ₪`}
              >
                {filteredPayments.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">אין פיגורים</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>לקוח</TableHead>
                        <TableHead>מזהה הזמנה</TableHead>
                        <TableHead>סכום</TableHead>
                        <TableHead>סטטוס כרטיס</TableHead>
                        <TableHead>תאריך חיוב</TableHead>
                        <TableHead className="w-32">פעולות</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPayments.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell className="font-medium">{payment.customerName}</TableCell>
                          <TableCell>
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{payment.orderId}</code>
                          </TableCell>
                          <TableCell className="font-bold text-red-600">{payment.price} ₪</TableCell>
                          <TableCell>
                            <Badge variant="destructive" className="text-xs">
                              {payment.cardcomStatus}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDate(payment.chargeDate)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" className="size-8">
                                <Phone className="size-4" />
                              </Button>
                              <Button variant="outline" size="sm">
                                חיוב חוזר
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </AlertSection>

              {/* Organizations to Bill */}
              <AlertSection
                title="ארגונים לחיוב"
                icon={Receipt}
                count={filteredOrgs.length}
                severity={totalOrgDebt > 5000 ? 'critical' : totalOrgDebt > 2000 ? 'warning' : 'normal'}
                subtitle={`סה״כ ${totalOrgDebt.toLocaleString('he-IL')} ₪`}
              >
                {filteredOrgs.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">אין ארגונים לחיוב</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>שם ארגון</TableHead>
                        <TableHead>עובדים פעילים</TableHead>
                        <TableHead>מחיר לעובד</TableHead>
                        <TableHead>חוב</TableHead>
                        <TableHead className="w-32">פעולות</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOrgs.map((org) => (
                        <TableRow key={org.organizationId}>
                          <TableCell className="font-medium">{org.organizationName}</TableCell>
                          <TableCell>{org.activeEmployees}</TableCell>
                          <TableCell>{org.memberPrice} ₪</TableCell>
                          <TableCell className="font-bold text-amber-600">
                            {org.debt.toLocaleString('he-IL')} ₪
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button variant="outline" size="sm">
                                שלח חשבונית
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </AlertSection>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
