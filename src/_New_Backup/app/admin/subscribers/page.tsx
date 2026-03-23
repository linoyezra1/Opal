'use client'

import React, { useState } from 'react'
import { 
  UserCheck, Filter, Download, TrendingUp, Receipt, Users, Calendar,
  ChevronDown, ChevronUp, Edit2, Save, X, FileCheck, FileX, User,
  Phone, Mail, MapPin, CreditCard, Clock, Building2, UserPlus, Trash2,
  CheckCircle2, AlertCircle, Circle
} from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/admin/confirm-dialog'
import type { Subscriber, Beneficiary } from '@/lib/api'

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
    address: 'רחוב הרצל 15',
    city: 'תל אביב',
    birthDate: '1985-03-15',
    productId: '1',
    productName: 'ביטוח בריאות בסיסי',
    agentId: '1',
    agentName: 'דוד כהן',
    organizationName: 'חברת היי-טק בע"מ',
    priceListName: 'מחירון ארגוני',
    revenue: 250,
    vendorCost: 150,
    agentCommission: 50,
    netProfit: 50,
    status: 'active',
    documents: {
      beneficiariesCompleted: true,
      beneficiariesCount: 3,
      contractSigned: true,
      contractSignedAt: '2024-03-16',
      idDocumentUploaded: true,
      medicalFormCompleted: true,
      paymentVerified: true,
    },
    beneficiaries: [
      { id: 'b1', firstName: 'שרה', lastName: 'ישראלי', idNumber: '123456780', birthDate: '1987-06-20', phone: '050-1234568', relationship: 'בן/בת זוג' },
      { id: 'b2', firstName: 'יוסי', lastName: 'ישראלי', idNumber: '123456781', birthDate: '2010-01-10', relationship: 'ילד/ה' },
      { id: 'b3', firstName: 'מיכל', lastName: 'ישראלי', idNumber: '123456782', birthDate: '2015-08-25', relationship: 'ילד/ה' },
    ],
    notes: 'לקוח VIP - נרשם דרך קמפיין מיוחד',
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
    address: 'שדרות בן גוריון 42',
    city: 'חיפה',
    birthDate: '1990-11-08',
    productId: '2',
    productName: 'ביטוח חיים פרימיום',
    agentId: '2',
    agentName: 'שרה לוי',
    organizationName: 'לקוחות פרטיים',
    priceListName: 'מחירון פרטי',
    revenue: 350,
    vendorCost: 200,
    agentCommission: 75,
    netProfit: 75,
    status: 'active',
    documents: {
      beneficiariesCompleted: false,
      beneficiariesCount: 0,
      contractSigned: true,
      contractSignedAt: '2024-03-19',
      idDocumentUploaded: true,
      medicalFormCompleted: false,
      paymentVerified: true,
    },
    beneficiaries: [],
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
    address: 'רחוב יפו 100',
    city: 'ירושלים',
    birthDate: '1975-05-22',
    productId: '3',
    productName: 'ביטוח סיעודי',
    agentId: '1',
    agentName: 'דוד כהן',
    organizationName: 'עיריית תל אביב',
    priceListName: 'מחירון עירוני',
    revenue: 300,
    vendorCost: 180,
    agentCommission: 60,
    netProfit: 60,
    status: 'pending',
    documents: {
      beneficiariesCompleted: true,
      beneficiariesCount: 1,
      contractSigned: false,
      idDocumentUploaded: false,
      medicalFormCompleted: false,
      paymentVerified: false,
    },
    beneficiaries: [
      { id: 'b4', firstName: 'דינה', lastName: 'לוי', idNumber: '456789124', birthDate: '1978-09-14', phone: '050-4567892', relationship: 'בן/בת זוג' },
    ],
    notes: 'ממתין לאישור תשלום',
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
  const [subscribers, setSubscribers] = useState<Subscriber[]>(mockSubscribers)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Subscriber | null>(null)
  const [filters, setFilters] = useState<Filters>({
    productId: '',
    agentId: '',
    organizationName: '',
    dateFrom: '',
    dateTo: '',
  })
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [beneficiaryDialog, setBeneficiaryDialog] = useState<{ open: boolean; subscriberId: string; beneficiary?: Beneficiary }>({
    open: false,
    subscriberId: '',
  })
  const [deleteBeneficiaryDialog, setDeleteBeneficiaryDialog] = useState<{ open: boolean; subscriberId: string; beneficiaryId: string }>({
    open: false,
    subscriberId: '',
    beneficiaryId: '',
  })

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

  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null)
      setEditingId(null)
      setEditForm(null)
    } else {
      setExpandedId(id)
      setEditingId(null)
      setEditForm(null)
    }
  }

  const startEditing = (subscriber: Subscriber) => {
    setEditingId(subscriber.id)
    setEditForm({ ...subscriber })
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditForm(null)
  }

  const saveEditing = () => {
    if (editForm) {
      setSubscribers(subscribers.map(s => s.id === editForm.id ? editForm : s))
      setEditingId(null)
      setEditForm(null)
    }
  }

  const getStatusBadge = (status: Subscriber['status']) => {
    const variants = {
      active: { variant: 'default' as const, label: 'פעיל', icon: CheckCircle2 },
      pending: { variant: 'secondary' as const, label: 'ממתין', icon: Clock },
      cancelled: { variant: 'destructive' as const, label: 'מבוטל', icon: X },
    }
    const { variant, label, icon: Icon } = variants[status]
    return (
      <Badge variant={variant} className="gap-1">
        <Icon className="size-3" />
        {label}
      </Badge>
    )
  }

  const getDocumentStatus = (docs?: Subscriber['documents']) => {
    if (!docs) return { completed: 0, total: 5, percentage: 0 }
    const checks = [
      docs.beneficiariesCompleted,
      docs.contractSigned,
      docs.idDocumentUploaded,
      docs.medicalFormCompleted,
      docs.paymentVerified,
    ]
    const completed = checks.filter(Boolean).length
    return { completed, total: 5, percentage: Math.round((completed / 5) * 100) }
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('he-IL')
  }

  const DocumentStatusIcon = ({ completed }: { completed: boolean }) => {
    return completed ? (
      <CheckCircle2 className="size-4 text-green-600" />
    ) : (
      <AlertCircle className="size-4 text-amber-500" />
    )
  }

  // Beneficiary handlers
  const addBeneficiary = (subscriberId: string) => {
    setBeneficiaryDialog({ open: true, subscriberId })
  }

  const editBeneficiary = (subscriberId: string, beneficiary: Beneficiary) => {
    setBeneficiaryDialog({ open: true, subscriberId, beneficiary })
  }

  const saveBeneficiary = (data: Partial<Beneficiary>) => {
    const { subscriberId, beneficiary } = beneficiaryDialog
    setSubscribers(subscribers.map(sub => {
      if (sub.id !== subscriberId) return sub
      const beneficiaries = sub.beneficiaries || []
      if (beneficiary) {
        // Edit existing
        return {
          ...sub,
          beneficiaries: beneficiaries.map(b => b.id === beneficiary.id ? { ...b, ...data } : b)
        }
      } else {
        // Add new
        return {
          ...sub,
          beneficiaries: [...beneficiaries, { ...data, id: `b${Date.now()}` } as Beneficiary]
        }
      }
    }))
    setBeneficiaryDialog({ open: false, subscriberId: '' })
  }

  const confirmDeleteBeneficiary = () => {
    const { subscriberId, beneficiaryId } = deleteBeneficiaryDialog
    setSubscribers(subscribers.map(sub => {
      if (sub.id !== subscriberId) return sub
      return {
        ...sub,
        beneficiaries: (sub.beneficiaries || []).filter(b => b.id !== beneficiaryId)
      }
    }))
    setDeleteBeneficiaryDialog({ open: false, subscriberId: '', beneficiaryId: '' })
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
                      value={filters.productId || 'all'}
                      onValueChange={(value) => setFilters({ ...filters, productId: value === 'all' ? '' : value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="כל המוצרים" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">כל המוצרים</SelectItem>
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
                      value={filters.agentId || 'all'}
                      onValueChange={(value) => setFilters({ ...filters, agentId: value === 'all' ? '' : value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="כל הסוכנים" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">כל הסוכנים</SelectItem>
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
                      value={filters.organizationName || 'all'}
                      onValueChange={(value) => setFilters({ ...filters, organizationName: value === 'all' ? '' : value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="כל הארגונים" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">כל הארגונים</SelectItem>
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

      {/* Subscribers List */}
      <Card>
        <CardHeader>
          <CardTitle>רשימת מנויים</CardTitle>
          <CardDescription>
            {filteredSubscribers.length} מנויים 
            {hasActiveFilters && ' (מסונן)'} - לחץ על שורה לצפייה בפרטים
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
            <div className="space-y-3">
              {filteredSubscribers.map((subscriber) => {
                const isExpanded = expandedId === subscriber.id
                const isEditing = editingId === subscriber.id
                const docStatus = getDocumentStatus(subscriber.documents)
                const currentData = isEditing && editForm ? editForm : subscriber
                
                return (
                  <div 
                    key={subscriber.id} 
                    className={`border rounded-lg transition-all ${isExpanded ? 'ring-2 ring-primary/20 shadow-md' : 'hover:border-primary/30'}`}
                  >
                    {/* Summary Row */}
                    <div 
                      className="flex items-center gap-4 p-4 cursor-pointer"
                      onClick={() => toggleExpand(subscriber.id)}
                    >
                      <Button variant="ghost" size="icon" className="shrink-0">
                        {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                      </Button>
                      
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                        <div>
                          <p className="font-medium">{subscriber.firstName} {subscriber.lastName}</p>
                          <p className="text-xs text-muted-foreground" dir="ltr">{subscriber.phone}</p>
                        </div>
                        
                        <div>
                          <p className="text-sm">{subscriber.productName}</p>
                          <p className="text-xs text-muted-foreground">{subscriber.organizationName}</p>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all ${docStatus.percentage === 100 ? 'bg-green-500' : docStatus.percentage >= 60 ? 'bg-amber-500' : 'bg-red-400'}`}
                              style={{ width: `${docStatus.percentage}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {docStatus.completed}/{docStatus.total}
                          </span>
                        </div>
                        
                        <div className="text-sm">
                          <p className="font-medium">₪{subscriber.revenue}</p>
                          <p className="text-xs text-green-600">רווח: ₪{subscriber.netProfit}</p>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          {getStatusBadge(subscriber.status)}
                          <span className="text-xs text-muted-foreground hidden md:block">
                            {formatDate(subscriber.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="border-t bg-muted/30">
                        <div className="p-6 space-y-6">
                          {/* Action Bar */}
                          <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold">פרטי מנוי</h3>
                            {isEditing ? (
                              <div className="flex gap-2">
                                <Button size="sm" onClick={saveEditing}>
                                  <Save className="size-4 me-1" />
                                  שמור
                                </Button>
                                <Button size="sm" variant="outline" onClick={cancelEditing}>
                                  <X className="size-4 me-1" />
                                  ביטול
                                </Button>
                              </div>
                            ) : (
                              <Button size="sm" variant="outline" onClick={() => startEditing(subscriber)}>
                                <Edit2 className="size-4 me-1" />
                                עריכה
                              </Button>
                            )}
                          </div>
                          
                          {/* Primary Beneficiary - Main Subscriber */}
                          <div className="bg-primary/5 rounded-xl p-5 border border-primary/10">
                            <div className="flex items-center gap-2 mb-4">
                              <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <User className="size-5 text-primary" />
                              </div>
                              <div>
                                <h4 className="font-semibold text-primary">מוטב ראשי</h4>
                                <p className="text-xs text-muted-foreground">בעל המנוי</p>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <Field>
                                <FieldLabel>שם פרטי</FieldLabel>
                                {isEditing ? (
                                  <Input 
                                    value={currentData.firstName} 
                                    onChange={(e) => setEditForm({ ...editForm!, firstName: e.target.value })}
                                  />
                                ) : (
                                  <p className="text-sm py-2">{currentData.firstName}</p>
                                )}
                              </Field>
                              <Field>
                                <FieldLabel>שם משפחה</FieldLabel>
                                {isEditing ? (
                                  <Input 
                                    value={currentData.lastName} 
                                    onChange={(e) => setEditForm({ ...editForm!, lastName: e.target.value })}
                                  />
                                ) : (
                                  <p className="text-sm py-2">{currentData.lastName}</p>
                                )}
                              </Field>
                              <Field>
                                <FieldLabel>תעודת זהות</FieldLabel>
                                {isEditing ? (
                                  <Input 
                                    value={currentData.idNumber} 
                                    onChange={(e) => setEditForm({ ...editForm!, idNumber: e.target.value })}
                                    dir="ltr"
                                  />
                                ) : (
                                  <p className="text-sm py-2" dir="ltr">{currentData.idNumber}</p>
                                )}
                              </Field>
                              <Field>
                                <FieldLabel>טלפון</FieldLabel>
                                {isEditing ? (
                                  <Input 
                                    value={currentData.phone || ''} 
                                    onChange={(e) => setEditForm({ ...editForm!, phone: e.target.value })}
                                    dir="ltr"
                                  />
                                ) : (
                                  <p className="text-sm py-2" dir="ltr">{currentData.phone || '-'}</p>
                                )}
                              </Field>
                              <Field>
                                <FieldLabel>אימייל</FieldLabel>
                                {isEditing ? (
                                  <Input 
                                    value={currentData.email || ''} 
                                    onChange={(e) => setEditForm({ ...editForm!, email: e.target.value })}
                                    dir="ltr"
                                    type="email"
                                  />
                                ) : (
                                  <p className="text-sm py-2" dir="ltr">{currentData.email || '-'}</p>
                                )}
                              </Field>
                              <Field>
                                <FieldLabel>תאריך לידה</FieldLabel>
                                {isEditing ? (
                                  <Input 
                                    type="date"
                                    value={currentData.birthDate || ''} 
                                    onChange={(e) => setEditForm({ ...editForm!, birthDate: e.target.value })}
                                  />
                                ) : (
                                  <p className="text-sm py-2">{formatDate(currentData.birthDate)}</p>
                                )}
                              </Field>
                              <Field>
                                <FieldLabel>כתובת</FieldLabel>
                                {isEditing ? (
                                  <Input 
                                    value={currentData.address || ''} 
                                    onChange={(e) => setEditForm({ ...editForm!, address: e.target.value })}
                                  />
                                ) : (
                                  <p className="text-sm py-2">{currentData.address || '-'}</p>
                                )}
                              </Field>
                              <Field>
                                <FieldLabel>עיר</FieldLabel>
                                {isEditing ? (
                                  <Input 
                                    value={currentData.city || ''} 
                                    onChange={(e) => setEditForm({ ...editForm!, city: e.target.value })}
                                  />
                                ) : (
                                  <p className="text-sm py-2">{currentData.city || '-'}</p>
                                )}
                              </Field>
                            </div>
                          </div>
                          
                          {/* Secondary Beneficiaries */}
                          <div className="bg-secondary/30 rounded-xl p-5 border border-secondary/50">
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-2">
                                <div className="size-10 rounded-full bg-secondary flex items-center justify-center">
                                  <Users className="size-5 text-secondary-foreground" />
                                </div>
                                <div>
                                  <h4 className="font-semibold">מוטבים משניים</h4>
                                  <p className="text-xs text-muted-foreground">
                                    {(currentData.beneficiaries?.length || 0)} מוטבים נוספים
                                  </p>
                                </div>
                              </div>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={(e) => { e.stopPropagation(); addBeneficiary(subscriber.id) }}
                              >
                                <UserPlus className="size-4 me-1" />
                                הוסף מוטב
                              </Button>
                            </div>
                            
                            {currentData.beneficiaries && currentData.beneficiaries.length > 0 ? (
                              <div className="grid gap-3">
                                {currentData.beneficiaries.map((ben, idx) => (
                                  <div 
                                    key={ben.id} 
                                    className="bg-background rounded-lg p-4 border flex items-start gap-4"
                                  >
                                    <div className="size-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                                      <span className="text-sm font-medium">{idx + 1}</span>
                                    </div>
                                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                                      <div>
                                        <p className="text-xs text-muted-foreground">שם מלא</p>
                                        <p className="text-sm font-medium">{ben.firstName} {ben.lastName}</p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-muted-foreground">תעודת זהות</p>
                                        <p className="text-sm" dir="ltr">{ben.idNumber}</p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-muted-foreground">קרבה</p>
                                        <p className="text-sm">{ben.relationship || '-'}</p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-muted-foreground">תאריך לידה</p>
                                        <p className="text-sm">{formatDate(ben.birthDate)}</p>
                                      </div>
                                    </div>
                                    <div className="flex gap-1 shrink-0">
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="size-8"
                                        onClick={(e) => { e.stopPropagation(); editBeneficiary(subscriber.id, ben) }}
                                      >
                                        <Edit2 className="size-3.5" />
                                      </Button>
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="size-8 text-destructive"
                                        onClick={(e) => { 
                                          e.stopPropagation()
                                          setDeleteBeneficiaryDialog({ open: true, subscriberId: subscriber.id, beneficiaryId: ben.id })
                                        }}
                                      >
                                        <Trash2 className="size-3.5" />
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-center py-6 text-muted-foreground">
                                <Users className="size-8 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">אין מוטבים משניים</p>
                              </div>
                            )}
                          </div>
                          
                          {/* Document Status & Product Info */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Document Status */}
                            <div className="bg-background rounded-xl p-5 border">
                              <div className="flex items-center gap-2 mb-4">
                                <FileCheck className="size-5 text-primary" />
                                <h4 className="font-semibold">סטטוס מסמכים</h4>
                              </div>
                              
                              <div className="space-y-3">
                                <div className="flex items-center justify-between py-2 border-b">
                                  <span className="text-sm">פרטי מוטבים</span>
                                  <div className="flex items-center gap-2">
                                    <DocumentStatusIcon completed={subscriber.documents?.beneficiariesCompleted || false} />
                                    <span className="text-xs text-muted-foreground">
                                      {subscriber.documents?.beneficiariesCount || 0} מוטבים
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between py-2 border-b">
                                  <span className="text-sm">חתימה על חוזה</span>
                                  <div className="flex items-center gap-2">
                                    <DocumentStatusIcon completed={subscriber.documents?.contractSigned || false} />
                                    {subscriber.documents?.contractSignedAt && (
                                      <span className="text-xs text-muted-foreground">
                                        {formatDate(subscriber.documents.contractSignedAt)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center justify-between py-2 border-b">
                                  <span className="text-sm">העלאת תעודת זהות</span>
                                  <DocumentStatusIcon completed={subscriber.documents?.idDocumentUploaded || false} />
                                </div>
                                <div className="flex items-center justify-between py-2 border-b">
                                  <span className="text-sm">טופס רפואי</span>
                                  <DocumentStatusIcon completed={subscriber.documents?.medicalFormCompleted || false} />
                                </div>
                                <div className="flex items-center justify-between py-2">
                                  <span className="text-sm">אימות תשלום</span>
                                  <DocumentStatusIcon completed={subscriber.documents?.paymentVerified || false} />
                                </div>
                              </div>
                            </div>
                            
                            {/* Product & Financial Info */}
                            <div className="bg-background rounded-xl p-5 border">
                              <div className="flex items-center gap-2 mb-4">
                                <CreditCard className="size-5 text-primary" />
                                <h4 className="font-semibold">פרטי מוצר וכספים</h4>
                              </div>
                              
                              <div className="space-y-3">
                                <div className="flex items-center justify-between py-2 border-b">
                                  <span className="text-sm text-muted-foreground">מוצר</span>
                                  <span className="text-sm font-medium">{subscriber.productName}</span>
                                </div>
                                <div className="flex items-center justify-between py-2 border-b">
                                  <span className="text-sm text-muted-foreground">מחירון</span>
                                  <span className="text-sm">{subscriber.priceListName || '-'}</span>
                                </div>
                                <div className="flex items-center justify-between py-2 border-b">
                                  <span className="text-sm text-muted-foreground">סוכן</span>
                                  <span className="text-sm">{subscriber.agentName || '-'}</span>
                                </div>
                                <Separator />
                                <div className="flex items-center justify-between py-2">
                                  <span className="text-sm text-muted-foreground">הכנסה</span>
                                  <span className="text-sm font-medium">₪{subscriber.revenue}</span>
                                </div>
                                <div className="flex items-center justify-between py-2">
                                  <span className="text-sm text-muted-foreground">עלות ספק</span>
                                  <span className="text-sm">₪{subscriber.vendorCost}</span>
                                </div>
                                <div className="flex items-center justify-between py-2">
                                  <span className="text-sm text-muted-foreground">עמלת סוכן</span>
                                  <span className="text-sm">₪{subscriber.agentCommission}</span>
                                </div>
                                <div className="flex items-center justify-between py-2 bg-green-50 rounded px-2 -mx-2">
                                  <span className="text-sm font-medium text-green-700">רווח נקי</span>
                                  <span className="text-sm font-bold text-green-700">₪{subscriber.netProfit}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          {/* Notes */}
                          <div className="bg-background rounded-xl p-5 border">
                            <div className="flex items-center gap-2 mb-3">
                              <Calendar className="size-5 text-primary" />
                              <h4 className="font-semibold">הערות ומידע נוסף</h4>
                            </div>
                            {isEditing ? (
                              <Textarea 
                                value={currentData.notes || ''} 
                                onChange={(e) => setEditForm({ ...editForm!, notes: e.target.value })}
                                placeholder="הוסף הערות..."
                                rows={3}
                              />
                            ) : (
                              <p className="text-sm text-muted-foreground">
                                {currentData.notes || 'אין הערות'}
                              </p>
                            )}
                            <div className="mt-4 pt-3 border-t flex items-center gap-4 text-xs text-muted-foreground">
                              <span>נוצר: {formatDate(subscriber.createdAt)}</span>
                              {subscriber.createdBy && <span>ע״י: {subscriber.createdBy}</span>}
                              {subscriber.updatedAt && <span>עודכן: {formatDate(subscriber.updatedAt)}</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Beneficiary Dialog */}
      <BeneficiaryDialog 
        open={beneficiaryDialog.open}
        beneficiary={beneficiaryDialog.beneficiary}
        onClose={() => setBeneficiaryDialog({ open: false, subscriberId: '' })}
        onSave={saveBeneficiary}
      />

      {/* Delete Beneficiary Confirm */}
      <ConfirmDialog
        open={deleteBeneficiaryDialog.open}
        onOpenChange={(open) => setDeleteBeneficiaryDialog({ ...deleteBeneficiaryDialog, open })}
        title="מחיקת מוטב"
        description="האם אתה בטוח שברצונך למחוק מוטב זה? פעולה זו אינה ניתנת לביטול."
        confirmLabel="מחק"
        onConfirm={confirmDeleteBeneficiary}
        variant="destructive"
      />
    </div>
  )
}

// Beneficiary Dialog Component
function BeneficiaryDialog({ 
  open, 
  beneficiary, 
  onClose, 
  onSave 
}: { 
  open: boolean
  beneficiary?: Beneficiary
  onClose: () => void
  onSave: (data: Partial<Beneficiary>) => void
}) {
  const [form, setForm] = useState<Partial<Beneficiary>>({
    firstName: '',
    lastName: '',
    idNumber: '',
    birthDate: '',
    phone: '',
    relationship: '',
  })

  React.useEffect(() => {
    if (beneficiary) {
      setForm(beneficiary)
    } else {
      setForm({
        firstName: '',
        lastName: '',
        idNumber: '',
        birthDate: '',
        phone: '',
        relationship: '',
      })
    }
  }, [beneficiary, open])

  const handleSave = () => {
    onSave(form)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{beneficiary ? 'עריכת מוטב' : 'הוספת מוטב'}</DialogTitle>
          <DialogDescription>
            הזן את פרטי המוטב המשני
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel>שם פרטי</FieldLabel>
              <Input 
                value={form.firstName || ''} 
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              />
            </Field>
            <Field>
              <FieldLabel>שם משפחה</FieldLabel>
              <Input 
                value={form.lastName || ''} 
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              />
            </Field>
          </div>
          <Field>
            <FieldLabel>תעודת זהות</FieldLabel>
            <Input 
              value={form.idNumber || ''} 
              onChange={(e) => setForm({ ...form, idNumber: e.target.value })}
              dir="ltr"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel>תאריך לידה</FieldLabel>
              <Input 
                type="date"
                value={form.birthDate || ''} 
                onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
              />
            </Field>
            <Field>
              <FieldLabel>טלפון</FieldLabel>
              <Input 
                value={form.phone || ''} 
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                dir="ltr"
              />
            </Field>
          </div>
          <Field>
            <FieldLabel>קרבה</FieldLabel>
            <Select
              value={form.relationship || 'none'}
              onValueChange={(value) => setForm({ ...form, relationship: value === 'none' ? '' : value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="בחר קרבה" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">בחר קרבה</SelectItem>
                <SelectItem value="בן/בת זוג">בן/בת זוג</SelectItem>
                <SelectItem value="ילד/ה">ילד/ה</SelectItem>
                <SelectItem value="הורה">הורה</SelectItem>
                <SelectItem value="אח/ות">אח/ות</SelectItem>
                <SelectItem value="אחר">אחר</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>ביטול</Button>
          <Button onClick={handleSave}>
            {beneficiary ? 'שמור שינויים' : 'הוסף מוטב'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
