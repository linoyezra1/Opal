'use client'

import { useState } from 'react'
import { Plus, Edit2, Trash2, Users, Percent, Wallet } from 'lucide-react'
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
import type { Agent, AgentCommission } from '@/lib/api'

// Mock products for commission setup
const mockProducts = [
  { id: '1', name: 'ביטוח בריאות בסיסי' },
  { id: '2', name: 'ביטוח חיים פרימיום' },
  { id: '3', name: 'ביטוח סיעודי' },
]

// Mock data
const mockAgents: Agent[] = [
  {
    id: '1',
    name: 'דוד כהן',
    phone: '050-1234567',
    email: 'david@agent.co.il',
    idNumber: '123456789',
    bankName: 'בנק הפועלים',
    bankNum: '12',
    branchNum: '123',
    accountNum: '123456',
    accountHolder: 'דוד כהן',
    commissions: [
      { productId: '1', commissionAmount: 50 },
      { productId: '2', commissionAmount: 75 },
    ],
    createdAt: '2024-01-15',
  },
  {
    id: '2',
    name: 'שרה לוי',
    phone: '050-9876543',
    email: 'sara@agent.co.il',
    idNumber: '987654321',
    bankName: 'בנק לאומי',
    bankNum: '10',
    branchNum: '456',
    accountNum: '654321',
    accountHolder: 'שרה לוי',
    commissions: [
      { productId: '1', commissionAmount: 45 },
      { productId: '3', commissionAmount: 60 },
    ],
    createdAt: '2024-02-20',
  },
]

interface AgentFormData {
  name: string
  phone: string
  email: string
  idNumber: string
  bankName: string
  bankNum: string
  branchNum: string
  accountNum: string
  accountHolder: string
  commissions: AgentCommission[]
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>(mockAgents)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState<AgentFormData>({
    name: '',
    phone: '',
    email: '',
    idNumber: '',
    bankName: '',
    bankNum: '',
    branchNum: '',
    accountNum: '',
    accountHolder: '',
    commissions: [],
  })

  const openCreateDialog = () => {
    setSelectedAgent(null)
    setFormData({
      name: '',
      phone: '',
      email: '',
      idNumber: '',
      bankName: '',
      bankNum: '',
      branchNum: '',
      accountNum: '',
      accountHolder: '',
      commissions: mockProducts.map(p => ({ productId: p.id, commissionAmount: 0 })),
    })
    setIsDialogOpen(true)
  }

  const openEditDialog = (agent: Agent) => {
    setSelectedAgent(agent)
    // Merge existing commissions with all products
    const existingCommissions = agent.commissions || []
    const commissions = mockProducts.map(p => {
      const existing = existingCommissions.find(c => c.productId === p.id)
      return existing || { productId: p.id, commissionAmount: 0 }
    })
    
    setFormData({
      name: agent.name,
      phone: agent.phone || '',
      email: agent.email || '',
      idNumber: agent.idNumber || '',
      bankName: agent.bankName || '',
      bankNum: agent.bankNum || '',
      branchNum: agent.branchNum || '',
      accountNum: agent.accountNum || '',
      accountHolder: agent.accountHolder || '',
      commissions,
    })
    setIsDialogOpen(true)
  }

  const openDeleteDialog = (agent: Agent) => {
    setSelectedAgent(agent)
    setIsDeleteDialogOpen(true)
  }

  const updateCommission = (productId: string, amount: number) => {
    setFormData(prev => ({
      ...prev,
      commissions: prev.commissions.map(c =>
        c.productId === productId ? { ...c, commissionAmount: amount } : c
      ),
    }))
  }

  const handleSubmit = async () => {
    setIsLoading(true)
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Filter out zero commissions
    const activeCommissions = formData.commissions.filter(c => c.commissionAmount > 0)
    
    if (selectedAgent) {
      setAgents(prev => prev.map(a => 
        a.id === selectedAgent.id 
          ? { ...a, ...formData, commissions: activeCommissions }
          : a
      ))
    } else {
      const newAgent: Agent = {
        id: Date.now().toString(),
        ...formData,
        commissions: activeCommissions,
        createdAt: new Date().toISOString().split('T')[0],
      }
      setAgents(prev => [...prev, newAgent])
    }
    
    setIsLoading(false)
    setIsDialogOpen(false)
  }

  const handleDelete = async () => {
    if (!selectedAgent) return
    
    setIsLoading(true)
    await new Promise(resolve => setTimeout(resolve, 500))
    
    setAgents(prev => prev.filter(a => a.id !== selectedAgent.id))
    setIsLoading(false)
    setIsDeleteDialogOpen(false)
    setSelectedAgent(null)
  }

