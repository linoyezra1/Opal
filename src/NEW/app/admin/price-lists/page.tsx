'use client'

import { useState } from 'react'
import { Plus, Edit2, Trash2, Receipt, Copy, Link2, ExternalLink, ToggleLeft, ToggleRight } from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { Empty, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { ConfirmDialog } from '@/components/admin/confirm-dialog'
import { Spinner } from '@/components/ui/spinner'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { PriceList, PriceListLine } from '@/lib/api'

// Mock data
const mockVendors = [
  { id: '1', name: 'חברת הביטוח הישראלית', products: [
    { productId: '1', vendorCost: 150 },
    { productId: '2', vendorCost: 200 },
  ]},
  { id: '2', name: 'ביטוח ישיר', products: [
    { productId: '3', vendorCost: 180 },
  ]},
]

const mockProducts = [
  { id: '1', name: 'ביטוח בריאות בסיסי' },
  { id: '2', name: 'ביטוח חיים פרימיום' },
  { id: '3', name: 'ביטוח סיעודי' },
]

const mockPriceLists: PriceList[] = [
  {
    id: '1',
    name: 'מחירון ארגון א',
    organizationName: 'חברת היי-טק בע"מ',
    lines: [
      { vendorId: '1', productId: '1', retailPrice: 250, defaultAgentCommission: 50, vendorCost: 150 },
      { vendorId: '1', productId: '2', retailPrice: 350, defaultAgentCommission: 75, vendorCost: 200 },
    ],
    landingUrl: '/landing/1',
    isActive: true,
    createdAt: '2024-01-20',
  },
  {
    id: '2',
    name: 'מחירון כללי',
    organizationName: 'לקוחות פרטיים',
    lines: [
      { vendorId: '2', productId: '3', retailPrice: 300, defaultAgentCommission: 60, vendorCost: 180 },
    ],
    landingUrl: '/landing/2',
    isActive: true,
    createdAt: '2024-02-15',
  },
]

interface PriceListFormData {
  name: string
  organizationName: string
  lines: PriceListLine[]
}

export default function PriceListsPage() {
  const [priceLists, setPriceLists] = useState<PriceList[]>(mockPriceLists)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeactivateDialogOpen, setIsDeactivateDialogOpen] = useState(false)
  const [selectedPriceList, setSelectedPriceList] = useState<PriceList | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  
  // Filter only active price lists
  const activePriceLists = priceLists.filter(p => p.isActive)
  const [formData, setFormData] = useState<PriceListFormData>({
    name: '',
    organizationName: '',
    lines: [],
  })

  const openCreateDialog = () => {
    setSelectedPriceList(null)
    setFormData({
      name: '',
      organizationName: '',
      lines: [{ vendorId: '', productId: '', retailPrice: 0, defaultAgentCommission: 0 }],
    })
    setIsDialogOpen(true)
  }

  const openEditDialog = (priceList: PriceList) => {
    setSelectedPriceList(priceList)
    setFormData({
      name: priceList.name,
      organizationName: priceList.organizationName || '',
      lines: priceList.lines.length > 0 ? priceList.lines : 
        [{ vendorId: '', productId: '', retailPrice: 0, defaultAgentCommission: 0 }],
    })
    setIsDialogOpen(true)
  }

  const openDeactivateDialog = (priceList: PriceList) => {
    setSelectedPriceList(priceList)
    setIsDeactivateDialogOpen(true)
  }

  const addLine = () => {
    setFormData(prev => ({
      ...prev,
      lines: [...prev.lines, { vendorId: '', productId: '', retailPrice: 0, defaultAgentCommission: 0 }],
    }))
  }

  const removeLine = (index: number) => {
    setFormData(prev => ({
      ...prev,
      lines: prev.lines.filter((_, i) => i !== index),
    }))
  }

  const updateLine = (index: number, field: keyof PriceListLine, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      lines: prev.lines.map((line, i) => {
        if (i !== index) return line
        
        const updatedLine = { ...line, [field]: value }
        
        // Auto-fill vendor cost when vendor and product are selected
        if (field === 'vendorId' || field === 'productId') {
          const vendor = mockVendors.find(v => v.id === updatedLine.vendorId)
          const productLink = vendor?.products.find(p => p.productId === updatedLine.productId)
          if (productLink) {
            updatedLine.vendorCost = productLink.vendorCost
          }
        }
        
        return updatedLine
      }),
    }))
  }

  const getVendorProducts = (vendorId: string) => {
    const vendor = mockVendors.find(v => v.id === vendorId)
    if (!vendor) return []
    return vendor.products.map(p => {
      const product = mockProducts.find(prod => prod.id === p.productId)
      return { ...p, name: product?.name || p.productId }
    })
  }

  const calculateProfit = (line: PriceListLine) => {
    const vendorCost = line.vendorCost || 0
    const profitBeforeAgent = line.retailPrice - vendorCost
    const netProfit = profitBeforeAgent - line.defaultAgentCommission
    return { profitBeforeAgent, netProfit }
  }

  const handleSubmit = async () => {
    setIsLoading(true)
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Add calculated fields to lines
    const linesWithCalc = formData.lines.map(line => ({
      ...line,
      ...calculateProfit(line),
    }))
    
    if (selectedPriceList) {
      setPriceLists(prev => prev.map(p => 
        p.id === selectedPriceList.id 
          ? { ...p, ...formData, lines: linesWithCalc }
          : p
      ))
    } else {
      const newPriceList: PriceList = {
        id: Date.now().toString(),
        ...formData,
        lines: linesWithCalc,
        landingUrl: `/landing/${Date.now()}`,
        isActive: true,
        createdAt: new Date().toISOString().split('T')[0],
      }
      setPriceLists(prev => [...prev, newPriceList])
    }
    
    setIsLoading(false)
    setIsDialogOpen(false)
  }

  const handleDeactivate = async () => {
    if (!selectedPriceList) return
    
    setIsLoading(true)
    await new Promise(resolve => setTimeout(resolve, 500))
    
    setPriceLists(prev => prev.map(p => 
      p.id === selectedPriceList.id 
        ? { ...p, isActive: false }
        : p
    ))
    setIsLoading(false)
    setIsDeactivateDialogOpen(false)
    setSelectedPriceList(null)
  }

  const copyLandingUrl = (url: string) => {
    const fullUrl = `${window.location.origin}${url}`
    navigator.clipboard.writeText(fullUrl)
    // Could add toast notification here
  }

  const getProductName = (productId: string) => {
    return mockProducts.find(p => p.id === productId)?.name || productId
  }

  const getVendorName = (vendorId: string) => {
    return mockVendors.find(v => v.id === vendorId)?.name || vendorId
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">מחירונים</h1>
          <p className="text-muted-foreground">ניהול מחירונים ודפי נחיתה</p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="size-4 me-2" />
          צור מחירון
        </Button>
      </div>

      {/* Price Lists Table */}
      <Card>
        <CardHeader>
          <CardTitle>רשימת מחירונים</CardTitle>
          <CardDescription>{activePriceLists.length} מחירונים פעילים במערכת</CardDescription>
        </CardHeader>
        <CardContent>
          {activePriceLists.length === 0 ? (
            <Empty>
              <EmptyMedia variant="icon">
                <Receipt className="size-8" />
              </EmptyMedia>
              <EmptyTitle>אין מחירונים עדיין</EmptyTitle>
              <EmptyDescription>התחל ביצירת מחירון ראשון</EmptyDescription>
              <Button onClick={openCreateDialog} className="mt-4">
                <Plus className="size-4 me-2" />
                צור מחירון חדש
              </Button>
            </Empty>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>שם מחירון</TableHead>
                    <TableHead>ארגון</TableHead>
                    <TableHead>מוצרים</TableHead>
                    <TableHead>דף נחיתה</TableHead>
                    <TableHead className="w-24">פעולות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activePriceLists.map((priceList) => (
                    <TableRow key={priceList.id}>
                      <TableCell className="font-medium">{priceList.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {priceList.organizationName || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {priceList.lines.length} שורות
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8"
                            onClick={() => copyLandingUrl(priceList.landingUrl || '')}
                          >
                            <Copy className="size-3 me-1" />
                            העתק
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            asChild
                          >
                            <a href={priceList.landingUrl} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="size-3" />
                            </a>
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(priceList)}
                            title="ערוך"
                          >
                            <Edit2 className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openDeactivateDialog(priceList)}
                            title="העבר לא פעיל"
                            className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                          >
                            <ToggleLeft className="size-4" />
                          </Button>
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

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedPriceList ? 'עריכת מחירון' : 'יצירת מחירון חדש'}
            </DialogTitle>
            <DialogDescription>
              {selectedPriceList ? 'עדכן את פרטי המחירון' : 'הגדר את פרטי המחירון והמוצרים'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 mt-4">
            {/* Basic Info */}
            <FieldGroup>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel>שם מחירון</FieldLabel>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="לדוגמה: מחירון ארגון א"
                  />
                </Field>
                <Field>
                  <FieldLabel>שם ארגון</FieldLabel>
                  <Input
                    value={formData.organizationName}
                    onChange={(e) => setFormData({ ...formData, organizationName: e.target.value })}
                    placeholder="שם החברה או הארגון"
                  />
                </Field>
              </div>
            </FieldGroup>

            {/* Price Lines */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">שורות מחירון</h4>
                <Button type="button" variant="outline" size="sm" onClick={addLine}>
                  <Plus className="size-4 me-1" />
                  הוסף שורה
                </Button>
              </div>
              
              <div className="rounded-lg border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ספק</TableHead>
                      <TableHead>מוצר</TableHead>
                      <TableHead>עלות ספק</TableHead>
                      <TableHead>מחיר קמעונאי</TableHead>
                      <TableHead>עמלת סוכן</TableHead>
                      <TableHead>רווח נקי</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {formData.lines.map((line, index) => {
                      const { profitBeforeAgent, netProfit } = calculateProfit(line)
                      const vendorProducts = getVendorProducts(line.vendorId)
                      
                      return (
                        <TableRow key={index}>
                          <TableCell>
                            <Select
                              value={line.vendorId}
                              onValueChange={(value) => updateLine(index, 'vendorId', value)}
                            >
                              <SelectTrigger className="w-40">
                                <SelectValue placeholder="בחר ספק" />
                              </SelectTrigger>
                              <SelectContent>
                                {mockVendors.map((vendor) => (
                                  <SelectItem key={vendor.id} value={vendor.id}>
                                    {vendor.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={line.productId}
                              onValueChange={(value) => updateLine(index, 'productId', value)}
                              disabled={!line.vendorId}
                            >
                              <SelectTrigger className="w-40">
                                <SelectValue placeholder="בחר מוצר" />
                              </SelectTrigger>
                              <SelectContent>
                                {vendorProducts.map((product) => (
                                  <SelectItem key={product.productId} value={product.productId}>
                                    {product.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <span className="text-muted-foreground">
                              ₪{line.vendorCost || 0}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              value={line.retailPrice}
                              onChange={(e) => updateLine(index, 'retailPrice', Number(e.target.value))}
                              className="w-24"
                              dir="ltr"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              value={line.defaultAgentCommission}
                              onChange={(e) => updateLine(index, 'defaultAgentCommission', Number(e.target.value))}
                              className="w-24"
                              dir="ltr"
                            />
                          </TableCell>
                          <TableCell>
                            <span className={netProfit >= 0 ? 'text-success' : 'text-destructive'}>
                              ₪{netProfit}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeLine(index)}
                              disabled={formData.lines.length === 1}
                            >
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse mt-6">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              ביטול
            </Button>
            <Button onClick={handleSubmit} disabled={isLoading || !formData.name}>
              {isLoading && <Spinner className="me-2" />}
              {selectedPriceList ? 'עדכן' : 'צור'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate Confirmation */}
      <ConfirmDialog
        open={isDeactivateDialogOpen}
        onOpenChange={setIsDeactivateDialogOpen}
        title="העברה לארכיון"
        description={`האם אתה בטוח שברצונך להעביר את המחירון "${selectedPriceList?.name}" לארכיון? המחירון יסומן כלא פעיל וניתן יהיה לשחזר אותו מדף הארכיון.`}
        confirmLabel="העבר לארכיון"
        variant="default"
        isLoading={isLoading}
        onConfirm={handleDeactivate}
      />
    </div>
  )
}
