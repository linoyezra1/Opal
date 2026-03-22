import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  CheckCircle,
  Phone,
  Mail,
  Clock,
  Heart,
  Shield,
  Star,
  ArrowLeft,
} from 'lucide-react';
import { API_BASE } from '../apiBase.js';
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

function validateId(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length === 9;
}

const DEFAULT_ID = '123456782';

function popularIndex(total) {
  if (total <= 1) return 0;
  if (total === 2) return 1;
  return 1;
}

/**
 * דף נחיתה ציבורי — תומך ב־/p/:slug (תוכן מלא) או ב־/landing/:priceListId (מחירון בלבד + תבנית ברירת מחדל)
 * ניתן לייבא מ־App עם prop slug (דף הבית דינמי דרך VITE_PUBLIC_HOME_LANDING_SLUG)
 */
export function PublicLandingView({ slug: slugProp, priceListId: priceListIdProp } = {}) {
  const params = useParams();
  const slug = slugProp ?? params.slug;
  const routePriceListId = params.priceListId;
  const priceListId = priceListIdProp ?? routePriceListId;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ctx, setCtx] = useState(null);
  const [content, setContent] = useState({
    title: '',
    subtitle: '',
    main: '',
    subContentRaw: '',
    imageUrl: '',
  });
  const [publicAgents, setPublicAgents] = useState([]);
  const [productId, setProductId] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [idNum, setIdNum] = useState(DEFAULT_ID);
  const [agentId, setAgentId] = useState('');
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

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
        const agRes = await fetch(`${API_BASE}/api/public/agents`).then((r) => r.json());
        if (agRes.success && Array.isArray(agRes.agents)) setPublicAgents(agRes.agents);

        if (slug) {
          const r = await fetch(`${API_BASE}/api/public/landing/${encodeURIComponent(slug)}`).then((x) => x.json());
          if (!r.success) throw new Error(r.error || 'דף לא נמצא');
          const pl = r.priceList;
          if (!pl) throw new Error('מחירון לא נמצא');
          setCtx(pl);
          setContent({
            title: r.pageTitle || pl.listName || '',
            subtitle: r.subTitle || DEFAULT_SUBTITLE,
            main: r.mainContent || DEFAULT_MAIN,
            subContentRaw: r.subContent || DEFAULT_SUB_CONTENT,
            imageUrl: r.imageUrl || '',
          });
        } else {
          const pl = await fetch(`${API_BASE}/api/public/price-list/${encodeURIComponent(priceListId)}`).then((x) => x.json());
          if (!pl.success) throw new Error(pl.error || 'מחירון לא נמצא');
          setCtx(pl);
          setContent({
            title: pl.listName || 'מחירון',
            subtitle: DEFAULT_SUBTITLE,
            main: DEFAULT_MAIN,
            subContentRaw: DEFAULT_SUB_CONTENT,
            imageUrl: '',
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

  const servicesList = useMemo(
    () => content.subContentRaw.split('\n').filter((line) => line.trim()),
    [content.subContentRaw]
  );

  const effectivePriceListId = ctx?.priceListId ?? priceListId;

  const selectedProduct = useMemo(() => {
    if (!ctx?.products?.length || !productId) return null;
    return ctx.products.find((p) => p.productId === productId) || null;
  }, [ctx, productId]);

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
      if (!validateId(idNum)) {
        setSubmitError('תעודת זהות לא תקינה');
        return;
      }
      if (publicAgents.length > 0 && !agentId) {
        setSubmitError('נא לבחור סוכן');
        return;
      }
      const agent = publicAgents.find((a) => a.id === agentId);
      const formState = {
        selectedPlanId: `pl-${productId}`,
        priceListId: effectivePriceListId,
        productId,
        fullName: fullName.trim(),
        phone: phone.trim(),
        id: idNum.replace(/\D/g, ''),
        email: 'landing@opal.local',
        organizationName: ctx?.organizationName || 'לקוח פרטי',
        agentId: agentId || '',
        agentName: agent?.agentName || '',
        beneficiaryCount: 0,
        beneficiaries: [],
        landingFlow: true,
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
    [productId, fullName, phone, idNum, agentId, publicAgents, effectivePriceListId, ctx]
  );

  if (loading) {
    return (
      <div dir="rtl" className="min-h-screen bg-background flex items-center justify-center p-6">
        <p className="text-muted-foreground">טוען דף נחיתה…</p>
      </div>
    );
  }

  if (error || !ctx) {
    return (
      <div dir="rtl" className="min-h-screen bg-background p-6">
        <div className="max-w-lg mx-auto rounded-xl border bg-card p-8 text-center space-y-4">
          <p className="text-destructive font-medium">{error || 'לא נמצא'}</p>
          <Button asChild variant="outline">
            <Link to="/">חזרה לדף הבית</Link>
          </Button>
        </div>
      </div>
    );
  }

  const products = ctx.products || [];
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
      {content.imageUrl ? (
        <section className="relative h-[300px] md:h-[400px] w-full">
          <img src={content.imageUrl} alt="" className="absolute inset-0 size-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        </section>
      ) : null}

      <section
        className={cn(
          'relative py-16 md:py-24 overflow-hidden',
          content.imageUrl ? '-mt-32 md:-mt-48 relative z-10' : 'bg-gradient-to-b from-primary/5 via-primary/3 to-background'
        )}
      >
        {!content.imageUrl ? (
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
        ) : null}
        <div className="container relative max-w-5xl mx-auto px-4">
          <div
            className={cn(
              'max-w-3xl mx-auto text-center',
              content.imageUrl && 'bg-background/95 backdrop-blur-sm rounded-2xl p-8 md:p-12 shadow-xl border'
            )}
          >
            {content.subtitle ? (
              <Badge className="mb-4 inline-flex">{content.subtitle}</Badge>
            ) : null}
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6 text-balance leading-tight">
              {content.title}
            </h1>
            <p className="text-lg text-muted-foreground mb-8 text-pretty leading-relaxed max-w-2xl mx-auto whitespace-pre-line">
              {content.main}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" asChild>
                <a href="#plans">
                  הצטרף עכשיו
                  <ArrowLeft className="size-4 ms-2" />
                </a>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="#contact">
                  <Phone className="size-4 me-2" />
                  צור קשר
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 bg-muted/30 border-y">
        <div className="container max-w-6xl mx-auto px-4">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
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

      <section className="py-16">
        <div className="container max-w-5xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">מה כולל השירות?</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">כל מה שאתם צריכים לבריאות המשפחה, במקום אחד</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 max-w-3xl mx-auto">
            {servicesList.map((service, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-4 rounded-lg border bg-card hover:shadow-sm transition-shadow"
              >
                <CheckCircle className="size-5 text-green-600 shrink-0 mt-0.5" />
                <span className="text-sm leading-relaxed">{service.trim()}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="plans" className="py-16 bg-muted/30 scroll-mt-20">
        <div className="container max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">בחר את המסלול שלך</h2>
            {ctx.organizationName ? (
              <p className="text-muted-foreground">מחירים מיוחדים לעובדי {ctx.organizationName}</p>
            ) : (
              <p className="text-muted-foreground">בחרו מסלול והמשיכו לפרטי תשלום</p>
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
                    'relative transition-all hover:shadow-lg cursor-pointer',
                    popular && 'border-primary shadow-lg md:scale-[1.02]',
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
                  {popular ? (
                    <Badge className="absolute -top-3 start-1/2 -translate-x-1/2">הכי פופולרי</Badge>
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
                        document.getElementById('checkout')?.scrollIntoView({ behavior: 'smooth' });
                      }}
                    >
                      {selected ? 'נבחר — המשך למטה' : 'בחר מסלול'}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section id="checkout" className="py-16 scroll-mt-20">
        <div className="container max-w-lg mx-auto px-4">
          <Card>
            <CardHeader>
              <CardTitle>פרטים לתשלום</CardTitle>
              <p className="text-sm text-muted-foreground">מילוי פרטים והמשך לתשלום מאובטח (Cardcom)</p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePay} className="space-y-4">
                <div>
                  <label className="text-xs text-muted-foreground">שם מלא *</label>
                  <input
                    className="w-full border rounded-lg px-3 py-2 mt-1 bg-background"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">טלפון *</label>
                  <input
                    className="w-full border rounded-lg px-3 py-2 mt-1 bg-background"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">תעודת זהות *</label>
                  <input
                    className="w-full border rounded-lg px-3 py-2 mt-1 bg-background"
                    value={idNum}
                    onChange={(e) => setIdNum(e.target.value)}
                    required
                  />
                </div>
                {publicAgents.length > 0 ? (
                  <div>
                    <label className="text-xs text-muted-foreground">סוכן *</label>
                    <select
                      className="w-full border rounded-lg px-3 py-2 mt-1 bg-background"
                      value={agentId}
                      onChange={(e) => setAgentId(e.target.value)}
                      required
                    >
                      <option value="">— בחרו סוכן —</option>
                      {publicAgents.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.agentName}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
                {selectedProduct ? (
                  <p className="text-sm rounded-lg bg-muted p-3">
                    מסלול: <strong>{selectedProduct.productName}</strong> — <strong>₪{Number(selectedProduct.retailPrice || 0)}</strong>{' '}
                    לחודש
                  </p>
                ) : (
                  <p className="text-amber-700 text-sm">נא לבחור מסלול למעלה</p>
                )}
                {submitError ? <p className="text-destructive text-sm">{submitError}</p> : null}
                <Button type="submit" className="w-full" size="lg" disabled={submitting || !selectedProduct}>
                  {submitting ? 'מעביר לתשלום…' : 'המשך לתשלום מאובטח'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="contact" className="py-16 bg-primary text-primary-foreground scroll-mt-20">
        <div className="container max-w-5xl mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-4">צור קשר</h2>
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
                <span className="font-medium text-sm" dir="ltr">
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
          <Link to="/" className="text-sm text-primary underline mt-4 inline-block">
            דף הבית
          </Link>
        </div>
      </footer>
    </div>
  );
}

export default function LandingPage() {
  return <PublicLandingView />;
}