  const getProductName = (productId: string) => {
    return mockProducts.find(p => p.id === productId)?.name || productId
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">סוכנים</h1>
          <p className="text-muted-foreground">ניהול סוכנים ועמלות</p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="size-4 me-2" />
          הוסף סוכן
        </Button>
      </div>

      {/* Agents Table */}
      <Card>
        <CardHeader>
          <CardTitle>רשימת סוכנים</CardTitle>
          <CardDescription>{agents.length} סוכנים במערכת</CardDescription>
        </CardHeader>
        <CardContent>
          {agents.length === 0 ? (
            <Empty>
              <EmptyMedia variant="icon">
                <Users className="size-8" />
              </EmptyMedia>
              <EmptyTitle>אין סוכנים עדיין</EmptyTitle>
              <EmptyDescription>התחל בהוספת סוכן ראשון למערכת</EmptyDescription>
              <Button onClick={openCreateDialog} className="mt-4">
                <Plus className="size-4 me-2" />
                הוסף סוכן חדש
              </Button>
            </Empty>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>שם סוכן</TableHead>
                    <TableHead>ת.ז.</TableHead>
                    <TableHead>טלפון</TableHead>
                    <TableHead>אימייל</TableHead>
                    <TableHead>עמלות</TableHead>
                    <TableHead className="w-24">פעולות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agents.map((agent) => (
                    <TableRow key={agent.id}>
                      <TableCell className="font-medium">{agent.name}</TableCell>
                      <TableCell dir="ltr" className="text-start font-mono text-sm">
                        {agent.idNumber || '-'}
                      </TableCell>
                      <TableCell dir="ltr" className="text-start">{agent.phone || '-'}</TableCell>
                      <TableCell dir="ltr" className="text-start text-muted-foreground">
                        {agent.email || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {agent.commissions?.slice(0, 2).map((c) => (
                            <Badge key={c.productId} variant="outline" className="text-xs">
                              <Percent className="size-3 me-1" />
                              {getProductName(c.productId).slice(0, 10)}... ₪{c.commissionAmount}
                            </Badge>
                          ))}
                          {(agent.commissions?.length || 0) > 2 && (
                            <Badge variant="secondary" className="text-xs">
                              +{(agent.commissions?.length || 0) - 2}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(agent)}
                          >
                            <Edit2 className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openDeleteDialog(agent)}
                          >
                            <Trash2 className="size-4 text-destructive" />
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
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedAgent ? 'עריכת סוכן' : 'הוספת סוכן חדש'}
            </DialogTitle>
            <DialogDescription>
              {selectedAgent ? 'עדכן את פרטי הסוכן' : 'הזן את פרטי הסוכן החדש'}
            </DialogDescription>
          </DialogHeader>
          
          <Tabs defaultValue="details" className="mt-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="details">פרטים אישיים</TabsTrigger>
              <TabsTrigger value="bank">פרטי בנק</TabsTrigger>
              <TabsTrigger value="commissions">עמלות</TabsTrigger>
            </TabsList>
            
            <TabsContent value="details" className="space-y-4 mt-4">
              <FieldGroup>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel>שם מלא</FieldLabel>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="שם פרטי ומשפחה"
                    />
                  </Field>
                  <Field>
                    <FieldLabel>תעודת זהות</FieldLabel>
                    <Input
                      value={formData.idNumber}
                      onChange={(e) => setFormData({ ...formData, idNumber: e.target.value })}
                      placeholder="123456789"
                      dir="ltr"
                    />
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel>טלפון</FieldLabel>
                    <Input
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="050-1234567"
                      dir="ltr"
                    />
                  </Field>
                  <Field>
                    <FieldLabel>אימייל</FieldLabel>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="agent@example.com"
                      dir="ltr"
                    />
                  </Field>
                </div>
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
            
            <TabsContent value="commissions" className="space-y-4 mt-4">
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>מוצר</TableHead>
                      <TableHead className="w-40">עמלה (₪)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockProducts.map((product) => {
                      const commission = formData.commissions.find(c => c.productId === product.id)
                      return (
                        <TableRow key={product.id}>
                          <TableCell className="font-medium">{product.name}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                min="0"
                                value={commission?.commissionAmount || 0}
                                onChange={(e) => updateCommission(product.id, Number(e.target.value))}
                                className="w-24"
                                dir="ltr"
                              />
                              <span className="text-muted-foreground">₪</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
              <p className="text-sm text-muted-foreground">
                הגדר את סכום העמלה לכל מוצר. מוצרים עם עמלה 0 לא ישויכו לסוכן.
              </p>
            </TabsContent>
          </Tabs>

          <DialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse mt-6">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              ביטול
            </Button>
            <Button onClick={handleSubmit} disabled={isLoading || !formData.name}>
              {isLoading && <Spinner className="me-2" />}
              {selectedAgent ? 'עדכן' : 'הוסף'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title="מחיקת סוכן"
        description={`האם אתה בטוח שברצונך למחוק את הסוכן "${selectedAgent?.name}"? פעולה זו אינה ניתנת לביטול.`}
        confirmLabel="מחק"
        variant="destructive"
        isLoading={isLoading}
        onConfirm={handleDelete}
      />
    </div>
  )
}
