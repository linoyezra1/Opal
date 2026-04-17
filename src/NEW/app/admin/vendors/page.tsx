'use client'

import React, { useState, useMemo } from 'react'
import { 
  Plus, Edit2, Building2, CreditCard, ChevronDown, ChevronUp, 
  ToggleLeft, ToggleRight, Package, Phone, Mail, MapPin
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
import { UnifiedFilter, FilterConfig, FilterValues } from '@/components/admin/unified-filter'
import { Spinner } from '@/components/ui/spinner'
import { Badge } from '@/components/ui/badge'
import type { Vendor } from '@/lib/api'

// Opal Brand Colors
const OPAL_BLUE = '#1A365D'
const OPAL_GOLD = '#C5A059'

// Enhanced Mock data with products
const mockVendors: (Vendor & { products?: { id: string; sku: string; name: string; vendorCost: number; retailPrice: number }[] })[] = [
  {
    id: '1',
    name: 'Opal Medical Services',
    contactName: 'משה לוי',
    phone: '+972-54-1234567',
    email: 'support@opal-med.co.il',
    address: 'תל אביב, ישראל',
    bankName: 'בנק הפועלים',
    bankNum: '12',
    branchNum: '123',
    accountNum: '123456',
    accountHolder: 'אופאל שירותים רפואיים בע"מ',
    productLinks: [
      { productId: '1', vendorCost: 79 },
      { productId: '2', vendorCost: 129 },
    ],
    products: [
      { id: '1', sku: 'OP-MED-BASE', name: 'Basic Medical Plan', vendorCost: 79, retailPrice: 119 },
      { id: '2', sku: 'OP-MED-PRO', name: 'Pro Medical Plan', vendorCost: 129, retailPrice: 189 },
    ],
    isActive: true,
    createdAt: '2024-01-10',
  },
  {
    id: '2',
    name: 'ביטוח ישיר',
    contactName: 'שרה כהן',
    phone: '+972-3-9876543',
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
    products: [
      { id: '3', sku: 'DI-CARE-001', name: 'ביטוח סיעודי מורחב', vendorCost: 180, retailPrice: 250 },
    ],
    isActive: true,
    createdAt: '2024-02-05',
  },
  {
    id: '3',
    name: 'רפואה שלמה',
    contactName: 'יעקב אברהם',
    phone: '+972-2-5551234',
    email: 'contact@refuah.co.il',
    address: 'ירושלים, רחוב יפו 100',
    bankName: 'בנק דיסקונט',
    bankNum: '11',
    branchNum: '789',
    accountNum: '987654',
    accountHolder: 'רפואה שלמה בע"מ',
    productLinks: [],
    products: [],
    isActive: true,
    createdAt: '2024-03-15',
  },
]

// Filter configuration
const filterConfig: FilterConfig[] = [
  {
    key: 'search',
    label: 'חיפוש',
    type: 'text',
    placeholder: 'חיפוש לפי שם, טלפון או אימייל...',
  },
  {
    key: 'hasProducts',
    label: 'מוצרים',
    type: 'select',
    options: [
      { value: 'yes', label: 'יש מוצרים' },
      { value: 'no', label: 'ללא מוצרים' },
    ],
  },
  {
    key: 'bank',
    label: 'בנק',
    type: 'select',
    options: [
      { value: '12', label: 'בנק הפועלים' },
      { value: '10', label: 'בנק לאומי' },
      { value: '11', label: 'בנק דיסקונט' },
    ],
  },
  {
    key: 'createdFrom',
    label: 'נוצר מתאריך',
    type: 'date',
  },
  {
    key: 'createdTo',
    label: 'נוצר עד תאריך',
    type: 'date',
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
  const [vendors, setVendors] = useState(mockVendors)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeactivateDialogOpen, setIsDeactivateDialogOpen] = useState(false)
  const [selectedVendor, setSelectedVendor] = useState<typeof mockVendors[0] | null>(null)
  const [expandedVendor, setExpandedVendor] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isFiltering, setIsFiltering] = useState(false)
  
  // Filter state
  const [filterValues, setFilterValues] = useState<FilterValues>({
    search: '',
    hasProducts: '',
    bank: '',
    createdFrom: '',
    createdTo: '',
  })
  
  // Filter only active vendors
  const activeVendors = vendors.filter(v => v.isActive)
  
  // Apply filters
  const filteredVendors = useMemo(() => {
    return activeVendors.filter(vendor => {
      // Text search
      if (filterValues.search) {
        const search = filterValues.search.toLowerCase()
        const matchesSearch = 
          vendor.name.toLowerCase().includes(search) ||
          vendor.contactName?.toLowerCase().includes(search) ||
          vendor.phone?.includes(search) ||
          vendor.email?.toLowerCase().includes(search)
        if (!matchesSearch) return false
      }
      
      // Has products filter
      if (filterValues.hasProducts === 'yes' && (!vendor.products || vendor.products.length === 0)) {
        return false
      }
      if (filterValues.hasProducts === 'no' && vendor.products && vendor.products.length > 0) {
        return false
      }
      
      // Bank filter
      if (filterValues.bank && vendor.bankNum !== filterValues.bank) {
        return false
      }
      
      return true
    })
  }, [activeVendors, filterValues])
  
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

  const handleFilterChange = (values: FilterValues) => {
    setFilterValues(values)
  }

  const handleFilterClear = () => {
    setFilterValues({
      search: '',
      hasProducts: '',
      bank: '',
      createdFrom: '',
      createdTo: '',
    })
  }

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

  const openEditDialog = (vendor: typeof mockVendors[0]) => {
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

  const openDeactivateDialog = (vendor: typeof mockVendors[0]) => {
    setSelectedVendor(vendor)
    setIsDeactivateDialogOpen(true)
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
      const newVendor = {
        id: Date.now().toString(),
        ...formData,
        productLinks: [],
        products: [],
        isActive: true,
        createdAt: new Date().toISOString().split('T')[0],
      }
      setVendors(prev => [...prev, newVendor])
    }
    
    setIsLoading(false)
    setIsDialogOpen(false)
  }

  const handleDeactivate = async () => {
    if (!selectedVendor) return
    
    setIsLoading(true)
    await new Promise(resolve => setTimeout(resolve, 500))
    
    setVendors(prev => prev.map(v => 
      v.id === selectedVendor.id 
        ? { ...v, isActive: false }
        : v
    ))
    
    setIsLoading(false)
    setIsDeactivateDialogOpen(false)
    setSelectedVendor(null)
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: OPAL_BLUE }}>
            ספקים
          </h1>
          <p className="text-muted-foreground">ניהול ספקים ומוצרים משויכים</p>
        </div>
        <Button onClick={openCreateDialog} style={{ backgroundColor: OPAL_BLUE }}>
          <Plus className="size-4 me-2" />
          הוסף ספק
        </Button>
      </div>

      {/* Unified Filter */}
      <UnifiedFilter
        filters={filterConfig}
        values={filterValues}
        onChange={handleFilterChange}
        onClear={handleFilterClear}
        resultsCount={filteredVendors.length}
        totalCount={activeVendors.length}
        isLoading={isFiltering}
      />

      {/* Vendors List */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">רשימת ספקים</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredVendors.length === 0 ? (
            <div className="p-8">
              <Empty>
                <EmptyMedia variant="icon">
                  <Building2 className="size-8" />
                </EmptyMedia>
                <EmptyTitle>
                  {activeVendors.length === 0 ? 'אין ספקים עדיין' : 'לא נמצאו תוצאות'}
                </EmptyTitle>
                <EmptyDescription>
                  {activeVendors.length === 0 
                    ? 'התחל בהוספת ספק ראשון למערכת'
                    : 'נסה לשנות את הגדרות החיפוש'
                  }
                </EmptyDescription>
                {activeVendors.length === 0 && (
                  <Button onClick={openCreateDialog} className="mt-4" style={{ backgroundColor: OPAL_BLUE }}>
                    <Plus className="size-4 me-2" />
                    הוסף ספק חדש
                  </Button>
                )}
              </Empty>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50">
                    <TableHead className="w-10"></TableHead>
                    <TableHead>ספק</TableHead>
                    <TableHead>איש קשר</TableHead>
                    <TableHead>סטטוס</TableHead>
                    <TableHead>מוצרים</TableHead>
                    <TableHead className="w-28 text-center">פעולות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVendors.map((vendor) => (
                    <React.Fragment key={vendor.id}>
                      <TableRow 
                        className={`group transition-colors ${expandedVendor === vendor.id ? 'bg-slate-50' : 'hover:bg-slate-50/50'}`}
                      >
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            onClick={() => toggleExpand(vendor.id)}
                          >
                            {expandedVendor === vendor.id ? (
                              <ChevronUp className="size-4" />
                            ) : (
                              <ChevronDown className="size-4" />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div 
                              className="size-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                              style={{ backgroundColor: OPAL_BLUE }}
                            >
                              {vendor.name.charAt(0)}
                            </div>
                            <div>
                              <div className="font-medium">{vendor.name}</div>
                              <div className="text-xs text-muted-foreground" dir="ltr">
                                {vendor.email}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="text-sm">{vendor.contactName || '-'}</div>
                            <div className="text-xs text-muted-foreground" dir="ltr">
                              {vendor.phone || '-'}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className="border-emerald-200"
                            style={{ backgroundColor: '#ecfdf5', color: '#059669' }}
                          >
                            <ToggleRight className="size-3 me-1" />
                            פעיל
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="secondary"
                            className="gap-1"
                            style={{ 
                              backgroundColor: vendor.products && vendor.products.length > 0 ? `${OPAL_GOLD}20` : undefined,
                              color: vendor.products && vendor.products.length > 0 ? OPAL_BLUE : undefined
                            }}
                          >
                            <Package className="size-3" />
                            {vendor.products?.length || 0}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              onClick={() => openEditDialog(vendor)}
                              title="ערוך"
                            >
                              <Edit2 className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                              onClick={() => openDeactivateDialog(vendor)}
                              title="העבר לא פעיל"
                            >
                              <ToggleLeft className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      
                      {/* Expanded Row - Products & Details */}
                      {expandedVendor === vendor.id && (
                        <TableRow>
                          <TableCell colSpan={6} className="p-0">
                            <div className="bg-gradient-to-b from-slate-50 to-white p-6 border-t">
                              <div className="grid gap-6 md:grid-cols-3">
                                {/* Contact Info */}
                                <div className="space-y-3">
                                  <h4 className="font-medium text-sm flex items-center gap-2" style={{ color: OPAL_BLUE }}>
                                    <Mail className="size-4" />
                                    פרטי קשר
                                  </h4>
                                  <div className="text-sm space-y-2 bg-white rounded-lg p-4 shadow-sm border border-slate-100">
                                    <div className="flex items-center gap-2">
                                      <Phone className="size-3.5 text-muted-foreground" />
                                      <span dir="ltr">{vendor.phone || '-'}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Mail className="size-3.5 text-muted-foreground" />
                                      <span dir="ltr">{vendor.email || '-'}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <MapPin className="size-3.5 text-muted-foreground" />
                                      <span>{vendor.address || '-'}</span>
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Bank Details */}
                                <div className="space-y-3">
                                  <h4 className="font-medium text-sm flex items-center gap-2" style={{ color: OPAL_BLUE }}>
                                    <CreditCard className="size-4" />
                                    פרטי בנק
                                  </h4>
                                  <div className="text-sm space-y-2 bg-white rounded-lg p-4 shadow-sm border border-slate-100">
                                    <p><span className="text-muted-foreground">בנק:</span> {vendor.bankName || '-'} ({vendor.bankNum || '-'})</p>
                                    <p><span className="text-muted-foreground">סניף:</span> {vendor.branchNum || '-'}</p>
                                    <p><span className="text-muted-foreground">חשבון:</span> {vendor.accountNum || '-'}</p>
                                    <p><span className="text-muted-foreground">בעל החשבון:</span> {vendor.accountHolder || '-'}</p>
                                  </div>
                                </div>
                                
                                {/* Products */}
                                <div className="space-y-3">
                                  <h4 className="font-medium text-sm flex items-center gap-2" style={{ color: OPAL_BLUE }}>
                                    <Package className="size-4" />
                                    מוצרים משויכים ({vendor.products?.length || 0})
                                  </h4>
                                  <div className="bg-white rounded-lg shadow-sm border border-slate-100 overflow-hidden">
                                    {vendor.products && vendor.products.length > 0 ? (
                                      <div className="divide-y divide-slate-100">
                                        {vendor.products.map((product) => (
                                          <div key={product.id} className="p-3 flex items-center justify-between">
                                            <div>
                                              <div className="text-sm font-medium">{product.name}</div>
                                              <div className="text-xs text-muted-foreground">{product.sku}</div>
                                            </div>
                                            <div className="text-left">
                                              <div className="text-sm font-medium">₪{product.retailPrice}</div>
                                              <div className="text-xs text-muted-foreground">עלות: ₪{product.vendorCost}</div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="p-4 text-center text-sm text-muted-foreground">
                                        אין מוצרים משויכים
                                      </div>
                                    )}
                                  </div>
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
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedVendor ? 'עריכת ספק' : 'הוספת ספק חדש'}
            </DialogTitle>
            <DialogDescription>
              {selectedVendor ? 'עדכן את פרטי הספק' : 'מלא את פרטי הספק החדש'}
            </DialogDescription>
          </DialogHeader>
          
          <Tabs defaultValue="general" className="mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="general">פרטים כלליים</TabsTrigger>
              <TabsTrigger value="bank">פרטי בנק</TabsTrigger>
            </TabsList>
            
            <TabsContent value="general" className="space-y-4 mt-4">
              <FieldGroup>
                <Field>
                  <FieldLabel>שם הספק *</FieldLabel>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="הכנס שם ספק"
                  />
                </Field>
                
                <Field>
                  <FieldLabel>איש קשר</FieldLabel>
                  <Input
                    value={formData.contactName}
                    onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                    placeholder="שם איש הקשר"
                  />
                </Field>
              </FieldGroup>
              
              <FieldGroup>
                <Field>
                  <FieldLabel>טלפון</FieldLabel>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+972-XX-XXXXXXX"
                    dir="ltr"
                  />
                </Field>
                
                <Field>
                  <FieldLabel>אימייל</FieldLabel>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="email@example.com"
                    dir="ltr"
                  />
                </Field>
              </FieldGroup>
              
              <Field>
                <FieldLabel>כתובת</FieldLabel>
                <Input
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="עיר, רחוב ומספר"
                />
              </Field>
            </TabsContent>
            
            <TabsContent value="bank" className="space-y-4 mt-4">
              <FieldGroup>
                <Field>
                  <FieldLabel>שם הבנק</FieldLabel>
                  <Input
                    value={formData.bankName}
                    onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                    placeholder="בנק הפועלים"
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
              </FieldGroup>
              
              <FieldGroup>
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
              </FieldGroup>
              
              <Field>
                <FieldLabel>שם בעל החשבון</FieldLabel>
                <Input
                  value={formData.accountHolder}
                  onChange={(e) => setFormData({ ...formData, accountHolder: e.target.value })}
                  placeholder="שם מלא של בעל החשבון"
                />
              </Field>
            </TabsContent>
          </Tabs>
          
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              ביטול
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={isLoading || !formData.name}
              style={{ backgroundColor: OPAL_BLUE }}
            >
              {isLoading ? <Spinner className="me-2" /> : null}
              {selectedVendor ? 'שמור שינויים' : 'הוסף ספק'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate Confirmation */}
      <ConfirmDialog
        open={isDeactivateDialogOpen}
        onOpenChange={setIsDeactivateDialogOpen}
        title="העברה לארכיון"
        description={`האם אתה בטוח שברצונך להעביר את הספק "${selectedVendor?.name}" לארכיון? הספק יסומן כלא פעיל וניתן יהיה לשחזר אותו מדף הארכיון.`}
        confirmLabel="העבר לארכיון"
        variant="default"
        isLoading={isLoading}
        onConfirm={handleDeactivate}
      />
    </div>
  )
}
