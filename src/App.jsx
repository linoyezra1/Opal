import React, { useMemo, useState, useCallback } from 'react';
import BeneficiaryFields from './components/BeneficiaryFields';

const API_BASE = window.location.origin;
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

const LANDING_PLANS = [
  { optionId: 'opt-family', mappedPlanId: 'plan-a', label: 'מנוי חבילה למשפחה זוג + עד 3 ילדים מחיר רגיל 128 ₪', charge: 68 },
  { optionId: 'opt-adult', mappedPlanId: 'plan-b', label: 'מנוי למבוגר מחיר רגיל 49 ₪', charge: 29 },
  { optionId: 'opt-spouse', mappedPlanId: 'plan-fg', label: 'תוספת בן / בת זוג מחיר רגיל 35 ₪', charge: 22 },
  { optionId: 'opt-child-alone', mappedPlanId: 'plan-fg', label: 'מנוי לילד ללא תלות במבוגר 35 ₪', charge: 27 },
  { optionId: 'opt-child-add', mappedPlanId: 'plan-fg', label: 'מנוי תוספת ילד כתוספת למבוגר מחיר רגיל 14 ₪', charge: 10 },
  { optionId: 'opt-65-single', mappedPlanId: 'plan-fg', label: 'מנוי יחיד מעל גיל 65+ מחיר 58 ₪', charge: 35 },
  { optionId: 'opt-65-couple', mappedPlanId: 'plan-fg', label: 'מנוי לזוג מבוגרים מעל גיל 65 מחיר 79 ₪', charge: 45 },
];

const initialBeneficiary = () => ({
  firstName: '',
  lastName: '',
  id: '',
  dateOfBirth: '',
});

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
};

function validateId(value) {
  const digits = value.replace(/\D/g, '');
  return digits.length === 9;
}

function validatePhone(value) {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 9 && digits.length <= 11;
}

