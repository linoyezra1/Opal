import * as React from 'react';
import { cn } from '../../lib/cn.js';

export function FieldGroup({ className, ...props }) {
  return <div className={cn('grid w-full gap-4', className)} {...props} />;
}

export function Field({ className, ...props }) {
  return <div className={cn('grid w-full gap-2', className)} {...props} />;
}

export function FieldLabel({ className, ...props }) {
  return (
    <label className={cn('block w-full text-start text-sm font-medium leading-none', className)} {...props} />
  );
}
