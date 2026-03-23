import React, { useState } from 'react';
import { API_BASE } from '../apiBase.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card.jsx';
import { Button } from '../components/ui/button.jsx';
import { Input } from '../components/ui/input.jsx';
import { Field, FieldGroup, FieldLabel } from '../components/ui/field.jsx';

const emptyPerson = { name: '', role: '', phone: '', mobile: '', email: '' };

export default function OrganizationJoinRequest() {
  const [company, setCompany] = useState({ companyName: '', companyId: '', officialAddress: '', companyEmail: '' });
  const [contactPerson, setContactPerson] = useState(emptyPerson);
  const [accounting, setAccounting] = useState(emptyPerson);
  const [additionalContact, setAdditionalContact] = useState(emptyPerson);
  const [billingMethod, setBillingMethod] = useState('corporate');
  const [generalData, setGeneralData] = useState({ fieldOfActivity: '', employeesCount: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const setPerson = (setter, key) => (e) => setter((p) => ({ ...p, [key]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setDone(false);
    try {
      const res = await fetch(`${API_BASE}/api/organization-join-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company,
          contactPerson,
          accounting,
          additionalContact,
          billingMethod,
          generalData: { ...generalData, employeesCount: Number(generalData.employeesCount || 0) },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'שליחה נכשלה');
      setDone(true);
    } catch (err) {
      setError(err.message || 'שגיאה');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-muted/30 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">בקשת הצטרפות והזמנה</h1>
          <p className="text-muted-foreground">אנא מלאו את הפרטים והצוות שלנו יחזור אליכם בהקדם</p>
        </div>

        <form onSubmit={submit} className="space-y-6">
          <Card>
            <CardHeader><CardTitle>פרטי ארגון</CardTitle></CardHeader>
            <CardContent>
              <FieldGroup>
                <Field><FieldLabel>שם חברה *</FieldLabel><Input value={company.companyName} onChange={(e) => setCompany((p) => ({ ...p, companyName: e.target.value }))} required /></Field>
                <Field><FieldLabel>ח.פ</FieldLabel><Input value={company.companyId} onChange={(e) => setCompany((p) => ({ ...p, companyId: e.target.value }))} /></Field>
                <Field><FieldLabel>כתובת רשמית</FieldLabel><Input value={company.officialAddress} onChange={(e) => setCompany((p) => ({ ...p, officialAddress: e.target.value }))} /></Field>
                <Field><FieldLabel>אימייל חברה</FieldLabel><Input dir="ltr" value={company.companyEmail} onChange={(e) => setCompany((p) => ({ ...p, companyEmail: e.target.value }))} /></Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>איש קשר ראשי</CardTitle></CardHeader>
            <CardContent><PersonFields person={contactPerson} setPerson={setPerson} setter={setContactPerson} requiredName requiredPhone /></CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>הנהלת חשבונות</CardTitle></CardHeader>
            <CardContent><PersonFields person={accounting} setPerson={setPerson} setter={setAccounting} /></CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>איש קשר נוסף</CardTitle></CardHeader>
            <CardContent><PersonFields person={additionalContact} setPerson={setPerson} setter={setAdditionalContact} /></CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>נתונים כלליים</CardTitle></CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel>שיטת חיוב</FieldLabel>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={billingMethod} onChange={(e) => setBillingMethod(e.target.value)}>
                    <option value="private">חיוב לקוח פרטי</option>
                    <option value="corporate">חיוב מרוכז חברה</option>
                  </select>
                </Field>
                <Field><FieldLabel>תחום פעילות</FieldLabel><Input value={generalData.fieldOfActivity} onChange={(e) => setGeneralData((p) => ({ ...p, fieldOfActivity: e.target.value }))} /></Field>
                <Field><FieldLabel>מספר עובדים</FieldLabel><Input type="number" value={generalData.employeesCount} onChange={(e) => setGeneralData((p) => ({ ...p, employeesCount: e.target.value }))} /></Field>
              </FieldGroup>
            </CardContent>
          </Card>

          {error ? <p className="text-destructive text-sm">{error}</p> : null}
          {done ? <p className="text-emerald-700 text-sm font-medium">הבקשה נשלחה בהצלחה.</p> : null}
          <Button type="submit" size="lg" disabled={loading}>{loading ? 'שולח…' : 'שליחת בקשה'}</Button>
        </form>
      </div>
    </div>
  );
}

function PersonFields({ person, setPerson, setter, requiredName = false, requiredPhone = false }) {
  return (
    <FieldGroup>
      <Field><FieldLabel>שם</FieldLabel><Input value={person.name} onChange={setPerson(setter, 'name')} required={requiredName} /></Field>
      <Field><FieldLabel>תפקיד</FieldLabel><Input value={person.role} onChange={setPerson(setter, 'role')} /></Field>
      <Field><FieldLabel>טלפון</FieldLabel><Input dir="ltr" value={person.phone} onChange={setPerson(setter, 'phone')} required={requiredPhone} /></Field>
      <Field><FieldLabel>נייד</FieldLabel><Input dir="ltr" value={person.mobile} onChange={setPerson(setter, 'mobile')} /></Field>
      <Field><FieldLabel>אימייל</FieldLabel><Input dir="ltr" value={person.email} onChange={setPerson(setter, 'email')} /></Field>
    </FieldGroup>
  );
}
