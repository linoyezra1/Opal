import React from 'react';
import { Link } from 'react-router-dom';

const DOCUMENTS_LINK = '#';

export default function Success() {
  return (
    <div dir="rtl" className="min-h-screen flex flex-col bg-slate-50 font-sans">
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-6 flex justify-center">
          <div className="h-10 w-40 bg-medical-teal/10 rounded-lg flex items-center justify-center text-medical-teal-dark font-bold text-lg">
            לוגו אופל
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8 text-right">
        <h1 className="text-xl sm:text-2xl font-bold text-medical-blue-dark mb-4 text-center">
          שמחים על הצטרפותך למנוי רופא עד הבית
        </h1>
        <p className="text-medical-grey-dark mb-8 text-center leading-relaxed">
          הזמנתך בצירוף כתב השירות ישלחו אליך בדקות הקרובות למייל.
        </p>

        <section className="bg-amber-50 border-2 border-amber-400 rounded-xl p-5 sm:p-6 mb-8 shadow-sm">
          <p className="text-medical-grey-dark font-semibold mb-4 leading-relaxed">
            חשוב מאוד - בכדי להפעיל את השירות יש למלא את פרטי המוטבים בלינק המצורף
          </p>
          <div className="flex flex-col items-center gap-3">
            <Link
              to="/beneficiary-form"
              className="w-full sm:w-auto min-w-[220px] px-8 py-4 bg-medical-blue hover:bg-medical-blue-dark text-white font-bold text-lg rounded-xl shadow-md transition-colors text-center"
            >
              עדכון מוטבים
            </Link>
            <p className="text-sm text-amber-800 font-medium">
              ללא קבלת פרטי המוטבים לא יהיה ניתן לקבל את השירות
            </p>
          </div>
        </section>

        <section className="space-y-2 mb-6 text-medical-grey-dark text-sm sm:text-base">
          <p>טלפונים להזמנת שירותים רפואיים: 00-00000</p>
          <p>
            לינק להגשת מסמכים רפואיים - תביעה און ליין:{' '}
            <a href={DOCUMENTS_LINK} className="text-medical-blue hover:underline" target="_blank" rel="noopener noreferrer">
              לינק
            </a>
          </p>
        </section>

        <section className="bg-white rounded-xl border border-slate-200 p-5 mb-6 space-y-2 text-medical-grey-dark text-sm">
          <p className="font-semibold text-medical-teal-dark">מחלקת מכירות: 054-4261369</p>
          <p className="text-amber-800 font-medium">שים לב: החיוב החודשי של המנוי דרך חברת אופאל תקשורת בע&quot;מ</p>
          <p>
            לפניות ובירורים: 054-4261369 | דוא&quot;ל:{' '}
            <a href="mailto:opal2000@zahav.net.il" className="text-medical-blue hover:underline">opal2000@zahav.net.il</a>
          </p>
        </section>

        <footer className="text-center text-slate-500 text-sm">
          המנוי כפוף לכתב השירות ולגילוי נאות
        </footer>
      </main>
    </div>
  );
}
