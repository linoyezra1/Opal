import React, { useMemo, useState } from 'react';
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
  const [generalData, setGeneralData] = useState({ fieldOfActivity: '', employeesCount: '' });
  const [notes, setNotes] = useState('');
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const setPerson = (setter, key) => (e) => setter((p) => ({ ...p, [key]: e.target.value }));

  const canGoStep2 = useMemo(
    () => String(company.companyName || '').trim().length > 0,
    [company.companyName]
  );
  const canGoStep3 = useMemo(
    () =>
      String(contactPerson.name || '').trim().length > 0 &&
      String(contactPerson.phone || '').trim().length > 0,
    [contactPerson.name, contactPerson.phone]
  );

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
          {step === 1 ? (
            <Card className="bg-white border-border shadow-sm">
              <CardHeader><CardTitle className="text-[#1A365D]">פרטי הארגון</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <FieldGroup>
                  <Field><FieldLabel className="text-[#1A365D]">שם חברה *</FieldLabel><Input dir="rtl" className="text-right" value={company.companyName} onChange={(e) => setCompany((p) => ({ ...p, companyName: e.target.value }))} required /></Field>
                  <Field><FieldLabel className="text-[#1A365D]">ח.פ</FieldLabel><Input dir="rtl" className="text-right" value={company.companyId} onChange={(e) => setCompany((p) => ({ ...p, companyId: e.target.value }))} /></Field>
                  <Field><FieldLabel className="text-[#1A365D]">כתובת רשמית</FieldLabel><Input dir="rtl" className="text-right" value={company.officialAddress} onChange={(e) => setCompany((p) => ({ ...p, officialAddress: e.target.value }))} /></Field>
                  <Field><FieldLabel className="text-[#1A365D]">אימייל חברה</FieldLabel><Input dir="ltr" className="text-right" value={company.companyEmail} onChange={(e) => setCompany((p) => ({ ...p, companyEmail: e.target.value }))} /></Field>
                  <Field><FieldLabel className="text-[#1A365D]">תחום פעילות</FieldLabel><Input dir="rtl" className="text-right" value={generalData.fieldOfActivity} onChange={(e) => setGeneralData((p) => ({ ...p, fieldOfActivity: e.target.value }))} /></Field>
                  <Field><FieldLabel className="text-[#1A365D]">מספר עובדים</FieldLabel><Input type="number" dir="rtl" className="text-right" value={generalData.employeesCount} onChange={(e) => setGeneralData((p) => ({ ...p, employeesCount: e.target.value }))} /></Field>
                </FieldGroup>
                <div className="flex justify-end">
                  <Button type="button" onClick={() => setStep(2)} disabled={!canGoStep2}>שמור</Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {step === 2 ? (
            <Card className="bg-white border-border shadow-sm">
              <CardHeader><CardTitle className="text-[#1A365D]">אנשי קשר</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <p className="font-medium text-[#1A365D] mb-2">איש קשר ראשי</p>
                  <PersonFields person={contactPerson} setPerson={setPerson} setter={setContactPerson} requiredName requiredPhone />
                </div>
                <div>
                  <p className="font-medium text-[#1A365D] mb-2">איש קשר נוסף</p>
                  <PersonFields person={additionalContact} setPerson={setPerson} setter={setAdditionalContact} />
                </div>
                <div className="flex justify-between">
                  <Button type="button" variant="outline" onClick={() => setStep(1)}>חזרה</Button>
                  <Button type="button" onClick={() => setStep(3)} disabled={!canGoStep3}>המשך</Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {step === 3 ? (
            <Card className="bg-white border-border shadow-sm">
              <CardHeader><CardTitle className="text-[#1A365D]">פרטי חשבון וסיום</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <p className="font-medium text-[#1A365D] mb-2">הנהלת חשבונות</p>
                  <PersonFields person={accounting} setPerson={setPerson} setter={setAccounting} />
                </div>
                <Field>
                  <FieldLabel className="text-[#1A365D]">הערות נוספות</FieldLabel>
                  <textarea
                    rows={4}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-right"
                    placeholder="פרטו את הצרכים, שאלות או בקשות נוספות..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </Field>
                {error ? <p className="text-destructive text-sm">{error}</p> : null}
                <div className="flex justify-between">
                  <Button type="button" variant="outline" onClick={() => setStep(2)}>חזרה</Button>
                  <Button type="submit" size="lg" className="bg-[#1A365D] hover:bg-[#152d4e]" disabled={loading}>
                    {loading ? 'שולח…' : 'סיום / שמור'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}
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
