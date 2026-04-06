import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { API_BASE } from '../apiBase.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card.jsx';
import { Button } from '../components/ui/button.jsx';
import { Input } from '../components/ui/input.jsx';
import { Spinner } from '../components/ui/spinner.jsx';
import { FieldGroup, Field, FieldLabel } from '../components/ui/field.jsx';

const MARITAL_OPTIONS = ['', 'רווק/ה', 'נשוי/אה', 'גרוש/ה', 'אלמן/ה', 'ידוע/ה בציבור'];
const HEALTH_FUNDS = ['', 'כללית', 'מכבי', 'מאוחדת', 'לאומית'];
const GENDER_OPTIONS = ['', 'זכר', 'נקבה', 'אחר'];
const SUPPLEMENTAL_OPTIONS = ['', 'אין', 'כסף', 'זהב', 'פלטינום', 'אחר'];

function validateId(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length === 9;
}

function emptyMember() {
  return {
    firstName: '',
    lastName: '',
    id: '',
    dateOfBirth: '',
    gender: '',
    maritalStatus: '',
    healthFund: '',
    supplementalInsurance: '',
    phone: '',
    email: '',
    address: '',
  };
}

function splitFullName(fullName) {
  const parts = String(fullName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] };
}

function MemberFields({ title, member, onChange, errors = {}, includeContact = false }) {
  const set = (k) => (v) => onChange({ ...member, [k]: v });

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field>
          <FieldLabel>שם פרטי *</FieldLabel>
          <Input value={member.firstName} onChange={(e) => set('firstName')(e.target.value)} placeholder="שם פרטי" />
          {errors.firstName ? <p className="text-destructive text-xs">{errors.firstName}</p> : null}
        </Field>
        <Field>
          <FieldLabel>שם משפחה *</FieldLabel>
          <Input value={member.lastName} onChange={(e) => set('lastName')(e.target.value)} placeholder="שם משפחה" />
          {errors.lastName ? <p className="text-destructive text-xs">{errors.lastName}</p> : null}
        </Field>
        <Field>
          <FieldLabel>תעודת זהות *</FieldLabel>
          <Input
            value={member.id}
            onChange={(e) => set('id')(String(e.target.value).replace(/\D/g, '').slice(0, 9))}
            placeholder="9 ספרות"
            inputMode="numeric"
            maxLength={9}
          />
          {errors.id ? <p className="text-destructive text-xs">{errors.id}</p> : null}
        </Field>
        <Field>
          <FieldLabel>תאריך לידה *</FieldLabel>
          <Input type="date" value={member.dateOfBirth} onChange={(e) => set('dateOfBirth')(e.target.value)} />
          {errors.dateOfBirth ? <p className="text-destructive text-xs">{errors.dateOfBirth}</p> : null}
        </Field>
        <Field>
          <FieldLabel>מין</FieldLabel>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={member.gender}
            onChange={(e) => set('gender')(e.target.value)}
          >
            {GENDER_OPTIONS.map((o) => (
              <option key={o || 'g-empty'} value={o}>
                {o || 'בחר'}
              </option>
            ))}
          </select>
        </Field>
        <Field>
          <FieldLabel>מצב משפחתי</FieldLabel>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={member.maritalStatus}
            onChange={(e) => set('maritalStatus')(e.target.value)}
          >
            {MARITAL_OPTIONS.map((o) => (
              <option key={o || 'empty'} value={o}>
                {o || 'בחר'}
              </option>
            ))}
          </select>
        </Field>
        <Field>
          <FieldLabel>קופת חולים</FieldLabel>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={member.healthFund}
            onChange={(e) => set('healthFund')(e.target.value)}
          >
            {HEALTH_FUNDS.map((o) => (
              <option key={o || 'empty'} value={o}>
                {o || 'בחר'}
              </option>
            ))}
          </select>
        </Field>
        <Field>
          <FieldLabel>ביטוח משלים</FieldLabel>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={member.supplementalInsurance}
            onChange={(e) => set('supplementalInsurance')(e.target.value)}
          >
            {SUPPLEMENTAL_OPTIONS.map((o) => (
              <option key={o || 'empty'} value={o}>
                {o || 'בחר'}
              </option>
            ))}
          </select>
        </Field>
        {includeContact ? (
          <>
            <Field>
              <FieldLabel>טלפון</FieldLabel>
              <Input value={member.phone} onChange={(e) => set('phone')(e.target.value)} placeholder="0501234567" dir="ltr" />
            </Field>
            <Field>
              <FieldLabel>אימייל</FieldLabel>
              <Input type="email" value={member.email} onChange={(e) => set('email')(e.target.value)} dir="ltr" />
            </Field>
            <Field className="sm:col-span-2">
              <FieldLabel>כתובת</FieldLabel>
              <Input value={member.address} onChange={(e) => set('address')(e.target.value)} placeholder="עיר, רחוב, מספר בית" />
            </Field>
          </>
        ) : null}
      </div>
    </div>
  );
}

