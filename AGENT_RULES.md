# AGENT_RULES.md - Panduan Arsitektur & Pengembangan Desktop ERP Lite

Dokumen ini menjadi acuan standar bagi developer maupun AI coding agent dalam memahami arsitektur, struktur direktori, alur bisnis, serta aturan teknis aplikasi **Desktop ERP Lite (Offline)** berbasis Electron, React, TypeScript, Tailwind CSS, dan SQLite (`sql.js`).

---

## 1. Ringkasan Teknologi (Tech Stack)

| Layer | Teknologi | Keterangan |
| :--- | :--- | :--- |
| **Desktop Runtime** | Electron 33+ | Main Process & Preload IPC Bridge (`contextIsolation: true`, `sandbox: false`) |
| **Frontend UI** | React 18 + TypeScript + Tailwind CSS v4 | Renderer Process dengan Vite sebagai bundler & dev server |
| **Database Lokal** | SQLite via `sql.js` (WASM) | Disimpan persisten di folder `userData` (`erp_offline.db`) melalui atomic file write |
| **Sinkronisasi & Backup** | Offline-First (JSON, CSV & Excel `.xlsx`) | Transfer dokumen antardivisi via `.json`, migrasi master via `.csv`/`.json`, arsip laporan via `xlsx` (SheetJS), dan disaster recovery via `.db` |

---

## 2. Struktur Direktori Proyek

- `AGENT_RULES.md` - Dokumen panduan arsitektur & aturan pengembangan ini.
- `package.json` - Konfigurasi dependencies, scripts, dan `electron-builder`.
- `tsconfig.json` - Konfigurasi TypeScript untuk Frontend (`src/`).
- `tsconfig.electron.json` - Konfigurasi TypeScript untuk Electron (`electron/` & `shared/`).
- `vite.config.ts` - Konfigurasi Vite bundler.
- `index.html` - Entry HTML untuk Vite / Renderer.
- `shared/types.ts` - Kontrak tipe data bersama antara Main & Renderer (`DTO`, `Entity`, `AppMode`, `DocType`, `TransferPayload`).
- `electron/` - Backend Desktop (Node.js / Main Process):
  - `main.ts` - Lifecycle `BrowserWindow`, inisialisasi DB, registrasi IPC handlers.
  - `preload.ts` - `ContextBridge` mengekspos `window.api` ke Renderer secara aman.
  - `db/database.ts` - Loader WASM `sql.js`, helper `queryAll`, `queryOne`, `execute`, dan `runTransaction`.
  - `db/migrations.ts` - Pembuatan tabel, indeks, dan seeding data awal.
  - `db/defaultTemplates.ts` - Template bawaan HTML/CSS untuk cetak dokumen PDF.
  - `services/masterService.ts` - CRUD Barang, Customer, Supplier + Bulk Import CSV/JSON.
  - `services/orderDeliveryService.ts` - CRUD PO/SO, Surat Jalan, Sample, kalkulasi stok, mutasi manual & otomatis, serta rebuild buku besar mutasi dari dokumen.
  - `services/invoicePaymentService.ts` - CRUD Invoice, Pelunasan FIFO, update status Lunas/Cicil.
  - `services/pdfBackupService.ts` - Render PDF (Chromium), kustomisasi template, Backup/Restore DB mentah (`.db`), serta sinkronisasi salinan otomatis ke folder pilihan user.
  - `services/exportBackupService.ts` - Export arsip laporan terbaca manusia ke Excel multi-sheet (`.xlsx` via `xlsx`/SheetJS) dan `.csv` dengan filter rentang tanggal serta JOIN relasi partner & item barang.
