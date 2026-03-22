'use client'

import { useState } from 'react'
import { Edit2, Eye, ExternalLink, Copy, FileText, ImageIcon, Palette } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { Empty, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { Spinner } from '@/components/ui/spinner'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { PriceList, LandingPageContent } from '@/lib/api'

// Default landing page content template
const defaultLandingContent: LandingPageContent = {
  title: 'מנוי רופא פרטי עד הבית 24/7 בפחות משקל ליום',
  subtitle: 'יעוץ טלפוני בתחום רפואת המשפחה',
  content: `כשאתה צריך רופא, אתה צריך אותו עכשיו. במקום להמתין ימים ארוכים בתסכול, אצלנו תקבל ביטחון וטיפול מקצועי ומנוסה אצלך בבית עוד היום.. ללא עיכובים מיותרים`,
  subContent: `מוקד שרות רפואי 24/7
יעוץ רפואי טלפוני
מתן תעודה רפואית
הפניה להמשך טיפול אצל רופא מומחה
בדיקה גופנית וקבלת הבחנה רפואית
מתן מרשמים ותרופות
זריקת וולטרן, פרמין ועוד
קבלת אנמנזה רפואית
מתן הפנייה במקרה הצורך לחדר מיון (טופס 17)
בתום הייעוץ יישלח למנוי סיכום הייעוץ הרפואי`,
  imageUrl: '',
}

// Mock data with landing content
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
    landingPageContent: { ...defaultLandingContent },
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
    landingPageContent: { ...defaultLandingContent },
    createdAt: '2024-02-15',
  },
]

