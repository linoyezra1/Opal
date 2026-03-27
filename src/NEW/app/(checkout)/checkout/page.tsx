'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, CreditCard, Users, ChevronLeft, Plus, Trash2, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

// Mock data
const mockPlans = [
  {
    id: '1',
    name: 'ביטוח בריאות בסיסי',
    description: 'כיסוי בריאותי מקיף לכל המשפחה',
    price: 250,
    features: ['כיסוי אשפוז מלא', 'ניתוחים בחו"ל', 'תרופות מיוחדות'],
    popular: false,
  },
  {
    id: '2',
    name: 'ביטוח חיים פרימיום',
    description: 'הגנה מקסימלית למשפחה שלך',
    price: 350,
    features: ['כיסוי מוות מכל סיבה', 'נכות מלאה', 'מחלות קשות', 'פיצוי חד פעמי'],
    popular: true,
  },
  {
    id: '3',
    name: 'ביטוח סיעודי',
    description: 'ביטחון כלכלי לגיל הזהב',
    price: 300,
    features: ['קצבה חודשית', 'סיוע בבית', 'טיפול במוסד'],
    popular: false,
  },
]

const mockAgents = [
  { id: '1', name: 'דוד כהן' },
  { id: '2', name: 'שרה לוי' },
  { id: '3', name: 'יוסי אברהם' },
]

interface Beneficiary {
  id: string
  firstName: string
  lastName: string
  idNumber: string
  phone: string
  email: string
}

