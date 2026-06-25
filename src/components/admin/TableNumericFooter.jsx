import React from 'react';
import { TableCell, TableFooter, TableRow } from '../ui/table.jsx';

function formatTotal(value, format = 'number') {
  const n = Number(value || 0);
  if (format === 'currency') {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS',
      maximumFractionDigits: 0,
    }).format(n);
  }
  if (format === 'currency2') {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS',
      maximumFractionDigits: 2,
    }).format(n);
  }
  return String(Math.round(n));
}

function resolveNumeric(row, col) {
  if (typeof col.getValue === 'function') return Number(col.getValue(row) || 0);
  return Number(row?.[col.key] ?? 0);
}

/**
 * @param {{ columns: Array<{ key: string, format?: string, getValue?: Function }>, rows: Array, label?: string, leadingColSpan?: number }} props
 */
export default function TableNumericFooter({
  columns = [],
  rows = [],
  label = 'סה״כ',
  leadingColSpan = 1,
  trailingColSpan = 0,
}) {
  if (!columns.length) return null;

  const totals = columns.map((col) =>
    (rows || []).reduce((sum, row) => sum + resolveNumeric(row, col), 0)
  );

  return (
    <TableFooter>
      <TableRow className="bg-muted/60 font-semibold hover:bg-muted/60">
        {leadingColSpan > 0 ? (
          <TableCell colSpan={leadingColSpan} className="text-right text-sm">
            {label}
          </TableCell>
        ) : null}
        {columns.map((col, idx) => (
          <TableCell key={col.key || idx} className="text-right tabular-nums">
            {formatTotal(totals[idx], col.format)}
          </TableCell>
        ))}
        {trailingColSpan > 0 ? <TableCell colSpan={trailingColSpan} /> : null}
      </TableRow>
    </TableFooter>
  );
}
