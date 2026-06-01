import React from 'react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog.jsx';
import { Button } from './ui/button.jsx';
import { Spinner } from './ui/spinner.jsx';

/** דיאלוג אישור — תואם לשימוש קודם + תמיכה ב-loading אופציונלית */
export default function ConfirmDialog({
  open,
  title,
  message,
  error = '',
  confirmLabel = 'אישור',
  danger,
  onConfirm,
  onCancel,
  isLoading = false,
}) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && onCancel) onCancel();
      }}
    >
      <AlertDialogContent className="dir-rtl" dir="rtl">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>{message}</p>
              {error ? (
                <p
                  className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive font-medium"
                  role="alert"
                >
                  {error}
                </p>
              ) : null}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse">
          <AlertDialogCancel asChild>
            <Button type="button" variant="outline" disabled={isLoading} onClick={onCancel}>
              ביטול
            </Button>
          </AlertDialogCancel>
          <Button
            type="button"
            variant={danger ? 'destructive' : 'default'}
            disabled={isLoading}
            onClick={() => onConfirm?.()}
          >
            {isLoading && <Spinner className="me-2" />}
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
