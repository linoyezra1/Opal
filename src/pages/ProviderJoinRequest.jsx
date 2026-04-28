import React, { useState } from 'react';
import { API_BASE } from '../apiBase.js';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card.jsx';
import { Button } from '../components/ui/button.jsx';
import { Input } from '../components/ui/input.jsx';
import { Field, FieldGroup, FieldLabel } from '../components/ui/field.jsx';

const emptyContact = { name: '', role: '', phone: '', mobile: '', email: '' };

export default function ProviderJoinRequest() {
  const [company, setCompany] = useState({
    companyName: '',
    companyId: '',
    officialAddress: '',
    companyEmail: '',
  });
  const [contact, setContact] = useState(emptyContact);
  const [activity, setActivity] = useState({ fieldOfActivity: '', message: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const setC = (k) => (e) => setCompany((p) => ({ ...p, [k]: e.target.value }));
  const setK = (k) => (e) => setContact((p) => ({ ...p, [k]: e.target.value }));
  const setA = (k) => (e) => setActivity((p) => ({ ...p, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    if (!company.companyName.trim()) {
      setError('נדרש שם החברה');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/providers/join-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName:     company.companyName.trim(),
          companyId:       company.companyId.trim(),
          officialAddress: company.officialAddress.trim(),
          companyEmail:    company.companyEmail.trim(),
          contactPerson:   contact,
          fieldOfActivity: activity.fieldOfActivity.trim(),
          message:         activity.message.trim(),
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
          <p className="text-muted-foreground">הצוות שלנו יבדוק את הבקשה ויחזור אליך בהקדם.</p>
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
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-row items-center justify-between gap-4">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1A365D]">
            טופס בקשת הצטרפות לספק
          </h1>
          <img
            src="/branding/opal-logo.jpeg"
            alt="אופאל"
            className="h-16 sm:h-20 w-auto object-contain rounded-md bg-white px-2 py-1 shadow-sm flex-shrink-0"
          />
        </div>
        <p className="text-sm text-[#1A365D]/70">
          אנא מלאו את הפרטים והצוות שלנו יחזור אליכם בהקדם
        </p>

        <form onSubmit={submit} className="space-y-6">

          {/* Card 1 — פרטי הספק */}
          <Card className="bg-white border-border shadow-sm">
            <CardHeader>
              <CardTitle className="text-[#1A365D]">פרטי הספק</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel className="text-[#1A365D]">שם החברה *</FieldLabel>
                    <Input value={company.companyName} onChange={setC('companyName')} placeholder="שם מלא" required />
                  </Field>
                  <Field>
                    <FieldLabel className="text-[#1A365D]">ח.פ</FieldLabel>
                    <Input value={company.companyId} onChange={setC('companyId')} dir="ltr" />
                  </Field>
                </div>
                <Field>
                  <FieldLabel className="text-[#1A365D]">כתובת רשמית</FieldLabel>
                  <Input value={company.officialAddress} onChange={setC('officialAddress')} placeholder="עיר, רחוב, מס׳" />
                </Field>
                <Field>
                  <FieldLabel className="text-[#1A365D]">מייל החברה</FieldLabel>
                  <Input type="email" dir="ltr" value={company.companyEmail} onChange={setC('companyEmail')} />
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          {/* Card 2 — פרטי הפונה */}
          <Card className="bg-white border-border shadow-sm">
            <CardHeader>
              <CardTitle className="text-[#1A365D]">פרטי הפונה</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel className="text-[#1A365D]">שם איש קשר</FieldLabel>
                    <Input value={contact.name} onChange={setK('name')} />
                  </Field>
                  <Field>
                    <FieldLabel className="text-[#1A365D]">תפקיד</FieldLabel>
                    <Input value={contact.role} onChange={setK('role')} />
                  </Field>
                  <Field>
                    <FieldLabel className="text-[#1A365D]">טלפון איש קשר</FieldLabel>
                    <Input dir="ltr" value={contact.phone} onChange={setK('phone')} placeholder="03-…" />
                  </Field>
                  <Field>
                    <FieldLabel className="text-[#1A365D]">נייד איש קשר</FieldLabel>
                    <Input dir="ltr" value={contact.mobile} onChange={setK('mobile')} placeholder="05x-…" />
                  </Field>
                </div>
                <Field>
                  <FieldLabel className="text-[#1A365D]">אימייל איש קשר</FieldLabel>
                  <Input type="email" dir="ltr" value={contact.email} onChange={setK('email')} />
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          {/* Card 3 — פעילות ופנייה */}
          <Card className="bg-white border-border shadow-sm">
            <CardHeader>
              <CardTitle className="text-[#1A365D]">פעילות ופנייה</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel className="text-[#1A365D]">תחום פעילות ומכירות</FieldLabel>
                  <Input
                    value={activity.fieldOfActivity}
                    onChange={setA('fieldOfActivity')}
                    placeholder="תארו את תחום הפעילות שלכם"
                  />
                </Field>
                <Field>
                  <FieldLabel className="text-[#1A365D]">תוכן הפנייה</FieldLabel>
                  <textarea
                    rows={5}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="פרטו את מהות הפנייה, ציפיות ושאלות נוספות…"
                    value={activity.message}
                    onChange={setA('message')}
                  />
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          {error ? <p className="text-destructive text-sm font-medium">{error}</p> : null}

          <Button
            type="submit"
            size="lg"
            className="w-full sm:w-auto bg-[#1A365D] hover:bg-[#152d4e]"
            disabled={loading}
          >
            {loading ? 'שולח…' : 'שלח'}
          </Button>
        </form>
      </div>
    </div>
  );
}
