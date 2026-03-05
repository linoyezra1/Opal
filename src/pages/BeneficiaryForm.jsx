import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

const API_BASE = 'http://localhost:3001';
const PENDING_KEY = 'opal_pending_data';

function splitFullName(fullName) {
  const t = String(fullName || '').trim();
  if (!t) return { firstName: '', lastName: '' };
  const idx = t.indexOf(' ');
  if (idx === -1) return { firstName: t, lastName: '' };
  return { firstName: t.slice(0, idx), lastName: t.slice(idx + 1).trim() };
}

function validateId(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length === 9;
}

const MARITAL_OPTIONS = ['', 'רווק/ה', 'נשוי/אה', 'גרוש/ה', 'אלמן/ה', 'ידוע/ה בציבור'];
const HEALTH_FUNDS = ['', 'כללית', 'מכבי', 'מאוחדת', 'לאומית'];
const SUPPLEMENTAL_OPTIONS = ['', 'אין', 'כסף', 'זהב', 'פלטינום', 'אחר'];

function SectionCard({ title, subtitle, children }) {
  return (
    <section className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-sm space-y-4">
      <div className="text-right">
        <h2 className="text-lg font-semibold text-medical-blue-dark">{title}</h2>
        {subtitle ? <p className="text-sm text-medical-grey-dark mt-1 leading-relaxed">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

function TextField({
  label,
  required,
  value,
  onChange,
  placeholder,
  type = 'text',
  inputMode,
  maxLength,
  error,
  autoFilled = false,
  readOnly = false,
}) {
  return (
    <div className="text-right">
      <label className="block text-sm text-medical-grey-dark mb-1 text-right">
        {label} {required ? <span className="text-red-600">*</span> : null}
      </label>
      <input
        type={type}
        value={value}
        inputMode={inputMode}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readOnly}
        className={`w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-medical-blue focus:border-medical-blue text-right ${
          autoFilled ? 'bg-slate-50' : 'bg-white'
        }`}
        placeholder={placeholder}
      />
      {error ? <p className="text-red-600 text-sm mt-1 text-right">{error}</p> : null}
      {autoFilled && !error ? (
        <p className="text-xs text-slate-500 mt-1 text-right">שדה שנשמר מהטופס הקודם (ניתן לעריכה)</p>
      ) : null}
    </div>
  );
}

function SelectField({ label, required, value, onChange, options, error }) {
  return (
    <div className="text-right">
      <label className="block text-sm text-medical-grey-dark mb-1 text-right">
        {label} {required ? <span className="text-red-600">*</span> : null}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-medical-blue focus:border-medical-blue bg-white text-right"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o || 'בחר'}
          </option>
        ))}
      </select>
      {error ? <p className="text-red-600 text-sm mt-1 text-right">{error}</p> : null}
    </div>
  );
}

