import React from 'react';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Truck,
  ArrowLeftRight,
  FileText,
  Wallet,
  Archive,
  Settings,
  BookOpen,
  Layers,
} from 'lucide-react';
import { AppMode } from '../../shared/types';
import { APP_NAME, APP_VERSION } from '../data/changelog';

export type NavPage =
  | 'dashboard'
  | 'master'
  | 'orders'
  | 'delivery_notes'
  | 'mutasi'
  | 'invoices'
  | 'payments'
  | 'backup'
  | 'settings'
  | 'docs';

interface SidebarProps {
  activePage: NavPage;
  onNavigate: (page: NavPage) => void;
  appMode: AppMode;
  companyName: string;
  onQuickSwitchMode: (mode: AppMode) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activePage,
  onNavigate,
  appMode,
  companyName,
  onQuickSwitchMode,
}) => {
  const showGudang = appMode === 'mode_1_gudang' || appMode === 'all';
  const showFinance = appMode === 'mode_2_finance' || appMode === 'all';

  const navItems: Array<{
    id: NavPage;
    label: string;
    icon: React.ReactNode;
    visible: boolean;
    badge?: string;
  }> = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <LayoutDashboard className="h-4 w-4" />,
      visible: true,
    },
    {
      id: 'master',
      label: 'Master Data',
      icon: <Package className="h-4 w-4" />,
      visible: true,
    },
    {
      id: 'orders',
      label: 'Purchase & Sales Order',
      icon: <ShoppingCart className="h-4 w-4" />,
      visible: showGudang,
      badge: 'Mode 1',
    },
    {
      id: 'delivery_notes',
      label: 'Surat Jalan',
      icon: <Truck className="h-4 w-4" />,
      visible: showGudang,
      badge: 'Mode 1',
    },
    {
      id: 'mutasi',
      label: 'Mutasi Stok Barang',
      icon: <ArrowLeftRight className="h-4 w-4" />,
      visible: showGudang,
      badge: 'Mode 1',
    },
    {
      id: 'invoices',
      label: 'Invoice (Hutang/Piutang)',
      icon: <FileText className="h-4 w-4" />,
      visible: showFinance,
      badge: 'Mode 2',
    },
    {
      id: 'payments',
      label: 'Pelunasan & FIFO',
      icon: <Wallet className="h-4 w-4" />,
      visible: showFinance,
      badge: 'Mode 2',
    },
    {
      id: 'backup',
      label: 'Backup & Export Data',
      icon: <Archive className="h-4 w-4" />,
      visible: true,
    },
    {
      id: 'settings',
      label: 'Template & Pengaturan',
      icon: <Settings className="h-4 w-4" />,
      visible: true,
    },
    {
      id: 'docs',
      label: 'Panduan & Versi',
      icon: <BookOpen className="h-4 w-4" />,
      visible: true,
    },
  ];

  return (
    <aside className="flex h-screen w-64 flex-shrink-0 flex-col border-r border-slate-800 bg-slate-900 text-slate-200">
      <div className="border-b border-slate-800 p-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white font-bold">
            <Layers className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-white">{companyName}</p>
            <p className="text-[11px] text-slate-400">{APP_NAME} â€¢ v{APP_VERSION}</p>
          </div>
        </div>
        <div className="mt-3">
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Mode Operasi Divisi
          </label>
          <select
            value={appMode}
            onChange={(e) => onQuickSwitchMode(e.target.value as AppMode)}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-white focus:border-blue-500 focus:outline-none"
          >
            <option value="all">Semua Modul (Gabungan)</option>
            <option value="mode_1_gudang">Mode 1: Order & Gudang</option>
            <option value="mode_2_finance">Mode 2: Finance / Accounting</option>
          </select>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navItems
          .filter((item) => item.visible)
          .map((item) => {
            const active = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                  active
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  {item.icon}
                  <span>{item.label}</span>
                </span>
                {item.badge && appMode === 'all' && (
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                      active ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
      </nav>
      <div className="border-t border-slate-800 p-3 text-[11px] text-slate-400">
        <div className="flex items-center justify-between">
          <span>{APP_NAME} v{APP_VERSION}</span>
          <span className="inline-flex items-center gap-1 text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400"></span> Offline Ready
          </span>
        </div>
      </div>
    </aside>
  );
};
