'use client'

import React, { useState } from 'react'
import { Plus, Edit2, Trash2, Building2, CreditCard, ChevronDown, ChevronUp } from 'lucide-react'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { Empty, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { ConfirmDialog } from '@/components/admin/confirm-dialog'
import { Spinner } from '@/components/ui/spinner'
import { Badge } from '@/components/ui/badge'
import type { Vendor, VendorProductLink } from '@/lib/api'

// Mock data
const mockVendors: Vendor[] = [
  {
    id: '1',
    name: 'חברת הביטוח הישראלית',
    contactName: 'משה לוי',
    phone: '03-1234567',
    email: 'contact@insurance.co.il',
    address: 'תל אביב, רחוב הרצל 15',
    bankName: 'בנק הפועלים',
    bankNum: '12',
    branchNum: '123',
    accountNum: '123456',
    accountHolder: 'חברת הביטוח הישראלית בע"מ',
    productLinks: [
      { productId: '1', vendorCost: 150 },
      { productId: '2', vendorCost: 200 },
    ],
    createdAt: '2024-01-10',
  },
  {
    id: '2',
    name: 'ביטוח ישיר',
    contactName: 'שרה כהן',
    phone: '03-9876543',
    email: 'info@direct.co.il',
    address: 'חיפה, שדרות הנשיא 20',
    bankName: 'בנק לאומי',
    bankNum: '10',
    branchNum: '456',
    accountNum: '654321',
    accountHolder: 'ביטוח ישיר בע"מ',
    productLinks: [
      { productId: '3', vendorCost: 180 },
    ],
    createdAt: '2024-02-05',
  },
]

interface VendorFormData {
  name: string
  contactName: string
  phone: string
  email: string
  address: string
  bankName: string
  bankNum: string
  branchNum: string
  accountNum: string
  accountHolder: string
}

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>(mockVendors)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null)
  const [expandedVendor, setExpandedVendor] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState<VendorFormData>({
    name: '',
    contactName: '',
    phone: '',
    email: '',
    address: '',
    bankName: '',
    bankNum: '',
    branchNum: '',
    accountNum: '',
    accountHolder: '',
  })

  const openCreateDialog = () => {
    setSelectedVendor(null)
    setFormData({
      name: '',
      contactName: '',
      phone: '',
      email: '',
      address: '',
      bankName: '',
      bankNum: '',
      branchNum: '',
      accountNum: '',
      accountHolder: '',
    })
    setIsDialogOpen(true)
  }

  const openEditDialog = (vendor: Vendor) => {
    setSelectedVendor(vendor)
    setFormData({
      name: vendor.name,
      contactName: vendor.contactName || '',
      phone: vendor.phone || '',
      email: vendor.email || '',
      address: vendor.address || '',
      bankName: vendor.bankName || '',
      bankNum: vendor.bankNum || '',
      branchNum: vendor.branchNum || '',
      accountNum: vendor.accountNum || '',
      accountHolder: vendor.accountHolder || '',
    })
    setIsDialogOpen(true)
  }

  const openDeleteDialog = (vendor: Vendor) => {
    setSelectedVendor(vendor)
    setIsDeleteDialogOpen(true)
  }

  const toggleExpand = (vendorId: string) => {
    setExpandedVendor(expandedVendor === vendorId ? null : vendorId)
  }

  const handleSubmit = async () => {
    setIsLoading(true)
    await new Promise(resolve => setTimeout(resolve, 500))
    
    if (selectedVendor) {
      setVendors(prev => prev.map(v => 
        v.id === selectedVendor.id 
          ? { ...v, ...formData }
          : v
      ))
    } else {
      const newVendor: Vendor = {
        id: Date.now().toString(),
        ...formData,
        productLinks: [],
        createdAt: new Date().toISOString().split('T')[0],
      }
      setVendors(prev => [...prev, newVendor])
    }
    
    setIsLoading(false)
    setIsDialogOpen(false)
  }

  const handleDelete = async () => {
    if (!selectedVendor) return
    
    setIsLoading(true)
    await new Promise(resolve => setTimeout(resolve, 500))
    
    setVendors(prev => prev.filter(v => v.id !== selectedVendor.id))
    setIsLoading(false)
    setIsDeleteDialogOpen(false)
    setSelectedVendor(null)
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">ספקים</h1>
          <p className="text-muted-foreground">ניהול ספקים ופרטי בנק</p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="size-4 me-2" />
          הוסף ספק
        </Button>
      </div>

      {/* Vendors Table */}
      <Card>
        <CardHeader>
          <CardTitle>רשימת ספקים</CardTitle>
          <CardDescription>{vendors.length} ספקים במערכת</CardDescription>
        </CardHeader>
        <CardContent>
          {vendors.length === 0 ? (
            <Empty>
              <EmptyMedia variant="icon">
                <Building2 className="size-8" />
              </EmptyMedia>
              <EmptyTitle>אין ספקים עדיין</EmptyTitle>
              <EmptyDescription>התחל בהוספת ספק ראשון למערכת</EmptyDescription>
              <Button onClick={openCreateDialog} className="mt-4">
                <Plus className="size-4 me-2" />
                הוסף ספק חדש
              </Button>
            </Empty>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>שם ספק</TableHead>
                    <TableHead>איש קשר</TableHead>
                    <TableHead>טלפון</TableHead>
                    <TableHead>מוצרים</TableHead>
                    <TableHead className="w-24">פעולות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendors.map((vendor) => (
                    <React.Fragment key={vendor.id}>
                      <TableRow className="group">
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-6"
                            onClick={() => toggleExpand(vendor.id)}
                          >
                            {expandedVendor === vendor.id ? (
                              <ChevronUp className="size-4" />
                            ) : (
                              <ChevronDown className="size-4" />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell className="font-medium">{vendor.name}</TableCell>
                        <TableCell>{vendor.contactName || '-'}</TableCell>
                        <TableCell dir="ltr" className="text-start">{vendor.phone || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {vendor.productLinks?.length || 0} מוצרים
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(vendor)}
                            >
                              <Edit2 className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openDeleteDialog(vendor)}
                            >
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {expandedVendor === vendor.id && (
                        <TableRow key={`${vendor.id}-expanded`}>
                          <TableCell colSpan={6} className="bg-muted/50 p-4">
                            <div className="grid gap-4 md:grid-cols-2">
                              {/* Contact Info */}
                              <div className="space-y-2">
                                <h4 className="font-medium text-sm">פרטי קשר</h4>
                                <div className="text-sm space-y-1">
                                  <p><span className="text-muted-foreground">אימייל:</span> {vendor.email || '-'}</p>
                                  <p><span className="text-muted-foreground">כתובת:</span> {vendor.address || '-'}</p>
                                </div>
                              </div>
                              
                              {/* Bank Details */}
                              <div className="space-y-2">
                                <h4 className="font-medium text-sm flex items-center gap-2">
                                  <CreditCard className="size-4" />
                                  פרטי בנק
                                </h4>
                                <div className="text-sm space-y-1">
                                  <p><span className="text-muted-foreground">בנק:</span> {vendor.bankName || '-'} ({vendor.bankNum || '-'})</p>
                                  <p><span className="text-muted-foreground">סניף:</span> {vendor.branchNum || '-'}</p>
                                  <p><span className="text-muted-foreground">חשבון:</span> {vendor.accountNum || '-'}</p>
                                  <p><span className="text-muted-foreground">שם בעל החשבון:</span> {vendor.accountHolder || '-'}</p>
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedVendor ? 'עריכת ספק' : 'הוספת ספק חדש'}
            </DialogTitle>
            <DialogDescription>
              {selectedVendor ? 'עדכן את פרטי הספק' : 'הזן את פרטי הספק החדש'}
            </DialogDescription>
          </DialogHeader>
          
          <Tabs defaultValue="details" className="mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="details">פרטים כלליים</TabsTrigger>
              <TabsTrigger value="bank">פרטי בנק</TabsTrigger>
            </TabsList>
            
            <TabsContent value="details" className="space-y-4 mt-4">
              <FieldGroup>
                <Field>
                  <FieldLabel>שם ספק</FieldLabel>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="שם החברה"
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel>איש קשר</FieldLabel>
                    <Input
                      value={formData.contactName}
                      onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                      placeholder="שם מלא"
                    />
                  </Field>
                  <Field>
                    <FieldLabel>טלפון</FieldLabel>
                    <Input
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="03-1234567"
                      dir="ltr"
                    />
                  </Field>
                </div>
                <Field>
                  <FieldLabel>אימייל</FieldLabel>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="contact@example.com"
                    dir="ltr"
                  />
                </Field>
                <Field>
                  <FieldLabel>כתובת</FieldLabel>
                  <Input
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="עיר, רחוב ומספר"
                  />
                </Field>
              </FieldGroup>
            </TabsContent>
            
            <TabsContent value="bank" className="space-y-4 mt-4">
              <FieldGroup>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel>שם בנק</FieldLabel>
                    <Input
                      value={formData.bankName}
                      onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                      placeholder="לדוגמה: בנק הפועלים"
                    />
                  </Field>
                  <Field>
                    <FieldLabel>מספר בנק</FieldLabel>
                    <Input
                      value={formData.bankNum}
                      onChange={(e) => setFormData({ ...formData, bankNum: e.target.value })}
                      placeholder="12"
                      dir="ltr"
                    />
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel>מספר סניף</FieldLabel>
                    <Input
                      value={formData.branchNum}
                      onChange={(e) => setFormData({ ...formData, branchNum: e.target.value })}
                      placeholder="123"
                      dir="ltr"
                    />
                  </Field>
                  <Field>
                    <FieldLabel>מספר חשבון</FieldLabel>
                    <Input
                      value={formData.accountNum}
                      onChange={(e) => setFormData({ ...formData, accountNum: e.target.value })}
                      placeholder="123456"
                      dir="ltr"
                    />
                  </Field>
                </div>
                <Field>
                  <FieldLabel>שם בעל החשבון</FieldLabel>
                  <Input
                    value={formData.accountHolder}
                    onChange={(e) => setFormData({ ...formData, accountHolder: e.target.value })}
                    placeholder="שם כפי שמופיע בבנק"
                  />
                </Field>
              </FieldGroup>
            </TabsContent>
          </Tabs>

          <DialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse mt-6">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              ביטול
            </Button>
            <Button onClick={handleSubmit} disabled={isLoading || !formData.name}>
              {isLoading && <Spinner className="me-2" />}
              {selectedVendor ? 'עדכן' : 'הוסף'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title="מחיקת ספק"
        description={`האם אתה בטוח שברצונך למחוק את הספק "${selectedVendor?.name}"? פעולה זו אינה ניתנת לביטול.`}
        confirmLabel="מחק"
        variant="destructive"
        isLoading={isLoading}
        onConfirm={handleDelete}
      />
    </div>
  )
}
