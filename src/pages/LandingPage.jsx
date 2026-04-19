import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  Phone,
  Mail,
  Clock,
  Heart,
  Shield,
  Star,
  ArrowLeft,
  Users,
  Pill,
  Stethoscope,
  Syringe,
  FileText,
  CreditCard,
  Minus,
  Plus,
  AlertCircle,
} from 'lucide-react';
import { API_BASE } from '../apiBase.js';
import {
  normalizeIsraeliIdDigitsInput,
} from '../utils/israeliId.js';

const ORG_JOIN_REQUEST_URL = 'https://opal-production-5fee.up.railway.app/organization-join-request';
import { cn } from '../lib/cn.js';
import { Button } from '../components/ui/button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card.jsx';
import { Badge } from '../components/ui/badge.jsx';

const DEFAULT_SUBTITLE = 'יעוץ טלפוני בתחום רפואת המשפחה';
const DEFAULT_MAIN = `כשאתה צריך רופא, אתה צריך אותו עכשיו. במקום להמתין ימים ארוכים בתסכול, אצלנו תקבל ביטחון וטיפול מקצועי ומנוסה אצלך בבית עוד היום.. ללא עיכובים מיותרים`;
const DEFAULT_SUB_CONTENT = `מוקד שרות רפואי 24/7
יעוץ רפואי טלפוני
מתן תעודה רפואית
הפניה להמשך טיפול אצל רופא מומחה
בדיקה גופנית וקבלת הבחנה רפואית
מתן מרשמים ותרופות
זריקת וולטרן, פרמין ועוד
קבלת אנמנזה רפואית
מתן הפנייה במקרה הצורך לחדר מיון (טופס 17)
בתום הייעוץ יישלח למנוי סיכום הייעוץ הרפואי`;

const DEFAULT_WHAT_YOU_GET = [
  { icon: 'phone', title: 'ייעוץ רפואי טלפוני 24/7', description: 'שיחה עם רופא מוסמך בכל שעה ביום ובלילה' },
  { icon: 'users', title: 'הפניות לרופאים מומחים', description: 'גישה מהירה לרופאים מומחים בכל התחומים' },
  { icon: 'pill', title: 'מרשמים ותרופות', description: 'קבלת מרשמים לתרופות ללא צורך בהמתנה' },
  { icon: 'stethoscope', title: 'בדיקה גופנית ואבחון', description: 'בדיקה רפואית מקיפה בנוחות הבית שלך' },
  { icon: 'syringe', title: 'זריקות (וולטרן, פרמין)', description: 'מתן זריקות על ידי צוות רפואי מקצועי' },
  { icon: 'file', title: 'הפניות לחדר מיון (טופס 17)', description: 'הנפקת טופס 17 להפניה לחדר מיון במידת הצורך' },
];

const ICON_MAP = {
  phone: Phone,
  users: Users,
  pill: Pill,
  stethoscope: Stethoscope,
  syringe: Syringe,
  file: FileText,
};

const benefits = [
  { icon: Clock, title: 'זמינות 24/7', description: 'שירות רפואי בכל שעה, כל יום' },
  { icon: Heart, title: 'טיפול אישי', description: 'רופאים מנוסים עד הבית' },
  { icon: Shield, title: 'מקצועיות', description: 'צוות רפואי מוסמך ואמין' },
  { icon: Star, title: 'מחיר הוגן', description: 'פחות משקל ליום' },
];

function validatePhone(value) {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 9 && digits.length <= 11;
}

