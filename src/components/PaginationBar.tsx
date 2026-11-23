import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationBarProps {
  totalItems: number;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  itemLabel?: string;
}

export const PaginationBar: React.FC<PaginationBarProps> = ({
  totalItems,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange,
  itemLabel = 'data',
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const startIdx = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endIdx = Math.min(totalItems, safePage * pageSize);

  const getPageNumbers = (): (number | 'ellipsis')[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | 'ellipsis')[] = [1];
    if (safePage > 3) pages.push('ellipsis');
    const from = Math.max(2, safePage - 1);
    const to = Math.min(totalPages - 1, safePage + 1);
    for (let p = from; p <= to; p++) pages.push(p);
    if (safePage < totalPages - 2) pages.push('ellipsis');
    pages.push(totalPages);
    return pages;
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/70 px-4 py-3 text-xs text-slate-600">
      <div className="flex flex-wrap items-center gap-3">
        <span>
          Menampilkan <strong className="text-slate-900">{startIdx}</strong> -{' '}
          <strong className="text-slate-900">{endIdx}</strong> dari{' '}
          <strong className="text-slate-900">{totalItems}</strong> {itemLabel}
        </span>
        <div className="flex items-center gap-1.5">
          <span>Per halaman:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              onPageSizeChange(Number(e.target.value));
              onPageChange(1);
            }}
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 focus:border-blue-500 focus:outline-none"
          >
            {[10, 20, 50, 100].map((sz) => (
              <option key={sz} value={sz}>
                {sz}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          className="flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Prev
        </button>

        {getPageNumbers().map((item, idx) =>
          item === 'ellipsis' ? (
            <span key={`el-${idx}`} className="px-2 text-slate-400">
              ...
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => onPageChange(item)}
              className={`min-w-[28px] rounded-md px-2 py-1 font-semibold transition-colors ${
                item === safePage
                  ? 'bg-slate-900 text-white'
                  : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              {item}
            </button>
          )
        )}

        <button
          type="button"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(safePage + 1)}
          className="flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};
