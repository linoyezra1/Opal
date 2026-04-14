'use client'

import React, { useState, useMemo } from 'react'
import {
  Archive,
  Package,
  Building2,
  Users,
  MessageSquare,
  RefreshCw,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  Phone,
  Mail,
  Calendar,
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
import { ConfirmDialog } from '@/components/admin/confirm-dialog'
import { cn } from '@/lib/utils'

// Types for archived items
interface ArchivedProduct {
  id: string
  name: string
  sku?: string
  archivedAt: string
}

interface ArchivedVendor {
  id: string
  name: string
  contactName?: string
  phone?: string
  archivedAt: string
}

interface ArchivedAgent {
  id: string
  name: string
  phone?: string
  email?: string
  archivedAt: string
}

interface ArchivedContact {
  id: string
  fullName: string
  phone: string
  email: string
  source: 'individual' | 'organization'
  organizationName?: string
  archivedAt: string
}

// Mock archived data
const mockArchivedProducts: ArchivedProduct[] = [
  { id: 'p1', name: 'ביטוח נסיעות לחו"ל', sku: 'TRAVEL-001', archivedAt: '2026-02-15' },
  { id: 'p2', name: 'ביטוח רכב משלים', sku: 'CAR-002', archivedAt: '2026-01-20' },
]

const mockArchivedVendors: ArchivedVendor[] = [
  { id: 'v1', name: 'ספק ישן בע"מ', contactName: 'משה כהן', phone: '03-1234567', archivedAt: '2026-03-01' },
]

const mockArchivedAgents: ArchivedAgent[] = [
  { id: 'a1', name: 'יוסף לוי', phone: '052-9876543', email: 'yosef@example.com', archivedAt: '2026-02-28' },
  { id: 'a2', name: 'רחל אברהם', phone: '054-1112222', email: 'rachel@example.com', archivedAt: '2026-01-15' },
]

const mockArchivedContacts: ArchivedContact[] = [
  { id: 'c1', fullName: 'דוד ישראלי', phone: '050-5555555', email: 'david@example.com', source: 'individual', archivedAt: '2026-03-10' },
  { id: 'c2', fullName: 'שרה לוי', phone: '053-3334444', email: 'sara@example.com', source: 'organization', organizationName: 'חברת אלפא בע"מ', archivedAt: '2026-02-20' },
]

// Section component for each archive category
interface ArchiveSectionProps {
  title: string
  icon: React.ElementType
  count: number
  children: React.ReactNode
  defaultOpen?: boolean
}

function ArchiveSection({ title, icon: Icon, count, children, defaultOpen = false }: ArchiveSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-muted flex items-center justify-center">
                  <Icon className="size-5 text-muted-foreground" />
                </div>
                <div>
                  <CardTitle className="text-lg">{title}</CardTitle>
                  <CardDescription>{count} רשומות בארכיון</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{count}</Badge>
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

export default function ArchivePage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<{ type: string; id: string; name: string } | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // State for archived items
  const [archivedProducts, setArchivedProducts] = useState(mockArchivedProducts)
  const [archivedVendors, setArchivedVendors] = useState(mockArchivedVendors)
  const [archivedAgents, setArchivedAgents] = useState(mockArchivedAgents)
  const [archivedContacts, setArchivedContacts] = useState(mockArchivedContacts)

  // Filter by search
  const filteredProducts = useMemo(() => 
    archivedProducts.filter(p => 
      p.name.includes(searchQuery) || (p.sku && p.sku.includes(searchQuery))
    ), [archivedProducts, searchQuery]
  )

  const filteredVendors = useMemo(() => 
    archivedVendors.filter(v => 
      v.name.includes(searchQuery) || (v.contactName && v.contactName.includes(searchQuery))
    ), [archivedVendors, searchQuery]
  )

  const filteredAgents = useMemo(() => 
    archivedAgents.filter(a => 
      a.name.includes(searchQuery) || (a.email && a.email.includes(searchQuery))
    ), [archivedAgents, searchQuery]
  )

  const filteredContacts = useMemo(() => 
    archivedContacts.filter(c => 
      c.fullName.includes(searchQuery) || c.email.includes(searchQuery)
    ), [archivedContacts, searchQuery]
  )

  const totalArchived = archivedProducts.length + archivedVendors.length + archivedAgents.length + archivedContacts.length

  const openRestoreDialog = (type: string, id: string, name: string) => {
    setSelectedItem({ type, id, name })
    setRestoreDialogOpen(true)
  }

  const handleRestore = async () => {
    if (!selectedItem) return
    setIsLoading(true)
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Remove from archived list based on type
    switch (selectedItem.type) {
      case 'product':
        setArchivedProducts(prev => prev.filter(p => p.id !== selectedItem.id))
        break
      case 'vendor':
        setArchivedVendors(prev => prev.filter(v => v.id !== selectedItem.id))
        break
      case 'agent':
        setArchivedAgents(prev => prev.filter(a => a.id !== selectedItem.id))
        break
      case 'contact':
        setArchivedContacts(prev => prev.filter(c => c.id !== selectedItem.id))
        break
    }
    
    setIsLoading(false)
    setRestoreDialogOpen(false)
    setSelectedItem(null)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('he-IL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  return (
    <div className="flex flex-col min-h-screen">
      <AdminHeader
        title="ארכיון"
        description="רשומות לא פעילות מכל המערכת"
      />

      <main className="flex-1 p-4 md:p-6">
        <div className="container max-w-5xl">
          {/* Stats */}
          <Card className="mb-6 bg-muted/30">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="size-14 rounded-xl bg-muted flex items-center justify-center">
                  <Archive className="size-7 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-3xl font-bold">{totalArchived}</p>
                  <p className="text-muted-foreground">סה״כ רשומות בארכיון</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Search */}
          <div className="mb-6">
            <div className="relative max-w-md">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="חיפוש בארכיון..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="ps-10"
              />
            </div>
          </div>

          {totalArchived === 0 ? (
            <Card>
              <CardContent className="py-16">
                <Empty>
                  <EmptyMedia variant="icon">
                    <Archive className="size-8" />
                  </EmptyMedia>
                  <EmptyTitle>הארכיון ריק</EmptyTitle>
                  <EmptyDescription>
                    כאשר תסמן רשומות כ״לא פעיל״ הן יופיעו כאן
                  </EmptyDescription>
                </Empty>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Products Section */}
              <ArchiveSection 
                title="מוצרים" 
                icon={Package} 
                count={filteredProducts.length}
                defaultOpen={filteredProducts.length > 0}
              >
                {filteredProducts.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">אין מוצרים בארכיון</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>שם מוצר</TableHead>
                        <TableHead>מק״ט</TableHead>
                        <TableHead>תאריך העברה לארכיון</TableHead>
                        <TableHead className="w-24">פעולות</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProducts.map((product) => (
                        <TableRow key={product.id}>
                          <TableCell className="font-medium">{product.name}</TableCell>
                          <TableCell className="font-mono text-sm text-muted-foreground">
                            {product.sku || '-'}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <Calendar className="size-4" />
                              {formatDate(product.archivedAt)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openRestoreDialog('product', product.id, product.name)}
                            >
                              <RefreshCw className="size-4 me-1" />
                              שחזר
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </ArchiveSection>

              {/* Vendors Section */}
              <ArchiveSection 
                title="ספקים" 
                icon={Building2} 
                count={filteredVendors.length}
              >
                {filteredVendors.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">אין ספקים בארכיון</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>שם ספק</TableHead>
                        <TableHead>איש קשר</TableHead>
                        <TableHead>טלפון</TableHead>
                        <TableHead>תאריך העברה לארכיון</TableHead>
                        <TableHead className="w-24">פעולות</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredVendors.map((vendor) => (
                        <TableRow key={vendor.id}>
                          <TableCell className="font-medium">{vendor.name}</TableCell>
                          <TableCell className="text-muted-foreground">{vendor.contactName || '-'}</TableCell>
                          <TableCell dir="ltr" className="text-start text-muted-foreground">
                            {vendor.phone || '-'}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDate(vendor.archivedAt)}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openRestoreDialog('vendor', vendor.id, vendor.name)}
                            >
                              <RefreshCw className="size-4 me-1" />
                              שחזר
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </ArchiveSection>

              {/* Agents Section */}
              <ArchiveSection 
                title="סוכנים" 
                icon={Users} 
                count={filteredAgents.length}
              >
                {filteredAgents.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">אין סוכנים בארכיון</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>שם סוכן</TableHead>
                        <TableHead>טלפון</TableHead>
                        <TableHead>אימייל</TableHead>
                        <TableHead>תאריך העברה לארכיון</TableHead>
                        <TableHead className="w-24">פעולות</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAgents.map((agent) => (
                        <TableRow key={agent.id}>
                          <TableCell className="font-medium">{agent.name}</TableCell>
                          <TableCell dir="ltr" className="text-start text-muted-foreground">
                            {agent.phone || '-'}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{agent.email || '-'}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDate(agent.archivedAt)}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openRestoreDialog('agent', agent.id, agent.name)}
                            >
                              <RefreshCw className="size-4 me-1" />
                              שחזר
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </ArchiveSection>

              {/* Contacts Section */}
              <ArchiveSection 
                title="פניות" 
                icon={MessageSquare} 
                count={filteredContacts.length}
              >
                {filteredContacts.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">אין פניות בארכיון</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>שם מלא</TableHead>
                        <TableHead>מקור</TableHead>
                        <TableHead>טלפון</TableHead>
                        <TableHead>אימייל</TableHead>
                        <TableHead>תאריך העברה לארכיון</TableHead>
                        <TableHead className="w-24">פעולות</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredContacts.map((contact) => (
                        <TableRow key={contact.id}>
                          <TableCell className="font-medium">{contact.fullName}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {contact.source === 'individual' ? 'פרטי' : contact.organizationName || 'ארגון'}
                            </Badge>
                          </TableCell>
                          <TableCell dir="ltr" className="text-start text-muted-foreground">
                            {contact.phone}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{contact.email}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDate(contact.archivedAt)}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openRestoreDialog('contact', contact.id, contact.fullName)}
                            >
                              <RefreshCw className="size-4 me-1" />
                              שחזר
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </ArchiveSection>
            </div>
          )}
        </div>
      </main>

      {/* Restore Confirmation Dialog */}
      <ConfirmDialog
        open={restoreDialogOpen}
        onOpenChange={setRestoreDialogOpen}
        title="שחזור רשומה"
        description={`האם אתה בטוח שברצונך לשחזר את "${selectedItem?.name}"? הרשומה תחזור להיות פעילה במערכת.`}
        confirmLabel="שחזר"
        variant="default"
        isLoading={isLoading}
        onConfirm={handleRestore}
      />
    </div>
  )
}
