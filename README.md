# PCS-ERP â€” Sistem Administrasi, Gudang & Finance Offline

Aplikasi desktop administrasi operasional dan keuangan berbasis offline untuk **PT. Pilar Cerah Sejahtera**. Dibangun menggunakan Electron, React, TypeScript, Tailwind CSS, dan SQLite lokal sehingga seluruh pencatatan transaksi berjalan cepat tanpa bergantung pada koneksi internet.

---

## Fitur Utama

### 1. Tiga Mode Operasi per Divisi
Aplikasi dapat diatur sesuai kebutuhan komputer masing-masing divisi melalui menu **Pengaturan** atau pilihan cepat di **Sidebar**:
- **Mode 1 â€” Order & Gudang**: Fokus pada pengelolaan Master Data, Purchase Order (PO), Sales Order (SO), Surat Jalan Masuk/Keluar, dan Buku Besar Mutasi Stok.
- **Mode 2 â€” Finance / Accounting**: Fokus pada penagihan Invoice Piutang/Hutang, impor data transaksi dari divisi Gudang, serta Pelunasan otomatis (FIFO).
- **Mode Gabungan (Semua Modul)**: Menampilkan seluruh fitur Gudang dan Finance dalam satu aplikasi.

### 2. Manajemen Master Data & Import Massal
- Pengelolaan database **Barang**, **Customer**, dan **Supplier**.
- Mendukung **Bulk Import** dari file `.csv` maupun `.json` (otomatis memperbarui data jika kode sudah terdaftar, atau menambah data baru).
- Tersedia template `.csv` siap unduh langsung dari aplikasi untuk mempermudah migrasi data awal.

### 3. Alur Pembelian, Penjualan & Stok Otomatis (Divisi Gudang)
- **Purchase Order (PO) & Sales Order (SO)**: Pencatatan pesanan lengkap dengan perhitungan DPP, diskon, PPN, dan ongkos kirim.
- **Surat Jalan (Masuk & Keluar)**:
  - Dapat menarik sisa item yang belum terkirim langsung dari nomor PO/SO.
  - Otomatis menambah atau mengurangi stok barang saat Surat Jalan disimpan, sekaligus mencatat riwayatnya di **Mutasi Barang**.
  - Menghapus atau mengubah Surat Jalan otomatis mengembalikan (*rollback*) saldo stok sebelumnya.
- **Transfer Dokumen ke Finance**: Export dokumen PO, SO, atau Surat Jalan ke file `.json` untuk diproses menjadi tagihan di komputer divisi Finance tanpa input ulang.

### 4. Penagihan & Pelunasan FIFO (Divisi Finance)
- **Invoice Piutang & Hutang**:
  - Dapat dibuat manual, ditarik dari referensi Surat Jalan, atau diimpor langsung dari file `.json` kiriman Gudang.
  - Tampilan fleksibel: **Daftar Tabel** biasa atau **Grup per Partner** untuk melihat total sisa tagihan tiap Customer/Supplier.
  - Mendukung centang beberapa invoice sekaligus untuk pelunasan gabungan.
- **Pelunasan Otomatis (FIFO)**:
  - Nominal pembayaran otomatis dialokasikan ke invoice terlama terlebih dahulu hingga saldo habis.
  - Mendukung pembayaran cicilan, penyesuaian nominal manual per invoice, serta pencatatan potongan admin bank.
  - Status invoice otomatis diperbarui menjadi **Belum Lunas**, **Cicil**, atau **Lunas**.

### 5. Cetak Dokumen PDF & Kustomisasi Template
- Mendukung pratinjau dan cetak dokumen ke **PDF** secara offline untuk **PO**, **SO**, **Surat Jalan**, dan **Invoice** (termasuk format kertas *Continuous Form / Dot Matrix* 9.5" x 5.5").
- Desain kop surat, logo perusahaan, penandatangan, serta tata letak HTML/CSS setiap dokumen dapat diubah langsung dari menu **Template & Pengaturan**.

### 6. Backup & Export Laporan
- **Export Laporan Excel & CSV**: Unduh arsip laporan yang rapi dan mudah dibaca manusia ke format `.xlsx` (multi-sheet) atau `.csv` dengan filter rentang tanggal dan pilihan dataset.
- **Backup & Restore Database Sistem**: Cadangkan seluruh database lokal (`erp_offline.db`) ke satu file `.db` untuk keamanan data maupun pemulihan (*restore*) kapan saja.

---

## Teknologi yang Digunakan

- **Desktop Framework**: Electron 33
- **Antarmuka (UI)**: React 18, TypeScript, Tailwind CSS v4, Lucide Icons
- **Database Offline**: SQLite (`sql.js` WebAssembly)
- **Export & Packaging**: SheetJS (`xlsx`), Vite, Electron Builder

---

## Panduan Menjalankan & Build (Untuk Developer)

### Prasyarat
- **Node.js** versi 18 atau lebih baru
- **npm** (bawaan Node.js)

### Instalasi Dependensi
```bash
npm install
```

### Menjalankan Mode Pengembangan (Development)
```bash
npm run dev
```

### Kompilasi & Membuat Installer Windows (`.exe`)
```bash
npm run dist:win
```
File installer siap pakai (`PCS-ERP Setup 1.0.0.exe`) akan otomatis dihasilkan di dalam folder `release/`.

> **Catatan Build di Windows**: Jika proses pembuatan installer mengalami kendala ekstraksi *symbolic link*, aktifkan **Developer Mode** di pengaturan Windows (*Settings â†’ System â†’ For developers*) atau jalankan terminal sebagai **Administrator**.

---

## Lokasi Penyimpanan Data Lokal

Agar data perusahaan tetap aman dan tidak terhapus saat aplikasi diperbarui ke versi baru, database SQLite disimpan terpisah dari folder instalasi program di direktori user Windows:

```text
C:\Users\<NamaUserWindows>\AppData\Roaming\desktop-erp-lite\erp_offline.db
```
