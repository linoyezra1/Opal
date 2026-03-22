import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/cn.js';

export function Spinner({ className }) {
  return <Loader2 className={cn('size-4 animate-spin', className)} />;
}
