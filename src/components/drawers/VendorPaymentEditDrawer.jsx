import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '../ui/button.jsx';
import { Input } from '../ui/input.jsx';
import { Textarea } from '../ui/textarea.jsx';
import { Field, FieldGroup, FieldLabel } from '../ui/field.jsx';
import { Spinner } from '../ui/spinner.jsx';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '../ui/drawer.jsx';

function formatCurrency(v) {
  return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 2 }).format(
    Number(v || 0)
  );
}

export function calcVendorPaymentBalance(form) {
  return (
    Number(form?.invoiceAmount || 0) -
    Number(form?.creditNoteAmount || 0) -
    Number(form?.totalPaid || 0)
  );
}

export function snapshotToVendorPaymentForm(snapshot) {
  if (!snapshot) {
    return {
      status: 'Pending',
      invoiceNum: '',
      invoiceAmount: 0,
      creditNoteNum: '',
      creditNoteAmount: 0,
      totalPaid: 0,
      notes: '',
    };
  }
  const totalAmount = Number(snapshot.totalAmount || 0);
  const invoiceAmount = Number(snapshot.invoiceAmount || 0) || totalAmount;
  return {
    status: String(snapshot.status || 'Pending'),
    invoiceNum: String(snapshot.invoiceNum || ''),
    invoiceAmount,
    creditNoteNum: String(snapshot.creditNoteNum || ''),
    creditNoteAmount: Number(snapshot.creditNoteAmount || 0),
    totalPaid: Number(snapshot.totalPaid || 0),
    notes: String(snapshot.notes || ''),
  };
}

const ltrNumericClass = 'text-end font-mono tabular-nums';

/**
 * מגירת עריכת דרישת תשלום לספק — תואמת למגירת/דיאלוג הסוכן.
 */
export default function VendorPaymentEditDrawer({
  open,
  onOpenChange,
  vendorName = '',
  snapshot = null,
  onSave,
  saving = false,
}) {
  const [form, setForm] = useState(() => snapshotToVendorPaymentForm(snapshot));

  useEffect(() => {
    if (open && snapshot) {
      setForm(snapshotToVendorPaymentForm(snapshot));
    }
  }, [open, snapshot]);

  const balanceDue = useMemo(() => calcVendorPaymentBalance(form), [form]);

  const periodLabel =
    snapshot?.fromDate && snapshot?.toDate
      ? `${snapshot.fromDate} — ${snapshot.toDate}`
      : snapshot?.month || '';

  const handleSave = async () => {
    if (!onSave) return;
    await onSave(form);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent dir="rtl" className="text-right">
        <DrawerHeader>
          <DrawerTitle>עריכת דרישת תשלום — {vendorName || 'ספק'}</DrawerTitle>
          <DrawerDescription>
            {periodLabel ? `${periodLabel} · ` : ''}
            {snapshot ? `${Number(snapshot.totalDeals || 0)} עסקאות · ${formatCurrency(snapshot.totalAmount)}` : ''}
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel className="text-right w-full">סטטוס</FieldLabel>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-right shadow-sm"
                dir="rtl"
                value={form.status}
                onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
              >
                <option value="Pending">ממתין לתשלום</option>
                <option value="Paid">שולם</option>
              </select>
            </Field>

            <Field>
              <FieldLabel className="text-right w-full">מספר חשבונית</FieldLabel>
              <Input
                dir="rtl"
                className="text-right"
                value={form.invoiceNum}
                onChange={(e) => setForm((p) => ({ ...p, invoiceNum: e.target.value }))}
              />
            </Field>

            <Field>
              <FieldLabel className="text-right w-full">סכום חשבונית</FieldLabel>
              <Input
                type="number"
                min="0"
                step="0.01"
                dir="ltr"
                className={ltrNumericClass}
                value={form.invoiceAmount}
                onChange={(e) => setForm((p) => ({ ...p, invoiceAmount: Number(e.target.value || 0) }))}
              />
            </Field>

            <Field>
              <FieldLabel className="text-right w-full">מספר זיכוי</FieldLabel>
              <Input
                dir="rtl"
                className="text-right"
                value={form.creditNoteNum}
                onChange={(e) => setForm((p) => ({ ...p, creditNoteNum: e.target.value }))}
              />
            </Field>

            <Field>
              <FieldLabel className="text-right w-full">סכום זיכוי</FieldLabel>
              <Input
                type="number"
                min="0"
                step="0.01"
                dir="ltr"
                className={ltrNumericClass}
                value={form.creditNoteAmount}
                onChange={(e) => setForm((p) => ({ ...p, creditNoteAmount: Number(e.target.value || 0) }))}
              />
            </Field>

            <Field>
              <FieldLabel className="text-right w-full">סכום ששולם</FieldLabel>
              <Input
                type="number"
                min="0"
                step="0.01"
                dir="ltr"
                className={ltrNumericClass}
                value={form.totalPaid}
                onChange={(e) => setForm((p) => ({ ...p, totalPaid: Number(e.target.value || 0) }))}
              />
            </Field>

            <Field>
              <FieldLabel className="text-right w-full">יתרה לתשלום (מחושב)</FieldLabel>
              <Input readOnly dir="ltr" className={`${ltrNumericClass} bg-muted`} value={formatCurrency(balanceDue)} />
            </Field>

            <Field>
              <FieldLabel className="text-right w-full">הערות</FieldLabel>
              <Textarea
                dir="rtl"
                className="text-right min-h-[88px]"
                rows={3}
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              />
            </Field>
          </FieldGroup>
        </div>

        <DrawerFooter>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? <Spinner className="size-4 me-2" /> : null}
            שמירה
          </Button>
          <Button type="button" variant="outline" onClick={() => onOpenChange?.(false)} disabled={saving}>
            ביטול
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