- `src/` - Frontend UI (React Renderer Process):
  - `main.tsx` - Entry point ReactDOM.
  - `index.css` - Konfigurasi Tailwind CSS.
  - `App.tsx` - State global (`AppSettings`, `dataRevision`, `paymentPrefill`), navigasi halaman (`activePage`), filter mode divisi, dan handover data lintas halaman (`InvoicesPage` -> `PaymentsPage`).
  - `types/window.d.ts` - Deklarasi tipe global `window.api`.
  - `utils/format.ts` - Format Rupiah, tanggal ISO, generator nomor dokumen, parser CSV/JSON.
  - `components/Sidebar.tsx` - Navigasi dinamis sesuai Mode Operasi (`mode_1_gudang` / `mode_2_finance` / `all`).
  - `components/SearchableSelect.tsx` - Komponen dropdown searchable reusable untuk pemilihan Customer, Supplier, Barang, dan filter partner.
  - `components/PaginationBar.tsx` - Komponen kontrol paginasi reusable (pilihan item per halaman 10/20/50/100, nomor halaman, Prev/Next).
  - `components/PdfPreviewModal.tsx` - Modal pratinjau HTML dokumen & export ke file PDF.
  - `pages/DashboardPage.tsx` - Ringkasan KPI, peringatan stok menipis (<= 5), aksi cepat.
  - `pages/MasterDataPage.tsx` - Manajemen Barang, Customer, Supplier, download template CSV & Bulk Import.
  - `pages/OrdersPage.tsx` - Pembuatan/Edit PO (`in`) & SO (`out`), cetak PDF, export JSON.
  - `pages/DeliveryNotesPage.tsx` - Surat Jalan (`in`/`out`), tarik sisa item dari PO/SO, update stok.
  - `pages/MutasiBarangPage.tsx` - Buku besar log pergerakan stok (otomatis dari SJ/Sample + CRUD mutasi manual + utilitas Rebuild Stok & Mutasi).
  - `pages/InvoicesPage.tsx` - Tagihan Hutang (`in`) & Piutang (`out`), import JSON Gudang, filter partner & status, mode tampilan tabel vs grup per partner (layered list), multi-select pelunasan, dan paginasi.
  - `pages/PaymentsPage.tsx` - Pelunasan otomatis FIFO, cicilan, edit manual baris, potongan bank, filter partner, paginasi, serta penerima `prefillDraft` dari halaman Invoices.
  - `pages/BackupExportPage.tsx` - Pusat Backup & Export Data: memisahkan backup arsip terbaca manusia (`.xlsx` multi-sheet / `.csv` per file dengan filter tanggal & checklist 13 jenis dataset) dan backup/restore database sistem penuh (`.db`) beserta pengaturan folder salinan otomatis.
  - `pages/SettingsTemplatesPage.tsx` - Profil perusahaan, switch mode, editor HTML/CSS PDF, Backup/Restore DB.

> **Catatan Build Electron**: Karena `tsconfig.electron.json` mengompilasi folder `electron/` dan `shared/` dengan `rootDir: "."`, hasil kompilasi berada di `dist-electron/electron/main.js` (sesuai field `"main"` di `package.json`).

---

## 3. Mode Operasi Aplikasi (`AppMode`)

Aplikasi mendukung 3 mode yang dapat diubah melalui dropdown Sidebar atau halaman Pengaturan (`app_settings.app_mode`):

1. **`mode_1_gudang` (Order & Gudang)**
   - Fokus operasional logistik: Dashboard, Master Data, Purchase Order (PO), Sales Order (SO), Surat Jalan, Mutasi Stok Barang, dan Pengaturan.
2. **`mode_2_finance` (Finance / Accounting)**
   - Fokus penagihan & kas: Dashboard, Master Data, Invoice (Hutang/Piutang), Pelunasan & FIFO, dan Pengaturan.
3. **`all` (Gabungan)**
   - Menampilkan seluruh modul dalam satu instalasi PC.

---

## 4. Alur Kerja Sistem (End-to-End Workflows)

### A. Migrasi & Master Data (`masterService.ts`)
- **Entitas**: `barang` (terhubung opsional ke `supplier_id`), `customer`, dan `supplier`.
- **Template & Bulk Import**:
  - Mendukung download template `.csv` langsung dari modal Bulk Import (lengkap dengan contoh baris & header standar) maupun tombol pengisi contoh otomatis.
  - Parser menerima format JSON array/object maupun CSV dengan delimiter koma (`,`), titik koma (`;`), atau tab.
  - Proses simpan bersifat *upsert* berdasarkan kolom `kode` (update jika `kode` sudah ada, insert jika baru/kosong).

### B. Alur Pembelian & Penjualan - Divisi Gudang (`orderDeliveryService.ts`)
1. **PO & SO (`orders` & `order_details`)**:
   - `type = 'in'` -> Purchase Order (Pembelian ke `supplier_id`).
   - `type = 'out'` -> Sales Order (Penjualan ke `cust_id`).
   - Perhitungan: `dpp = SUM(qty * price)`, `total = MAX(0, dpp - diskon) + (MAX(0, dpp - diskon) * ppn / 100)`.
2. **Surat Jalan (`delivery_notes` & `delivery_note_details`)**:
   - User dapat menarik sisa item yang belum terkirim dari nomor PO/SO (`qty - qty_sent`).
   - **Efek Transaksi Simpan**:
     - `type = 'in'` (SJ Masuk): `barang.stock += qty_sent`.
     - `type = 'out'` (SJ Keluar): `barang.stock -= qty_sent`.
     - Memperbarui akumulasi `order_details.qty_sent` jika terhubung ke `order_detail_id`.
     - Mencatat audit trail ke tabel `mutasi_barang` (`stok_sebelum`, `qty`, `stok_sesudah`, `source = no_surat_jalan`).
   - **Efek Edit / Hapus**: Wajib melakukan *rollback* stok barang dan `order_details.qty_sent` terlebih dahulu sebelum menerapkan perubahan baru atau menghapus dokumen.
