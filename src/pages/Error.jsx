import React from 'react';
import { Link } from 'react-router-dom';

export default function Error() {
  return (
    <div dir="rtl" className="min-h-screen flex flex-col bg-slate-50 font-sans items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-xl border border-slate-200 p-8 text-center">
        <h1 className="text-xl font-bold text-red-600 mb-2">שגיאה בתשלום</h1>
        <p className="text-medical-grey-dark mb-6">אירעה שגיאה בעת ביצוע התשלום. נא לנסות שוב או ליצור קשר.</p>
        <Link
          to="/"
          className="inline-block px-6 py-3 bg-medical-blue hover:bg-medical-blue-dark text-white font-medium rounded-lg"
        >
          חזרה לדף הבית
        </Link>
      </div>
    </div>
  );
}
