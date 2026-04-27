import React from 'react';
import { Search, Filter, ChevronDown, ChevronUp, RotateCcw, X } from 'lucide-react';
import { Input } from '../ui/input.jsx';
import { Button } from '../ui/button.jsx';
export default function UnifiedFilterShell(props) {
  const {
    filters = null,
    values = null,
    onChange = null,
    onClear = null,
    resultsCount,
    totalCount,
    isLoading = false,
    className = '',
    searchValue = '',
    onSearchChange = null,
    searchPlaceholder = 'חיפוש...',
    basicControls = null,
    advancedContent = null,
  } = props;
  const [expanded, setExpanded] = React.useState(false);
  const hasNewApi = Array.isArray(filters) && values && typeof onChange === 'function';
  const searchFilter = hasNewApi ? filters.find((f) => f.key === 'search' || f.type === 'text') : null;
  const otherFilters = hasNewApi ? filters.filter((f) => !(f.key === (searchFilter?.key || '') || f.type === 'text')) : [];
  const resolvedSearchValue = hasNewApi ? String(values?.[searchFilter?.key] || '') : searchValue;
  const resolvedSearchPlaceholder = hasNewApi ? (searchFilter?.placeholder || searchPlaceholder) : searchPlaceholder;

  function updateValue(key, value) {
    if (!hasNewApi) return;
    onChange({ ...values, [key]: value });
  }

  return (
    <div className={`space-y-3 ${className}`} dir="rtl">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:flex-1 sm:min-w-[220px] sm:max-w-xl">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            value={resolvedSearchValue}
            onChange={(e) => {
              if (hasNewApi && searchFilter) updateValue(searchFilter.key, e.target.value);
              else onSearchChange?.(e.target.value);
            }}
            placeholder={resolvedSearchPlaceholder}
            className="h-10 pe-10 ps-9 bg-white border-slate-200 shadow-sm"
          />
          {resolvedSearchValue ? (
            <button
              type="button"
              onClick={() => {
                if (hasNewApi && searchFilter) updateValue(searchFilter.key, '');
                else onSearchChange?.('');
              }}
              className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="נקה חיפוש"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>

        {!hasNewApi ? basicControls : null}

        {(hasNewApi ? otherFilters.length > 0 : !!advancedContent) ? (
          <Button
            type="button"
            variant="outline"
            className={`h-10 gap-2 border-slate-200 bg-white shadow-sm ${expanded ? 'bg-slate-50 border-slate-300' : ''}`}
            onClick={() => setExpanded((v) => !v)}
          >
            <Filter className="size-4" />
            סינון
            {expanded ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
          </Button>
        ) : null}

        {resultsCount !== undefined && totalCount !== undefined ? (
          <div className="text-xs sm:text-sm text-muted-foreground w-full sm:w-auto text-center sm:text-right">
            {isLoading ? 'מחפש...' : resultsCount === totalCount ? `${totalCount} תוצאות` : `${resultsCount} מתוך ${totalCount}`}
          </div>
        ) : null}
      </div>

      {(hasNewApi ? otherFilters.length > 0 : !!advancedContent) && expanded ? (
        <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h4 className="text-sm font-medium text-slate-800">סינון מתקדם</h4>
            {onClear ? (
              <Button type="button" variant="ghost" size="sm" onClick={onClear} className="h-8 gap-1.5 text-muted-foreground">
                <RotateCcw className="size-3.5" />
                נקה הכל
              </Button>
            ) : null}
          </div>

          {hasNewApi ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {otherFilters.map((filter) => (
                <div key={filter.key} className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">{filter.label}</label>
                  {filter.type === 'select' && Array.isArray(filter.options) ? (
                    <select
                      value={String(values?.[filter.key] || '')}
                      onChange={(e) => updateValue(filter.key, e.target.value)}
                      className="h-9 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-1 text-sm"
                    >
                      <option value="">הכל</option>
                      {filter.options.map((opt) => (
                        <option key={`${filter.key}-${opt.value}`} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      type={
                        filter.type === 'date' || filter.type === 'dateRange'
                          ? 'date'
                          : filter.type === 'month'
                            ? 'month'
                            : 'text'
                      }
                      value={String(values?.[filter.key] || '')}
                      onChange={(e) => updateValue(filter.key, e.target.value)}
                      placeholder={filter.placeholder || ''}
                      className="h-9 bg-slate-50 border-slate-200 text-sm"
                    />
                  )}
                </div>
              ))}
            </div>
          ) : advancedContent}
        </div>
      ) : null}
    </div>
  );
}
