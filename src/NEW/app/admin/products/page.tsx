'use client'

import { useState } from 'react'
import { Plus, Edit2, Package, ToggleLeft, ToggleRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
import { Textarea } from '@/components/ui/textarea'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { Empty, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { ConfirmDialog } from '@/components/admin/confirm-dialog'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import type { Product } from '@/lib/api'

// Mock data - replace with API
const mockProducts: Product[] = [
  { id: '1', name: 'ביטוח בריאות בסיסי', sku: 'HEALTH-001', description: 'ביטוח בריאות מקיף לכל המשפחה', isActive: true, createdAt: '2024-01-15' },
  { id: '2', name: 'ביטוח חיים פרימיום', sku: 'LIFE-001', description: 'תוכנית ביטוח חיים עם כיסוי מורחב', isActive: true, createdAt: '2024-02-20' },
  { id: '3', name: 'ביטוח סיעודי', sku: 'CARE-001', description: 'ביטוח סיעודי לגיל הזהב', isActive: true, createdAt: '2024-03-01' },
]

interface ProductFormData {
  name: string
  sku: string
  description: string
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>(mockProducts)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeactivateDialogOpen, setIsDeactivateDialogOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  
  // Filter only active products for display
  const activeProducts = products.filter(p => p.isActive)
  
  const [formData, setFormData] = useState<ProductFormData>({
    name: '',
    sku: '',
    description: '',
  })

  const openCreateDialog = () => {
    setSelectedProduct(null)
    setFormData({ name: '', sku: '', description: '' })
    setIsDialogOpen(true)
  }

  const openEditDialog = (product: Product) => {
    setSelectedProduct(product)
    setFormData({
      name: product.name,
      sku: product.sku || '',
      description: product.description || '',
    })
    setIsDialogOpen(true)
  }

  const openDeactivateDialog = (product: Product) => {
    setSelectedProduct(product)
    setIsDeactivateDialogOpen(true)
  }

  const handleSubmit = async () => {
    setIsLoading(true)
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500))
    
    if (selectedProduct) {
      // Update
      setProducts(prev => prev.map(p => 
        p.id === selectedProduct.id 
          ? { ...p, ...formData }
          : p
      ))
    } else {
      // Create
      const newProduct: Product = {
        id: Date.now().toString(),
        ...formData,
        isActive: true,
        createdAt: new Date().toISOString().split('T')[0],
      }
      setProducts(prev => [...prev, newProduct])
    }
    
    setIsLoading(false)
    setIsDialogOpen(false)
  }

  const handleDeactivate = async () => {
    if (!selectedProduct) return
    
    setIsLoading(true)
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Mark as inactive instead of deleting
    setProducts(prev => prev.map(p => 
      p.id === selectedProduct.id 
        ? { ...p, isActive: false }
        : p
    ))
    
    setIsLoading(false)
    setIsDeactivateDialogOpen(false)
    setSelectedProduct(null)
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">מוצרים</h1>
          <p className="text-muted-foreground">ניהול מוצרים וביטוחים</p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="size-4 me-2" />
          הוסף מוצר
        </Button>
      </div>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle>רשימת מוצרים</CardTitle>
          <CardDescription>{activeProducts.length} מוצרים פעילים במערכת</CardDescription>
        </CardHeader>
        <CardContent>
          {activeProducts.length === 0 ? (
            <Empty>
              <EmptyMedia variant="icon">
                <Package className="size-8" />
              </EmptyMedia>
              <EmptyTitle>אין מוצרים עדיין</EmptyTitle>
              <EmptyDescription>התחל בהוספת מוצר ראשון למערכת</EmptyDescription>
              <Button onClick={openCreateDialog} className="mt-4">
                <Plus className="size-4 me-2" />
                הוסף מוצר חדש
              </Button>
            </Empty>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>שם מוצר</TableHead>
                    <TableHead>מק״ט</TableHead>
                    <TableHead>תיאור</TableHead>
                    <TableHead>סטטוס</TableHead>
                    <TableHead>תאריך יצירה</TableHead>
                    <TableHead className="w-28">פעולות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell className="font-mono text-sm">{product.sku || '-'}</TableCell>
                      <TableCell className="max-w-xs truncate text-muted-foreground">
                        {product.description || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                          <ToggleRight className="size-3 me-1" />
                          פעיל
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {product.createdAt}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(product)}
                            title="ערוך"
                          >
                            <Edit2 className="size-4" />
                            <span className="sr-only">ערוך</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openDeactivateDialog(product)}
                            title="העבר לא פעיל"
                            className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                          >
                            <ToggleLeft className="size-4" />
                            <span className="sr-only">העבר לא פעיל</span>
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedProduct ? 'עריכת מוצר' : 'הוספת מוצר חדש'}
            </DialogTitle>
            <DialogDescription>
              {selectedProduct ? 'עדכן את פרטי המוצר' : 'הזן את פרטי המוצר החדש'}
            </DialogDescription>
          </DialogHeader>
          
          <FieldGroup>
            <Field>
              <FieldLabel>שם מוצר</FieldLabel>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="לדוגמה: ביטוח בריאות"
              />
            </Field>
            <Field>
              <FieldLabel>{"מק\"ט"}</FieldLabel>
              <Input
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                placeholder="לדוגמה: HEALTH-001"
                className="font-mono"
              />
            </Field>
            <Field>
              <FieldLabel>תיאור</FieldLabel>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="תיאור קצר של המוצר"
                rows={3}
              />
            </Field>
          </FieldGroup>

          <DialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              ביטול
            </Button>
            <Button onClick={handleSubmit} disabled={isLoading || !formData.name}>
              {isLoading && <Spinner className="me-2" />}
              {selectedProduct ? 'עדכן' : 'הוסף'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate Confirmation */}
      <ConfirmDialog
        open={isDeactivateDialogOpen}
        onOpenChange={setIsDeactivateDialogOpen}
        title="העברה לארכיון"
        description={`האם אתה בטוח שברצונך להעביר את המוצר "${selectedProduct?.name}" לארכיון? המוצר יסומן כלא פעיל וניתן יהיה לשחזר אותו מדף הארכיון.`}
        confirmLabel="העבר לארכיון"
        variant="default"
        isLoading={isLoading}
        onConfirm={handleDeactivate}
      />
    </div>
  )
}
