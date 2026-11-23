import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

export interface SearchableOption {
  value: number | string;
  label: string;
  sublabel?: string;
  searchText?: string;
}

interface SearchableSelectProps {
  options: SearchableOption[];
  value: number | string | null;
  onChange: (value: number | string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  required?: boolean;
  compact?: boolean;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = '-- Pilih --',
  searchPlaceholder = 'Ketik untuk mencari...',
  required = false,
  compact = false,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((opt) => String(opt.value) === String(value ?? ''));

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [open]);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? options.filter((opt) => {
        const haystack = (opt.searchText || `${opt.label} ${opt.sublabel || ''}`).toLowerCase();
        return haystack.includes(q);
      })
    : options;

  return (
    <div ref={containerRef} className="relative w-full">
      {required && (
        <input
          tabIndex={-1}
          aria-hidden="true"
          required
          value={selectedOption ? String(selectedOption.value) : ''}
          onChange={() => {}}
          className="pointer-events-none absolute inset-0 h-0 w-0 opacity-0"
        />
      )}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white text-left transition-colors hover:border-slate-400 focus:border-blue-500 focus:outline-none ${
          compact ? 'rounded px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'
        }`}
      >
        <span className={`truncate ${selectedOption ? 'text-slate-900' : 'text-slate-400'}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={`h-4 w-4 flex-shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 z-50 mt-1 w-full min-w-[240px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center gap-1.5 border-b border-slate-200 bg-slate-50 px-2.5 py-1.5">
            <Search className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setOpen(false);
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  if (filtered.length > 0) {
                    onChange(filtered[0].value);
                    setOpen(false);
                  }
                }
              }}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-2.5 text-center text-xs text-slate-400">
                Data tidak ditemukan
              </div>
            ) : (
              filtered.map((opt) => {
                const isSelected = String(opt.value) === String(value ?? '');
                return (
                  <button
                    key={String(opt.value)}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                    className={`flex w-full flex-col px-3 py-1.5 text-left text-xs transition-colors ${
                      isSelected
                        ? 'bg-blue-50 font-semibold text-blue-700'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="truncate">{opt.label}</span>
                    {opt.sublabel && (
                      <span className="truncate text-[11px] text-slate-400">{opt.sublabel}</span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
