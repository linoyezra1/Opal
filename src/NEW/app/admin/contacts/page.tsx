'use client'

import React, { useState, useMemo } from 'react'
import {
  Phone,
  Mail,
  Calendar,
  Clock,
  Search,
  Filter,
  MoreHorizontal,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Send,
  ToggleLeft,
  Edit2,
  MessageSquare,
  ShoppingCart,
  X,
  ExternalLink,
  Loader2,
} from 'lucide-react'

import { AdminHeader } from '@/components/admin/admin-header'
import { ConfirmDialog } from '@/components/admin/confirm-dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { Field, FieldLabel } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

// Lead data model
interface Lead {
  id: string
  fullName: string
  phone: string
  email: string
  category: 'general' | 'abandoned_checkout'
  status: 'new' | 'in_progress' | 'handled'
  adminNotes: string
  createdAt: string
}

// Status configuration
const statusConfig: Record<Lead['status'], { label: string; color: string; bgColor: string }> = {
  new: { 
    label: 'חדש', 
    color: 'text-blue-700', 
    bgColor: 'bg-blue-50 border-blue-200' 
  },
  in_progress: { 
    label: 'בטיפול', 
    color: 'text-amber-700', 
    bgColor: 'bg-amber-50 border-amber-200' 
  },
  handled: { 
    label: 'טופל', 
    color: 'text-emerald-700', 
    bgColor: 'bg-emerald-50 border-emerald-200' 
  },
}

// Category configuration
const categoryConfig: Record<Lead['category'], { label: string; icon: typeof MessageSquare; color: string }> = {
  general: { 
    label: 'כללי', 
    icon: MessageSquare, 
    color: 'text-primary bg-primary/10' 
  },
  abandoned_checkout: { 
    label: 'לא המשיכו לתשלום', 
    icon: ShoppingCart, 
    color: 'text-amber-600 bg-amber-50' 
  },
}

// Mock data
const mockLeads: Lead[] = [
  {
    id: '1',
    fullName: 'דוד כהן',
    phone: '052-1234567',
    email: 'david@example.com',
    category: 'abandoned_checkout',
    status: 'new',
    adminNotes: '',
    createdAt: '2026-03-27T10:30:00',
  },
  {
    id: '2',
    fullName: 'שרה לוי',
    phone: '054-9876543',
    email: 'sara@example.com',
    category: 'general',
    status: 'in_progress',
    adminNotes: 'התקשרתי, ביקשה לחזור אליה מחר בבוקר',
    createdAt: '2026-03-26T15:45:00',
  },
  {
    id: '3',
    fullName: 'משה ישראלי',
    phone: '050-5555555',
    email: 'moshe@example.com',
    category: 'abandoned_checkout',
    status: 'in_progress',
    adminNotes: 'חזר בווטסאפ, שואל על תנאי ביטול. הסברתי והוא יחזור אלינו',
    createdAt: '2026-03-25T09:15:00',
  },
  {
    id: '4',
    fullName: 'רחל אברהם',
    phone: '053-1112222',
    email: 'rachel@example.com',
    category: 'general',
    status: 'handled',
    adminNotes: 'הסברתי על השירות, רכשה מנוי משפחתי',
    createdAt: '2026-03-24T12:00:00',
  },
  {
    id: '5',
    fullName: 'יוסף מזרחי',
    phone: '058-7778888',
    email: 'yosef@example.com',
    category: 'abandoned_checkout',
    status: 'handled',
    adminNotes: 'לא מעוניין כרגע, יש לו ביטוח דרך העבודה',
    createdAt: '2026-03-23T18:20:00',
  },
  {
    id: '6',
    fullName: 'מירב גולן',
    phone: '054-3332211',
    email: 'merav@example.com',
    category: 'general',
    status: 'new',
    adminNotes: '',
    createdAt: '2026-03-27T08:15:00',
  },
]

