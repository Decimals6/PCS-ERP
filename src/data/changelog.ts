export interface ReleaseNoteItem {
  type: 'feature' | 'improvement' | 'database';
  text: string;
}

export interface AppRelease {
  version: string;
  date: string;
  codename: string;
  schemaVersion: number;
  isCurrent?: boolean;
  summary: string;
  changes: ReleaseNoteItem[];
}

export const APP_VERSION = '1.0.0';
export const APP_NAME = 'PCS-ERP';

export const APP_RELEASES: AppRelease[] = [
  {
    version: '1.0.0',
    date: '23 November 2026',
    codename: 'Initial Production Release',
    schemaVersion: 6,
    isCurrent: true,
    summary:
      'Rilis perdana PCS-ERP offline untuk operasional administrasi Order, Gudang, Surat Jalan, Invoice, Pelunasan FIFO, dan cetak dokumen PDF perusahaan.',
    changes: [
      {
        type: 'feature',
        text: 'Manajemen Master Data (Barang, Customer, Supplier) lengkap dengan fitur Bulk Import CSV/Excel, pencarian cepat, pengurutan kolom (sorting), dan pagination.',
      },
      {
        type: 'feature',
        text: 'Modul Purchase Order (PO) & Sales Order (SO) dengan dukungan Deldate, Perihal/Jenis Spesifikasi PO, perhitungan otomatis DPP, Diskon, PPN, Ongkir, dan terbilang Rupiah.',
      },
      {
        type: 'feature',
        text: 'Modul Surat Jalan (Masuk & Keluar) yang terhubung ke PO/SO dan otomatis memperbarui kartu stok serta riwayat Mutasi Stok Barang secara real-time.',
      },
      {
        type: 'feature',
        text: 'Modul Invoice (Hutang & Piutang) dari Surat Jalan maupun input manual, serta Pelunasan dengan alokasi otomatis metode FIFO dan dukungan cicilan.',
      },
      {
        type: 'feature',
        text: 'Kustomisasi Template PDF & Kop Surat (Logo Perusahaan Base64, Kota Kop Surat, Nama & Jabatan Penandatangan PO) serta dukungan cetak A4 maupun Dot Matrix.',
      },
      {
        type: 'feature',
        text: 'Mode Operasi Divisi (Semua Modul, Mode 1 Gudang, Mode 2 Finance) beserta fitur Transfer Dokumen JSON antardivisi dan Backup/Restore database SQLite (.db) maupun Excel.',
      },
      {
        type: 'database',
        text: 'Skema database lokal SQLite v6 dengan sistem migrasi otomatis (PRAGMA user_version) dan atomic file write agar data tetap aman saat pembaruan aplikasi.',
      },
    ],
  },
];
