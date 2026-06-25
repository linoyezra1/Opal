import React from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
} from '../ui/drawer.jsx';
import { Button } from '../ui/button.jsx';
import { Spinner } from '../ui/spinner.jsx';
import DrawerContextHeader from './DrawerContextHeader.jsx';

/**
 * דרואר צף לצפייה / עריכה מהירה מעל הטבלה.
 */
export default function RecordDetailDrawer({
  open,
  onOpenChange,
  title,
  subtitle = '',
  meta = [],
  children,
  onSave,
  onUpdateStatus,
  saveLabel = 'שמור שינויים',
  statusLabel = 'עדכן סטטוס',
  saveBusy = false,
  statusBusy = false,
  wide = false,
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        className={wide ? 'max-w-2xl w-full' : 'max-w-lg w-full'}
        dir="rtl"
      >
        <DrawerHeader>
          <DrawerContextHeader title={title} subtitle={subtitle} meta={meta} />
        </DrawerHeader>
        <div className="flex-1 overflow-y-auto px-6 pb-4 text-right">{children}</div>
        <DrawerFooter className="flex-row-reverse gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange?.(false)}>
            סגור
          </Button>
          {onUpdateStatus ? (
            <Button type="button" variant="secondary" disabled={statusBusy} onClick={onUpdateStatus}>
              {statusBusy ? <Spinner className="me-2" /> : null}
              {statusLabel}
            </Button>
          ) : null}
          {onSave ? (
            <Button type="button" disabled={saveBusy} onClick={onSave}>
              {saveBusy ? <Spinner className="me-2" /> : null}
              {saveLabel}
            </Button>
          ) : null}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
