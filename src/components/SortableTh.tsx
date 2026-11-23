import React from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

export type SortDirection = 'asc' | 'desc';

export interface SortConfig<K extends string = string> {
  key: K;
  direction: SortDirection;
}

export function toggleSort<K extends string>(current: SortConfig<K> | null, key: K): SortConfig<K> {
  if (current && current.key === key) {
    return {
      key,
      direction: current.direction === 'asc' ? 'desc' : 'asc',
    };
  }
  // Default saat pertama kali diklik: tanggal & nominal lebih intuitif mulai dari desc (terbaru/terbesar), kode/nomor/nama mulai asc
  const defaultDir: SortDirection =
    key === 'no' || key === 'kode' || key === 'part_number' || key === 'nama' ? 'asc' : 'desc';
  return { key, direction: defaultDir };
}

export function compareStringsNatural(a: string, b: string): number {
  return String(a || '').localeCompare(String(b || ''), 'id', {
    numeric: true,
    sensitivity: 'base',
  });
}

interface SortableThProps<K extends string> {
  label: string;
  sortKey: K;
  sortConfig: SortConfig<K> | null;
  onSort: (key: K) => void;
  align?: 'left' | 'right' | 'center';
  className?: string;
}

export function SortableTh<K extends string>({
  label,
  sortKey,
  sortConfig,
  onSort,
  align = 'left',
  className = '',
}: SortableThProps<K>) {
  const isActive = sortConfig?.key === sortKey;
  const direction = isActive ? sortConfig?.direction : null;

  const justifyClass =
    align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start';

  return (
    <th className={`px-4 py-3 select-none ${className}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        title={`Urutkan berdasarkan ${label} (${
          isActive && direction === 'asc' ? 'Descending' : 'Ascending'
        })`}
        className={`group inline-flex w-full items-center gap-1.5 font-semibold uppercase transition-colors hover:text-blue-600 ${justifyClass} ${
          isActive ? 'text-blue-700' : 'text-inherit'
        }`}
      >
        <span>{label}</span>
        <span
          className={`inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded transition-colors ${
            isActive
              ? 'bg-blue-100 text-blue-700'
              : 'text-slate-400 group-hover:bg-slate-200/70 group-hover:text-slate-600'
          }`}
        >
          {direction === 'asc' ? (
            <ArrowUp className="h-3 w-3" />
          ) : direction === 'desc' ? (
            <ArrowDown className="h-3 w-3" />
          ) : (
            <ArrowUpDown className="h-3 w-3" />
          )}
        </span>
      </button>
    </th>
  );
}
