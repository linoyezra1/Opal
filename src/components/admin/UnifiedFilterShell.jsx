import React from 'react';
import { Search, Filter, ChevronDown, ChevronUp, RotateCcw, X } from 'lucide-react';
import { Input } from '../ui/input.jsx';
import { Button } from '../ui/button.jsx';

export default function UnifiedFilterShell(props) {
  const {
    filters = null,
    values = null,
    onChange = null,
    onApply = null,
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
    toolbarTrailing = null,
    hideSearchBar = false,
    applyLabel = 'חיפוש',
  } = props;

  const [expanded, setExpanded] = React.useState(false);
  const hasNewApi = Array.isArray(filters) && values && typeof onChange === 'function';
  const searchFilter = hasNewApi ? filters.find((f) => f.key === 'search' || f.type === 'text') : null;
  const otherFilters = hasNewApi ? filters.filter((f) => !(f.key === (searchFilter?.key || '') || f.type === 'text')) : [];
  const resolvedSearchPlaceholder = hasNewApi ? (searchFilter?.placeholder || searchPlaceholder) : searchPlaceholder;

  const [draft, setDraft] = React.useState(() => (hasNewApi ? { ...values } : {}));
  const [draftSearch, setDraftSearch] = React.useState(() => String(searchValue || ''));

  React.useEffect(() => {
    if (hasNewApi) setDraft({ ...values });
  }, [hasNewApi, values]);

  React.useEffect(() => {
    if (!hasNewApi) setDraftSearch(String(searchValue || ''));
  }, [hasNewApi, searchValue]);

  function updateDraft(key, value) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function handleApply() {
    if (hasNewApi) {
      onChange?.({ ...draft });
      onApply?.({ ...draft });
      return;
    }
    onSearchChange?.(draftSearch);
    onApply?.(draftSearch);
  }

  function handleClear() {
    if (hasNewApi && searchFilter) {
      const cleared = { ...values };
      for (const f of filters) cleared[f.key] = f.type === 'select' ? (f.key === 'status' ? 'all' : '') : '';
      setDraft(cleared);
    } else {
      setDraftSearch('');
    }
    onClear?.();
  }

  function handleSearchKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleApply();
    }
  }

  const resolvedDraftSearch = hasNewApi ? String(draft?.[searchFilter?.key] || '') : draftSearch;

  return (
    <div className={`space-y-3 ${className}`} dir="rtl">
      <div className="flex flex-wrap items-center gap-3">
        {!hideSearchBar ? (
          <div className="relative w-full sm:flex-1 sm:min-w-[220px] sm:max-w-xl">
            <Input
              value={resolvedDraftSearch}
              onChange={(e) => {
                if (hasNewApi && searchFilter) updateDraft(searchFilter.key, e.target.value);
                else setDraftSearch(e.target.value);
              }}
              onKeyDown={handleSearchKeyDown}
              placeholder={resolvedSearchPlaceholder}
              className="h-10 bg-white border-slate-200 shadow-sm"
            />
            {resolvedDraftSearch ? (
              <button
                type="button"
                onClick={() => {
                  if (hasNewApi && searchFilter) updateDraft(searchFilter.key, '');
                  else setDraftSearch('');
                }}
                className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="נקה טקסט חיפוש"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>
        ) : null}

        <Button
          type="button"
          className="h-10 gap-2 shrink-0"
          onClick={handleApply}
          disabled={isLoading}
        >
          <Search className={`size-4 ${isLoading ? 'animate-pulse' : ''}`} />
          {applyLabel}
        </Button>

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

        {toolbarTrailing ? <div className="flex shrink-0 items-center gap-2">{toolbarTrailing}</div> : null}
      </div>

      {(hasNewApi ? otherFilters.length > 0 : !!advancedContent) && expanded ? (
        <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h4 className="text-sm font-medium text-slate-800">סינון מתקדם</h4>
            {onClear ? (
              <Button type="button" variant="ghost" size="sm" onClick={handleClear} className="h-8 gap-1.5 text-muted-foreground">
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
                      value={String(draft?.[filter.key] ?? '')}
                      onChange={(e) => updateDraft(filter.key, e.target.value)}
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
                      value={String(draft?.[filter.key] || '')}
                      onChange={(e) => updateDraft(filter.key, e.target.value)}
                      onKeyDown={handleSearchKeyDown}
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
