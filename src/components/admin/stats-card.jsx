import { TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card.jsx';
import { cn } from '../../lib/cn.js';

/**
 * כרטיס סטטיסטיקה — תואם ל־_New_Backup/components/admin/stats-card
 */
export function StatsCard({ title, value, icon: Icon, trend, className, loading }) {
  const isPositive = trend && trend.value >= 0;

  return (
    <Card className={cn('relative overflow-hidden', className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4" />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-8 w-24 animate-pulse rounded bg-muted" />
        ) : (
          <>
            <div className="text-2xl font-bold tabular-nums">{value}</div>
            {trend && (
              <div className="mt-1 flex items-center gap-1 text-xs">
                {isPositive ? (
                  <TrendingUp className="size-3 text-emerald-600" />
                ) : (
                  <TrendingDown className="size-3 text-destructive" />
                )}
                <span className={cn('font-medium', isPositive ? 'text-emerald-600' : 'text-destructive')}>
                  {isPositive ? '+' : ''}
                  {trend.value}%
                </span>
                <span className="text-muted-foreground">{trend.label}</span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
