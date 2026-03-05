import React from 'react'

export default function Header() {
  return (
    <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm" dir="rtl">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex justify-end items-center h-14 sm:h-16">
        <div className="h-8 w-32 sm:h-10 sm:w-40 bg-medical-grey-light/30 rounded flex items-center justify-center text-medical-grey-dark text-xs sm:text-sm font-medium">
          לוגו
        </div>
      </div>
    </header>
  )
}
