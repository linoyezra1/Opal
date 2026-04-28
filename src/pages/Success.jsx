import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Phone, Mail, ArrowRight } from 'lucide-react';
import { Button } from '../components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card.jsx';
import { Spinner } from '../components/ui/spinner.jsx';
import { API_BASE } from '../apiBase.js';

const DOCUMENTS_LINK =
  'https://medi-care.org.il/online-claim/#elementor-action%3Aaction%3Dpopup%3Aopen%26settings%3DeyJpZCI6IjQzNiIsInRvZ2dsZSI6ZmFsc2V9';

export default function Success() {
  const [transactionId, setTransactionId] = useState('');
  const [loadingOrder, setLoadingOrder] = useState(true);
  const [beneficiaryTo, setBeneficiaryTo] = useState('/beneficiary-form');

  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    let code = qs.get('LowProfileCode') || qs.get('lowProfileCode') || qs.get('lowprofilecode') || '';
    if (!code) {
      try {
        code = sessionStorage.getItem('opal_checkout_low_profile') || '';
      } catch {
        code = '';
      }
    }
    if (code) {
      setBeneficiaryTo(`/beneficiary-form?lowProfileCode=${encodeURIComponent(code)}`);
    }

    if (!code) {
      setLoadingOrder(false);
      return undefined;
    }

    let cancelled = false;
    (async () => {
      for (let i = 0; i < 25 && !cancelled; i += 1) {
        try {
          const r = await fetch(
            `${API_BASE}/api/public/deal-lookup?lowProfileCode=${encodeURIComponent(code)}`
          ).then((x) => x.json());
          if (r.success && r.found && r.transactionId) {
            if (!cancelled) {
              const tid = String(r.transactionId);
              setTransactionId(tid);
              setBeneficiaryTo(`/beneficiary-form?transactionId=${encodeURIComponent(tid)}`);
            }
            setLoadingOrder(false);
            return;
          }
        } catch {
          /* retry */
        }
        await new Promise((res) => setTimeout(res, 1000));
      }
      if (!cancelled) setLoadingOrder(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div dir="rtl" className="min-h-screen flex flex-col bg-gradient-to-b from-primary/5 via-background to-muted/30 font-sans">
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container max-w-3xl mx-auto px-4 py-4 flex flex-row items-center justify-between gap-4">
          <div className="text-right min-w-0">
            <p className="text-sm text-muted-foreground">תודה על ההצטרפות</p>
            <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-foreground truncate">
              שמחים על הצטרפותך למנוי רופא עד הבית
            </h1>
          </div>
          <img src="/branding/opal-logo.jpeg" alt="אופאל" className="h-16 sm:h-20 w-auto object-contain shrink-0" />
        </div>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-10 md:py-14 text-right">
        <div className="flex flex-col items-center text-center mb-10">
          <div className="flex size-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 mb-6">
            <CheckCircle2 className="size-10" strokeWidth={2} />
          </div>
          <p className="text-muted-foreground max-w-xl leading-relaxed text-pretty">
            הזמנתך בצירוף כתב השירות יישלחו אליך בדקות הקרובות למייל.
          </p>
        </div>

        <Card className="mb-8 border-amber-500/40 shadow-md bg-amber-50/50 dark:bg-amber-950/20">
          <CardHeader>
            <CardTitle className="text-lg text-amber-900 dark:text-amber-100">חשוב מאוד</CardTitle>
            <CardDescription className="text-amber-900/80 dark:text-amber-200/90 text-base leading-relaxed">
              <strong className="font-bold text-lg">להפעלת הביטוח חובה למלא את עדכון המוטבים</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button asChild size="lg" variant="opalGold" className="w-full sm:w-auto min-w-[240px]">
              <Link to={beneficiaryTo}>
                עדכון מוטבים
                <ArrowRight className="size-4 me-2 rotate-180" />
              </Link>
            </Button>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              ללא קבלת פרטי המוטבים לא יהיה ניתן לקבל את השירות
            </p>
          </CardContent>
        </Card>

        <Card className="mb-6 border-primary/20">
          <CardHeader>
            <CardTitle className="text-lg">מס׳ הזמנה</CardTitle>

          </CardHeader>
          <CardContent>
            {loadingOrder ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Spinner />
                <span>טוען מספר הזמנה…</span>
              </div>
            ) : transactionId ? (
              <p className="text-2xl font-mono font-semibold text-foreground text-start" dir="ltr">
                {transactionId}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                המספר יופיע כאן לאחר עדכון המערכת. ניתן להמשיך לעדכון מוטבים מהקישור למטה.
              </p>
            )}
          </CardContent>
        </Card>



        <Card className="mb-6">
          <CardContent className="pt-6 space-y-3 text-muted-foreground text-sm sm:text-amber-100">
            <p className="font-bold text-lg text-foreground">
              טלפונים להזמנת שירותים רפואיים: 00-00000 לינק להגשת מסמכים רפואיים — תביעה און ליין: לינק
            </p>
            <p>
              לינק להגשת מסמכים רפואיים — תביעה און ליין:{' '}
              <a
                href={DOCUMENTS_LINK}
                className="text-primary hover:underline font-medium"
                target="_blank"
                rel="noopener noreferrer"
              >
                לינק
              </a>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 space-y-3">
            <p className="font-semibold text-primary">מחלקת מכירות: 054-4261369</p>
            <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">
              שים לב: החיוב החודשי של המנוי דרך חברת אופאל תקשורת בע&quot;מ
            </p>
            <div className="flex flex-wrap gap-4 pt-2">
              <a
                href="tel:0544261369"
                className="inline-flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
              >
                <Phone className="size-4" />
                <span dir="ltr">054-4261369</span>
              </a>
              <a
                href="mailto:opal2000@zahav.net.il"
                className="inline-flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
              >
                <Mail className="size-4" />
                <span dir="ltr">opal2000@zahav.net.il</span>
              </a>
            </div>
          </CardContent>
        </Card>

        <footer className="text-center text-muted-foreground text-sm mt-12 pt-8 border-t">
          המנוי כפוף לכתב השירות ולגילוי נאות
        </footer>
      </main>
    </div>
  );
}
