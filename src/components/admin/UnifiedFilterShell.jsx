import React from 'react';
import { Search, Filter, ChevronDown, ChevronUp, RotateCcw, X } from 'lucide-react';
import { Input } from '../ui/input.jsx';
import { Button } from '../ui/button.jsx';
import { Badge } from '../ui/badge.jsx';

export default function UnifiedFilterShell({
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'חיפוש...',
  activeCount = 0,
  onClear,
  basicControls,
  advancedContent = null,
  className = '',
}) {
  const [expanded, setExpanded] = React.useState(false);
  return (
    <div className={`space-y-3 ${className}`} dir="rtl">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-xl">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            value={searchValue}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-10 pe-10 ps-9 bg-white border-slate-200 shadow-sm"
          />
          {searchValue ? (
            <button
              type="button"
              onClick={() => onSearchChange?.('')}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="נקה חיפוש"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>
        {basicControls}
        {advancedContent ? (
          <Button
            type="button"
            variant="outline"
            className={`h-10 gap-2 border-slate-200 bg-white shadow-sm ${expanded ? 'bg-slate-50 border-slate-300' : ''}`}
            onClick={() => setExpanded((v) => !v)}
          >
            <Filter className="size-4" />
            סינון מתקדם
            {activeCount > 0 ? (
              <Badge className="size-5 p-0 rounded-full bg-blue-600 text-white flex items-center justify-center">{activeCount}</Badge>
            ) : null}
            {expanded ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
          </Button>
        ) : null}
      </div>
      {advancedContent && expanded ? (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h4 className="text-sm font-medium text-slate-800">סינון מתקדם</h4>
            {onClear ? (
              <Button type="button" variant="ghost" size="sm" onClick={onClear} className="h-8 gap-1.5 text-muted-foreground">
                <RotateCcw className="size-3.5" />
                נקה הכל
              </Button>
            ) : null}
          </div>
          {advancedContent}
        </div>
      ) : null}
    </div>
  );
}
