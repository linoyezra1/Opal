import React, { useState } from 'react';
import { API_BASE } from '../apiBase.js';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card.jsx';
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
  const [notes, setNotes] = useState('');
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
          notes: notes.trim(),
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

  if (done) {
    return (
      <div
        dir="rtl"
        className="min-h-screen flex items-center justify-center p-6"
        style={{ background: 'linear-gradient(180deg, #f8fbff 0%, #eef4fb 100%)' }}
      >
        <div className="w-full max-w-md text-center space-y-4">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 text-3xl">✓</div>
          <h1 className="text-2xl font-bold text-[#1A365D]">הבקשה נשלחה בהצלחה!</h1>
          <p className="text-muted-foreground">הצוות שלנו יחזור אליכם בהקדם.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      dir="rtl"
      className="min-h-screen p-3 sm:p-4 md:p-8"
      style={{ background: 'linear-gradient(180deg, #f8fbff 0%, #f3f7fc 48%, #eef4fb 100%)' }}
    >
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-row items-center justify-between gap-4">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1A365D] text-right">
            בקשת הצטרפות ארגונים
          </h1>
          <img
            src="/branding/opal-logo.jpeg"
            alt="אופאל"
            className="h-16 sm:h-20 w-auto object-contain rounded-md bg-white px-2 py-1 shadow-sm shrink-0"
          />
        </div>
        <p className="text-sm sm:text-base text-[#1A365D]/70 text-right">
          אנא מלאו את הפרטים והצוות שלנו יחזור אליכם בהקדם
        </p>

        <form onSubmit={submit} className="space-y-6">
          <Card className="bg-white border-border shadow-sm">
            <CardHeader><CardTitle className="text-[#1A365D]">פרטי ארגון</CardTitle></CardHeader>
            <CardContent>
              <FieldGroup>
                <Field><FieldLabel className="text-[#1A365D]">שם חברה *</FieldLabel><Input value={company.companyName} onChange={(e) => setCompany((p) => ({ ...p, companyName: e.target.value }))} required /></Field>
                <Field><FieldLabel className="text-[#1A365D]">ח.פ</FieldLabel><Input value={company.companyId} onChange={(e) => setCompany((p) => ({ ...p, companyId: e.target.value }))} /></Field>
                <Field><FieldLabel className="text-[#1A365D]">כתובת רשמית</FieldLabel><Input value={company.officialAddress} onChange={(e) => setCompany((p) => ({ ...p, officialAddress: e.target.value }))} /></Field>
                <Field><FieldLabel className="text-[#1A365D]">אימייל חברה</FieldLabel><Input dir="ltr" value={company.companyEmail} onChange={(e) => setCompany((p) => ({ ...p, companyEmail: e.target.value }))} /></Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card className="bg-white border-border shadow-sm">
            <CardHeader><CardTitle className="text-[#1A365D]">איש קשר ראשי</CardTitle></CardHeader>
            <CardContent><PersonFields person={contactPerson} setPerson={setPerson} setter={setContactPerson} requiredName requiredPhone /></CardContent>
          </Card>

          <Card className="bg-white border-border shadow-sm">
            <CardHeader><CardTitle className="text-[#1A365D]">הנהלת חשבונות</CardTitle></CardHeader>
            <CardContent><PersonFields person={accounting} setPerson={setPerson} setter={setAccounting} /></CardContent>
          </Card>

          <Card className="bg-white border-border shadow-sm">
            <CardHeader><CardTitle className="text-[#1A365D]">איש קשר נוסף</CardTitle></CardHeader>
            <CardContent><PersonFields person={additionalContact} setPerson={setPerson} setter={setAdditionalContact} /></CardContent>
          </Card>

          <Card className="bg-white border-border shadow-sm">
            <CardHeader><CardTitle className="text-[#1A365D]">נתונים כלליים</CardTitle></CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel className="text-[#1A365D]">שיטת חיוב</FieldLabel>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-[#1A365D]"
                    value={billingMethod}
                    onChange={(e) => setBillingMethod(e.target.value)}
                  >
                    <option value="private">חיוב לקוח פרטי</option>
                    <option value="corporate">חיוב מרוכז חברה</option>
                  </select>
                </Field>
                <Field><FieldLabel className="text-[#1A365D]">תחום פעילות</FieldLabel><Input value={generalData.fieldOfActivity} onChange={(e) => setGeneralData((p) => ({ ...p, fieldOfActivity: e.target.value }))} /></Field>
                <Field><FieldLabel className="text-[#1A365D]">מספר עובדים</FieldLabel><Input type="number" value={generalData.employeesCount} onChange={(e) => setGeneralData((p) => ({ ...p, employeesCount: e.target.value }))} /></Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card className="bg-white border-border shadow-sm">
            <CardHeader><CardTitle className="text-[#1A365D]">הערות נוספות</CardTitle></CardHeader>
            <CardContent>
              <Field>
                <FieldLabel className="text-[#1A365D]">תוכן ההודעה</FieldLabel>
                <textarea
                  rows={4}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="פרטו את הצרכים, שאלות או בקשות נוספות..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </Field>
            </CardContent>
          </Card>

          {error ? <p className="text-destructive text-sm">{error}</p> : null}

          <Button type="submit" size="lg" className="w-full sm:w-auto bg-[#1A365D] hover:bg-[#152d4e]" disabled={loading}>
            {loading ? 'שולח…' : 'שליחת בקשה'}
          </Button>
        </form>
      </div>
    </div>
  );
}

function PersonFields({ person, setPerson, setter, requiredName = false, requiredPhone = false }) {
  return (
    <FieldGroup>
      <Field><FieldLabel className="text-[#1A365D]">שם</FieldLabel><Input value={person.name} onChange={setPerson(setter, 'name')} required={requiredName} /></Field>
      <Field><FieldLabel className="text-[#1A365D]">תפקיד</FieldLabel><Input value={person.role} onChange={setPerson(setter, 'role')} /></Field>
      <Field><FieldLabel className="text-[#1A365D]">טלפון</FieldLabel><Input dir="ltr" value={person.phone} onChange={setPerson(setter, 'phone')} required={requiredPhone} /></Field>
      <Field><FieldLabel className="text-[#1A365D]">נייד</FieldLabel><Input dir="ltr" value={person.mobile} onChange={setPerson(setter, 'mobile')} /></Field>
      <Field><FieldLabel className="text-[#1A365D]">אימייל</FieldLabel><Input dir="ltr" value={person.email} onChange={setPerson(setter, 'email')} /></Field>
    </FieldGroup>
  );
}