3. **Transfer ke Finance**:
   - Dari halaman Orders atau Surat Jalan, user menekan **Export JSON** (`exportTransferJson`) untuk menghasilkan file `.json` berisi header dokumen, data partner, dan rincian item.

### C. Alur Penagihan & Pelunasan FIFO - Divisi Finance (`invoicePaymentService.ts`)
1. **Invoice (`invoices` & `invoice_details`)**:
   - Dapat dibuat manual atau melalui tombol **Import JSON Gudang** (`importTransferJson`), yang otomatis mencocokkan `partner` dan `barang` berdasarkan `kode` atau `nama`.
   - `type = 'out'` -> Invoice Penjualan (Piutang Customer).
   - `type = 'in'` -> Invoice Pembelian (Hutang Supplier).
   - Tagihan akhir = `total + ongkir`.
2. **Pelunasan & Alokasi FIFO (`payments` & `payment_details`)**:
   - `type = 'in'` melunasi Invoice `type = 'out'` (Piutang); `type = 'out'` melunasi Invoice `type = 'in'` (Hutang).
   - **Algoritma FIFO**: Mengambil daftar invoice partner yang belum lunas diurutkan berdasarkan `tgl ASC, id ASC`, lalu mengalokasikan nominal pembayaran mulai dari invoice terlama hingga saldo pembayaran habis.
   - User tetap dapat menambah, menghapus, atau mengedit nominal per baris invoice secara manual serta mencatat `potongan` (biaya admin bank).
   - **Sinkronisasi Status Invoice**: Setiap simpan/edit/hapus pembayaran menghitung ulang `invoices.paid` dan memperbarui `invoices.status` menjadi `'Belum Lunas'` (`paid <= 0`), `'Cicil'` (`0 < paid < total + ongkir`), atau `'Lunas'` (`paid >= total + ongkir`).

### D. Cetak PDF, Dot Matrix & Backup Database (`pdfBackupService.ts` & `exportBackupService.ts`)
- **Template Engine**: Setiap jenis dokumen (`PO`, `SO`, `SJ`, `SJ_DOT`, `INVOICE`, `INVOICE_DOT`) memiliki baris HTML & CSS di tabel `pdf_templates` dengan placeholder `{{...}}` yang dapat dikustomisasi langsung dari UI.
- **PDF Rendering**: Menggunakan hidden `BrowserWindow` Electron (`webContents.printToPDF`) untuk menghasilkan PDF presisi tinggi secara offline (termasuk dukungan ukuran Continuous Form 9.5" x 5.5" untuk varian `_DOT`).
- **Backup Sistem Penuh (`.db`)**: Fitur Backup menyalin file SQLite aktif (`erp_offline.db`) ke lokasi pilihan user untuk disaster recovery sistem; Restore menimpa database lokal dan me-reload instance `sql.js` serta menjalankan `runMigrations()`.
- **Backup Arsip Terbaca Manusia (`.xlsx` / `.csv` via `exportBackupService.ts` & `BackupExportPage.tsx`)**:
  - Mendukung filter rentang tanggal (`startDate` - `endDate`) dengan preview jumlah dokumen real-time (`backup:previewCounts`) serta checklist selektif untuk 12 dataset terpisah: `po`, `so`, `sj_in`, `sj_out`, `mutasi`, `invoice_in`, `invoice_out`, `payment_in`, `payment_out`, `master_barang`, `master_customer`, dan `master_supplier`.
  - Seluruh relasi ID (`cust_id`, `supp_id`, `barang_id`, `invoice_id`) otomatis di-`JOIN` menjadi kode & nama partner, kode barang, part number, nama barang, serta satuan.
  - Format `.xlsx` menghasilkan 1 workbook berisi sheet `Ringkasan Backup` plus 1 sheet terpisah per dataset terpilih; format `.csv` menggunakan pemisah `;` dengan UTF-8 BOM (disimpan ke 1 file jika 1 dataset, atau ke dalam folder berisi file `.csv` terpisah jika >1 dataset).

---

## 5. Aturan Wajib Pengembangan Lanjutan (Coding Rules)

1. **Integritas Transaksi SQLite (`runTransaction`)**:
   - Setiap operasi tulis yang mengubah lebih dari satu tabel (misal: simpan Surat Jalan yang mengubah stok + mutasi + `order_details`, atau simpan Payment yang mengubah status Invoice) **WAJIB** dibungkus dalam `runTransaction(() => { ... })` dari `electron/db/database.ts`.
