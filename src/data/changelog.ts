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

export const APP_VERSION = '1.0.2';
export const APP_NAME = 'PCS-ERP';

export const APP_RELEASES: AppRelease[] = [
  {
    version: '1.0.2',
    date: '25 November 2026',
    codename: 'Rebuild Stok, Mutasi Kronologis & Dual-Backup',
    schemaVersion: 7,
    isCurrent: true,
    summary:
      'Penambahan fitur Rebuild Stok & Mutasi otomatis dari dokumen, penyempurnaan perhitungan saldo berjalan kronologis pada Buku Besar Mutasi Barang, serta sistem Dual-Backup database SQLite.',
    changes: [
      {
        type: 'feature',
        text: 'Rebuild Stok & Mutasi dari Dokumen: Utilitas sinkronisasi ulang buku besar stok secara kronologis dari seluruh Surat Jalan (SJ) dan Tanda Terima Sampel (SP), mendukung mode Rombak Total (reset stok awal ke 0) maupun Mulai Tanggal Tertentu s/d Sekarang dengan opsi mempertahankan mutasi manual.',
      },
      {
        type: 'feature',
        text: 'Mutasi Stok Manual & Saldo Berjalan Kronologis: Dukungan penuh CRUD mutasi manual (Stock Opname, Retur/Kerusakan, Penyesuaian Gudang, Produksi/Repack) dengan kalkulasi ulang otomatis stok sebelum & sesudah secara kronologis saat mutasi disisipkan pada tanggal lampau.',
      },
      {
        type: 'feature',
        text: 'Sistem Dual-Backup & Folder Salinan Otomatis: Auto-backup database (.db) sebelum proses rebuild serta dukungan konfigurasi folder salinan eksternal (misal folder cloud sync) untuk backup manual maupun otomatis.',
      },
      {
        type: 'database',
        text: 'Skema database lokal SQLite v7 dengan tabel Sample Barang (samples, sample_barangs) dan relasi sample_id pada mutasi_barang.',
      },
    ],
  },
  {
    version: '1.0.1',
    date: '24 November 2026',
    codename: 'fitur sample, dan update patch',
    schemaVersion: 7,
    isCurrent: false,
    summary:
      'Pembaruan modul manajemen Sample Barang, pencatatan Mutasi Stok manual, sistem OTA Auto-Update langsung dari dalam aplikasi, serta perbaikan stabilitas dan tampilan.',
    changes: [
      {
        type: 'feature',
        text: 'Modul Sample Barang: Pencatatan transaksi pengiriman dan penerimaan sampel barang ke Customer maupun dari Supplier lengkap dengan status pelacakan, cetak dokumen tanda terima sampel, serta filter pencarian.',
      },
      {
        type: 'feature',
        text: 'Mutasi Stok Manual & Kartu Stok: Penambahan fitur input penyesuaian stok manual (Stok Masuk/Keluar non-PO/SO seperti stock opname, barang rusak, atau koreksi gudang) yang langsung tercatat pada riwayat kartu stok.',
      },
      {
        type: 'feature',
        text: 'Sistem OTA (Over-The-Air) Auto-Update: Pengecekan versi terbaru otomatis dari GitHub dengan verifikasi integritas SHA-256 dan tombol Update & Restart satu klik tanpa perlu menjalankan ulang file installer.',
      },
      {
        type: 'improvement',
        text: 'Perbaikan bug tampilan karakter simbol (encoding UTF-8) pada header, sidebar, dan halaman dokumentasi, serta penyempurnaan validasi form dan sinkronisasi status dokumen.',
      },
    ],
  },
  {
    version: '1.0.0',
    date: '23 November 2026',
    codename: 'Initial Production Release',
    schemaVersion: 6,
    isCurrent: false,
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
