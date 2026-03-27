'use client'

import { useState } from 'react'
import { Save, CreditCard, Globe, Bell, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { Separator } from '@/components/ui/separator'

export default function SettingsPage() {
  const [isLoading, setIsLoading] = useState(false)
  
  // Form states
  const [generalSettings, setGeneralSettings] = useState({
    companyName: 'Opal',
    supportEmail: 'support@opal.co.il',
    supportPhone: '03-1234567',
  })

  const [paymentSettings, setPaymentSettings] = useState({
    cardcomTerminal: '',
    cardcomApiKey: '',
    testMode: true,
  })

  const [notificationSettings, setNotificationSettings] = useState({
    emailOnNewDeal: true,
    emailOnCancellation: true,
    dailySummary: false,
    weeklySummary: true,
  })

  const handleSave = async () => {
    setIsLoading(true)
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    setIsLoading(false)
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">הגדרות</h1>
          <p className="text-muted-foreground">ניהול הגדרות המערכת</p>
        </div>
        <Button onClick={handleSave} disabled={isLoading}>
          {isLoading ? <Spinner className="me-2" /> : <Save className="size-4 me-2" />}
          שמור שינויים
        </Button>
      </div>

      {/* Settings Tabs */}
      <Tabs defaultValue="general" className="space-y-6">
        <TabsList>
          <TabsTrigger value="general">
            <Globe className="size-4 me-2" />
            כללי
          </TabsTrigger>
          <TabsTrigger value="payment">
            <CreditCard className="size-4 me-2" />
            תשלומים
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="size-4 me-2" />
            התראות
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="size-4 me-2" />
            אבטחה
          </TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>הגדרות כלליות</CardTitle>
              <CardDescription>פרטי החברה ומידע בסיסי</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel>שם החברה</FieldLabel>
                  <Input
                    value={generalSettings.companyName}
                    onChange={(e) => setGeneralSettings({ ...generalSettings, companyName: e.target.value })}
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel>אימייל תמיכה</FieldLabel>
                    <Input
                      type="email"
                      value={generalSettings.supportEmail}
                      onChange={(e) => setGeneralSettings({ ...generalSettings, supportEmail: e.target.value })}
                      dir="ltr"
                    />
                  </Field>
                  <Field>
                    <FieldLabel>טלפון תמיכה</FieldLabel>
                    <Input
                      value={generalSettings.supportPhone}
                      onChange={(e) => setGeneralSettings({ ...generalSettings, supportPhone: e.target.value })}
                      dir="ltr"
                    />
                  </Field>
                </div>
              </FieldGroup>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payment Settings */}
        <TabsContent value="payment">
          <Card>
            <CardHeader>
              <CardTitle>הגדרות תשלומים</CardTitle>
              <CardDescription>חיבור לספק סליקה Cardcom</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel>מספר מסוף</FieldLabel>
                    <Input
                      value={paymentSettings.cardcomTerminal}
                      onChange={(e) => setPaymentSettings({ ...paymentSettings, cardcomTerminal: e.target.value })}
                      placeholder="Terminal ID"
                      dir="ltr"
                    />
                  </Field>
                  <Field>
                    <FieldLabel>API Key</FieldLabel>
                    <Input
                      type="password"
                      value={paymentSettings.cardcomApiKey}
                      onChange={(e) => setPaymentSettings({ ...paymentSettings, cardcomApiKey: e.target.value })}
                      placeholder="••••••••"
                      dir="ltr"
                    />
                  </Field>
                </div>
                
                <Separator />
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">מצב בדיקות</p>
                    <p className="text-sm text-muted-foreground">
                      הפעלת מצב בדיקות לא תחייב כרטיסי אשראי אמיתיים
                    </p>
                  </div>
                  <Switch
                    checked={paymentSettings.testMode}
                    onCheckedChange={(checked) => setPaymentSettings({ ...paymentSettings, testMode: checked })}
                  />
                </div>
              </FieldGroup>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notification Settings */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>הגדרות התראות</CardTitle>
              <CardDescription>קביעת התראות דוא״ל</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">התראה על עסקה חדשה</p>
                  <p className="text-sm text-muted-foreground">קבל התראה בכל פעם שנוצרת עסקה חדשה</p>
                </div>
                <Switch
                  checked={notificationSettings.emailOnNewDeal}
                  onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, emailOnNewDeal: checked })}
                />
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">התראה על ביטול</p>
                  <p className="text-sm text-muted-foreground">קבל התראה כשמנוי מבטל</p>
                </div>
                <Switch
                  checked={notificationSettings.emailOnCancellation}
                  onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, emailOnCancellation: checked })}
                />
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">סיכום יומי</p>
                  <p className="text-sm text-muted-foreground">קבל סיכום יומי של כל הפעילות</p>
                </div>
                <Switch
                  checked={notificationSettings.dailySummary}
                  onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, dailySummary: checked })}
                />
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">סיכום שבועי</p>
                  <p className="text-sm text-muted-foreground">קבל סיכום שבועי עם נתונים סטטיסטיים</p>
                </div>
                <Switch
                  checked={notificationSettings.weeklySummary}
                  onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, weeklySummary: checked })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Settings */}
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>הגדרות אבטחה</CardTitle>
              <CardDescription>ניהול סיסמה והרשאות</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel>סיסמה נוכחית</FieldLabel>
                  <Input
                    type="password"
                    placeholder="••••••••"
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel>סיסמה חדשה</FieldLabel>
                    <Input
                      type="password"
                      placeholder="••••••••"
                    />
                  </Field>
                  <Field>
                    <FieldLabel>אימות סיסמה</FieldLabel>
                    <Input
                      type="password"
                      placeholder="••••••••"
                    />
                  </Field>
                </div>
                <Button variant="outline">
                  עדכן סיסמה
                </Button>
              </FieldGroup>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
