import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  GitCommit,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Wrench,
  Database,
  ArrowRight,
  Layers,
  FileSpreadsheet,
  HardDrive,
  AlertTriangle,
  RefreshCw,
  DownloadCloud,
  WifiOff,
} from 'lucide-react';
import { APP_NAME, APP_RELEASES, APP_VERSION, ReleaseNoteItem } from '../data/changelog';
import { UpdateCheckResult } from '../../shared/types';

const BADGE_STYLES: Record<
  ReleaseNoteItem['type'],
  { label: string; className: string; icon: React.ReactNode }
> = {
  feature: {
    label: 'Fitur Baru',
    className: 'bg-blue-50 text-blue-700 border-blue-200',
    icon: <Sparkles className="h-3 w-3" />,
  },
  improvement: {
    label: 'Peningkatan',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
    icon: <Wrench className="h-3 w-3" />,
  },
  database: {
    label: 'Skema DB',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: <Database className="h-3 w-3" />,
  },
};

export const DocsVersionPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'guide' | 'changelog'>('guide');
  const [dbPath, setDbPath] = useState<string>('');
  const [installedVersion, setInstalledVersion] = useState<string>(APP_VERSION);
  const [checkingUpdate, setCheckingUpdate] = useState<boolean>(false);
  const [applyingUpdate, setApplyingUpdate] = useState<boolean>(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(null);
  const [updateStatusMsg, setUpdateStatusMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const handleCheckUpdate = async () => {
    if (!window.api?.checkForOtaUpdate) return;
    setCheckingUpdate(true);
    setUpdateStatusMsg(null);
    try {
      const res = await window.api.checkForOtaUpdate();
      setUpdateInfo(res);
      if (res.offline || res.error) {
        setUpdateStatusMsg({ type: 'info', text: res.error || 'Tidak dapat memeriksa pembaruan.' });
      } else if (res.hasUpdate) {
        setUpdateStatusMsg({
          type: 'success',
          text: `Pembaruan v${res.latestVersion} tersedia! Klik tombol "Update & Restart Sekarang" untuk memasang.`,
        });
      } else {
        setUpdateStatusMsg({
          type: 'info',
          text: `Aplikasi sudah menggunakan versi terbaru (v${res.currentVersion}).`,
        });
      }
    } catch (err: any) {
      setUpdateStatusMsg({ type: 'error', text: err?.message || 'Gagal memeriksa pembaruan.' });
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handleApplyUpdate = async () => {
    if (!updateInfo?.hasUpdate || !updateInfo.bundleUrl || !window.api?.applyOtaUpdate) return;
    setApplyingUpdate(true);
    setUpdateStatusMsg({ type: 'info', text: 'Mengunduh & memasang pembaruan, mohon tunggu...' });
    try {
      const res = await window.api.applyOtaUpdate({
        version: updateInfo.latestVersion,
        bundleUrl: updateInfo.bundleUrl,
        sha256: updateInfo.sha256 || '',
      });
      if (!res.success) {
        setUpdateStatusMsg({ type: 'error', text: res.message });
        setApplyingUpdate(false);
      } else {
        setUpdateStatusMsg({ type: 'success', text: res.message });
      }
    } catch (err: any) {
      setUpdateStatusMsg({ type: 'error', text: err?.message || 'Gagal menerapkan pembaruan.' });
      setApplyingUpdate(false);
    }
  };

  useEffect(() => {
    window.api?.getDbPath?.().then((p) => setDbPath(p)).catch(() => {});
    window.api?.getCurrentAppVersion?.().then((v) => v && setInstalledVersion(v)).catch(() => {});
    handleCheckUpdate();
  }, []);

  const currentRelease = APP_RELEASES.find((r) => r.isCurrent) || APP_RELEASES[0];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-3 py-1 text-xs font-bold tracking-wide text-white">
                {APP_NAME} v{installedVersion}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                <ShieldCheck className="h-3.5 w-3.5" />
                Schema DB v{currentRelease.schemaVersion} â€¢ Offline Ready
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Panduan Penggunaan &amp; Versi Sistem</h1>
            <p className="max-w-2xl text-sm text-slate-600">
              Dokumentasi ringkas alur kerja harian aplikasi, keamanan penyimpanan data lokal, serta catatan pembaruan tiap versi.
            </p>
          </div>

          {/* Tab Switcher & Update Trigger */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleCheckUpdate}
              disabled={checkingUpdate || applyingUpdate}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${checkingUpdate ? 'animate-spin text-blue-600' : 'text-slate-600'}`} />
              {checkingUpdate ? 'Memeriksa...' : 'Cek Pembaruan'}
            </button>

            {updateInfo?.hasUpdate && (
              <button
                type="button"
                onClick={handleApplyUpdate}
                disabled={applyingUpdate}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition-all hover:bg-emerald-700 disabled:opacity-50"
              >
                <DownloadCloud className="h-4 w-4" />
                {applyingUpdate ? 'Memasang Update...' : `Update & Restart (v${updateInfo.latestVersion})`}
              </button>
            )}

            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setActiveTab('guide')}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                  activeTab === 'guide'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BookOpen className="h-4 w-4" />
                Tutorial Penggunaan
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('changelog')}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                  activeTab === 'changelog'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <GitCommit className="h-4 w-4" />
                Log Versi ({APP_RELEASES.length})
              </button>
            </div>
          </div>
        </div>

        {/* OTA Update Status Banner */}
        {(updateInfo?.hasUpdate || updateStatusMsg) && (
          <div
            className={`mt-4 flex flex-col justify-between gap-3 rounded-xl border p-4 sm:flex-row sm:items-center ${
              updateInfo?.hasUpdate
                ? 'border-emerald-300 bg-emerald-50 text-emerald-950'
                : updateStatusMsg?.type === 'error'
                ? 'border-rose-200 bg-rose-50 text-rose-900'
                : 'border-slate-200 bg-slate-50 text-slate-700'
            }`}
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-bold">
                {updateInfo?.offline ? (
                  <WifiOff className="h-4 w-4 text-slate-500" />
                ) : updateInfo?.hasUpdate ? (
                  <Sparkles className="h-4 w-4 text-emerald-600" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-blue-600" />
                )}
                <span>
                  {updateInfo?.hasUpdate
                    ? `Versi Baru Tersedia: v${updateInfo.latestVersion} (Rilis ${updateInfo.releaseDate || '-'})`
                    : updateStatusMsg?.text}
                </span>
              </div>
              {updateInfo?.hasUpdate && updateInfo.notes && (
                <p className="text-xs leading-relaxed text-emerald-900">
                  <strong>Catatan Perubahan:</strong> {updateInfo.notes}
                </p>
              )}
              {updateInfo?.hasUpdate && updateStatusMsg && applyingUpdate && (
                <p className="text-xs font-semibold text-emerald-700">{updateStatusMsg.text}</p>
              )}
            </div>

            {updateInfo?.hasUpdate && (
              <button
                type="button"
                onClick={handleApplyUpdate}
                disabled={applyingUpdate}
                className="inline-flex flex-shrink-0 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
              >
                <DownloadCloud className="h-4 w-4" />
                {applyingUpdate ? 'Memproses...' : 'Update & Restart Sekarang'}
              </button>
            )}
          </div>
        )}
      </div>

      {activeTab === 'guide' ? (
        <div className="space-y-6">
          {/* Alur Kerja Utama */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-1 text-lg font-bold text-slate-900">1. Alur Kerja Standar Operasional</h2>
            <p className="mb-5 text-sm text-slate-500">
              Ikuti urutan transaksi di bawah ini agar stok barang, dokumen pengiriman, dan saldo hutang/piutang tercatat otomatis.
            </p>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
              {[
                {
                  step: 'Langkah 1',
                  title: 'Master Data',
                  desc: 'Daftarkan data Barang, Customer, dan Supplier. Gunakan fitur Import CSV jika data berjumlah banyak.',
                },
                {
                  step: 'Langkah 2',
                  title: 'PO / Sales Order',
                  desc: 'Buat PO (Pembelian ke Supplier) atau SO (Pesanan dari Customer) lengkap dengan Deldate & spesifikasi.',
                },
                {
                  step: 'Langkah 3',
                  title: 'Surat Jalan',
                  desc: 'Terbitkan Surat Jalan dari nomor PO/SO. Stok barang otomatis bertambah (Masuk) atau berkurang (Keluar).',
                },
                {
                  step: 'Langkah 4',
                  title: 'Invoice',
                  desc: 'Tarik data dari Surat Jalan ke menu Invoice untuk menerbitkan tagihan resmi (A4 / Dot Matrix).',
                },
                {
                  step: 'Langkah 5',
                  title: 'Pelunasan FIFO',
                  desc: 'Input pembayaran masuk/keluar. Sistem otomatis melunasi tagihan terlama lebih dulu (FIFO) atau cicilan.',
                },
              ].map((item, idx) => (
                <div
                  key={item.step}
                  className="relative flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/70 p-4"
                >
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="rounded-md bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-700">
                        {item.step}
                      </span>
                      {idx < 4 && <ArrowRight className="hidden h-4 w-4 text-slate-400 lg:block" />}
                    </div>
                    <h3 className="text-sm font-bold text-slate-900">{item.title}</h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Mode Operasi & Transfer Antardivisi */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-3 flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <Layers className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">2. Mode Operasi Divisi</h2>
                  <p className="text-xs text-slate-500">Atur tampilan menu sesuai PC pengguna</p>
                </div>
              </div>
              <ul className="space-y-2.5 text-xs text-slate-700">
                <li className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <span className="font-bold text-slate-900">Semua Modul (Gabungan):</span> Menampilkan seluruh menu dari Gudang hingga Finance dalam satu layar.
                </li>
                <li className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <span className="font-bold text-slate-900">Mode 1 â€” Order &amp; Gudang:</span> Fokus pada Master Data, PO/SO, Surat Jalan, dan Mutasi Stok.
                </li>
                <li className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <span className="font-bold text-slate-900">Mode 2 â€” Finance / Accounting:</span> Fokus pada Invoice Hutang/Piutang, Pelunasan FIFO, dan Laporan.
                </li>
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-3 flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">3. Kop Surat, Cetak PDF &amp; Backup</h2>
                  <p className="text-xs text-slate-500">Kustomisasi dokumen &amp; perlindungan data</p>
                </div>
              </div>
              <ul className="space-y-2.5 text-xs text-slate-700">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
                  <span>
                    <strong>Kop Surat &amp; Logo:</strong> Atur nama perusahaan, alamat, kota tanggal PO, nama direktur, dan upload logo di menu <em>Template &amp; Pengaturan</em>.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
                  <span>
                    <strong>Transfer JSON Antardivisi:</strong> Jika PC Gudang dan Finance terpisah, gunakan tombol <em>Export JSON</em> pada PO/Surat Jalan lalu import di PC Finance.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
                  <span>
                    <strong>Backup Berkala:</strong> Unduh salinan database mentah (<code>.db</code>) untuk pemulihan penuh atau export Excel (<code>.xlsx</code>) untuk arsip bulanan.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Jaminan Keamanan Database Saat Update */}
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
                  <HardDrive className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-sm font-bold text-emerald-950">
                    Database Aman Saat Update / Timpa Versi Baru
                  </h2>
                  <p className="text-xs leading-relaxed text-emerald-900">
                    File database SQLite disimpan terpisah di folder profil sistem (<code>AppData\Roaming</code>), bukan di folder instalasi program. Saat installer versi baru dijalankan untuk menimpa versi lama, seluruh transaksi tetap utuh dan struktur tabel diperbarui otomatis (<code>PRAGMA user_version</code>).
                  </p>
                  {dbPath && (
                    <p className="pt-1 font-mono text-[11px] text-emerald-800">
                      Lokasi DB aktif: <span className="font-semibold">{dbPath}</span>
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-900 md:max-w-xs">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-600" />
                <span>Tip: Selalu simpan backup file .db di menu Backup &amp; Export sebelum menginstal pembaruan besar.</span>
              </div>
            </div>
          </div>

          {/* Timeline Versi */}
          <div className="space-y-4">
            {APP_RELEASES.map((release) => (
              <div
                key={release.version}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="text-lg font-extrabold text-slate-900">v{release.version}</span>
                    <span className="rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                      {release.codename}
                    </span>
                    {release.isCurrent && (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                        Versi Terpasang
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-medium text-slate-500">
                    Rilis: {release.date} â€¢ DB Schema v{release.schemaVersion}
                  </div>
                </div>

                <p className="mt-3 text-sm text-slate-600">{release.summary}</p>

                <ul className="mt-4 space-y-2.5">
                  {release.changes.map((item, idx) => {
                    const badge = BADGE_STYLES[item.type];
                    return (
                      <li key={idx} className="flex items-start gap-2.5 text-sm text-slate-700">
                        <span
                          className={`mt-0.5 inline-flex flex-shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${badge.className}`}
                        >
                          {badge.icon}
                          {badge.label}
                        </span>
                        <span className="leading-relaxed">{item.text}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
