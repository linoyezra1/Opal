import React from 'react';

/**
 * דף הבית הזמני — האתר בשיפוצים
 */
export default function App() {
  return (
    <div dir="rtl" className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-[#D9EAF3]/50 via-background to-muted/40 px-6 py-16">
      <div className="flex flex-col items-center max-w-lg text-center space-y-6">
        <div className="h-28 w-28 rounded-2xl bg-primary/15 border-2 border-primary/25 shadow-lg flex items-center justify-center">
          <span className="text-3xl font-black tracking-tight text-primary">Opal</span>
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground">דף זה בשיפוצים</h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            אנו משדרגים את האתר. בקרוב יחזרו כל השירותים והמידע.
          </p>
        </div>
        <p className="text-sm text-muted-foreground">אופאל — בית ליזמות רפואית</p>
      </div>
    </div>
  );
}