export default function CheckoutPage() {
  const router = useRouter()
  const [step, setStep] = useState<'plan' | 'beneficiaries' | 'review'>('plan')
  const [selectedPlan, setSelectedPlan] = useState<string>('')
  const [selectedAgent, setSelectedAgent] = useState<string>('')
  const [organizationName, setOrganizationName] = useState('')
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([
    { id: '1', firstName: '', lastName: '', idNumber: '', phone: '', email: '' },
  ])

  const currentPlan = mockPlans.find(p => p.id === selectedPlan)
  const currentAgent = mockAgents.find(a => a.id === selectedAgent)

  const addBeneficiary = () => {
    setBeneficiaries(prev => [
      ...prev,
      { id: Date.now().toString(), firstName: '', lastName: '', idNumber: '', phone: '', email: '' },
    ])
  }

  const removeBeneficiary = (id: string) => {
    if (beneficiaries.length > 1) {
      setBeneficiaries(prev => prev.filter(b => b.id !== id))
    }
  }

  const updateBeneficiary = (id: string, field: keyof Beneficiary, value: string) => {
    setBeneficiaries(prev =>
      prev.map(b => (b.id === id ? { ...b, [field]: value } : b))
    )
  }

  const isStepValid = () => {
    if (step === 'plan') {
      return !!selectedPlan
    }
    if (step === 'beneficiaries') {
      return beneficiaries.every(b => 
        b.firstName && b.lastName && b.idNumber && b.phone
      )
    }
    return true
  }

  const nextStep = () => {
    if (step === 'plan') setStep('beneficiaries')
    else if (step === 'beneficiaries') setStep('review')
  }

  const prevStep = () => {
    if (step === 'beneficiaries') setStep('plan')
    else if (step === 'review') setStep('beneficiaries')
  }

  const handleSubmit = () => {
    // In real app, would redirect to Cardcom payment
    router.push('/checkout/success')
  }

  const totalPrice = currentPlan ? currentPlan.price * beneficiaries.length : 0

  return (
    <div className="container py-8 max-w-4xl">
      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-center gap-4">
          {[
            { key: 'plan', label: 'בחירת תוכנית' },
            { key: 'beneficiaries', label: 'פרטי מבוטחים' },
            { key: 'review', label: 'סיכום ותשלום' },
          ].map((s, i) => (
            <div key={s.key} className="flex items-center">
              <div className={cn(
                "flex items-center gap-2",
                step === s.key && "text-primary font-medium",
                ['plan', 'beneficiaries', 'review'].indexOf(step) > i && "text-muted-foreground"
              )}>
                <div className={cn(
                  "flex size-8 items-center justify-center rounded-full border-2 text-sm font-medium",
                  step === s.key && "border-primary bg-primary text-primary-foreground",
                  ['plan', 'beneficiaries', 'review'].indexOf(step) > i && "border-primary bg-primary/10 text-primary"
                )}>
                  {['plan', 'beneficiaries', 'review'].indexOf(step) > i ? (
                    <CheckCircle className="size-4" />
                  ) : (
                    i + 1
                  )}
                </div>
                <span className="hidden sm:inline">{s.label}</span>
              </div>
              {i < 2 && (
                <div className="mx-4 h-px w-8 sm:w-16 bg-border" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      {step === 'plan' && (
        <div className="space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold">בחר את התוכנית המתאימה לך</h1>
            <p className="text-muted-foreground mt-2">
              כל התוכניות כוללות שירות לקוחות 24/7 ואפשרות לביטול בכל עת
            </p>
          </div>

          <RadioGroup
            value={selectedPlan}
            onValueChange={setSelectedPlan}
            className="grid gap-4 md:grid-cols-3"
          >
            {mockPlans.map((plan) => (
              <label
                key={plan.id}
                className={cn(
                  "relative cursor-pointer rounded-xl border-2 p-6 transition-all hover:border-primary/50",
                  selectedPlan === plan.id && "border-primary bg-primary/5"
                )}
              >
                <RadioGroupItem value={plan.id} className="sr-only" />
                
                {plan.popular && (
                  <Badge className="absolute -top-3 start-4">
                    פופולרי
                  </Badge>
                )}

                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold">{plan.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {plan.description}
                    </p>
                  </div>

                  <div className="text-2xl font-bold">
                    ₪{plan.price}
                    <span className="text-sm font-normal text-muted-foreground">/חודש</span>
                  </div>

                  <ul className="space-y-2 text-sm">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <CheckCircle className="size-4 text-success" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              </label>
            ))}
          </RadioGroup>

          {/* Agent & Organization */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">פרטים נוספים</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel>סוכן (אופציונלי)</FieldLabel>
                  <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                    <SelectTrigger>
                      <SelectValue placeholder="בחר סוכן" />
                    </SelectTrigger>
                    <SelectContent>
                      {mockAgents.map((agent) => (
                        <SelectItem key={agent.id} value={agent.id}>
                          {agent.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel>שם ארגון (אופציונלי)</FieldLabel>
                  <Input
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    placeholder="שם החברה או הארגון"
                  />
                </Field>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {step === 'beneficiaries' && (
        <div className="space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold">פרטי המבוטחים</h1>
            <p className="text-muted-foreground mt-2">
              הזן את פרטי כל המבוטחים בתוכנית
            </p>
          </div>

          <div className="space-y-4">
            {beneficiaries.map((beneficiary, index) => (
              <Card key={beneficiary.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <User className="size-5" />
                      מבוטח {index + 1}
                    </CardTitle>
                    {beneficiaries.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeBeneficiary(beneficiary.id)}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <FieldGroup>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field>
                        <FieldLabel>שם פרטי *</FieldLabel>
                        <Input
                          value={beneficiary.firstName}
                          onChange={(e) => updateBeneficiary(beneficiary.id, 'firstName', e.target.value)}
                          placeholder="שם פרטי"
                        />
                      </Field>
                      <Field>
                        <FieldLabel>שם משפחה *</FieldLabel>
                        <Input
                          value={beneficiary.lastName}
                          onChange={(e) => updateBeneficiary(beneficiary.id, 'lastName', e.target.value)}
                          placeholder="שם משפחה"
                        />
                      </Field>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <Field>
                        <FieldLabel>תעודת זהות *</FieldLabel>
                        <Input
                          value={beneficiary.idNumber}
                          onChange={(e) => updateBeneficiary(beneficiary.id, 'idNumber', e.target.value)}
                          placeholder="123456789"
                          dir="ltr"
                        />
                      </Field>
                      <Field>
                        <FieldLabel>טלפון *</FieldLabel>
                        <Input
                          value={beneficiary.phone}
                          onChange={(e) => updateBeneficiary(beneficiary.id, 'phone', e.target.value)}
                          placeholder="050-1234567"
                          dir="ltr"
                        />
                      </Field>
                      <Field>
                        <FieldLabel>אימייל</FieldLabel>
                        <Input
                          type="email"
                          value={beneficiary.email}
                          onChange={(e) => updateBeneficiary(beneficiary.id, 'email', e.target.value)}
                          placeholder="email@example.com"
                          dir="ltr"
                        />
                      </Field>
                    </div>
                  </FieldGroup>
                </CardContent>
              </Card>
            ))}

            <Button variant="outline" onClick={addBeneficiary} className="w-full">
              <Plus className="size-4 me-2" />
              הוסף מבוטח נוסף
            </Button>
          </div>
        </div>
      )}

      {step === 'review' && (
        <div className="space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold">סיכום הזמנה</h1>
            <p className="text-muted-foreground mt-2">
              בדוק את הפרטים לפני התשלום
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Order Summary */}
            <Card>
              <CardHeader>
                <CardTitle>פרטי התוכנית</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{currentPlan?.name}</span>
                  <span>₪{currentPlan?.price}/חודש</span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>מספר מבוטחים</span>
                  <span>{beneficiaries.length}</span>
                </div>
                {currentAgent && (
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>סוכן</span>
                    <span>{currentAgent.name}</span>
                  </div>
                )}
                {organizationName && (
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>ארגון</span>
                    <span>{organizationName}</span>
                  </div>
                )}
                <Separator />
                <div className="flex items-center justify-between text-lg font-bold">
                  <span>סה״כ לתשלום</span>
                  <span>₪{totalPrice}/חודש</span>
                </div>
              </CardContent>
            </Card>

            {/* Beneficiaries List */}
            <Card>
              <CardHeader>
                <CardTitle>רשימת מבוטחים</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {beneficiaries.map((b, i) => (
                    <li key={b.id} className="flex items-center gap-3 text-sm">
                      <div className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        {i + 1}
                      </div>
                      <div>
                        <p className="font-medium">{b.firstName} {b.lastName}</p>
                        <p className="text-muted-foreground" dir="ltr">{b.phone}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8 pt-6 border-t">
        <Button
          variant="outline"
          onClick={prevStep}
          disabled={step === 'plan'}
        >
          <ChevronLeft className="size-4 me-2" />
          חזור
        </Button>

        {step === 'review' ? (
          <Button onClick={handleSubmit} size="lg">
            <CreditCard className="size-4 me-2" />
            המשך לתשלום
          </Button>
        ) : (
          <Button onClick={nextStep} disabled={!isStepValid()}>
            המשך
            <ChevronLeft className="size-4 ms-2 rotate-180" />
          </Button>
        )}
      </div>
    </div>
  )
}