function validateEmail(value) {
  const t = String(value || '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

function popularIndex(total) {
  if (total <= 1) return 0;
  if (total === 2) return 1;
  return 1;
}

function mapWhatYouGetItems(items) {
  if (!Array.isArray(items) || items.length === 0) return DEFAULT_WHAT_YOU_GET;
  return items.map((it) => ({
    icon: ICON_MAP[it.icon] ? it.icon : 'phone',
    title: it.title || '',
    description: it.description || '',
  }));
}

/** נורמליזציה ל-src של תמונה (URL מלא או יחסי) */
function resolveImageSrc(url) {
  const u = String(url || '').trim();
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u;
  if (u.startsWith('//')) return `https:${u}`;
  if (u.startsWith('/')) return `${typeof window !== 'undefined' ? window.location.origin : ''}${u}`;
  return u;
}

function HeroImageBox({ src, minClass = 'min-h-[240px] md:min-h-[380px] lg:min-h-[420px]' }) {
  const [failed, setFailed] = useState(false);
  const resolved = resolveImageSrc(src);
  return (
    <div
      className={cn(
        'relative w-full rounded-2xl overflow-hidden border-2 border-primary/15 shadow-xl bg-muted',
        minClass
      )}
    >
      {resolved && !failed ? (
        <img
          src={resolved}
          alt=""
          className="absolute inset-0 size-full min-h-[inherit] object-cover object-center"
          onError={() => setFailed(true)}
          loading="eager"
          decoding="async"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm p-6 text-center">
          {failed ? 'לא ניתן לטעון את התמונה — בדקו את כתובת הקובץ' : 'ניתן להוסיף תמונת מוצר בניהול המוצר או תמונת דף בבונה דפי הנחיתה'}
        </div>
      )}
    </div>
  );
}

function ContactLandingView({ slug, content, whatYouGetRows, whatYouGetTitle, whatYouGetSubtitle }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [formErr, setFormErr] = useState('');

  async function submitContact(e) {
    e.preventDefault();
    setFormErr('');
    if (!name.trim() || !phone.trim()) {
      setFormErr('נא למלא שם וטלפון');
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`${API_BASE}/api/public/contact-lead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          message: message.trim(),
          landingSlug: slug || '',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'שגיאה בשליחה');
      setDone(true);
    } catch (err) {
      setFormErr(err.message || 'שגיאה');
    } finally {
      setSending(false);
    }
  }

  return (
    <div dir="rtl" className="min-h-screen bg-background text-right">
      <section className="relative py-10 md:py-16 overflow-hidden bg-gradient-to-b from-[#D9EAF3]/40 via-background to-background">
        <div className="container relative max-w-6xl mx-auto px-4 overflow-hidden">
          <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
            <div className="order-2 md:order-1 space-y-5 text-center md:text-right">
              {content.subtitle ? (
                <Badge className="inline-flex bg-primary/10 text-primary border-primary/20">{content.subtitle}</Badge>
              ) : null}
              <h1
                style={{ fontSize: 'clamp(1.75rem, 4vw + 0.5rem, 3rem)' }}
                className="font-bold text-balance leading-tight text-foreground"
              >
                {content.title || 'צור קשר'}
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed whitespace-pre-line max-w-xl mx-auto md:mx-0 md:ms-0 md:me-auto">
                {content.main || 'נשמח לעמוד לשירותכם.'}
              </p>
            </div>
            <div className="order-1 md:order-2 w-full">
              <HeroImageBox src={content.imageUrl} />
              <p className="text-xs text-center text-muted-foreground mt-2">לוגו / תמונה מדף הנחיתה</p>
            </div>
          </div>
        </div>
      </section>

      {whatYouGetRows?.length ? (
        <section className="py-16 md:py-20">
          <div className="container mx-auto max-w-6xl px-4">
            <div className="mb-12 text-center">
              <h2
                style={{ fontSize: 'clamp(1.5rem, 3vw + 0.5rem, 2.25rem)' }}
                className="mb-4 font-bold text-foreground"
              >
                {whatYouGetTitle}
              </h2>
              <p className="mx-auto max-w-2xl text-lg text-muted-foreground">{whatYouGetSubtitle}</p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {whatYouGetRows.map((service, index) => {
                const Ico = ICON_MAP[service.icon] || Phone;
                return (
                  <Card key={`${service.title}-${index}`} className="group border-border bg-card">
                    <CardContent className="p-6">
                      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#D9EAF3]">
                        <Ico className="h-6 w-6 text-primary" />
                      </div>
                      <h3 className="mb-2 text-lg font-semibold">{service.title}</h3>
                      <p className="text-sm text-muted-foreground">{service.description}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      <section id="contact-form" className="py-16 bg-muted/30 scroll-mt-20">
        <div className="container max-w-xl mx-auto px-4">
          <Card className="shadow-lg border-border">
            <CardHeader className="border-b bg-[#D9EAF3]/30">
              <CardTitle className="text-xl">שליחת פנייה</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {done ? (
                <p className="text-center text-primary font-medium py-6">הפנייה נשלחה בהצלחה. נחזור אליכם בהקדם.</p>
              ) : (
                <form onSubmit={submitContact} className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">שם מלא *</label>
                    <input
                      className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">טלפון *</label>
                    <input
                      type="tel"
                      dir="ltr"
                      className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">הודעה</label>
                    <textarea
                      rows={4}
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                    />
                  </div>
                  {formErr ? <p className="text-destructive text-sm">{formErr}</p> : null}
                  <Button type="submit" className="w-full" size="lg" disabled={sending}>
                    {sending ? 'שולח…' : 'שליחה'}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <footer className="py-8 border-t bg-muted/30">
        <div className="container text-center max-w-5xl mx-auto px-4">
          <p className="text-sm text-muted-foreground">כל הזכויות שמורות לאופאל - בית ליזמות רפואית</p>
          <a
            href={ORG_JOIN_REQUEST_URL}
            className="text-sm text-primary underline mt-4 inline-block"
            target="_blank"
            rel="noopener noreferrer"
          >
            בקשה להצטרפות ארגון
          </a>
        </div>
      </footer>
    </div>
  );
}

/**
 * דף נחיתה ציבורי — /p/:slug או /landing/:priceListId
 */
export function PublicLandingView({ slug: slugProp, priceListId: priceListIdProp } = {}) {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const slug = slugProp ?? params.slug;
  const routePriceListId = params.priceListId;
  const priceListId = priceListIdProp ?? routePriceListId;
  // agentId from URL takes priority over the price-list's default agent
  const urlAgentId = searchParams.get('agentId') || '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ctx, setCtx] = useState(null);
  const [content, setContent] = useState({
    title: '',
    subtitle: '',
    main: '',
    subContentRaw: '',
    imageUrl: '',
    whatYouGetTitle: '',
    whatYouGetSubtitle: '',
    whatYouGetItems: [],
    registrationTitle: '',
    registrationSubtitle: '',
  });
  const [productId, setProductId] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [beneficiaryCount, setBeneficiaryCount] = useState(0);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [pageType, setPageType] = useState('sales');

  useEffect(() => {
    if (pageType !== 'sales') return undefined;
    const phoneOk = validatePhone(String(phone || '').trim());
    const emailOk = validateEmail(String(email || '').trim());
    if (!phoneOk || !emailOk) return undefined;
    const keyBase = slug || String(priceListId || '');
    if (!keyBase) return undefined;

    const timer = setTimeout(async () => {
      try {
        const markKey = `opal_abandoned_lead_sent:${keyBase}:${String(phone || '').trim()}:${String(email || '').trim().toLowerCase()}`;
        const already = sessionStorage.getItem(markKey);
        if (already) return;
        await fetch(`${API_BASE}/api/public/abandoned-checkout-lead`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: fullName.trim(),
            phone: phone.trim(),
            email: email.trim(),
            landingSlug: slug || String(priceListId || ''),
            message: 'לא המשיכו לתשלום',
          }),
        });
        sessionStorage.setItem(markKey, '1');
      } catch {
        /* best effort */
      }
    }, 900);

    return () => clearTimeout(timer);
  }, [pageType, fullName, phone, email, slug, priceListId, productId]);

  useEffect(() => {
    if (!slug && !priceListId) {
      setLoading(false);
      setError('כתובת לא תקינה');
      return;
    }

    setLoading(true);
    setError('');
    const run = async () => {
      try {
        if (slug) {
          const r = await fetch(`${API_BASE}/api/public/landing/${encodeURIComponent(slug)}`).then((x) => x.json());
          if (!r.success) throw new Error(r.error || 'דף לא נמצא');
          if (r.pageType === 'contact') {
            setPageType('contact');
            setCtx(null);
            setContent({
              title: r.pageTitle || 'צור קשר',
              subtitle: r.subTitle || '',
              main: r.mainContent || '',
              subContentRaw: r.subContent || '',
              imageUrl: r.imageUrl || '',
              whatYouGetTitle: r.whatYouGetTitle || '',
              whatYouGetSubtitle: r.whatYouGetSubtitle || '',
              whatYouGetItems: Array.isArray(r.whatYouGetItems) ? r.whatYouGetItems : [],
              registrationTitle: r.registrationTitle || '',
              registrationSubtitle: r.registrationSubtitle || '',
            });
            return;
          }
          setPageType('sales');
          const pl = r.priceList;
          if (!pl) throw new Error('מחירון לא נמצא');
          setCtx(pl);
          setContent({
            title: r.pageTitle || pl.listName || '',
            subtitle: r.subTitle || DEFAULT_SUBTITLE,
            main: r.mainContent || DEFAULT_MAIN,
            subContentRaw: r.subContent || DEFAULT_SUB_CONTENT,
            imageUrl: r.imageUrl || '',
            whatYouGetTitle: r.whatYouGetTitle || '',
            whatYouGetSubtitle: r.whatYouGetSubtitle || '',
            whatYouGetItems: Array.isArray(r.whatYouGetItems) ? r.whatYouGetItems : [],
            registrationTitle: r.registrationTitle || '',
            registrationSubtitle: r.registrationSubtitle || '',
          });
        } else {
          setPageType('sales');
          const pl = await fetch(`${API_BASE}/api/public/price-list/${encodeURIComponent(priceListId)}`).then((x) => x.json());
          if (!pl.success) throw new Error(pl.error || 'מחירון לא נמצא');
          setCtx(pl);
          setContent({
            title: pl.listName || 'מחירון',
            subtitle: DEFAULT_SUBTITLE,
            main: DEFAULT_MAIN,
            subContentRaw: DEFAULT_SUB_CONTENT,
            imageUrl: '',
            whatYouGetTitle: '',
            whatYouGetSubtitle: '',
            whatYouGetItems: [],
            registrationTitle: '',
            registrationSubtitle: '',
          });
        }
      } catch (e) {
        setError(e.message || 'שגיאה');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [slug, priceListId]);

  const whatYouGetRows = useMemo(
    () => mapWhatYouGetItems(content.whatYouGetItems),
    [content.whatYouGetItems]
  );

  const whatYouGetTitle = content.whatYouGetTitle?.trim() || 'מה אתם מקבלים?';
  const whatYouGetSubtitle =
    content.whatYouGetSubtitle?.trim() || 'חבילת שירותים רפואיים מקיפה לכל המשפחה';

  const registrationTitle = content.registrationTitle?.trim() || 'הרשמה לשירות';
  const registrationSubtitle = content.registrationSubtitle?.trim() || 'מלאו את הפרטים והצטרפו למשפחת Opal';

  const effectivePriceListId = ctx?.priceListId ?? priceListId;

  const selectedProduct = useMemo(() => {
    if (!ctx?.products?.length || !productId) return null;
    return ctx.products.find((p) => p.productId === productId) || null;
  }, [ctx, productId]);

  const products = ctx?.products || [];

  const heroImageUrl = useMemo(() => {
    if (selectedProduct?.imageUrl) return selectedProduct.imageUrl;
    const firstWithImg = products.find((p) => p.imageUrl);
    if (firstWithImg?.imageUrl) return firstWithImg.imageUrl;
    return content.imageUrl || '';
  }, [selectedProduct, products, content.imageUrl]);

  const handlePay = useCallback(
    async (e) => {
      e.preventDefault();
      setSubmitError(null);
      if (!productId) {
        setSubmitError('נא לבחור מסלול');
        return;
      }
      if (!fullName.trim()) {
        setSubmitError('נא למלא שם מלא');
        return;
      }
      if (!validatePhone(phone)) {
        setSubmitError('נא למלא טלפון תקין');
        return;
      }
      if (!validateEmail(email)) {
        setSubmitError('נא למלא כתובת דוא״ל תקינה');
        return;
      }
      if (!acceptedTerms) {
        setSubmitError('יש לאשר את תנאי השירות');
        return;
      }
      const formState = {
        selectedPlanId: `pl-${productId}`,
        priceListId: effectivePriceListId,
        productId,
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        organizationName: ctx?.organizationName || 'לקוח פרטי',
        agentId: urlAgentId || String(selectedProduct?.agentId || ''),
        agentName: '',
        beneficiaryCount: Math.max(0, Math.min(5, Number(beneficiaryCount) || 0)),
        beneficiaries: [],
        landingFlow: true,
        landingPageSlug: String(slug || priceListId || '').trim(),
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
          setSubmitError(data.error || 'שגיאה ביצירת תשלום');
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
        setSubmitError('לא התקבל קישור לתשלום');
      } catch (err) {
        setSubmitError(err.message || 'שגיאת רשת');
      } finally {
        setSubmitting(false);
      }
    },
    [
      productId,
      fullName,
      phone,
      email,
      acceptedTerms,
      effectivePriceListId,
      ctx,
      beneficiaryCount,
      slug,
      priceListId,
      selectedProduct,
    ]
  );

  if (loading) {
    return (
      <div dir="rtl" className="min-h-screen bg-background flex items-center justify-center p-6">
        <p className="text-muted-foreground">טוען דף נחיתה…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div dir="rtl" className="min-h-screen bg-background p-6">
        <div className="max-w-lg mx-auto rounded-xl border bg-card p-8 text-center space-y-4">
          <p className="text-destructive font-medium">{error}</p>
          <Button asChild variant="outline">
            <Link to="/">חזרה לדף הבית</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (pageType === 'contact') {
    return (
      <ContactLandingView
        slug={slug || ''}
        content={content}
        whatYouGetRows={whatYouGetRows}
        whatYouGetTitle={whatYouGetTitle}
        whatYouGetSubtitle={whatYouGetSubtitle}
      />
    );
  }

  if (!ctx) {
    return (
      <div dir="rtl" className="min-h-screen bg-background p-6">
        <div className="max-w-lg mx-auto rounded-xl border bg-card p-8 text-center space-y-4">
          <p className="text-destructive font-medium">לא נמצא</p>
          <Button asChild variant="outline">
            <Link to="/">חזרה לדף הבית</Link>
          </Button>
        </div>
      </div>
    );
  }

  const n = products.length;
  const popIdx = popularIndex(n);

  if (!n) {
    return (
      <div dir="rtl" className="min-h-screen bg-background p-6">
        <div className="max-w-lg mx-auto rounded-xl border bg-card p-8 text-center space-y-4">
          <p className="text-muted-foreground">במחירון זה אין מוצרים. פנו למנהל המערכת.</p>
          <Button asChild variant="outline">
            <Link to="/">חזרה לדף הבית</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-background text-right">
      {/* Hero — תמונת מוצר/דף בולטת + טקסט */}
      <section className="relative py-10 md:py-16 overflow-hidden bg-gradient-to-b from-[#D9EAF3]/40 via-background to-background">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent pointer-events-none" />
        <div className="container relative max-w-6xl mx-auto px-4 overflow-hidden">
          <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
            <div className="order-2 md:order-1 space-y-5 text-center md:text-right">
              {content.subtitle ? (
                <Badge className="inline-flex bg-primary/10 text-primary border-primary/20">{content.subtitle}</Badge>
              ) : null}
              <h1
                style={{ fontSize: 'clamp(1.75rem, 4vw + 0.5rem, 3rem)' }}
                className="font-bold text-balance leading-tight text-foreground"
              >
                {content.title}
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed whitespace-pre-line max-w-xl mx-auto md:mx-0 md:ms-0 md:me-auto">
                {content.main}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
                <Button size="lg" asChild>
                  <a href="#plans">
                    בחירת מסלול
                    <ArrowLeft className="size-4 ms-2" />
                  </a>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <a href="#registration">הרשמה לשירות</a>
                </Button>
              </div>
            </div>
            <div className="order-1 md:order-2 w-full">
              <HeroImageBox src={heroImageUrl} />
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 bg-muted/30 border-y">
        <div className="container max-w-6xl mx-auto px-4">
          <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
            {benefits.map((benefit) => (
              <div key={benefit.title} className="flex items-center gap-4 p-4 rounded-lg bg-background border">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <benefit.icon className="size-6" />
                </div>
                <div>
                  <h3 className="font-semibold">{benefit.title}</h3>
                  <p className="text-sm text-muted-foreground">{benefit.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* מה אתם מקבלים — דינמי */}
      <section id="services" className="py-16 md:py-20 scroll-mt-20">
        <div className="container mx-auto max-w-6xl px-4">
          <div className="mb-12 text-center">
            <h2
              style={{ fontSize: 'clamp(1.5rem, 3vw + 0.5rem, 2.25rem)' }}
              className="mb-4 font-bold text-foreground"
            >
              {whatYouGetTitle}
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">{whatYouGetSubtitle}</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {whatYouGetRows.map((service, index) => {
              const Ico = ICON_MAP[service.icon] || Phone;
              return (
                <Card
                  key={`${service.title}-${index}`}
                  className="group border-border bg-card transition-all duration-300 hover:border-primary/30 hover:shadow-lg"
                >
                  <CardContent className="p-6">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#D9EAF3] transition-colors group-hover:bg-opal-gold/35">
                      <Ico className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="mb-2 text-lg font-semibold text-card-foreground">{service.title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{service.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section id="plans" className="py-16 bg-muted/30 scroll-mt-20">
        <div className="container max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2
              style={{ fontSize: 'clamp(1.5rem, 3vw + 0.5rem, 2.25rem)' }}
              className="font-bold mb-4"
            >
              בחר את המסלול שלך
            </h2>
            {ctx.organizationName ? (
              <p className="text-muted-foreground">מחירים מיוחדים לעובדי {ctx.organizationName}</p>
            ) : (
              <p className="text-muted-foreground">בחרו מסלול והמשיכו להרשמה</p>
            )}
          </div>

          <div
            className={cn(
              'grid gap-6 max-w-4xl mx-auto',
              n === 1 && 'md:grid-cols-1 max-w-md',
              n === 2 && 'md:grid-cols-2',
              n >= 3 && 'md:grid-cols-3'
            )}
          >
            {products.map((product, idx) => {
              const popular = idx === popIdx && n > 1;
              const selected = productId === product.productId;
              return (
                <Card
                  key={product.productId}
                  className={cn(
                    'relative transition-all hover:shadow-lg cursor-pointer overflow-hidden pt-0',
                    popular && 'border-2 border-opal-gold shadow-lg md:scale-[1.02] origin-center',
                    selected && 'ring-2 ring-primary'
                  )}
                  onClick={() => setProductId(product.productId)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(ev) => {
                    if (ev.key === 'Enter' || ev.key === ' ') {
                      ev.preventDefault();
                      setProductId(product.productId);
                    }
                  }}
                >
                  {product.imageUrl ? (
                    <div className="relative w-full min-h-[160px] aspect-[16/10] bg-muted border-b">
                      <img
                        src={resolveImageSrc(product.imageUrl)}
                        alt=""
                        className="absolute inset-0 size-full object-cover object-center min-h-[160px]"
                        loading="lazy"
                        decoding="async"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    </div>
                  ) : null}
                  {popular ? (
                    <Badge className="absolute top-3 start-1/2 -translate-x-1/2 z-10 border-0 bg-opal-gold text-opal-gold-foreground hover:bg-opal-gold/90">
                      הכי פופולרי
                    </Badge>
                  ) : null}
                  <CardHeader className="text-center pb-2">
                    <CardTitle className="text-xl">{product.productName}</CardTitle>
                    {product.baseDescription ? (
                      <p className="text-sm text-muted-foreground mt-2">{product.baseDescription}</p>
                    ) : null}
                  </CardHeader>
                  <CardContent className="space-y-4 text-center pb-6">
                    <div>
                      <span className="text-4xl font-bold">₪{Number(product.retailPrice || 0)}</span>
                      <span className="text-muted-foreground"> / חודש</span>
                    </div>
                    <Button
                      className="w-full"
                      size="lg"
                      variant={selected ? 'default' : 'outline'}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setProductId(product.productId);
                        document.getElementById('registration')?.scrollIntoView({ behavior: 'smooth' });
                      }}
                    >
                      {selected ? 'נבחר — המשך להרשמה' : 'בחר מסלול'}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* הרשמה לשירות — טופס ראשי */}
      <section id="registration" className="py-16 md:py-20 scroll-mt-20 bg-gradient-to-b from-muted/20 to-background">
        <div className="container mx-auto max-w-2xl px-4">
          <div className="mb-8 text-center">
            <h2
              style={{ fontSize: 'clamp(1.5rem, 3vw + 0.5rem, 2.25rem)' }}
              className="mb-4 font-bold text-foreground"
            >
              {registrationTitle}
            </h2>
            <p className="text-lg text-muted-foreground">{registrationSubtitle}</p>
          </div>

          <Card className="border-border shadow-lg overflow-hidden">
            <CardHeader className="border-b border-border bg-[#D9EAF3]/30">
              <CardTitle className="flex items-center justify-center gap-2 text-xl text-foreground md:justify-start">
                <CreditCard className="size-5 text-primary shrink-0" />
                טופס הרשמה ותשלום
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handlePay} className="space-y-6">
                {selectedProduct ? (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">תוכנית נבחרת:</p>
                        <p className="font-semibold text-foreground">{selectedProduct.productName}</p>
                      </div>
                      <div className="text-start sm:text-end">
                        <p className="text-2xl font-bold text-primary">₪{Number(selectedProduct.retailPrice || 0)}</p>
                        <p className="text-xs text-muted-foreground">לחודש</p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="link"
                      className="mt-2 h-auto p-0 text-sm text-primary"
                      onClick={() => document.getElementById('plans')?.scrollIntoView({ behavior: 'smooth' })}
                    >
                      שנה תוכנית
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-right">
                    <AlertCircle className="size-5 shrink-0 text-amber-600" />
                    <div>
                      <p className="font-medium text-amber-900">לא נבחרה תוכנית</p>
                      <Button
                        type="button"
                        variant="link"
                        className="h-auto p-0 text-sm text-amber-800 underline"
                        onClick={() => document.getElementById('plans')?.scrollIntoView({ behavior: 'smooth' })}
                      >
                        בחרו תוכנית מהמחירון למעלה
                      </Button>
                    </div>
                  </div>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium text-foreground">שם מלא *</label>
                    <input
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="הזן שם מלא"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">טלפון *</label>
                    <input
                      type="tel"
                      dir="ltr"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="0501234567"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">דוא״ל *</label>
                    <input
                      type="email"
                      dir="ltr"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">מוטבים נוספים</label>
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center rounded-lg border border-input bg-background">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 rounded-l-none"
                        onClick={() => setBeneficiaryCount((c) => Math.max(0, c - 1))}
                        disabled={beneficiaryCount === 0}
                      >
                        <Minus className="size-4" />
                      </Button>
                      <span className="w-12 text-center font-medium">{beneficiaryCount}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 rounded-r-none"
                        onClick={() => setBeneficiaryCount((c) => Math.min(5, c + 1))}
                        disabled={beneficiaryCount >= 5}
                      >
                        <Plus className="size-4" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="size-4" />
                      <span>עד 5 מוטבים נוספים</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="terms-landing"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="mt-1 size-4 rounded border-input"
                  />
                  <label htmlFor="terms-landing" className="text-sm leading-relaxed text-muted-foreground cursor-pointer">
                    הנני מאשר את{' '}
                    <a
                      href={`${API_BASE}/api/legal-document/service-terms`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline hover:no-underline font-medium"
                      onClick={(e) => e.stopPropagation()}
                    >
                      כתב השירות
                    </a>
                    {' '}ואת{' '}
                    <a
                      href={`${API_BASE}/api/legal-document/privacy-disclosure`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline hover:no-underline font-medium"
                      onClick={(e) => e.stopPropagation()}
                    >
                      גילוי נאות
                    </a>
                    .
                  </label>
                </div>

                <div className="rounded-lg border border-primary/20 bg-[#D9EAF3]/30 p-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <span className="text-lg font-medium text-foreground">סה״כ לתשלום חודשי:</span>
                    <span className="text-3xl font-bold text-primary">
                      {selectedProduct ? `₪${Number(selectedProduct.retailPrice || 0)}` : '—'}
                    </span>
                  </div>
                </div>

                {submitError ? <p className="text-destructive text-sm">{submitError}</p> : null}

                <Button
                  type="submit"
                  size="lg"
                  variant="opalGold"
                  className="w-full text-lg"
                  disabled={
                    submitting ||
                    !selectedProduct ||
                    !acceptedTerms
                  }
                >
                  {submitting ? 'מעביר לתשלום…' : 'המשך לתשלום מאובטח'}
                </Button>
                <p className="text-xs text-center text-muted-foreground">מועברים לסביבת תשלום מאובטחת (Cardcom)</p>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="contact" className="py-16 bg-primary text-primary-foreground scroll-mt-20">
        <div className="container max-w-5xl mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center">
            <h2
              style={{ fontSize: 'clamp(1.5rem, 3vw + 0.5rem, 2.25rem)' }}
              className="font-bold mb-4"
            >
              צור קשר
            </h2>
            <p className="text-primary-foreground/90 mb-8 text-lg">
              אופאל - בית ליזמות רפואית, המושתת על מקצועיות, מצוינות וחווית שירות פרטית.
            </p>
            <div className="grid gap-4 sm:grid-cols-2 max-w-md mx-auto">
              <a
                href="tel:0544261369"
                className="flex items-center justify-center gap-3 p-4 rounded-lg bg-primary-foreground/10 hover:bg-primary-foreground/20 transition-colors"
              >
                <Phone className="size-5" />
                <span className="font-medium" dir="ltr">
                  054-426-1369
                </span>
              </a>
              <a
                href="mailto:opal2000@zahav.net.il"
                className="flex items-center justify-center gap-3 p-4 rounded-lg bg-primary-foreground/10 hover:bg-primary-foreground/20 transition-colors"
              >
                <Mail className="size-5" />
                <span className="font-medium text-xs sm:text-sm break-all" dir="ltr">
                  opal2000@zahav.net.il
                </span>
              </a>
            </div>
          </div>
        </div>
      </section>

      <footer className="py-8 border-t bg-muted/30">
        <div className="container text-center max-w-5xl mx-auto px-4">
          <p className="text-sm text-muted-foreground">כל הזכויות שמורות לאופאל - בית ליזמות רפואית</p>
          <a
            href={ORG_JOIN_REQUEST_URL}
            className="text-sm text-primary underline mt-4 inline-block"
            target="_blank"
            rel="noopener noreferrer"
          >
            בקשה להצטרפות ארגון
          </a>
        </div>
      </footer>
    </div>
  );
}

export default function LandingPage() {
  return <PublicLandingView />;
}