export default function ContactsPage() {
  const [leads, setLeads] = useState<Lead[]>(mockLeads)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [editForm, setEditForm] = useState<Lead | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Filter leads
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const matchesSearch =
        searchQuery === '' ||
        lead.fullName.includes(searchQuery) ||
        lead.phone.includes(searchQuery) ||
        lead.email.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesCategory = filterCategory === 'all' || lead.category === filterCategory
      const matchesStatus = filterStatus === 'all' || lead.status === filterStatus

      return matchesSearch && matchesCategory && matchesStatus
    })
  }, [leads, searchQuery, filterCategory, filterStatus])

  // Stats
  const stats = useMemo(() => ({
    total: leads.length,
    new: leads.filter((l) => l.status === 'new').length,
    inProgress: leads.filter((l) => l.status === 'in_progress').length,
    handled: leads.filter((l) => l.status === 'handled').length,
  }), [leads])

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return new Intl.DateTimeFormat('he-IL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  }

  const clearFilters = () => {
    setSearchQuery('')
    setFilterCategory('all')
    setFilterStatus('all')
  }

  const hasActiveFilters = searchQuery !== '' || filterCategory !== 'all' || filterStatus !== 'all'

  const openEditDialog = (lead: Lead) => {
    setSelectedLead(lead)
    setEditForm({ ...lead })
    setEditDialogOpen(true)
  }

  const openDeactivateDialog = (lead: Lead) => {
    setSelectedLead(lead)
    setDeactivateDialogOpen(true)
  }

  const handleSave = async () => {
    if (!editForm) return
    setIsSaving(true)
    
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 500))
    
    setLeads(leads.map((l) => (l.id === editForm.id ? editForm : l)))
    setIsSaving(false)
    setEditDialogOpen(false)
  }

  const handleDeactivate = () => {
    if (!selectedLead) return
    // In real app, mark as inactive and move to archive
    setLeads(leads.filter((l) => l.id !== selectedLead.id))
    setDeactivateDialogOpen(false)
  }

  const updateStatus = (leadId: string, newStatus: Lead['status']) => {
    setLeads(leads.map((l) => (l.id === leadId ? { ...l, status: newStatus } : l)))
  }

  const getWhatsAppLink = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '')
    const israelPhone = cleanPhone.startsWith('0') ? '972' + cleanPhone.slice(1) : cleanPhone
    return `https://wa.me/${israelPhone}`
  }

  return (
    <div className="flex flex-col min-h-screen">
      <AdminHeader
        title="ניהול צור קשר"
        description="ניהול לידים מפניות כלליות ומלקוחות שלא המשיכו לתשלום"
      />

      <main className="flex-1 p-4 md:p-6">
        <div className="container max-w-7xl">
          {/* Stats Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <Card className="bg-background">
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground mb-1">סה״כ פניות</div>
                <div className="text-2xl font-bold">{stats.total}</div>
              </CardContent>
            </Card>
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4">
                <div className="text-sm text-blue-700 mb-1">חדשות</div>
                <div className="text-2xl font-bold text-blue-700">{stats.new}</div>
              </CardContent>
            </Card>
            <Card className="bg-amber-50 border-amber-200">
              <CardContent className="p-4">
                <div className="text-sm text-amber-700 mb-1">בטיפול</div>
                <div className="text-2xl font-bold text-amber-700">{stats.inProgress}</div>
              </CardContent>
            </Card>
            <Card className="bg-emerald-50 border-emerald-200">
              <CardContent className="p-4">
                <div className="text-sm text-emerald-700 mb-1">טופלו</div>
                <div className="text-2xl font-bold text-emerald-700">{stats.handled}</div>
              </CardContent>
            </Card>
          </div>

          {/* Filter Bar */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex flex-col lg:flex-row gap-3">
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    placeholder="חיפוש לפי שם, טלפון או אימייל..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="ps-10"
                  />
                </div>

                {/* Category Filter */}
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="w-full lg:w-52">
                    <SelectValue placeholder="קטגוריה" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">כל הקטגוריות</SelectItem>
                    <SelectItem value="general">כללי</SelectItem>
                    <SelectItem value="abandoned_checkout">לא המשיכו לתשלום</SelectItem>
                  </SelectContent>
                </Select>

                {/* Status Filter */}
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-full lg:w-44">
                    <SelectValue placeholder="סטטוס" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">כל הסטטוסים</SelectItem>
                    <SelectItem value="new">חדש</SelectItem>
                    <SelectItem value="in_progress">בטיפול</SelectItem>
                    <SelectItem value="handled">טופל</SelectItem>
                  </SelectContent>
                </Select>

                {/* Clear Filters */}
                {hasActiveFilters && (
                  <Button variant="ghost" onClick={clearFilters} className="shrink-0">
                    <X className="size-4 me-1" />
                    נקה סינון
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Desktop Table */}
          <div className="hidden lg:block">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">שם מלא</TableHead>
                    <TableHead className="w-[130px]">טלפון</TableHead>
                    <TableHead className="w-[180px]">אימייל</TableHead>
                    <TableHead className="w-[160px]">קטגוריה</TableHead>
                    <TableHead className="w-[100px]">סטטוס</TableHead>
                    <TableHead>הערות אדמין</TableHead>
                    <TableHead className="w-[150px]">תאריך יצירה</TableHead>
                    <TableHead className="w-[140px]">פעולות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-32 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <MessageSquare className="size-8 text-muted-foreground/50" />
                          <p className="text-muted-foreground">לא נמצאו פניות</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLeads.map((lead) => {
                      const CategoryIcon = categoryConfig[lead.category].icon
                      return (
                        <TableRow key={lead.id} className="group">
                          <TableCell className="font-medium">{lead.fullName}</TableCell>
                          <TableCell>
                            <span dir="ltr" className="text-muted-foreground">{lead.phone}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-muted-foreground text-sm">{lead.email}</span>
                          </TableCell>
                          <TableCell>
                            <div className={cn(
                              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
                              categoryConfig[lead.category].color
                            )}>
                              <CategoryIcon className="size-3" />
                              {categoryConfig[lead.category].label}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={lead.status}
                              onValueChange={(value) => updateStatus(lead.id, value as Lead['status'])}
                            >
                              <SelectTrigger className={cn(
                                'h-8 w-24 border text-xs font-medium',
                                statusConfig[lead.status].bgColor,
                                statusConfig[lead.status].color
                              )}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="new">חדש</SelectItem>
                                <SelectItem value="in_progress">בטיפול</SelectItem>
                                <SelectItem value="handled">טופל</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <p className="text-sm text-muted-foreground line-clamp-2 max-w-[200px]">
                              {lead.adminNotes || '-'}
                            </p>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {formatDate(lead.createdAt)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {/* WhatsApp */}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                asChild
                              >
                                <a 
                                  href={getWhatsAppLink(lead.phone)} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  title="WhatsApp"
                                >
                                  <Send className="size-4" />
                                </a>
                              </Button>
                              
                              {/* Email */}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                asChild
                              >
                                <a href={`mailto:${lead.email}`} title="שלח מייל">
                                  <Mail className="size-4" />
                                </a>
                              </Button>

                              {/* Edit */}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                onClick={() => openEditDialog(lead)}
                              >
                                <Edit2 className="size-4" />
                              </Button>

                              {/* Deactivate */}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                onClick={() => openDeactivateDialog(lead)}
                                title="העבר לא פעיל"
                              >
                                <ToggleLeft className="size-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </Card>
          </div>

          {/* Mobile Cards */}
          <div className="lg:hidden space-y-3">
            {filteredLeads.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <MessageSquare className="size-10 mx-auto mb-3 text-muted-foreground/50" />
                  <p className="text-muted-foreground">לא נמצאו פניות</p>
                </CardContent>
              </Card>
            ) : (
              filteredLeads.map((lead) => {
                const CategoryIcon = categoryConfig[lead.category].icon
                return (
                  <Card key={lead.id} className={cn(
                    lead.status === 'new' && 'border-s-4 border-s-blue-500'
                  )}>
                    <CardContent className="p-4">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            'size-10 rounded-lg flex items-center justify-center',
                            categoryConfig[lead.category].color
                          )}>
                            <CategoryIcon className="size-5" />
                          </div>
                          <div>
                            <h3 className="font-semibold">{lead.fullName}</h3>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(lead.createdAt)}
                            </span>
                          </div>
                        </div>
                        <Badge className={cn(
                          'text-xs',
                          statusConfig[lead.status].bgColor,
                          statusConfig[lead.status].color
                        )}>
                          {statusConfig[lead.status].label}
                        </Badge>
                      </div>

                      {/* Contact Info */}
                      <div className="space-y-2 mb-3">
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="size-4 text-muted-foreground" />
                          <span dir="ltr">{lead.phone}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="size-4 text-muted-foreground" />
                          <span className="truncate">{lead.email}</span>
                        </div>
                      </div>

                      {/* Category */}
                      <div className="mb-3">
                        <Badge variant="secondary" className={cn(
                          'text-xs',
                          categoryConfig[lead.category].color
                        )}>
                          {categoryConfig[lead.category].label}
                        </Badge>
                      </div>

                      {/* Notes */}
                      {lead.adminNotes && (
                        <div className="mb-3 p-2 bg-muted/50 rounded text-sm text-muted-foreground">
                          {lead.adminNotes}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-3 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                          asChild
                        >
                          <a 
                            href={getWhatsAppLink(lead.phone)} 
                            target="_blank" 
                            rel="noopener noreferrer"
                          >
                            <Send className="size-4 me-1" />
                            WhatsApp
                          </a>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          asChild
                        >
                          <a href={`mailto:${lead.email}`}>
                            <Mail className="size-4 me-1" />
                            מייל
                          </a>
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon" className="size-8">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            <DropdownMenuItem onClick={() => openEditDialog(lead)}>
                              <Edit2 className="size-4 me-2" />
                              עריכה
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => updateStatus(lead.id, 'new')}>
                              <AlertCircle className="size-4 me-2 text-blue-600" />
                              סמן כחדש
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateStatus(lead.id, 'in_progress')}>
                              <Clock className="size-4 me-2 text-amber-600" />
                              סמן בטיפול
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateStatus(lead.id, 'handled')}>
                              <CheckCircle2 className="size-4 me-2 text-emerald-600" />
                              סמן כטופל
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => openDeactivateDialog(lead)}
                              className="text-amber-600"
                            >
                              <ToggleLeft className="size-4 me-2" />
                              העבר לארכיון
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
        </div>
      </main>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>עריכת פנייה</DialogTitle>
            <DialogDescription>
              עדכון פרטי הפנייה והערות
            </DialogDescription>
          </DialogHeader>

          {editForm && (
            <div className="space-y-4">
              <Field>
                <FieldLabel>שם מלא</FieldLabel>
                <Input
                  value={editForm.fullName}
                  onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field>
                  <FieldLabel>טלפון</FieldLabel>
                  <Input
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    dir="ltr"
                  />
                </Field>
                <Field>
                  <FieldLabel>אימייל</FieldLabel>
                  <Input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    dir="ltr"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field>
                  <FieldLabel>קטגוריה</FieldLabel>
                  <Select
                    value={editForm.category}
                    onValueChange={(value) => setEditForm({ ...editForm, category: value as Lead['category'] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">כללי</SelectItem>
                      <SelectItem value="abandoned_checkout">לא המשיכו לתשלום</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel>סטטוס</FieldLabel>
                  <Select
                    value={editForm.status}
                    onValueChange={(value) => setEditForm({ ...editForm, status: value as Lead['status'] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">חדש</SelectItem>
                      <SelectItem value="in_progress">בטיפול</SelectItem>
                      <SelectItem value="handled">טופל</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <Field>
                <FieldLabel>הערות אדמין</FieldLabel>
                <Textarea
                  value={editForm.adminNotes}
                  onChange={(e) => setEditForm({ ...editForm, adminNotes: e.target.value })}
                  placeholder="הוסף הערות..."
                  rows={4}
                />
              </Field>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              ביטול
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Spinner className="me-2" />}
              שמירה
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate Confirmation */}
      <ConfirmDialog
        open={deactivateDialogOpen}
        onOpenChange={setDeactivateDialogOpen}
        title="העברה לארכיון"
        description={`האם אתה בטוח שברצונך להעביר את הפנייה של ${selectedLead?.fullName} לארכיון? הפנייה תסומן כלא פעילה וניתן יהיה לשחזר אותה מדף הארכיון.`}
        confirmLabel="העבר לארכיון"
        variant="default"
        onConfirm={handleDeactivate}
      />
    </div>
  )
}
