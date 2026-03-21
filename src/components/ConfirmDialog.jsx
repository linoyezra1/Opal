import React from 'react';

export default function ConfirmDialog({ open, title, message, confirmLabel = 'אישור', danger, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50" dir="rtl" onClick={onCancel} role="dialog" aria-modal="true">
      <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl border border-slate-200" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
        <p className="text-slate-600 text-sm mb-6">{message}</p>
        <div className="flex gap-2 justify-end flex-wrap">
          <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg bg-slate-200 text-slate-800 font-medium">
            ביטול
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-white font-medium ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-medical-blue hover:bg-medical-blue-dark'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
