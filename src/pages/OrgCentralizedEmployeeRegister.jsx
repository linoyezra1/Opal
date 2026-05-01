import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import { API_BASE } from '../apiBase.js';
import {
  normalizeIsraeliIdDigitsInput,
  validateIsraeliId,
  shouldShowIsraeliIdChecksumError,
  ISRAELI_ID_INVALID_MSG,
} from '../utils/israeliId.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card.jsx';
import { Button } from '../components/ui/button.jsx';
import { Input } from '../components/ui/input.jsx';
import { Field, FieldGroup, FieldLabel } from '../components/ui/field.jsx';
import { Spinner } from '../components/ui/spinner.jsx';

const MARITAL_OPTIONS = ['', 'רווק/ה', 'נשוי/אה', 'גרוש/ה', 'אלמן/ה', 'ידוע/ה בציבור'];
const HEALTH_FUNDS    = ['', 'כללית', 'מכבי', 'מאוחדת', 'לאומית'];
const GENDER_OPTIONS  = ['', 'זכר', 'נקבה', 'אחר'];
const SUPPLEMENTAL_OPTIONS = ['', 'אין', 'כסף', 'זהב', 'פלטינום', 'אחר'];

const SELECT_CLASS = 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm';

const emptyForm = {
  firstName: '',
  lastName: '',
  idNum: '',
  dateOfBirth: '',
  gender: '',
  maritalStatus: '',
  healthFund: '',
  supplementalInsurance: '',
  phone: '',
  email: '',
  address: '',
};

