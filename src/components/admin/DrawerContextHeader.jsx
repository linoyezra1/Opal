import React from 'react';

/**
 * כותרת היררכית לדרואר צפייה/עריכה מהירה.
 * @param {{ title: string, subtitle?: string, meta?: Array<{ label: string, value: string }> }} props
 */
export default function DrawerContextHeader({ title, subtitle = '', meta = [] }) {
  return (
    <div className="space-y-1 text-right" dir="rtl">
      <h1 className="text-xl font-bold leading-tight">{title || '—'}</h1>
      {subtitle ? <h3 className="text-sm font-medium text-muted-foreground">{subtitle}</h3> : null}
      {meta.length ? (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {meta.map((item) => (
            <span key={`${item.label}-${item.value}`}>
              <span className="font-medium text-foreground/80">{item.label}:</span> {item.value || '—'}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