function MemberFields({ title, member, onChange, errors = {}, includeContact = false }) {
  const set = (k) => (v) => onChange({ ...member, [k]: v });

  return (
    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-medical-blue-dark">{title}</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <TextField
          label="שם פרטי"
          required
          value={member.firstName}
          onChange={set('firstName')}
          placeholder="שם פרטי"
          error={errors.firstName}
        />
        <TextField
          label="שם משפחה"
          required
          value={member.lastName}
          onChange={set('lastName')}
          placeholder="שם משפחה"
          error={errors.lastName}
        />
        <TextField
          label="תעודת זהות"
          required
          value={member.id}
          onChange={(v) => set('id')(String(v).replace(/\D/g, '').slice(0, 9))}
          placeholder="9 ספרות"
          inputMode="numeric"
          maxLength={9}
          error={errors.id}
        />
        <TextField
          label="תאריך לידה"
          required
          value={member.dateOfBirth}
          onChange={set('dateOfBirth')}
          type="date"
          error={errors.dateOfBirth}
        />
        <SelectField
          label="מצב משפחתי"
          required={false}
          value={member.maritalStatus}
          onChange={set('maritalStatus')}
          options={MARITAL_OPTIONS}
          error={errors.maritalStatus}
        />
        <SelectField
          label="קופת חולים"
          required={false}
          value={member.healthFund}
          onChange={set('healthFund')}
          options={HEALTH_FUNDS}
          error={errors.healthFund}
        />
        <SelectField
          label="ביטוח משלים"
          required={false}
          value={member.supplementalInsurance}
          onChange={set('supplementalInsurance')}
          options={SUPPLEMENTAL_OPTIONS}
          error={errors.supplementalInsurance}
        />
        {includeContact ? (
          <>
            <TextField
              label="טלפון"
              required={false}
              value={member.phone}
              onChange={set('phone')}
              placeholder="0501234567"
              error={errors.phone}
            />
            <TextField
              label="אימייל"
              required={false}
              value={member.email}
              onChange={set('email')}
              placeholder="example@email.com"
              type="email"
              error={errors.email}
            />
            <div className="sm:col-span-2">
              <TextField
                label="כתובת"
                required={false}
                value={member.address}
                onChange={set('address')}
                placeholder="עיר, רחוב, מספר בית"
                error={errors.address}
              />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

const emptyMember = () => ({
  firstName: '',
  lastName: '',
  id: '',
  dateOfBirth: '',
  maritalStatus: '',
  healthFund: '',
  supplementalInsurance: '',
  phone: '',
  email: '',
  address: '',
});

export default function BeneficiaryForm({ showBackLink = true }) {
  const location = useLocation();
  const query = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const txFromQuery =
    query.get('transactionId') || query.get('TransactionId') || query.get('tx') || query.get('transaction') || '';

  const [transactionId, setTransactionId] = useState(String(txFromQuery || ''));
  const [organizationName, setOrganizationName] = useState('');
  const [organizationAutoFilled, setOrganizationAutoFilled] = useState(false);
  const [agentName, setAgentName] = useState('');
  const [agentAutoFilled, setAgentAutoFilled] = useState(false);
  const [primaryMember, setPrimaryMember] = useState(emptyMember());
  const [additionalMembers, setAdditionalMembers] = useState([]);

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
    } catch {
      return;
    }
    let data;
    try {
      const raw = window.localStorage.getItem(PENDING_KEY);
      if (!raw) return;
      data = JSON.parse(raw);
    } catch {
      return;
    }

    const org = data.organization || data.organizationName;
    const agent = data.agent || data.agentName;
    if (org) {
      setOrganizationName((prev) => prev || org);
      setOrganizationAutoFilled(true);
    }
    if (agent) {
      setAgentName((prev) => prev || agent);
      setAgentAutoFilled(true);
    }

    if (data.payerName || data.payerId || data.payerEmail || data.payerPhone) {
      const { firstName, lastName } = data.payerName ? splitFullName(data.payerName) : { firstName: '', lastName: '' };
      setPrimaryMember((prev) => ({
        ...prev,
        firstName: prev.firstName || firstName,
        lastName: prev.lastName || lastName,
        id: prev.id || (data.payerId || ''),
        email: prev.email || (data.payerEmail || ''),
        phone: prev.phone || (data.payerPhone || ''),
      }));
    }

    const count = Number(data.beneficiaryCount);
    if (!Number.isNaN(count) && count > 0) {
      const n = Math.max(0, Math.min(5, count));
      const savedBeneficiaries = Array.isArray(data.beneficiaries) ? data.beneficiaries : null;
      setAdditionalMembers((prev) => {
        let next = [...prev];
        if (next.length > n) next = next.slice(0, n);
        while (next.length < n) next.push(emptyMember());
        if (savedBeneficiaries) {
          const len = Math.min(n, savedBeneficiaries.length);
          for (let i = 0; i < len; i++) {
            const sb = savedBeneficiaries[i] || {};
            next[i] = {
              ...next[i],
              firstName: next[i].firstName || sb.firstName || '',
              lastName: next[i].lastName || sb.lastName || '',
              id: next[i].id || sb.id || '',
              dateOfBirth: next[i].dateOfBirth || sb.dateOfBirth || '',
            };
          }
        } else if (data.firstBeneficiary && typeof data.firstBeneficiary === 'object' && n > 0) {
          const fb = data.firstBeneficiary;
          next[0] = {
            ...next[0],
            firstName: next[0].firstName || fb.firstName || '',
            lastName: next[0].lastName || fb.lastName || '',
            id: next[0].id || fb.id || '',
            dateOfBirth: next[0].dateOfBirth || fb.dateOfBirth || '',
          };
        }
        return next;
      });
    }
  }, []);

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

    if (!String(transactionId || '').trim()) next.transactionId = 'שדה חובה';
    if (!String(organizationName || '').trim()) next.organizationName = 'שדה חובה';
    if (!String(agentName || '').trim()) next.agentName = 'שדה חובה';

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
  }, [
    transactionId,
    organizationName,
    agentName,
    primaryMember,
    additionalMembers,
    validateMemberRequired,
    isMemberProvided,
  ]);

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
      } catch (err) {
        setSubmitError(err.message || 'שגיאת רשת');
      } finally {
        setIsSubmitting(false);
      }
    },
    [validate, isMemberProvided, additionalMembers, transactionId, organizationName, agentName, primaryMember]
  );

  const headerRight = (
    <div className="h-8 w-32 bg-medical-teal/10 rounded flex items-center justify-center text-medical-teal-dark font-bold text-sm">
      לוגו אופל
    </div>
  );

  return (
    <div dir="rtl" className="min-h-screen flex flex-col bg-slate-50 font-sans">
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-4 flex justify-between items-center">
          {showBackLink ? (
            <Link to="/" className="text-medical-blue hover:underline text-sm">
              ← חזרה לדף הבית
            </Link>
          ) : (
            <div />
          )}
          {headerRight}
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8 sm:py-10 text-right">
        <h1 className="text-2xl sm:text-3xl font-bold text-medical-blue-dark mb-2">עדכון פרטי מוטבים</h1>
        <p className="text-medical-grey-dark mb-8 leading-relaxed">
          נא למלא פרטי ארגון, סוכן, מבוטח ראשי ומוטבים נוספים (בן/בת זוג ועד 3 ילדים).
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <SectionCard
            title="פרטי עסקה"
            subtitle="מס׳ הזמנה (אוטומטי) כפי שנקלט במערכת – לא ניתן לעריכה."
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <TextField
                label="מס׳ הזמנה (אוטומטי)"
                required
                value={transactionId}
                onChange={setTransactionId}
                placeholder="לדוגמה 123456"
                error={errors.transactionId}
                readOnly
              />
            </div>
          </SectionCard>

          <SectionCard title="פרטי ארגון וסוכן">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <TextField
                label="ארגון"
                required
                value={organizationName}
                onChange={setOrganizationName}
                placeholder="שם הארגון"
                error={errors.organizationName}
                autoFilled={organizationAutoFilled}
              />
              <TextField
                label="סוכן"
                required
                value={agentName}
                onChange={setAgentName}
                placeholder="שם הסוכן"
                error={errors.agentName}
                autoFilled={agentAutoFilled}
              />
            </div>
          </SectionCard>

          <SectionCard
            title="מבוטח ראשי"
            subtitle="שורה עם סטטוס 1 תכיל גם פרטי קשר וכתובת (ככל שנדרש)."
          >
            <MemberFields
              title="פרטי מבוטח ראשי"
              member={primaryMember}
              onChange={setPrimaryMember}
              includeContact
              errors={errors.primaryMember || {}}
            />
          </SectionCard>

          <SectionCard
            title="מוטבים נוספים"
            subtitle="מספר השורות מותאם למספר המוטבים שנבחר בטופס ההרשמה. ניתן להשאיר ריק אם אין מוטבים נוספים."
          >
            <div className="space-y-4">
              {additionalMembers.length === 0 ? (
                <p className="text-sm text-medical-grey-dark">
                  לא נבחרו מוטבים נוספים בשלב ההרשמה. אם תרצה להוסיף כעת, אנא פנה לסוכן.
                </p>
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
            </div>
          </SectionCard>

          <div className="pt-2 text-right">
            {submitError ? <p className="text-red-600 text-sm mb-2">{submitError}</p> : null}
            {submitted ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-3">
                <p className="text-emerald-800 font-medium">נשמר בהצלחה.</p>
              </div>
            ) : null}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto min-w-[220px] px-6 py-3 bg-medical-blue hover:bg-medical-blue-dark disabled:bg-medical-grey-light text-white font-semibold rounded-lg shadow-md transition-colors disabled:opacity-70"
            >
              {isSubmitting ? 'שולח…' : 'שמירה'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