export default function BeneficiaryForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const query = useMemo(() => new URLSearchParams(location.search), [location.search]);

  const [transactionId, setTransactionId] = useState('');
  const [resolvingTx, setResolvingTx] = useState(true);
  const [txResolveError, setTxResolveError] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [agentName, setAgentName] = useState('');
  const [primaryMember, setPrimaryMember] = useState(emptyMember);
  const [additionalMembers, setAdditionalMembers] = useState([]);

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [alreadyHasBeneficiaries, setAlreadyHasBeneficiaries] = useState(false);

  /** מספר הזמנה מהמסד לפי LowProfileCode (אחרי תשלום) — ללא מילוי אוטומטי של פרטי מוטבים */
  useEffect(() => {
    let cancelled = false;
    const qTx = query.get('transactionId') || query.get('TransactionId') || query.get('tx') || '';
    if (qTx) {
      setTransactionId(String(qTx));
      setResolvingTx(false);
      return undefined;
    }

    const lp =
      query.get('LowProfileCode') || query.get('lowProfileCode') || query.get('lowprofilecode') || '';
    let code = lp;
    if (!code) {
      try {
        code = sessionStorage.getItem('opal_checkout_low_profile') || '';
      } catch {
        code = '';
      }
    }

    if (!code) {
      setResolvingTx(false);
      setTxResolveError('חסר מזהה עסקה. יש להגיע מדף התודה לאחר תשלום, או לפתוח את הקישור מהמייל.');
      return undefined;
    }

    (async () => {
      setResolvingTx(true);
      setTxResolveError('');
      for (let i = 0; i < 20 && !cancelled; i += 1) {
        try {
          const r = await fetch(
            `${API_BASE}/api/public/deal-lookup?lowProfileCode=${encodeURIComponent(code)}`
          ).then((x) => x.json());
          if (r.success && r.found && r.transactionId) {
            if (!cancelled) {
              setTransactionId(String(r.transactionId));
              setResolvingTx(false);
            }
            return;
          }
        } catch {
          /* retry */
        }
        await new Promise((r) => setTimeout(r, 1200));
      }
      if (!cancelled) {
        setResolvingTx(false);
        setTxResolveError(
          'מספר ההזמנה עדיין לא זמין במערכת. נסו לרענן עוד מעט, או פנו לשירות עם מספר העסקה.'
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [location.search, query]);

  /** הקשר עסקה (כולל prefill למבוטח הראשי מהתשלום; ניתן לעריכה) */
  useEffect(() => {
    if (!transactionId || resolvingTx) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(
          `${API_BASE}/api/public/deal-context?transactionId=${encodeURIComponent(transactionId)}`
        ).then((x) => x.json());
        if (!r.success || cancelled) return;
        if (r.organizationName) setOrganizationName(r.organizationName);
        if (r.agentName) setAgentName(r.agentName);
        if (r.hasBeneficiaries) {
          setAlreadyHasBeneficiaries(true);
          return;
        }
        setPrimaryMember((prev) => {
          const name = splitFullName(r.fullName);
          return {
            ...prev,
            firstName: prev.firstName || name.firstName || '',
            lastName: prev.lastName || name.lastName || '',
            phone: prev.phone || String(r.phone || '').trim(),
            email: prev.email || String(r.email || '').trim(),
          };
        });
        const n = Math.max(0, Math.min(5, Number(r.beneficiaryCount) || 0));
        setAdditionalMembers(Array.from({ length: n }, () => emptyMember()));
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [transactionId, resolvingTx]);

  const validateMemberRequired = useCallback((m) => {
    const e = {};
    if (!m.firstName?.trim()) e.firstName = 'שדה חובה';
    if (!m.lastName?.trim()) e.lastName = 'שדה חובה';
    if (!m.id?.trim()) e.id = 'שדה חובה';
    else if (!validateId(m.id)) e.id = 'חייב להכיל 9 ספרות';
    if (!m.dateOfBirth?.trim()) e.dateOfBirth = 'שדה חובה';
    return e;
  }, []);

  const isMemberProvided = useCallback((m) => {
    return !!(
      String(m.firstName || '').trim() ||
      String(m.lastName || '').trim() ||
      String(m.id || '').trim() ||
      String(m.dateOfBirth || '').trim()
    );
  }, []);

  const validate = useCallback(() => {
    const next = {};
    if (!String(transactionId || '').trim()) next.transactionId = 'ממתינים למספר הזמנה מהמערכת';
    const pmErr = validateMemberRequired(primaryMember);
    if (Object.keys(pmErr).length) next.primaryMember = pmErr;
    const additionalErrs = [];
    for (let i = 0; i < additionalMembers.length; i++) {
      const m = additionalMembers[i];
      if (!isMemberProvided(m)) {
        additionalErrs.push(null);
        continue;
      }
      const me = validateMemberRequired(m);
      additionalErrs.push(Object.keys(me).length ? me : null);
    }
    if (additionalErrs.some(Boolean)) next.additional = additionalErrs;
    setErrors(next);
    return Object.keys(next).length === 0;
  }, [transactionId, primaryMember, additionalMembers, validateMemberRequired, isMemberProvided]);

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      setSubmitError(null);
      setSubmitted(false);
      if (!validate()) return;
      const additionalMembersPayload = additionalMembers
        .map((m, index) => ({ relation: `additional_${index + 1}`, ...m }))
        .filter((m) => isMemberProvided(m));
      setIsSubmitting(true);
      try {
        const res = await fetch(`${API_BASE}/api/update-beneficiaries`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transactionId: String(transactionId || '').trim(),
            organizationName: String(organizationName || '').trim(),
            agentName: String(agentName || '').trim(),
            primaryMember,
            additionalMembers: additionalMembersPayload,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setSubmitError(data.error || 'שגיאה בחיבור לשרת');
          return;
        }
        setSubmitted(true);
        navigate('/beneficiary-success', { replace: true });
      } catch (err) {
        setSubmitError(err.message || 'שגיאת רשת');
      } finally {
        setIsSubmitting(false);
      }
    },
    [validate, isMemberProvided, additionalMembers, transactionId, organizationName, agentName, primaryMember, navigate]
  );

  return (
    <div dir="rtl" className="min-h-screen flex flex-col bg-muted/30">
      <header className="border-b bg-card">
        <div className="container max-w-3xl mx-auto px-4 py-4 flex justify-center items-center">
          <img src="/branding/opal-logo.jpeg" alt="אופאל" className="h-9 w-auto object-contain" />
        </div>
      </header>

      <main className="flex-1 container max-w-3xl mx-auto w-full px-4 py-8 md:py-10">
        <div className="mb-8 text-right space-y-2">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">עדכון פרטי מוטבים</h1>
          <p className="text-muted-foreground leading-relaxed">
            נא למלא את פרטי המבוטח הראשי והמוטבים הנוספים. שם מלא/טלפון/אימייל של המבוטח הראשי נטענים מההזמנה וניתנים לעריכה.
          </p>
        </div>

        {alreadyHasBeneficiaries ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-base font-medium">
                פרטי המוטבים עבור עסקה זו כבר מולאו במערכת. תודה!
              </p>
            </CardContent>
          </Card>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>פרטי עסקה</CardTitle>
              <CardDescription>מס׳ הזמנה נטען מהמערכת לאחר התשלום (מסד הנתונים)</CardDescription>
            </CardHeader>
            <CardContent>
              {resolvingTx ? (
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Spinner />
                  <span>טוען מספר הזמנה מהמערכת…</span>
                </div>
              ) : txResolveError && !transactionId ? (
                <p className="text-destructive text-sm">{txResolveError}</p>
              ) : (
                <Field>
                  <FieldLabel>מס׳ הזמנה</FieldLabel>
                  <Input dir="ltr" className="font-mono bg-muted" value={transactionId} readOnly />
                </Field>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>מבוטח ראשי</CardTitle>
              <CardDescription>פרטי קשר וכתובת במידת הצורך</CardDescription>
            </CardHeader>
            <CardContent>
              <MemberFields
                title="פרטי מבוטח ראשי"
                member={primaryMember}
                onChange={setPrimaryMember}
                includeContact
                errors={errors.primaryMember || {}}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>מוטבים נוספים</CardTitle>
              <CardDescription>שורות לפי מספר המוטבים שנרכשו בעסקה — יש למלא רק אם רלוונטי</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {additionalMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground">לא נרשמו מוטבים נוספים בעסקה זו.</p>
              ) : (
                additionalMembers.map((m, index) => (
                  <MemberFields
                    key={index}
                    title={`מוטב ${index + 1}`}
                    member={m}
                    onChange={(nextMember) =>
                      setAdditionalMembers((prev) => {
                        const copy = [...prev];
                        copy[index] = nextMember;
                        return copy;
                      })
                    }
                    errors={(errors.additional && errors.additional[index]) || {}}
                  />
                ))
              )}
            </CardContent>
          </Card>

          <div className="flex flex-col items-stretch gap-3 pt-2">
            {submitError ? <p className="text-destructive text-sm">{submitError}</p> : null}
            <Button type="submit" size="lg" disabled={isSubmitting || resolvingTx || !transactionId} className="w-full sm:w-auto">
              {isSubmitting && <Spinner className="me-2" />}
              שמירה
            </Button>
          </div>
        </form>
        )}
      </main>
    </div>
  );
}
