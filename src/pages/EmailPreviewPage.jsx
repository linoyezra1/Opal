import React from 'react';
import AdminPageShell from '../components/admin/AdminPageShell.jsx';
import { OrderConfirmationEmailPreview } from '../components/email/OrderConfirmationEmailPreview.jsx';

export default function EmailPreviewPage() {
  return (
    <AdminPageShell>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">תצוגה מקדימה: מייל אישור הזמנה</h1>
          <p className="text-muted-foreground">עיצוב תבנית המייל האוטומטי לאחר תשלום מוצלח</p>
        </div>
      </div>
      <div className="-mx-4 md:-mx-6 mt-4">
        <OrderConfirmationEmailPreview />
      </div>
    </AdminPageShell>
  );
}

