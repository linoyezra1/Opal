import * as React from 'react';
import { cn } from '../../lib/cn.js';

export function Empty({ className, ...props }) {
  return <div className={cn('flex min-h-[200px] flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center', className)} {...props} />;
}

export function EmptyMedia({ className, variant, children, ...props }) {
  return (
    <div
      className={cn('mb-4 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground', variant === 'icon' && className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function EmptyTitle({ className, ...props }) {
  return <h3 className={cn('text-lg font-semibold', className)} {...props} />;
}

export function EmptyDescription({ className, ...props }) {
  return <p className={cn('text-sm text-muted-foreground', className)} {...props} />;
}
