import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Building2, CreditCard } from 'lucide-react';
import { API_BASE } from '../apiBase.js';
import { Button } from '../components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card.jsx';
import { Input } from '../components/ui/input.jsx';
import { Field, FieldGroup, FieldLabel } from '../components/ui/field.jsx';
import { Spinner } from '../components/ui/spinner.jsx';

function validateEmail(value) {
  const t = String(value || '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

function validatePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length >= 9 && digits.length <= 11;
}

export default function OrgRegisterPage() {
  const [searchParams] = useSearchParams();
  const orgId = useMemo(() => String(searchParams.get('orgId') || '').trim(), [searchParams]);

  const [loading, setLoading] = useState(!!orgId);
  const [error, setError] = useState('');
  const [org, setOrg] = useState(null);

  const [fullName, setFullName] = useState('');
  const [idNum, setIdNum] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!orgId) {
      setLoading(false);
      setError('חסר מזהה ארגון בקישור (orgId).');
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`${API_BASE}/api/public/organization/${encodeURIComponent(orgId)}`);
        const j = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok || !j.success || !j.organization) {
          setError(j.error || 'ארגון לא נמצא');
          setOrg(null);
          return;
        }
        setOrg(j.organization);
        if (j.organization.billingType !== 'Private') {
          setError(
            'ארגון זה אינו מוגדר לרישום בתשלום פרטי. לפרטים פנו לאופאל.'
          );
        }
      } catch {
        if (!cancelled) setError('שגיאת רשת');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  async function onSubmit(e) {
    e.preventDefault();
    setFormError('');
    if (!org || org.billingType !== 'Private') return;
    if (!fullName.trim()) {
      setFormError('נא למלא שם מלא');
      return;
    }
    if (!idNum.trim()) {
      setFormError('נא למלא תעודת זהות');
      return;
    }
    if (!validateEmail(email)) {
      setFormError('נא למלא כתובת דוא״ל תקינה');
      return;
    }
    if (!validatePhone(phone)) {
      setFormError('נא למלא טלפון תקין');
      return;
    }
    const price = Number(org.monthlyPricePerMember || 0);
    if (!price || price <= 0) {
      setFormError('לא הוגדר מחיר מנוי לארגון זה. פנו למנהל הארגון.');
      return;
    }

    const formState = {
      selectedPlanId: 'org-register',
      fullName: fullName.trim(),
      id: idNum.trim(),
      email: email.trim(),
      phone: phone.trim(),
      organizationName: org.name || '',
      organizationId: org.id,
      paymentMethod: 'private',
      orgPrivateEnrollment: true,
      orgPrivatePrice: price,
      productName: 'מנוי ארגוני — אופאל',
      agentId: '',
      agentName: '',
      beneficiaryCount: 0,
      beneficiaries: [],
    };

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formState }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(data.error || 'שגיאה ביצירת תשלום');
        return;
      }
      if (data.url) {
        try {
          if (data.lowProfileCode) {
            sessionStorage.setItem('opal_checkout_low_profile', String(data.lowProfileCode));
          }
        } catch {
          /* ignore */
        }
        window.location.href = data.url;
        return;
      }
      setFormError('לא התקבל קישור לתשלום');
    } catch (err) {
      setFormError(err.message || 'שגיאת רשת');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-b from-[#D9EAF3]/40 to-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center size-14 rounded-2xl bg-primary/10 border border-primary/20 mb-2">
            <span className="text-lg font-bold text-primary">אופאל</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">הרשמה ארגונית</h1>
          <p className="text-sm text-muted-foreground">שירותי בריאות דיגיטליים</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building2 className="size-5 text-primary" />
              {loading ? 'טוען…' : org ? `ברוכים הבאים עובדי ${org.name}` : 'הרשמה'}
            </CardTitle>
            <CardDescription>
              {org && org.billingType === 'Private' ? (
                <>
                  מחיר מנוי חודשי בהנחת ארגון:{' '}
                  <strong className="text-foreground">
                    {new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS' }).format(
                      Number(org.monthlyPricePerMember || 0)
                    )}
                  </strong>
                </>
              ) : (
                'מלאו את הפרטים להמשך לתשלום מאובטח'
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Spinner className="size-8" />
              </div>
            ) : error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : org && org.billingType === 'Private' ? (
              <form onSubmit={onSubmit} className="space-y-4">
                <FieldGroup>
                  <Field>
                    <FieldLabel>שם מלא</FieldLabel>
                    <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                  </Field>
                  <Field>
                    <FieldLabel>תעודת זהות</FieldLabel>
                    <Input dir="ltr" value={idNum} onChange={(e) => setIdNum(e.target.value)} required />
                  </Field>
                  <Field>
                    <FieldLabel>אימייל</FieldLabel>
                    <Input dir="ltr" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </Field>
                  <Field>
                    <FieldLabel>טלפון</FieldLabel>
                    <Input dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} required />
                  </Field>
                </FieldGroup>
                {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? <Spinner className="size-4 me-2" /> : <CreditCard className="size-4 me-2" />}
                  המשך לתשלום מאובטח
                </Button>
              </form>
            ) : (
              <p className="text-sm text-muted-foreground">לא ניתן להמשיך בהרשמה מקישור זה.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