export default function OrgCentralizedEmployeeRegister() {
  const [searchParams] = useSearchParams();
  const orgId = useMemo(() => String(searchParams.get('orgId') || '').trim(), [searchParams]);

  const [loading, setLoading]   = useState(!!orgId);
  const [error, setError]       = useState('');
  const [org, setOrg]           = useState(null);
  const [form, setForm]         = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError]   = useState('');
  const [done, setDone]             = useState(false);

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  useEffect(() => {
    if (!orgId) { setLoading(false); setError('חסר מזהה ארגון בקישור (orgId).'); return; }
    let cancelled = false;
    (async () => {
      setLoading(true); setError('');
      try {
        const res = await fetch(`${API_BASE}/api/public/organization/${encodeURIComponent(orgId)}`);
        const j   = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok || !j.success || !j.organization) { setError(j.error || 'ארגון לא נמצא'); return; }
        if (j.organization.billingType !== 'Centralized') {
          setError('ארגון זה אינו מוגדר לרישום עצמי מרוכז. לפרטים פנו לאופאל.');
          return;
        }
        setOrg(j.organization);
      } catch { if (!cancelled) setError('שגיאת רשת'); }
      finally  { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [orgId]);

  const set = (k) => (v) => setForm((p) => ({ ...p, [k]: v }));
  const setE = (k) => (e) => set(k)(e.target.value);

  async function onSubmit(e) {
    e.preventDefault();
    setFormError('');
    if (!form.firstName.trim() || !form.lastName.trim()) { setFormError('נא למלא שם פרטי ושם משפחה'); return; }
    const idDigits = normalizeIsraeliIdDigitsInput(form.idNum);
    if (!idDigits) { setFormError('נא למלא תעודת זהות'); return; }
    if (!validateIsraeliId(idDigits)) { setFormError(ISRAELI_ID_INVALID_MSG); return; }
    if (!form.dateOfBirth) { setFormError('נא למלא תאריך לידה'); return; }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/org/employee-register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, ...form, idNum: idDigits }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) { setFormError(data.error || 'שגיאה ברישום'); return; }
      setDone(true);
    } catch (err) {
      setFormError(err.message || 'שגיאת רשת');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div dir="rtl" className="min-h-screen bg-gradient-to-b from-[#D9EAF3]/40 to-background flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md text-center space-y-4">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 text-3xl">✓</div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">תודה רבה!</h1>
          <p className="text-muted-foreground leading-relaxed">
            הפרטים נשלחו לאישור מנהל הארגון.<br />
            <strong>רק לאחר אישור מנהל הארגון מנויך יופעל.</strong>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-b from-[#D9EAF3]/40 to-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-2">
          <img
            src="/branding/opal-logo.jpeg"
            alt="אופאל"
            className="mx-auto h-16 w-auto rounded-md bg-white shadow-sm"
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building2 className="size-5 text-primary" />
              {loading ? 'טוען…' : org ? `שלום עובד ${org.name}` : 'הרשמת עובד'}
            </CardTitle>
            {org && !error ? (
              <CardDescription className="leading-relaxed">
                <strong>{org.name}</strong> רוצים לצרף אותך ל-
                <strong>{org.subscriptionProductName || 'שירות רפואי'}</strong>.<br />
                לצורך השלמת התהליך יש להזין פרטים:
              </CardDescription>
            ) : null}
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8"><Spinner className="size-8" /></div>
            ) : error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : org ? (
              <form onSubmit={onSubmit} className="space-y-4">
                <FieldGroup>
                  {/* שם */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field>
                      <FieldLabel>שם פרטי *</FieldLabel>
                      <Input value={form.firstName} onChange={setE('firstName')} placeholder="שם פרטי" required />
                    </Field>
                    <Field>
                      <FieldLabel>שם משפחה *</FieldLabel>
                      <Input value={form.lastName} onChange={setE('lastName')} placeholder="שם משפחה" required />
                    </Field>
                  </div>

                  {/* ת.ז + תאריך לידה */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field>
                      <FieldLabel>תעודת זהות *</FieldLabel>
                      <Input
                        dir="ltr"
                        inputMode="numeric"
                        maxLength={9}
                        value={form.idNum}
                        onChange={(e) => set('idNum')(normalizeIsraeliIdDigitsInput(e.target.value))}
                        placeholder="7–9 ספרות"
                      />
                      {shouldShowIsraeliIdChecksumError(form.idNum) ? (
                        <p className="text-destructive text-xs mt-1">{ISRAELI_ID_INVALID_MSG}</p>
                      ) : null}
                    </Field>
                    <Field>
                      <FieldLabel>תאריך לידה *</FieldLabel>
                      <Input
                        type="date"
                        value={form.dateOfBirth}
                        max={today}
                        onChange={setE('dateOfBirth')}
                      />
                    </Field>
                  </div>

                  {/* מין + מצב משפחתי */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field>
                      <FieldLabel>מין</FieldLabel>
                      <select className={SELECT_CLASS} value={form.gender} onChange={setE('gender')}>
                        {GENDER_OPTIONS.map((o) => <option key={o || 'g'} value={o}>{o || 'בחר'}</option>)}
                      </select>
                    </Field>
                    <Field>
                      <FieldLabel>מצב משפחתי</FieldLabel>
                      <select className={SELECT_CLASS} value={form.maritalStatus} onChange={setE('maritalStatus')}>
                        {MARITAL_OPTIONS.map((o) => <option key={o || 'm'} value={o}>{o || 'בחר'}</option>)}
                      </select>
                    </Field>
                  </div>

                  {/* קופת חולים + ביטוח משלים */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field>
                      <FieldLabel>קופת חולים</FieldLabel>
                      <select className={SELECT_CLASS} value={form.healthFund} onChange={setE('healthFund')}>
                        {HEALTH_FUNDS.map((o) => <option key={o || 'h'} value={o}>{o || 'בחר'}</option>)}
                      </select>
                    </Field>
                    <Field>
                      <FieldLabel>ביטוח משלים</FieldLabel>
                      <select className={SELECT_CLASS} value={form.supplementalInsurance} onChange={setE('supplementalInsurance')}>
                        {SUPPLEMENTAL_OPTIONS.map((o) => <option key={o || 's'} value={o}>{o || 'בחר'}</option>)}
                      </select>
                    </Field>
                  </div>

                  {/* טלפון + אימייל */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field>
                      <FieldLabel>טלפון</FieldLabel>
                      <Input dir="ltr" value={form.phone} onChange={setE('phone')} placeholder="05x-xxxxxxx" />
                    </Field>
                    <Field>
                      <FieldLabel>אימייל</FieldLabel>
                      <Input dir="ltr" type="email" value={form.email} onChange={setE('email')} />
                    </Field>
                  </div>

                  <Field>
                    <FieldLabel>כתובת</FieldLabel>
                    <Input value={form.address} onChange={setE('address')} placeholder="עיר, רחוב, מספר בית" />
                  </Field>
                </FieldGroup>

                {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

                <Button type="submit" size="lg" className="w-full" disabled={submitting}>
                  {submitting ? <><Spinner className="size-4 me-2" />שולח…</> : 'שלח לאישור'}
                </Button>
              </form>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