export default function LandingPagesPage() {
  const [priceLists, setPriceLists] = useState<PriceList[]>(mockPriceLists)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedPriceList, setSelectedPriceList] = useState<PriceList | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState<LandingPageContent>(defaultLandingContent)
  const [previewMode, setPreviewMode] = useState(false)

  const openEditDialog = (priceList: PriceList) => {
    setSelectedPriceList(priceList)
    setFormData(priceList.landingPageContent || { ...defaultLandingContent })
    setIsDialogOpen(true)
  }

  const resetToDefault = () => {
    setFormData({ ...defaultLandingContent })
  }

  const handleSubmit = async () => {
    if (!selectedPriceList) return
    
    setIsLoading(true)
    await new Promise(resolve => setTimeout(resolve, 500))
    
    setPriceLists(prev => prev.map(p => 
      p.id === selectedPriceList.id 
        ? { ...p, landingPageContent: formData }
        : p
    ))
    
    setIsLoading(false)
    setIsDialogOpen(false)
  }

  const copyLandingUrl = (url: string) => {
    const fullUrl = `${window.location.origin}${url}`
    navigator.clipboard.writeText(fullUrl)
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">דפי נחיתה</h1>
          <p className="text-muted-foreground">עריכת תוכן דפי נחיתה למחירונים</p>
        </div>
      </div>

      {/* Landing Pages Table */}
      <Card>
        <CardHeader>
          <CardTitle>רשימת דפי נחיתה</CardTitle>
          <CardDescription>עריכת תוכן דפי הנחיתה לכל מחירון</CardDescription>
        </CardHeader>
        <CardContent>
          {priceLists.length === 0 ? (
            <Empty>
              <EmptyMedia variant="icon">
                <FileText className="size-8" />
              </EmptyMedia>
              <EmptyTitle>אין מחירונים עדיין</EmptyTitle>
              <EmptyDescription>צור מחירון כדי להתחיל לערוך דפי נחיתה</EmptyDescription>
            </Empty>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>מחירון</TableHead>
                    <TableHead>ארגון</TableHead>
                    <TableHead>כותרת דף נחיתה</TableHead>
                    <TableHead>קישור</TableHead>
                    <TableHead className="w-32">פעולות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {priceLists.map((priceList) => (
                    <TableRow key={priceList.id}>
                      <TableCell className="font-medium">{priceList.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {priceList.organizationName || '-'}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm line-clamp-1">
                          {priceList.landingPageContent?.title || defaultLandingContent.title}
                        </span>
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
                            title="ערוך תוכן"
                          >
                            <Edit2 className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            asChild
                            title="צפה בדף"
                          >
                            <a href={priceList.landingUrl} target="_blank" rel="noopener noreferrer">
                              <Eye className="size-4" />
                            </a>
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

      {/* Edit Landing Page Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>עריכת דף נחיתה - {selectedPriceList?.name}</DialogTitle>
            <DialogDescription>
              ערוך את תוכן דף הנחיתה. התוכן המוצג ללקוח יכלול את הפרטים האלה ואת המוצרים מהמחירון.
            </DialogDescription>
          </DialogHeader>
          
          <Tabs defaultValue="content" className="mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="content">
                <FileText className="size-4 me-2" />
                תוכן
              </TabsTrigger>
              <TabsTrigger value="preview">
                <Eye className="size-4 me-2" />
                תצוגה מקדימה
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="content" className="space-y-6 mt-4">
              <FieldGroup>
                <Field>
                  <FieldLabel>כותרת ראשית</FieldLabel>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="כותרת ראשית של דף הנחיתה"
                  />
                </Field>
                
                <Field>
                  <FieldLabel>תת כותרת</FieldLabel>
                  <Input
                    value={formData.subtitle}
                    onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                    placeholder="תת כותרת"
                  />
                </Field>
                
                <Field>
                  <FieldLabel>תוכן ראשי</FieldLabel>
                  <Textarea
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    placeholder="התוכן הראשי של דף הנחיתה"
                    rows={4}
                  />
                </Field>
                
                <Field>
                  <FieldLabel>תת תוכן (פירוט שירותים)</FieldLabel>
                  <Textarea
                    value={formData.subContent}
                    onChange={(e) => setFormData({ ...formData, subContent: e.target.value })}
                    placeholder="פירוט שירותים, כל שורה בשורה נפרדת"
                    rows={8}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    כל שורה תוצג כפריט נפרד ברשימה
                  </p>
                </Field>
                
                <Field>
                  <FieldLabel>תמונה לדף הנחיתה</FieldLabel>
                  <div className="space-y-3">
                    <Input
                      value={formData.imageUrl || ''}
                      onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                      placeholder="https://example.com/image.jpg"
                      dir="ltr"
                    />
                    {formData.imageUrl && (
                      <div className="relative aspect-video w-full max-w-sm rounded-lg border overflow-hidden bg-muted">
                        <img 
                          src={formData.imageUrl} 
                          alt="תצוגה מקדימה" 
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none'
                          }}
                        />
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      הכנס כתובת URL של תמונה. התמונה תוצג בראש דף הנחיתה.
                    </p>
                  </div>
                </Field>
              </FieldGroup>
              
              <Button type="button" variant="outline" onClick={resetToDefault}>
                <Palette className="size-4 me-2" />
                איפוס לברירת מחדל
              </Button>
            </TabsContent>
            
            <TabsContent value="preview" className="mt-4">
              <div className="border rounded-lg overflow-hidden bg-background">
                {/* Preview Image */}
                {formData.imageUrl && (
                  <div className="relative h-48 md:h-64 w-full bg-muted">
                    <img 
                      src={formData.imageUrl} 
                      alt="תמונת דף נחיתה" 
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
                  </div>
                )}
                
                {/* Preview Header */}
                <div className={`bg-gradient-to-b from-primary/5 to-background p-8 text-center ${formData.imageUrl ? '-mt-16 relative z-10' : ''}`}>
                  <Badge className="mb-4">{selectedPriceList?.organizationName}</Badge>
                  <h1 className="text-2xl md:text-3xl font-bold mb-4 text-balance">
                    {formData.title || 'כותרת ראשית'}
                  </h1>
                  <p className="text-lg text-primary font-medium mb-4">
                    {formData.subtitle || 'תת כותרת'}
                  </p>
                  <p className="text-muted-foreground max-w-xl mx-auto text-pretty">
                    {formData.content || 'תוכן ראשי'}
                  </p>
                </div>
                
                {/* Preview Services */}
                <div className="p-8 bg-muted/30">
                  <h3 className="font-semibold mb-4 text-center">מה כולל השירות?</h3>
                  <ul className="space-y-2 max-w-md mx-auto">
                    {(formData.subContent || '').split('\n').filter(line => line.trim()).map((line, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-success mt-0.5">✓</span>
                        {line.trim()}
                      </li>
                    ))}
                  </ul>
                </div>
                
                {/* Preview Products */}
                <div className="p-8">
                  <h3 className="font-semibold mb-4 text-center">המוצרים שלנו</h3>
                  <div className="grid gap-4 max-w-md mx-auto">
                    {selectedPriceList?.lines.map((line, i) => (
                      <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                        <span className="font-medium">מוצר {i + 1}</span>
                        <Badge variant="secondary">₪{line.retailPrice}/חודש</Badge>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Preview Footer */}
                <div className="bg-primary text-primary-foreground p-8 text-center">
                  <h3 className="font-bold mb-2">צור קשר</h3>
                  <p className="text-sm text-primary-foreground/90 mb-4">
                    אופאל - בית ליזמות רפואית, המושתת על מקצועיות, מצוינות וחווית שירות פרטית.
                  </p>
                  <p className="text-sm text-primary-foreground/80">
                    טלפון: 0544261369 | אימייל: opal2000@zahav.net.il
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse mt-6">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              ביטול
            </Button>
            <Button onClick={handleSubmit} disabled={isLoading}>
              {isLoading && <Spinner className="me-2" />}
              שמור שינויים
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