2. **Kontrak IPC & Type Safety**:
   - Setiap penambahan fitur backend harus didaftarkan berurutan di: `shared/types.ts` -> `electron/services/*.ts` -> `electron/main.ts` (`ipcMain.handle`) -> `electron/preload.ts` (`contextBridge`).
   - Jangan pernah memanggil modul Node.js (`fs`, `path`, `sql.js`) langsung dari folder `src/`.
3. **Konsistensi Tanda `type` (`'in'` vs `'out'`)**:
   - **Orders, Surat Jalan, Mutasi, Invoice**: `'in'` = Barang/Tagihan Masuk (Pembelian/Supplier), `'out'` = Barang/Tagihan Keluar (Penjualan/Customer).
   - **Payments**: `'in'` = Uang Masuk (Pelunasan Piutang dari Customer), `'out'` = Uang Keluar (Pelunasan Hutang ke Supplier).
4. **Migrasi Skema Aman**:
   - Jika menambah kolom/tabel baru di `electron/db/migrations.ts`, gunakan `CREATE TABLE IF NOT EXISTS` atau pengecekan `PRAGMA table_info(...)` sebelum `ALTER TABLE` agar database `.db` lama milik user tidak rusak saat aplikasi di-update.

---

## 6. Status Rilis & Arsitektur Mutasi Terkini (v1.0.2 - 25 November 2026)

Seluruh rangkaian fitur mutasi barang kronologis, rebuild buku besar stok, dan dual-backup telah diverifikasi konsistensi transaksinya serta resmi dirilis pada **v1.0.2** (Schema DB v7) melalui OTA:

### A. Mutasi Barang Manual & Saldo Berjalan Kronologis (`orderDeliveryService.ts`, `MutasiBarangPage.tsx`)
- **Mutasi Manual (CRUD)**: Selain mutasi otomatis dari Surat Jalan (`delivery_note_id`) dan Tanda Terima Sampel (`sample_id`), user dapat menambah, mengedit, dan menghapus catatan mutasi manual (misal: `STOCK OPNAME`, `RETUR / KERUSAKAN`, `PENYESUAIAN GUDANG`, `PRODUKSI / REPACK`). Mutasi otomatis tetap terkunci dari halaman ini dan hanya dapat diubah melalui dokumen asalnya.
- **Kalkulasi Saldo Berjalan (`recalculateBarangLedger`)**: Setiap perubahan mutasi (otomatis maupun manual, termasuk sisipan pada tanggal lampau) secara atomik menyusun ulang `stok_sebelum` dan `stok_sesudah` seluruh riwayat mutasi barang terkait berdasarkan urutan kronologis (`ORDER BY tgl ASC, id ASC`) dari titik `getBarangInitialBaseline(barangId)`, lalu menyinkronkan `barang.stock` akhir.

### B. Utilitas Rebuild Stok & Mutasi dari Dokumen (`rebuildMutasiAndStockFromDocuments`)
- **Dua Mode Scope**:
  1. `all` (**Rombak Total**): Mereset baseline stok seluruh barang ke `0`, menghapus log mutasi otomatis lama, lalu membangun ulang seluruh riwayat mutasi dari dokumen Surat Jalan (`delivery_notes`) dan Tanda Terima Sampel (`samples`) secara kronologis.
  2. `from_date` (**Mulai Tanggal Tertentu s/d Sekarang**): Mempertahankan saldo dan mutasi sebelum `fromDate` sebagai baseline, lalu membangun ulang mutasi mulai `fromDate` hingga sekarang.
- **Opsi Mutasi Manual (`keepManualMutasi`)**: Mempertahankan mutasi manual yang sudah ada agar ikut disisipkan ulang ke perhitungan saldo sesuai urutan tanggalnya, atau menghapus seluruh mutasi manual dalam rentang rebuild.

### C. Sistem Dual-Backup Database SQLite (`.db`)
- **Auto-Backup Sebelum Rebuild**: Sebelum `rebuildMutasiAndStockFromDocuments` berjalan, sistem memanggil `saveDatabase()` lalu membuat snapshot `.db` ke folder internal `userData/backups/auto_backup_before_rebuild_<timestamp>.db`.
- **Folder Salinan Otomatis Opsional (`app_settings.custom_backup_dir`)**:
  - User dapat memilih folder eksternal (misal folder sinkronisasi cloud/drive lokal) melalui halaman **Pusat Backup & Export Data** (`BackupExportPage.tsx`, via IPC `db:selectCustomBackupFolder` & `db:openLocation`).
  - Setiap backup manual (`backupDatabase`) maupun auto-backup sebelum rebuild otomatis menyalin file `.db` ke folder pilihan tersebut melalui `copyBackupToCustomFolder()`.
