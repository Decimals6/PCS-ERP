import React, { useEffect, useState } from 'react';
import {
  Archive,
  Calendar,
  CheckSquare,
  Database,
  Download,
  FileSpreadsheet,
  FileText,
  Square,
  Upload,
  CheckCircle2,
} from 'lucide-react';
import {
  AppMode,
  ExportDatasetKey,
  HumanBackupPreviewCounts,
  HumanBackupResult,
} from '../../shared/types';

interface BackupExportPageProps {
  appMode: AppMode;
}

interface DatasetOption {
  key: ExportDatasetKey;
  label: string;
  description: string;
  group: 'gudang' | 'finance' | 'master';
  hasDateFilter: boolean;
}

const DATASET_OPTIONS: DatasetOption[] = [
  {
    key: 'po',
    label: 'Purchase Order (PO - Masuk)',
    description: 'Header PO, Supplier, rincian barang, qty order/terkirim, harga & total',
    group: 'gudang',
    hasDateFilter: true,
  },
  {
    key: 'so',
    label: 'Sales Order (SO - Keluar)',
    description: 'Header SO, Customer, rincian barang, qty order/terkirim, harga & total',
    group: 'gudang',
    hasDateFilter: true,
  },
  {
    key: 'sj_in',
    label: 'Surat Jalan Masuk (Penerimaan)',
    description: 'SJ penerimaan barang dari Supplier beserta kode & nama barang',
    group: 'gudang',
    hasDateFilter: true,
  },
  {
    key: 'sj_out',
    label: 'Surat Jalan Keluar (Pengiriman)',
    description: 'SJ pengiriman barang ke Customer beserta kode & nama barang',
    group: 'gudang',
    hasDateFilter: true,
  },
  {
    key: 'mutasi',
    label: 'Mutasi Stok Barang',
    description: 'Log pergerakan stok masuk/keluar, stok sebelum & sesudah',
    group: 'gudang',
    hasDateFilter: true,
  },
  {
    key: 'invoice_in',
    label: 'Invoice Pembelian / Hutang (IN)',
    description: 'Tagihan dari Supplier, detail item barang, PPN, ongkir & status lunas',
    group: 'finance',
    hasDateFilter: true,
  },
  {
    key: 'invoice_out',
    label: 'Invoice Penjualan / Piutang (OUT)',
    description: 'Tagihan ke Customer, detail item barang, PPN, ongkir & status lunas',
    group: 'finance',
    hasDateFilter: true,
  },
  {
    key: 'payment_in',
    label: 'Pelunasan Piutang Customer (IN)',
    description: 'Bukti uang masuk, alokasi per nomor invoice, serta potongan bank',
    group: 'finance',
    hasDateFilter: true,
  },
  {
    key: 'payment_out',
    label: 'Pembayaran Hutang Supplier (OUT)',
    description: 'Bukti pembayaran hutang, alokasi per nomor invoice, serta potongan bank',
    group: 'finance',
    hasDateFilter: true,
  },
  {
    key: 'master_barang',
    label: 'Master Data Barang & Stok Akhir',
    description: 'Daftar seluruh kode barang, part number, satuan, supplier & stok saat ini',
    group: 'master',
    hasDateFilter: false,
  },
  {
    key: 'master_customer',
    label: 'Master Data Customer',
    description: 'Daftar seluruh kode, nama, UP, telepon, email & alamat customer',
    group: 'master',
    hasDateFilter: false,
  },
  {
    key: 'master_supplier',
    label: 'Master Data Supplier',
    description: 'Daftar seluruh kode, nama, UP, telepon, email & alamat supplier',
    group: 'master',
    hasDateFilter: false,
  },
];

function formatDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const BackupExportPage: React.FC<BackupExportPageProps> = ({ appMode }) => {
  const [startDate, setStartDate] = useState<string>(() => {
    const now = new Date();
    return formatDateLocal(new Date(now.getFullYear(), now.getMonth(), 1));
  });
  const [endDate, setEndDate] = useState<string>(() => formatDateLocal(new Date()));
  const [format, setFormat] = useState<'xlsx' | 'csv'>('xlsx');
  const [selectedKeys, setSelectedKeys] = useState<ExportDatasetKey[]>(() => {
    if (appMode === 'mode_1_gudang') return ['po', 'so', 'sj_in', 'sj_out'];
    if (appMode === 'mode_2_finance') return ['invoice_in', 'invoice_out', 'payment_in', 'payment_out'];
    return ['po', 'so', 'sj_in', 'sj_out', 'invoice_in', 'invoice_out'];
  });
  const [counts, setCounts] = useState<HumanBackupPreviewCounts | null>(null);
  const [dbPath, setDbPath] = useState<string>('');
  const [exporting, setExporting] = useState(false);
  const [lastResult, setLastResult] = useState<HumanBackupResult | null>(null);

  const loadCounts = async (sDate: string, eDate: string) => {
    const res = await window.api.previewHumanBackupCounts(sDate || undefined, eDate || undefined);
    setCounts(res);
  };

  useEffect(() => {
    window.api.getDbPath().then(setDbPath);
  }, []);

  useEffect(() => {
    loadCounts(startDate, endDate);
  }, [startDate, endDate]);

  const applyPresetRange = (preset: 'this_month' | 'last_month' | 'this_year' | 'all') => {
    const now = new Date();
    if (preset === 'this_month') {
      setStartDate(formatDateLocal(new Date(now.getFullYear(), now.getMonth(), 1)));
      setEndDate(formatDateLocal(now));
    } else if (preset === 'last_month') {
      const firstPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastPrev = new Date(now.getFullYear(), now.getMonth(), 0);
      setStartDate(formatDateLocal(firstPrev));
      setEndDate(formatDateLocal(lastPrev));
    } else if (preset === 'this_year') {
      setStartDate(`${now.getFullYear()}-01-01`);
      setEndDate(formatDateLocal(now));
    } else {
      setStartDate('');
      setEndDate('');
    }
  };

  const toggleKey = (key: ExportDatasetKey) => {
    setSelectedKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const selectGroup = (group: 'gudang' | 'finance' | 'master' | 'all' | 'none') => {
    if (group === 'none') {
      setSelectedKeys([]);
      return;
    }
    if (group === 'all') {
      setSelectedKeys(DATASET_OPTIONS.map((d) => d.key));
      return;
    }
    const groupKeys = DATASET_OPTIONS.filter((d) => d.group === group).map((d) => d.key);
    setSelectedKeys((prev) => {
      const allSelected = groupKeys.every((k) => prev.includes(k));
      if (allSelected) return prev.filter((k) => !groupKeys.includes(k));
      return Array.from(new Set([...prev, ...groupKeys]));
    });
  };

  const handleExportHuman = async () => {
    if (selectedKeys.length === 0) {
      alert('Pilih minimal satu jenis data yang ingin di-backup.');
      return;
    }
    setExporting(true);
    try {
      const res = await window.api.exportHumanBackup({
        format,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        datasets: selectedKeys,
      });
      if (res.saved) {
        setLastResult(res);
      }
    } catch (err: any) {
      alert('Gagal melakukan export backup: ' + (err?.message || String(err)));
    } finally {
      setExporting(false);
    }
  };

  const handleBackupDb = async () => {
    const res = await window.api.backupDatabase();
    if (res.saved) {
      alert('Backup database SQLite (.db) berhasil disimpan ke:\n' + res.filePath);
    }
  };

  const handleRestoreDb = async () => {
    if (
      !confirm(
        'Restore database akan menimpa seluruh data saat ini dengan file backup .db yang dipilih. Lanjutkan?'
      )
    ) {
      return;
    }
    const res = await window.api.restoreDatabase();
    if (res.restored) {
      alert('Database berhasil di-restore! Aplikasi akan memuat ulang data.');
      window.location.reload();
    }
  };

  const renderGroupCard = (title: string, group: 'gudang' | 'finance' | 'master', badgeColor: string) => {
    const items = DATASET_OPTIONS.filter((d) => d.group === group);
    const allChecked = items.every((i) => selectedKeys.includes(i.key));

    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${badgeColor}`} />
            <h3 className="text-sm font-bold text-slate-800">{title}</h3>
          </div>
          <button
            type="button"
            onClick={() => selectGroup(group)}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700"
          >
            {allChecked ? 'Batal Pilih Semua' : 'Pilih Semua'}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
          {items.map((item) => {
            const checked = selectedKeys.includes(item.key);
            const docCount = counts ? counts[item.key] : 0;
            return (
              <div
                key={item.key}
                onClick={() => toggleKey(item.key)}
                className={`cursor-pointer rounded-lg border p-3 transition-all ${
                  checked
                    ? 'border-blue-500 bg-blue-50/60 ring-1 ring-blue-500/30'
                    : 'border-slate-200 bg-slate-50/40 hover:border-slate-300 hover:bg-white'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 text-blue-600">
                    {checked ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4 text-slate-400" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold text-slate-900">{item.label}</p>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          docCount > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {docCount} {item.hasDateFilter ? 'dok' : 'data'}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{item.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold text-slate-900">
            <Archive className="h-6 w-6 text-blue-600" />
            Pusat Backup &amp; Export Data
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Pisahkan backup sistem penuh (<code>.db</code>) dengan arsip laporan Excel / CSV yang terbaca manusia (sudah
            dilengkapi nama partner &amp; rincian nama barang).
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* KOLOM KIRI (2/3): BACKUP EXCEL / CSV TERBACA MANUSIA */}
        <div className="space-y-5 xl:col-span-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                <div>
                  <h2 className="text-base font-bold text-slate-800">
                    1. Backup Arsip Terbaca Manusia (Excel / CSV)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Pilih rentang tanggal transaksi dan centang jenis data yang ingin di-export.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => selectGroup('all')}
                  className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Centang Semua
                </button>
                <button
                  type="button"
                  onClick={() => selectGroup('none')}
                  className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Kosongkan
                </button>
              </div>
            </div>

            {/* FILTER TANGGAL & FORMAT */}
            <div className="grid grid-cols-1 gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-12">
              <div className="sm:col-span-4">
                <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                  <Calendar className="h-3.5 w-3.5 text-blue-600" />
                  Dari Tanggal
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </div>

              <div className="sm:col-span-4">
                <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                  <Calendar className="h-3.5 w-3.5 text-blue-600" />
                  Sampai Tanggal
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </div>

              <div className="sm:col-span-4">
                <label className="mb-1 block text-xs font-semibold text-slate-700">Format File Output</label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value as 'xlsx' | 'csv')}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium"
                >
                  <option value="xlsx">Excel (.xlsx) â€” Multi-Sheet</option>
                  <option value="csv">CSV (.csv) â€” Terpisah per File</option>
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:col-span-12">
                <span className="text-xs font-medium text-slate-500">Preset Tanggal:</span>
                <button
                  type="button"
                  onClick={() => applyPresetRange('this_month')}
                  className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  Bulan Ini
                </button>
                <button
                  type="button"
                  onClick={() => applyPresetRange('last_month')}
                  className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  Bulan Lalu
                </button>
                <button
                  type="button"
                  onClick={() => applyPresetRange('this_year')}
                  className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  Tahun Ini
                </button>
                <button
                  type="button"
                  onClick={() => applyPresetRange('all')}
                  className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  Semua Waktu (Tanpa Batas)
                </button>
              </div>
            </div>

            {/* PILIHAN DATASET */}
            <div className="space-y-4">
              {renderGroupCard('Data Operasional Gudang & Order', 'gudang', 'bg-blue-500')}
              {renderGroupCard('Data Finance, Tagihan & Pelunasan', 'finance', 'bg-emerald-500')}
              {renderGroupCard('Snapshot Master Data (Tidak Terpengaruh Filter Tanggal)', 'master', 'bg-amber-500')}
            </div>

            {/* ACTION EXPORT */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <div className="text-xs text-slate-600">
                Terpilih: <span className="font-bold text-slate-900">{selectedKeys.length}</span> jenis data â€¢{' '}
                {format === 'xlsx'
                  ? 'Disimpan menjadi 1 file Excel berisi sheet terpisah per data'
                  : selectedKeys.length > 1
                    ? 'Disimpan ke dalam 1 folder berisi beberapa file .csv terpisah'
                    : 'Disimpan menjadi 1 file .csv'}
              </div>

              <button
                type="button"
                disabled={exporting || selectedKeys.length === 0}
                onClick={handleExportHuman}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {format === 'xlsx' ? <FileSpreadsheet className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                {exporting
                  ? 'Memproses Export...'
                  : format === 'xlsx'
                    ? 'Download Backup Excel (.xlsx)'
                    : 'Download Backup CSV (.csv)'}
              </button>
            </div>

            {lastResult && lastResult.saved && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-900 space-y-2">
                <div className="flex items-center gap-2 font-bold text-emerald-800">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>Backup Berhasil Disimpan!</span>
                </div>
                <p className="font-mono text-[11px] break-all text-emerald-800">Lokasi: {lastResult.filePath}</p>
                {lastResult.sheetSummary && lastResult.sheetSummary.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {lastResult.sheetSummary.map((s) => (
                      <span
                        key={s.key}
                        className="rounded bg-white px-2 py-0.5 text-[11px] font-medium text-emerald-800 border border-emerald-200"
                      >
                        {s.label}: <b>{s.rows}</b> baris
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* KOLOM KANAN (1/3): BACKUP & RESTORE DATABASE SISTEM (.DB) */}
        <div className="space-y-5">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b pb-3">
              <Database className="h-5 w-5 text-blue-600" />
              <div>
                <h2 className="text-base font-bold text-slate-800">2. Backup Sistem Penuh (.db)</h2>
                <p className="text-xs text-slate-500">Untuk pemulihan total aplikasi (Disaster Recovery)</p>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-slate-600">
              File <code>.db</code> menyimpan seluruh database SQLite mentah beserta seluruh relasi internal dan template
              PDF. Gunakan file ini jika ingin memindahkan aplikasi ke PC baru atau memulihkan sistem dari nol.
            </p>

            <div className="rounded-lg bg-slate-50 p-3 font-mono text-[11px] text-slate-600 break-all border border-slate-200">
              <span className="font-sans font-semibold text-slate-700">Lokasi Database Aktif:</span>
              <br />
              {dbPath || '-'}
            </div>

            <div className="space-y-2.5 pt-1">
              <button
                type="button"
                onClick={handleBackupDb}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
              >
                <Download className="h-4 w-4" />
                Backup Database Sistem (.db)
              </button>
              <button
                type="button"
                onClick={handleRestoreDb}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-rose-300 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-100"
              >
                <Upload className="h-4 w-4" />
                Restore dari File (.db)
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-900 space-y-1.5">
            <p className="font-bold">Tips Keamanan Data Offline:</p>
            <ul className="list-disc pl-4 space-y-1 text-amber-800">
              <li>
                Simpan file <b>.db</b> secara rutin ke flashdisk atau Google Drive sebagai cadangan pemulihan sistem.
              </li>
              <li>
                Export <b>.xlsx</b> setiap akhir bulan untuk arsip laporan audit yang mudah dibuka tanpa aplikasi.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
