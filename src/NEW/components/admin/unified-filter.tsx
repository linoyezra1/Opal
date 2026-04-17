'use client'

import { useState, useCallback } from 'react'
import { 
  Search, Filter, X, ChevronDown, ChevronUp, RotateCcw 
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'

// Opal Brand Colors
const OPAL_BLUE = '#1A365D'
const OPAL_GOLD = '#C5A059'

export interface FilterOption {
  value: string
  label: string
}

export interface FilterConfig {
  key: string
  label: string
  type: 'text' | 'select' | 'date' | 'dateRange'
  placeholder?: string
  options?: FilterOption[]
  icon?: React.ReactNode
}

export interface FilterValues {
  [key: string]: string
}

interface UnifiedFilterProps {
  filters: FilterConfig[]
  values: FilterValues
  onChange: (values: FilterValues) => void
  onClear: () => void
  resultsCount?: number
  totalCount?: number
  isLoading?: boolean
  className?: string
}

export function UnifiedFilter({
  filters,
  values,
  onChange,
  onClear,
  resultsCount,
  totalCount,
  isLoading = false,
  className,
}: UnifiedFilterProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  // Count active filters (excluding empty values)
  const activeFiltersCount = Object.values(values).filter(v => v && v.trim() !== '').length
  
  // Get active filter labels for display
  const activeFilters = filters
    .filter(f => values[f.key] && values[f.key].trim() !== '')
    .map(f => {
      const value = values[f.key]
      if (f.type === 'select' && f.options) {
        const option = f.options.find(o => o.value === value)
        return { key: f.key, label: f.label, value: option?.label || value }
      }
      return { key: f.key, label: f.label, value }
    })
  
  const handleChange = useCallback((key: string, value: string) => {
    onChange({ ...values, [key]: value })
  }, [values, onChange])
  
  const handleRemoveFilter = useCallback((key: string) => {
    onChange({ ...values, [key]: '' })
  }, [values, onChange])
  
  const searchFilter = filters.find(f => f.key === 'search' || f.type === 'text')
  const otherFilters = filters.filter(f => f.key !== 'search' && f.type !== 'text')
  
  return (
    <div className={cn('space-y-3', className)}>
      {/* Main Search Bar */}
      <div className="flex items-center gap-3">
        {/* Search Input */}
        {searchFilter && (
          <div className="relative flex-1 max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              value={values[searchFilter.key] || ''}
              onChange={(e) => handleChange(searchFilter.key, e.target.value)}
              placeholder={searchFilter.placeholder || 'חיפוש...'}
              className="pr-10 h-10 bg-white border-slate-200 focus:border-slate-300 focus:ring-1 focus:ring-slate-200 shadow-sm"
            />
            {values[searchFilter.key] && (
              <button
                onClick={() => handleChange(searchFilter.key, '')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        )}
        
        {/* Filter Toggle Button */}
        {otherFilters.length > 0 && (
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            <CollapsibleTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'h-10 gap-2 border-slate-200 bg-white shadow-sm hover:bg-slate-50 transition-all',
                  isExpanded && 'bg-slate-50 border-slate-300'
                )}
              >
                <Filter className="size-4" />
                <span>סינון</span>
                {activeFiltersCount > 0 && (
                  <Badge 
                    variant="secondary" 
                    className="size-5 p-0 flex items-center justify-center text-xs rounded-full"
                    style={{ backgroundColor: OPAL_GOLD, color: 'white' }}
                  >
                    {activeFiltersCount}
                  </Badge>
                )}
                {isExpanded ? (
                  <ChevronUp className="size-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="size-4 text-muted-foreground" />
                )}
              </Button>
            </CollapsibleTrigger>
          </Collapsible>
        )}
        
        {/* Results Count */}
        {resultsCount !== undefined && totalCount !== undefined && (
          <div className="text-sm text-muted-foreground hidden sm:block">
            {isLoading ? (
              <span className="animate-pulse">מחפש...</span>
            ) : (
              <span>
                {resultsCount === totalCount 
                  ? `${totalCount} תוצאות` 
                  : `${resultsCount} מתוך ${totalCount}`
                }
              </span>
            )}
          </div>
        )}
      </div>
      
      {/* Expandable Filter Panel */}
      {otherFilters.length > 0 && (
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleContent className="overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2">
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm mt-2">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-medium" style={{ color: OPAL_BLUE }}>
                  סינון מתקדם
                </h4>
                {activeFiltersCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClear}
                    className="h-8 text-muted-foreground hover:text-foreground gap-1.5"
                  >
                    <RotateCcw className="size-3.5" />
                    נקה הכל
                  </Button>
                )}
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {otherFilters.map((filter) => (
                  <div key={filter.key} className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      {filter.label}
                    </label>
                    {filter.type === 'select' && filter.options ? (
                      <Select
                        value={values[filter.key] || 'all'}
                        onValueChange={(value) => handleChange(filter.key, value === 'all' ? '' : value)}
                      >
                        <SelectTrigger className="h-9 bg-slate-50 border-slate-200 text-sm">
                          <SelectValue placeholder={`בחר ${filter.label}`} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">הכל</SelectItem>
                          {filter.options.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : filter.type === 'date' ? (
                      <Input
                        type="date"
                        value={values[filter.key] || ''}
                        onChange={(e) => handleChange(filter.key, e.target.value)}
                        className="h-9 bg-slate-50 border-slate-200 text-sm"
                      />
                    ) : (
                      <Input
                        value={values[filter.key] || ''}
                        onChange={(e) => handleChange(filter.key, e.target.value)}
                        placeholder={filter.placeholder}
                        className="h-9 bg-slate-50 border-slate-200 text-sm"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
      
      {/* Active Filters Tags */}
      {activeFilters.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">מסננים פעילים:</span>
          {activeFilters.map((filter) => (
            <Badge
              key={filter.key}
              variant="secondary"
              className="gap-1.5 h-7 pl-1.5 pr-2.5 bg-slate-100 hover:bg-slate-200 cursor-pointer transition-colors"
              onClick={() => handleRemoveFilter(filter.key)}
            >
              <span className="text-muted-foreground">{filter.label}:</span>
              <span className="font-medium">{filter.value}</span>
              <X className="size-3 text-muted-foreground hover:text-foreground" />
            </Badge>
          ))}
          <button
            onClick={onClear}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            נקה הכל
          </button>
        </div>
      )}
    </div>
  )
}