export default function App() {
  const [formState, setFormState] = useState(initialState);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [selectedLandingPlanOption, setSelectedLandingPlanOption] = useState('');

  const selectedLandingPlan = useMemo(
    () => LANDING_PLANS.find((p) => p.optionId === selectedLandingPlanOption) || null,
    [selectedLandingPlanOption]
  );

  const update = useCallback((key, value) => {
    setFormState((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
    setSubmitError(null);
    if (key === 'organizationName') {
      savePending({ organization: value });
    } else if (key === 'agentName') {
      savePending({ agent: value });
    } else if (key === 'fullName') {
      savePending({ payerName: value });
    } else if (key === 'id') {
      savePending({ payerId: value });
    } else if (key === 'email') {
      savePending({ payerEmail: value });
    } else if (key === 'phone') {
      savePending({ payerPhone: value });
    }
  }, []);

  const updateBeneficiary = useCallback((index, field, value) => {
    setFormState((prev) => {
      const next = [...(prev.beneficiaries || [])];
      while (next.length <= index) next.push(initialBeneficiary());
      next[index] = { ...next[index], [field]: value };
      const updated = { ...prev, beneficiaries: next };
      try {
        const safe = next.map((b) => ({
          firstName: b.firstName ?? '',
          lastName: b.lastName ?? '',
          id: b.id ?? '',
          dateOfBirth: b.dateOfBirth ?? '',
        }));
        savePending({ beneficiaries: safe, firstBeneficiary: safe[0] || null });
      } catch {
        // ignore storage errors
      }
      return updated;
    });
    setErrors((prev) => {
      const key = `beneficiary_${index}_${field}`;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const setBeneficiaryCount = useCallback((count) => {
    const n = Math.max(0, Math.min(5, Number(count) || 0));
    savePending({ beneficiaryCount: n });
    setFormState((prev) => {
      let beneficiaries = prev.beneficiaries || [];
      if (beneficiaries.length > n) beneficiaries = beneficiaries.slice(0, n);
      while (beneficiaries.length < n) beneficiaries.push(initialBeneficiary());
      return { ...prev, beneficiaryCount: n, beneficiaries };
    });
  }, []);

  const validate = useCallback(() => {
    const e = {};
    if (!formState.selectedPlanId) e.selectedPlanId = 'נא לבחור חבילה';
    if (!acceptedTerms) e.acceptedTerms = 'יש לאשר את תנאי כתב השירות';
    if (!formState.fullName?.trim()) e.fullName = 'שם מלא שדה חובה';
    if (!formState.id?.trim()) e.id = 'תעודת זהות שדה חובה';
    else if (!validateId(formState.id)) e.id = 'תעודת זהות חייבת להכיל 9 ספרות';
    if (!formState.phone?.trim()) e.phone = 'טלפון שדה חובה';
    else if (!validatePhone(formState.phone)) e.phone = 'הזן מספר טלפון תקין (9–11 ספרות)';
    if (!formState.email?.trim()) e.email = 'אימייל שדה חובה';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formState.email)) e.email = 'הזן כתובת אימייל תקינה';
    if (!formState.agentName?.trim()) e.agentName = 'שם הסוכן שדה חובה';
    if (!formState.organizationName?.trim()) e.organizationName = 'שם הארגון שדה חובה';
    const count = formState.beneficiaryCount || 0;
    const beneficiaries = formState.beneficiaries || [];
    for (let i = 0; i < count; i++) {
      const b = beneficiaries[i] || {};
      if (!b.firstName?.trim()) e[`beneficiary_${i}_firstName`] = 'שדה חובה';
      if (!b.lastName?.trim()) e[`beneficiary_${i}_lastName`] = 'שדה חובה';
      if (!b.id?.trim()) e[`beneficiary_${i}_id`] = 'שדה חובה';
      else if (!validateId(b.id)) e[`beneficiary_${i}_id`] = 'חייב להכיל 9 ספרות';
      if (!b.dateOfBirth?.trim()) e[`beneficiary_${i}_dateOfBirth`] = 'שדה חובה';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }, [formState, acceptedTerms]);

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      if (!validate()) return;

      setIsSubmitting(true);
      setSubmitError(null);

      try {
        const res = await fetch(`${API_BASE}/api/create-checkout-session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ formState }),
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          setSubmitError(data.error || 'שגיאה בחיבור לשרת');
          return;
        }
        if (data.url) {
          window.location.href = data.url;
          return;
        }
        setSubmitError('לא התקבל קישור לתשלום');
      } catch (err) {
        setSubmitError(err.message || 'שגיאת רשת');
      } finally {
        setIsSubmitting(false);
      }
    },
    [formState, validate]
  );

  return (
    <div dir="rtl" className="min-h-screen bg-[#D9EAF3] text-right">
      <main className="max-w-5xl mx-auto px-4 py-6 sm:py-10 space-y-8">
        <header className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-medical-blue-dark">מנוי רופא פרטי עד הבית 24/7 בפחות משקל ליום</h1>
            <p className="text-medical-grey-dark mt-2">אופל - שירות רפואי</p>
          </div>
          <div className="h-20 w-40 rounded-xl bg-medical-blue/10 border border-medical-blue/20 flex items-center justify-center text-medical-blue-dark font-semibold">
            OPAL LOGO
          </div>
        </header>

        <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm leading-8 text-medical-grey-dark">
          <p className="mb-4">
            כשאתה צריך רופא, אתה צריך אותו עכשיו. במקום להמתין ימים ארוכים בתסכול, אצלנו תקבל ביטחון וטיפול מקצועי ומנוסה אצלך בבית עוד היום.. ללא עיכובים מיותרים
          </p>
          <p>
            חברת אופאל מציגה שרות רפואי "רופא עד הבית " בזמינות 24/7 עם ספקי רפואה ורופאים מנוסים, הגעה מהירה ללקוח מבלי לצאת מהבית והכל במחירים אטרקטיבים במסגרת הארגון
          </p>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-xl font-bold text-medical-blue-dark mb-4">מה תקבל במסגרת המנוי רופא עד הבית?</h2>
            <ul className="space-y-2 text-medical-grey-dark list-disc pr-5">
              <li>ייעוץ טלפוני רפואי 24/7</li>
              <li>ייעוץ רפואי טלפוני</li>
              <li>הכוונה להמשך טיפול אצל רופא מומחה</li>
              <li>מתן מרשמים ותרופות</li>
              <li>מתן פניות רפואיות</li>
              <li>ייעוץ טלפוני בתחום רפואת המשפחה</li>
              <li>מתן תעודה רפואית</li>
              <li>בדיקה גופנית וקבלת אבחנה רפואית</li>
              <li>זריקת וולטרן, פרמין ועוד</li>
              <li>קבלת אבחנה רפואית</li>
              <li>מתן הפנייה במקרה הצורך לחדר מיון (טופס 17)</li>
            </ul>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-medical-blue-dark mb-3">רופא עד הבית - המחשה</h3>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm">
              <img
                src="/png1.png"
                alt="רופא בודק לחץ דם בבית"
                className="w-full h-72 object-cover object-center"
                loading="lazy"
              />
            </div>
            <p className="text-sm text-slate-600 mt-3 leading-6">
              שירות רפואי זמין ומקצועי עד הבית, באווירה רגועה ונעימה.
            </p>
          </div>
        </section>

        <form onSubmit={handleSubmit} className="space-y-6 text-right">
          <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-xl font-bold text-medical-blue-dark mb-4">מחיר חודשי במסגרת ההסדר בארגון</h2>
            <div className="space-y-3">
              {LANDING_PLANS.map((plan) => {
                const checked = selectedLandingPlanOption === plan.optionId;
                return (
                  <label
                    key={plan.optionId}
                    className={`flex items-start gap-3 p-3 rounded-lg border ${
                      checked ? 'border-medical-blue bg-medical-blue/5' : 'border-slate-200'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        const nextChecked = !checked;
                        setSelectedLandingPlanOption(nextChecked ? plan.optionId : '');
                        update('selectedPlanId', nextChecked ? plan.mappedPlanId : '');
                      }}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-medical-blue-dark">{plan.label}</p>
                      <p className="text-sm text-medical-grey-dark">מחיר לתשלום: ₪ {plan.charge}</p>
                    </div>
                  </label>
                );
              })}
            </div>
            {errors.selectedPlanId && <p className="text-red-600 text-sm mt-2">{errors.selectedPlanId}</p>}
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <input type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} />
              <p className="text-sm text-medical-grey-dark">הנני מאשר את כתב השרות וחבילת נאות</p>
            </div>
            <div className="text-sm space-x-2 space-x-reverse">
              <a href="#" className="text-medical-blue hover:underline">
                לינק לתנאי כתב השרות
              </a>
            </div>
            {errors.acceptedTerms ? <p className="text-red-600 text-sm mt-2">{errors.acceptedTerms}</p> : null}
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-medical-blue-dark mb-3">סה"כ לתשלום חודשי</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                readOnly
                value={selectedLandingPlan ? 'מנוי ב- V {חיוב}' : ''}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50"
                placeholder="מנוי ב- V {חיוב}"
              />
              <input
                type="text"
                readOnly
                value={selectedLandingPlan ? selectedLandingPlan.charge : ''}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50"
                placeholder="סכום"
              />
              <input
                type="text"
                readOnly
                value={selectedLandingPlan ? '₪' : ''}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50"
                placeholder="₪"
              />
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-medical-blue-dark mb-4">פרטי הצטרפות ומעבר לתשלום</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm text-medical-grey-dark mb-1">שם מלא *</label>
                <input
                  type="text"
                  value={formState.fullName}
                  onChange={(e) => update('fullName', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-medical-blue focus:border-medical-blue"
                  placeholder="שם מלא"
                />
                {errors.fullName && <p className="text-red-600 text-sm mt-1">{errors.fullName}</p>}
              </div>
              <div>
                <label className="block text-sm text-medical-grey-dark mb-1">תעודת זהות *</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={9}
                  value={formState.id}
                  onChange={(e) => update('id', e.target.value.replace(/\D/g, '').slice(0, 9))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-medical-blue focus:border-medical-blue"
                  placeholder="9 ספרות"
                />
                {errors.id && <p className="text-red-600 text-sm mt-1">{errors.id}</p>}
              </div>
              <div>
                <label className="block text-sm text-medical-grey-dark mb-1">טלפון *</label>
                <input
                  type="tel"
                  value={formState.phone}
                  onChange={(e) => update('phone', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-medical-blue focus:border-medical-blue"
                  placeholder="לדוגמה 0501234567"
                />
                {errors.phone && <p className="text-red-600 text-sm mt-1">{errors.phone}</p>}
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm text-medical-grey-dark mb-1">אימייל *</label>
                <input
                  type="email"
                  value={formState.email}
                  onChange={(e) => update('email', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-medical-blue focus:border-medical-blue"
                  placeholder="דוגמה@example.com"
                />
                {errors.email && <p className="text-red-600 text-sm mt-1">{errors.email}</p>}
              </div>
              <div>
                <label className="block text-sm text-medical-grey-dark mb-1">שם הסוכן *</label>
                <input
                  type="text"
                  value={formState.agentName}
                  onChange={(e) => update('agentName', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-medical-blue focus:border-medical-blue"
                  placeholder="שם הסוכן"
                />
                {errors.agentName && <p className="text-red-600 text-sm mt-1">{errors.agentName}</p>}
              </div>
              <div>
                <label className="block text-sm text-medical-grey-dark mb-1">שם הארגון *</label>
                <input
                  type="text"
                  value={formState.organizationName}
                  onChange={(e) => update('organizationName', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-medical-blue focus:border-medical-blue"
                  placeholder="שם הארגון"
                />
                {errors.organizationName && <p className="text-red-600 text-sm mt-1">{errors.organizationName}</p>}
              </div>
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <label className="block text-sm font-medium text-medical-grey-dark mb-2">כמה מוטבים נוספים?</label>
            <select
              value={formState.beneficiaryCount}
              onChange={(e) => setBeneficiaryCount(e.target.value)}
              className="w-full sm:w-48 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-medical-blue focus:border-medical-blue bg-white"
            >
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <div className="mt-4">
              <BeneficiaryFields
                count={formState.beneficiaryCount}
                beneficiaries={formState.beneficiaries}
                onChange={updateBeneficiary}
                errors={errors}
              />
            </div>
          </section>

          <div className="pt-4">
            {submitError && <p className="text-red-600 text-sm mb-2">{submitError}</p>}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto min-w-[220px] px-6 py-3 bg-medical-blue hover:bg-medical-blue-dark disabled:bg-medical-grey-light text-white font-semibold rounded-lg shadow-md transition-colors disabled:opacity-70"
            >
              {isSubmitting ? 'טוען…' : 'המשך לתשלום'}
            </button>
          </div>
        </form>

        <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm mt-4">
          <p className="text-sm text-medical-grey-dark">
            אופאל - בית ליזמות רפואית, המקשרת על מקצועיות, מצוינות וחווית שירות פרטית.
          </p>
          <p className="text-sm text-medical-grey-dark mt-1">
            טלפון: 0544281389 | דוא"ל: opal2000@zahav.net.il
          </p>
          <div className="mt-4 h-20 w-40 rounded-xl bg-medical-blue/10 border border-medical-blue/20 flex items-center justify-center text-medical-blue-dark font-semibold">
            Opal Logo
          </div>
        </section>

      </main>
    </div>
  );
}
