import React, { useState, useCallback } from 'react';
import Header from './components/Header';
import PackageSelection, { PLANS } from './components/PackageSelection';
import BeneficiaryFields from './components/BeneficiaryFields';

const API_BASE = 'http://localhost:3001';
const PENDING_KEY = 'opal_pending_data';

function savePending(partial) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
  } catch {
    return;
  }
  try {
    const raw = window.localStorage.getItem(PENDING_KEY);
    const current = raw ? JSON.parse(raw) : {};
    const next = { ...current, ...partial };
    window.localStorage.setItem(PENDING_KEY, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
}

const initialBeneficiary = () => ({
  firstName: '',
  lastName: '',
  id: '',
  dateOfBirth: '',
})

const initialState = {
  selectedPlanId: '',
  fullName: '',
  id: '',
  phone: '',
  email: '',
  agentName: '',
  organizationName: '',
  beneficiaryCount: 0,
  beneficiaries: [],
}

function validateId(value) {
  const digits = value.replace(/\D/g, '')
  return digits.length === 9
}

function validatePhone(value) {
  const digits = value.replace(/\D/g, '')
  return digits.length >= 9 && digits.length <= 11
}

function buildSheetRows(formState) {
  const plan = PLANS.find((p) => p.id === formState.selectedPlanId)
  const sku = plan?.sku ?? ''
  const payerRow = {
    status: 1,
    fullName: formState.fullName,
    id: formState.id,
    phone: formState.phone,
    email: formState.email,
    agentName: formState.agentName,
    organizationName: formState.organizationName,
    planSku: sku,
    planId: formState.selectedPlanId,
  }
  const beneficiaryRows = (formState.beneficiaries || []).map((b) => ({
    status: 0,
    firstName: b.firstName,
    lastName: b.lastName,
    id: b.id,
    dateOfBirth: b.dateOfBirth,
    planSku: sku,
    planId: formState.selectedPlanId,
  }))
  return { payer: payerRow, beneficiaries: beneficiaryRows, rows: [payerRow, ...beneficiaryRows] }
}

const initialContact = { name: '', email: '', phone: '', message: '' };
const initialOrganization = { organizationName: '', contactName: '', phone: '', email: '', notes: '' };

export default function App() {
  const [formState, setFormState] = useState(initialState);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [contact, setContact] = useState(initialContact);
  const [organization, setOrganization] = useState(initialOrganization);
  const [contactSent, setContactSent] = useState(false);
  const [organizationSent, setOrganizationSent] = useState(false);
  const [contactSending, setContactSending] = useState(false);
  const [organizationSending, setOrganizationSending] = useState(false);
  const [contactError, setContactError] = useState(null);
  const [organizationError, setOrganizationError] = useState(null);

  const update = useCallback((key, value) => {
    setFormState((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
    setSubmitError(null)
    if (key === 'organizationName') {
      savePending({ organization: value })
    } else if (key === 'agentName') {
      savePending({ agent: value })
    } else if (key === 'fullName') {
      savePending({ payerName: value })
    } else if (key === 'id') {
      savePending({ payerId: value })
    } else if (key === 'email') {
      savePending({ payerEmail: value })
    } else if (key === 'phone') {
      savePending({ payerPhone: value })
    }
  }, [])

  const updateBeneficiary = useCallback((index, field, value) => {
    setFormState((prev) => {
      const next = [...(prev.beneficiaries || [])]
      while (next.length <= index) next.push(initialBeneficiary())
      next[index] = { ...next[index], [field]: value }
      const updated = { ...prev, beneficiaries: next }
      try {
        const safe = next.map((b) => ({
          firstName: b.firstName ?? '',
          lastName: b.lastName ?? '',
          id: b.id ?? '',
          dateOfBirth: b.dateOfBirth ?? '',
        }))
        savePending({
          beneficiaries: safe,
          firstBeneficiary: safe[0] || null,
        })
      } catch {
        // ignore storage errors
      }
      return updated
    })
    setErrors((prev) => {
      const key = `beneficiary_${index}_${field}`
      const next = { ...prev }
      delete next[key]
      return next
    })
  }, [])

  const setBeneficiaryCount = useCallback((count) => {
    const n = Math.max(0, Math.min(5, Number(count) || 0))
    savePending({ beneficiaryCount: n })
    setFormState((prev) => {
      let beneficiaries = prev.beneficiaries || []
      if (beneficiaries.length > n) beneficiaries = beneficiaries.slice(0, n)
      while (beneficiaries.length < n) beneficiaries.push(initialBeneficiary())
      return { ...prev, beneficiaryCount: n, beneficiaries }
    })
  }, [])

  const validate = useCallback(() => {
    const e = {}
    if (!formState.selectedPlanId) e.selectedPlanId = 'נא לבחור חבילה'
    if (!formState.fullName?.trim()) e.fullName = 'שם מלא שדה חובה'
    if (!formState.id?.trim()) e.id = 'תעודת זהות שדה חובה'
    else if (!validateId(formState.id)) e.id = 'תעודת זהות חייבת להכיל 9 ספרות'
    if (!formState.phone?.trim()) e.phone = 'טלפון שדה חובה'
    else if (!validatePhone(formState.phone)) e.phone = 'הזן מספר טלפון תקין (9–11 ספרות)'
    if (!formState.email?.trim()) e.email = 'אימייל שדה חובה'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formState.email)) e.email = 'הזן כתובת אימייל תקינה'
    if (!formState.agentName?.trim()) e.agentName = 'שם הסוכן שדה חובה'
    if (!formState.organizationName?.trim()) e.organizationName = 'שם הארגון שדה חובה'
    const count = formState.beneficiaryCount || 0
    const beneficiaries = formState.beneficiaries || []
    for (let i = 0; i < count; i++) {
      const b = beneficiaries[i] || {}
      if (!b.firstName?.trim()) e[`beneficiary_${i}_firstName`] = 'שדה חובה'
      if (!b.lastName?.trim()) e[`beneficiary_${i}_lastName`] = 'שדה חובה'
      if (!b.id?.trim()) e[`beneficiary_${i}_id`] = 'שדה חובה'
      else if (!validateId(b.id)) e[`beneficiary_${i}_id`] = 'חייב להכיל 9 ספרות'
      if (!b.dateOfBirth?.trim()) e[`beneficiary_${i}_dateOfBirth`] = 'שדה חובה'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }, [formState])

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault()
      if (!validate()) return

      setIsSubmitting(true)
      setSubmitError(null)

      try {
        const res = await fetch(`${API_BASE}/api/create-checkout-session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ formState }),
        })
        const data = await res.json().catch(() => ({}))

        if (!res.ok) {
          setSubmitError(data.error || 'שגיאה בחיבור לשרת')
          return
        }
        if (data.url) {
          window.location.href = data.url
          return
        }
        setSubmitError('לא התקבל קישור לתשלום')
      } catch (err) {
        setSubmitError(err.message || 'שגיאת רשת')
      } finally {
        setIsSubmitting(false)
      }
    },
    [formState, validate]
  )

  return (
    <div dir="rtl" className="min-h-screen flex flex-col bg-slate-50">
      <Header />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 sm:py-10 text-right">
        <h1 className="text-2xl sm:text-3xl font-bold text-medical-blue-dark mb-2">
          אופל - שירות רפואי
        </h1>
        <p className="text-medical-grey-dark mb-8">
          הירשם לחבילה והוסף מוטבים להלן.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6 text-right">
          <PackageSelection
            selectedPlanId={formState.selectedPlanId}
            onSelect={(id) => update('selectedPlanId', id)}
          />
          {errors.selectedPlanId && (
            <p className="text-red-600 text-sm -mt-4">{errors.selectedPlanId}</p>
          )}

          <section className="mb-8">
            <h2 className="text-lg font-semibold text-medical-blue-dark mb-4">פרטיך</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm text-medical-grey-dark mb-1 text-right">שם מלא *</label>
                <input
                  type="text"
                  value={formState.fullName}
                  onChange={(e) => update('fullName', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-medical-blue focus:border-medical-blue text-right"
                  placeholder="שם מלא"
                />
                {errors.fullName && <p className="text-red-600 text-sm mt-1 text-right">{errors.fullName}</p>}
              </div>
              <div>
                <label className="block text-sm text-medical-grey-dark mb-1 text-right">תעודת זהות *</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={9}
                  value={formState.id}
                  onChange={(e) => update('id', e.target.value.replace(/\D/g, '').slice(0, 9))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-medical-blue focus:border-medical-blue text-right"
                  placeholder="9 ספרות"
                />
                {errors.id && <p className="text-red-600 text-sm mt-1 text-right">{errors.id}</p>}
              </div>
              <div>
                <label className="block text-sm text-medical-grey-dark mb-1 text-right">טלפון *</label>
                <input
                  type="tel"
                  value={formState.phone}
                  onChange={(e) => update('phone', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-medical-blue focus:border-medical-blue text-right"
                  placeholder="לדוגמה 0501234567"
                />
                {errors.phone && <p className="text-red-600 text-sm mt-1 text-right">{errors.phone}</p>}
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm text-medical-grey-dark mb-1 text-right">אימייל *</label>
                <input
                  type="email"
                  value={formState.email}
                  onChange={(e) => update('email', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-medical-blue focus:border-medical-blue text-right"
                  placeholder="דוגמה@example.com"
                />
                {errors.email && <p className="text-red-600 text-sm mt-1 text-right">{errors.email}</p>}
              </div>
              <div>
                <label className="block text-sm text-medical-grey-dark mb-1 text-right">שם הסוכן *</label>
                <input
                  type="text"
                  value={formState.agentName}
                  onChange={(e) => update('agentName', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-medical-blue focus:border-medical-blue text-right"
                  placeholder="שם הסוכן"
                />
                {errors.agentName && <p className="text-red-600 text-sm mt-1 text-right">{errors.agentName}</p>}
              </div>
              <div>
                <label className="block text-sm text-medical-grey-dark mb-1 text-right">שם הארגון *</label>
                <input
                  type="text"
                  value={formState.organizationName}
                  onChange={(e) => update('organizationName', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-medical-blue focus:border-medical-blue text-right"
                  placeholder="שם הארגון"
                />
                {errors.organizationName && (
                  <p className="text-red-600 text-sm mt-1 text-right">{errors.organizationName}</p>
                )}
              </div>
            </div>
          </section>

          <section className="mb-8 text-right">
            <label className="block text-sm font-medium text-medical-grey-dark mb-2">כמה מוטבים נוספים?</label>
            <select
              value={formState.beneficiaryCount}
              onChange={(e) => setBeneficiaryCount(e.target.value)}
              className="w-full sm:w-48 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-medical-blue focus:border-medical-blue bg-white text-right"
            >
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </section>

          <BeneficiaryFields
            count={formState.beneficiaryCount}
            beneficiaries={formState.beneficiaries}
            onChange={updateBeneficiary}
            errors={errors}
          />

          <div className="pt-4 text-right">
            {submitError && (
              <p className="text-red-600 text-sm mb-2">{submitError}</p>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto min-w-[200px] px-6 py-3 bg-medical-blue hover:bg-medical-blue-dark disabled:bg-medical-grey-light text-white font-semibold rounded-lg shadow-md transition-colors disabled:opacity-70"
            >
              {isSubmitting ? (
                <span className="inline-flex items-center gap-2">
                  <svg
                    className="animate-spin h-5 w-5"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  טוען…
                </span>
              ) : (
                'המשך לתשלום'
              )}
            </button>
          </div>
        </form>

        {/* Contact Us – צרו קשר */}
        <section className="mt-16 pt-10 border-t border-slate-200">
          <h2 className="text-xl font-bold text-medical-teal-dark mb-4">צרו קשר</h2>
          <p className="text-medical-grey-dark text-sm mb-4">מלאו את הפרטים ונחזור אליכם בהקדם.</p>
          {contactSent ? (
            <p className="text-medical-teal-dark font-medium py-2">נשלח בהצלחה. תודה.</p>
          ) : (
            <form
              className="space-y-4 max-w-xl"
              onSubmit={async (e) => {
                e.preventDefault();
                setContactSending(true);
                setContactError(null);
                try {
                  const res = await fetch(`${API_BASE}/api/contact`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(contact),
                  });
                  const data = await res.json().catch(() => ({}));
                  if (res.ok && data.success) {
                    setContactSent(true);
                    setContact(initialContact);
                  } else {
                    setContactError(data.error || 'שגיאה בשליחה');
                  }
                } catch (err) {
                  setContactError(err.message || 'שגיאת רשת');
                } finally {
                  setContactSending(false);
                }
              }}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-medical-grey-dark mb-1 text-right">שם</label>
                  <input
                    type="text"
                    value={contact.name}
                    onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-medical-teal focus:border-medical-teal text-right"
                    placeholder="שם מלא"
                  />
                </div>
                <div>
                  <label className="block text-sm text-medical-grey-dark mb-1 text-right">אימייל</label>
                  <input
                    type="email"
                    value={contact.email}
                    onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-medical-teal focus:border-medical-teal text-right"
                    placeholder="דוא&quot;ל"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-medical-grey-dark mb-1 text-right">טלפון</label>
                <input
                  type="tel"
                  value={contact.phone}
                  onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-medical-teal focus:border-medical-teal text-right"
                  placeholder="טלפון"
                />
              </div>
              <div>
                <label className="block text-sm text-medical-grey-dark mb-1 text-right">הודעה</label>
                <textarea
                  value={contact.message}
                  onChange={(e) => setContact((c) => ({ ...c, message: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-medical-teal focus:border-medical-teal text-right"
                  placeholder="הודעה"
                />
              </div>
              {contactError && <p className="text-red-600 text-sm text-right">{contactError}</p>}
              <button
                type="submit"
                disabled={contactSending}
                className="px-5 py-2.5 bg-medical-teal hover:bg-medical-teal-dark text-white font-medium rounded-lg disabled:opacity-70"
              >
                {contactSending ? 'שולח…' : 'שליחה'}
              </button>
            </form>
          )}
        </section>

        {/* Organization – רשום ארגון */}
        <section className="mt-12 pt-10 border-t border-slate-200">
          <h2 className="text-xl font-bold text-medical-teal-dark mb-4">רשום ארגון</h2>
          <p className="text-medical-grey-dark text-sm mb-4">הרשמת ארגון לשירות. נציג יצור איתכם קשר.</p>
          {organizationSent ? (
            <p className="text-medical-teal-dark font-medium py-2">נשלח בהצלחה. תודה.</p>
          ) : (
            <form
              className="space-y-4 max-w-xl"
              onSubmit={async (e) => {
                e.preventDefault();
                setOrganizationSending(true);
                setOrganizationError(null);
                try {
                  const res = await fetch(`${API_BASE}/api/organization`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(organization),
                  });
                  const data = await res.json().catch(() => ({}));
                  if (res.ok && data.success) {
                    setOrganizationSent(true);
                    setOrganization(initialOrganization);
                  } else {
                    setOrganizationError(data.error || 'שגיאה בשליחה');
                  }
                } catch (err) {
                  setOrganizationError(err.message || 'שגיאת רשת');
                } finally {
                  setOrganizationSending(false);
                }
              }}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-medical-grey-dark mb-1 text-right">שם הארגון</label>
                  <input
                    type="text"
                    value={organization.organizationName}
                    onChange={(e) => setOrganization((o) => ({ ...o, organizationName: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-medical-teal focus:border-medical-teal text-right"
                    placeholder="שם הארגון"
                  />
                </div>
                <div>
                  <label className="block text-sm text-medical-grey-dark mb-1 text-right">שם איש קשר</label>
                  <input
                    type="text"
                    value={organization.contactName}
                    onChange={(e) => setOrganization((o) => ({ ...o, contactName: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-medical-teal focus:border-medical-teal text-right"
                    placeholder="איש קשר"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-medical-grey-dark mb-1 text-right">טלפון</label>
                  <input
                    type="tel"
                    value={organization.phone}
                    onChange={(e) => setOrganization((o) => ({ ...o, phone: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-medical-teal focus:border-medical-teal text-right"
                    placeholder="טלפון"
                  />
                </div>
                <div>
                  <label className="block text-sm text-medical-grey-dark mb-1 text-right">אימייל</label>
                  <input
                    type="email"
                    value={organization.email}
                    onChange={(e) => setOrganization((o) => ({ ...o, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-medical-teal focus:border-medical-teal text-right"
                    placeholder="דוא&quot;ל"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-medical-grey-dark mb-1 text-right">הערות</label>
                <textarea
                  value={organization.notes}
                  onChange={(e) => setOrganization((o) => ({ ...o, notes: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-medical-teal focus:border-medical-teal text-right"
                  placeholder="הערות"
                />
              </div>
              {organizationError && <p className="text-red-600 text-sm text-right">{organizationError}</p>}
              <button
                type="submit"
                disabled={organizationSending}
                className="px-5 py-2.5 bg-medical-teal hover:bg-medical-teal-dark text-white font-medium rounded-lg disabled:opacity-70"
              >
                {organizationSending ? 'שולח…' : 'שליחה'}
              </button>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}
