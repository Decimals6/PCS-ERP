import { dialog } from 'electron';
import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import { queryAll, queryOne } from '../db/database';
import {
  ExportDatasetKey,
  HumanBackupPreviewCounts,
  HumanBackupRequest,
  HumanBackupResult,
} from '../../shared/types';

interface DatasetSheetSpec {
  key: ExportDatasetKey;
  sheetName: string;
  fileSlug: string;
  label: string;
  rows: Record<string, any>[];
}

function buildDateWhere(column: string, startDate?: string, endDate?: string): { sql: string; params: any[] } {
  const clauses: string[] = [];
  const params: any[] = [];

  if (startDate && startDate.trim()) {
    clauses.push(`substr(${column}, 1, 10) >= ?`);
    params.push(startDate.trim());
  }
  if (endDate && endDate.trim()) {
    clauses.push(`substr(${column}, 1, 10) <= ?`);
    params.push(endDate.trim());
  }

  if (clauses.length === 0) return { sql: '', params: [] };
  return { sql: ` AND ${clauses.join(' AND ')}`, params };
}

export function previewHumanBackupCounts(startDate?: string, endDate?: string): HumanBackupPreviewCounts {
  const orderFilter = buildDateWhere('tgl', startDate, endDate);
  const dnFilter = buildDateWhere('tgl', startDate, endDate);
  const invFilter = buildDateWhere('tgl', startDate, endDate);
  const payFilter = buildDateWhere('tgl', startDate, endDate);
  const mutFilter = buildDateWhere('tgl', startDate, endDate);

  const countOf = (sql: string, params: any[] = []) => {
    const row = queryOne<{ cnt: number }>(sql, params);
    return Number(row?.cnt || 0);
  };

  return {
    po: countOf(`SELECT COUNT(*) AS cnt FROM orders WHERE type = 'in'${orderFilter.sql}`, orderFilter.params),
    so: countOf(`SELECT COUNT(*) AS cnt FROM orders WHERE type = 'out'${orderFilter.sql}`, orderFilter.params),
    sj_in: countOf(`SELECT COUNT(*) AS cnt FROM delivery_notes WHERE type = 'in'${dnFilter.sql}`, dnFilter.params),
    sj_out: countOf(`SELECT COUNT(*) AS cnt FROM delivery_notes WHERE type = 'out'${dnFilter.sql}`, dnFilter.params),
    sample: countOf(`SELECT COUNT(*) AS cnt FROM samples WHERE 1=1${dnFilter.sql}`, dnFilter.params),
    invoice_in: countOf(`SELECT COUNT(*) AS cnt FROM invoices WHERE type = 'in'${invFilter.sql}`, invFilter.params),
    invoice_out: countOf(`SELECT COUNT(*) AS cnt FROM invoices WHERE type = 'out'${invFilter.sql}`, invFilter.params),
    payment_in: countOf(`SELECT COUNT(*) AS cnt FROM payments WHERE type = 'in'${payFilter.sql}`, payFilter.params),
    payment_out: countOf(`SELECT COUNT(*) AS cnt FROM payments WHERE type = 'out'${payFilter.sql}`, payFilter.params),
    mutasi: countOf(`SELECT COUNT(*) AS cnt FROM mutasi_barang WHERE 1=1${mutFilter.sql}`, mutFilter.params),
    master_barang: countOf(`SELECT COUNT(*) AS cnt FROM barang`),
    master_customer: countOf(`SELECT COUNT(*) AS cnt FROM customer`),
    master_supplier: countOf(`SELECT COUNT(*) AS cnt FROM supplier`),
  };
}

function fetchOrdersDataset(type: 'in' | 'out', startDate?: string, endDate?: string): Record<string, any>[] {
  const filter = buildDateWhere('o.tgl', startDate, endDate);
  const partnerLabel = type === 'in' ? 'Supplier' : 'Customer';

  const rows = queryAll<any>(
    `SELECT
       o.no AS order_no,
       o.tgl AS tgl,
       CASE WHEN o.type = 'in' THEN s.kode ELSE c.kode END AS partner_kode,
       CASE WHEN o.type = 'in' THEN s.nama ELSE c.nama END AS partner_nama,
       b.kode AS barang_kode,
       b.part_number AS part_number,
       b.nama AS barang_nama,
       od.qty AS qty,
       od.qty_sent AS qty_sent,
       od.satuan AS satuan,
       od.price AS price,
       od.subtotal AS subtotal,
       o.dpp AS dpp,
       o.diskon AS diskon,
       o.ppn AS ppn,
       o.ongkir AS ongkir,
       o.total AS total
     FROM orders o
     LEFT JOIN supplier s ON o.supp_id = s.id
     LEFT JOIN customer c ON o.cust_id = c.id
     LEFT JOIN order_details od ON od.order_id = o.id
     LEFT JOIN barang b ON od.barang_id = b.id
     WHERE o.type = ?${filter.sql}
     ORDER BY o.tgl ASC, o.id ASC, od.id ASC`,
    [type, ...filter.params]
  );

  return rows.map((r, idx) => {
    const dppNet = Math.max(0, Number(r.dpp || 0) - Number(r.diskon || 0));
    const ppnNominal = dppNet * (Number(r.ppn || 0) / 100);
    const qty = Number(r.qty || 0);
    const qtySent = Number(r.qty_sent || 0);
    return {
      No_Urut: idx + 1,
      No_Order: r.order_no || '-',
      Tanggal: r.tgl || '-',
      [`Kode_${partnerLabel}`]: r.partner_kode || '-',
      [`Nama_${partnerLabel}`]: r.partner_nama || '-',
      Kode_Barang: r.barang_kode || '-',
      Part_Number: r.part_number || '-',
      Nama_Barang: r.barang_nama || '(Tidak ada detail item)',
      Qty_Order: qty,
      Qty_Terkirim: qtySent,
      Sisa_Belum_Kirim: Math.max(0, qty - qtySent),
      Satuan: r.satuan || '-',
      Harga_Satuan: Number(r.price || 0),
      Subtotal_Item: Number(r.subtotal || 0),
      DPP_Dokumen: Number(r.dpp || 0),
      Diskon_Dokumen: Number(r.diskon || 0),
      PPN_Persen: Number(r.ppn || 0),
      PPN_Nominal: Math.round(ppnNominal),
      Ongkir_Dokumen: Number(r.ongkir || 0),
      Total_Dokumen: Number(r.total || 0),
    };
  });
}

function fetchDeliveryNotesDataset(type: 'in' | 'out', startDate?: string, endDate?: string): Record<string, any>[] {
  const filter = buildDateWhere('dn.tgl', startDate, endDate);
  const partnerLabel = type === 'in' ? 'Supplier' : 'Customer';

  const rows = queryAll<any>(
    `SELECT
       dn.no AS dn_no,
       dn.tgl AS tgl,
       dn.order_no AS order_no,
       CASE WHEN dn.type = 'in' THEN s.kode ELSE c.kode END AS partner_kode,
       CASE WHEN dn.type = 'in' THEN s.nama ELSE c.nama END AS partner_nama,
       dn.alamat_tujuan AS alamat_tujuan,
       dn.keterangan AS keterangan,
       b.kode AS barang_kode,
       b.part_number AS part_number,
       b.nama AS barang_nama,
       b.satuan AS barang_satuan,
       dnd.qty_sent AS qty_sent
     FROM delivery_notes dn
     LEFT JOIN orders o ON o.no = dn.order_no
     LEFT JOIN supplier s ON o.supp_id = s.id
     LEFT JOIN customer c ON o.cust_id = c.id
     LEFT JOIN delivery_note_details dnd ON dnd.delivery_note_id = dn.id
     LEFT JOIN barang b ON dnd.barang_id = b.id
     WHERE dn.type = ?${filter.sql}
     ORDER BY dn.tgl ASC, dn.id ASC, dnd.id ASC`,
    [type, ...filter.params]
  );

  return rows.map((r, idx) => ({
    No_Urut: idx + 1,
    No_Surat_Jalan: r.dn_no || '-',
    Tanggal: r.tgl || '-',
    Ref_No_Order: r.order_no || '-',
    [`Kode_${partnerLabel}`]: r.partner_kode || '-',
    [`Nama_${partnerLabel}`]: r.partner_nama || '-',
    Alamat_Tujuan: r.alamat_tujuan || '-',
    Keterangan: r.keterangan || '-',
    Kode_Barang: r.barang_kode || '-',
    Part_Number: r.part_number || '-',
    Nama_Barang: r.barang_nama || '(Tidak ada detail item)',
    Qty_Barang: Number(r.qty_sent || 0),
    Satuan: r.barang_satuan || 'PCS',
  }));
}

function fetchSamplesDataset(startDate?: string, endDate?: string): Record<string, any>[] {
  const filter = buildDateWhere('sp.tgl', startDate, endDate);
  const rows = queryAll<any>(
    `SELECT
       sp.no AS sample_no,
       sp.tgl AS tgl,
       c.kode AS customer_kode,
       COALESCE(c.nama, sp.penerima_nama) AS penerima_nama,
       sp.keterangan AS keterangan,
       b.kode AS barang_kode,
       b.part_number AS part_number,
       b.nama AS barang_nama,
       sb.qty AS qty,
       COALESCE(sb.satuan, b.satuan) AS satuan
     FROM samples sp
     LEFT JOIN customer c ON sp.id_customer = c.id
     LEFT JOIN sample_barangs sb ON sb.id_sample = sp.id
     LEFT JOIN barang b ON sb.id_barangs = b.id
     WHERE 1=1${filter.sql}
     ORDER BY sp.tgl ASC, sp.id ASC, sb.id ASC`,
    filter.params
  );

  return rows.map((r, idx) => ({
    No_Urut: idx + 1,
    No_Sample: r.sample_no || '-',
    Tanggal: r.tgl || '-',
    Kode_Customer: r.customer_kode || '-',
    Penerima_Customer: r.penerima_nama || '-',
    Keterangan: r.keterangan || '-',
    Kode_Barang: r.barang_kode || '-',
    Part_Number: r.part_number || '-',
    Nama_Barang: r.barang_nama || '(Tidak ada detail item)',
    Qty_Sample: Number(r.qty || 0),
    Satuan: r.satuan || 'PCS',
  }));
}

function fetchInvoicesDataset(type: 'in' | 'out', startDate?: string, endDate?: string): Record<string, any>[] {
  const filter = buildDateWhere('inv.tgl', startDate, endDate);
  const partnerLabel = type === 'in' ? 'Supplier' : 'Customer';

  const rows = queryAll<any>(
    `SELECT
       inv.no AS inv_no,
       inv.tgl AS tgl,
       inv.order_no AS order_no,
       inv.delivery_note_no AS delivery_note_no,
       CASE WHEN inv.type = 'in' THEN s.kode ELSE c.kode END AS partner_kode,
       CASE WHEN inv.type = 'in' THEN s.nama ELSE c.nama END AS partner_nama,
       inv.status AS status,
       inv.dpp AS dpp,
       inv.diskon AS diskon,
       inv.ppn AS ppn,
       inv.ppn_nominal AS ppn_nominal,
       inv.ongkir AS ongkir,
       inv.total AS total,
       inv.paid AS paid,
       b.kode AS barang_kode,
       b.part_number AS part_number,
       b.nama AS barang_nama,
       invd.qty AS qty,
       invd.satuan AS satuan,
       invd.price AS price,
       invd.subtotal AS subtotal
     FROM invoices inv
     LEFT JOIN supplier s ON inv.supp_id = s.id
     LEFT JOIN customer c ON inv.cust_id = c.id
     LEFT JOIN invoice_details invd ON invd.invoice_id = inv.id
     LEFT JOIN barang b ON invd.barang_id = b.id
     WHERE inv.type = ?${filter.sql}
     ORDER BY inv.tgl ASC, inv.id ASC, invd.id ASC`,
    [type, ...filter.params]
  );

  return rows.map((r, idx) => {
    const grandTotal = Number(r.total || 0) + Number(r.ongkir || 0);
    const paid = Number(r.paid || 0);
    const sisa = Math.max(0, grandTotal - paid);
    return {
      No_Urut: idx + 1,
      No_Invoice: r.inv_no || '-',
      Tanggal: r.tgl || '-',
      Ref_No_Order: r.order_no || '-',
      Ref_No_Surat_Jalan: r.delivery_note_no || '-',
      [`Kode_${partnerLabel}`]: r.partner_kode || '-',
      [`Nama_${partnerLabel}`]: r.partner_nama || '-',
      Status_Tagihan: r.status || 'Belum Lunas',
      Kode_Barang: r.barang_kode || '-',
      Part_Number: r.part_number || '-',
      Nama_Barang: r.barang_nama || '(Tidak ada detail item)',
      Qty: Number(r.qty || 0),
      Satuan: r.satuan || '-',
      Harga_Satuan: Number(r.price || 0),
      Subtotal_Item: Number(r.subtotal || 0),
      DPP_Invoice: Number(r.dpp || 0),
      Diskon_Invoice: Number(r.diskon || 0),
      PPN_Persen: Number(r.ppn || 0),
      PPN_Nominal: Number(r.ppn_nominal || 0),
      Ongkir_Invoice: Number(r.ongkir || 0),
      Total_Tagihan_Akhir: grandTotal,
      Sudah_Dibayar: paid,
      Sisa_Tagihan: sisa,
    };
  });
}

function fetchPaymentsDataset(type: 'in' | 'out', startDate?: string, endDate?: string): Record<string, any>[] {
  const filter = buildDateWhere('p.tgl', startDate, endDate);
  const partnerLabel = type === 'in' ? 'Customer' : 'Supplier';

  const rows = queryAll<any>(
    `SELECT
       p.no AS pay_no,
       p.tgl AS tgl,
       CASE WHEN p.type = 'in' THEN c.kode ELSE s.kode END AS partner_kode,
       CASE WHEN p.type = 'in' THEN c.nama ELSE s.nama END AS partner_nama,
       p.received AS received,
       p.deduction AS deduction,
       p.deduction_note AS deduction_note,
       p.total AS total_alokasi,
       p.keterangan AS keterangan,
       inv.no AS invoice_no,
       inv.tgl AS invoice_tgl,
       (inv.total + inv.ongkir) AS invoice_tagihan,
       inv.status AS invoice_status,
       pd.subtotal AS alokasi_invoice
     FROM payments p
     LEFT JOIN customer c ON p.cust_id = c.id
     LEFT JOIN supplier s ON p.supp_id = s.id
     LEFT JOIN payment_details pd ON pd.payment_id = p.id
     LEFT JOIN invoices inv ON pd.invoice_id = inv.id
     WHERE p.type = ?${filter.sql}
     ORDER BY p.tgl ASC, p.id ASC, pd.id ASC`,
    [type, ...filter.params]
  );

  return rows.map((r, idx) => ({
    No_Urut: idx + 1,
    No_Pelunasan: r.pay_no || '-',
    Tanggal_Bayar: r.tgl || '-',
    [`Kode_${partnerLabel}`]: r.partner_kode || '-',
    [`Nama_${partnerLabel}`]: r.partner_nama || '-',
    No_Invoice_Dilunasi: r.invoice_no || '-',
    Tanggal_Invoice: r.invoice_tgl || '-',
    Total_Tagihan_Invoice: Number(r.invoice_tagihan || 0),
    Status_Invoice_Saat_Ini: r.invoice_status || '-',
    Nominal_Dialokasikan: Number(r.alokasi_invoice || 0),
    Uang_Riil_Transaksi: Number(r.received || 0),
    Potongan_Admin_Bank: Number(r.deduction || 0),
    Catatan_Potongan: r.deduction_note || '-',
    Total_Bukti_Pelunasan: Number(r.total_alokasi || 0),
    Keterangan: r.keterangan || '-',
  }));
}

function fetchMutasiDataset(startDate?: string, endDate?: string): Record<string, any>[] {
  const filter = buildDateWhere('m.tgl', startDate, endDate);
  const rows = queryAll<any>(
    `SELECT
       m.tgl AS tgl,
       m.type AS type,
       m.source AS source,
       b.kode AS barang_kode,
       b.part_number AS part_number,
       b.nama AS barang_nama,
       b.satuan AS barang_satuan,
       m.stok_sebelum AS stok_sebelum,
       m.qty AS qty,
       m.stok_sesudah AS stok_sesudah,
       m.keterangan AS keterangan
     FROM mutasi_barang m
     LEFT JOIN barang b ON m.barang_id = b.id
     WHERE 1=1${filter.sql}
     ORDER BY m.tgl ASC, m.id ASC`,
    filter.params
  );

  return rows.map((r, idx) => ({
    No_Urut: idx + 1,
    Tanggal: r.tgl || '-',
    Arah_Mutasi: r.type === 'in' ? 'MASUK (+)' : 'KELUAR (-)',
    Sumber_Dokumen: r.source || '-',
    Kode_Barang: r.barang_kode || '-',
    Part_Number: r.part_number || '-',
    Nama_Barang: r.barang_nama || '-',
    Stok_Sebelum: Number(r.stok_sebelum || 0),
    Qty_Mutasi: Number(r.qty || 0),
    Stok_Sesudah: Number(r.stok_sesudah || 0),
    Satuan: r.barang_satuan || 'PCS',
    Keterangan: r.keterangan || '-',
  }));
}

function fetchMasterBarangDataset(): Record<string, any>[] {
  const rows = queryAll<any>(
    `SELECT
       b.kode,
       b.part_number,
       b.nama,
       b.satuan,
       b.stock,
       s.kode AS supplier_kode,
       s.nama AS supplier_nama,
       b.keterangan
     FROM barang b
     LEFT JOIN supplier s ON b.supplier_id = s.id
     ORDER BY b.kode ASC, b.nama ASC`
  );
  return rows.map((r, idx) => ({
    No_Urut: idx + 1,
    Kode_Barang: r.kode || '-',
    Part_Number: r.part_number || '-',
    Nama_Barang: r.nama || '-',
    Satuan: r.satuan || 'PCS',
    Stok_Saat_Ini: Number(r.stock || 0),
    Kode_Supplier_Default: r.supplier_kode || '-',
    Nama_Supplier_Default: r.supplier_nama || '-',
    Keterangan: r.keterangan || '-',
  }));
}

function fetchMasterPartnerDataset(table: 'customer' | 'supplier'): Record<string, any>[] {
  const label = table === 'customer' ? 'Customer' : 'Supplier';
  const rows = queryAll<any>(`SELECT kode, nama, alamat, email, telepon, UP FROM ${table} ORDER BY kode ASC, nama ASC`);
  return rows.map((r, idx) => ({
    No_Urut: idx + 1,
    [`Kode_${label}`]: r.kode || '-',
    [`Nama_${label}`]: r.nama || '-',
    UP_Kontak: r.UP || '-',
    Telepon: r.telepon || '-',
    Email: r.email || '-',
    Alamat: r.alamat || '-',
  }));
}

function buildDatasetSpec(key: ExportDatasetKey, startDate?: string, endDate?: string): DatasetSheetSpec {
  switch (key) {
    case 'po':
      return {
        key,
        sheetName: 'PO (Pembelian)',
        fileSlug: 'PO_Pembelian',
        label: 'Purchase Order (PO - Masuk)',
        rows: fetchOrdersDataset('in', startDate, endDate),
      };
    case 'so':
      return {
        key,
        sheetName: 'SO (Penjualan)',
        fileSlug: 'SO_Penjualan',
        label: 'Sales Order (SO - Keluar)',
        rows: fetchOrdersDataset('out', startDate, endDate),
      };
    case 'sj_in':
      return {
        key,
        sheetName: 'SJ Masuk (Terima)',
        fileSlug: 'SJ_Masuk',
        label: 'Surat Jalan Masuk (Penerimaan)',
        rows: fetchDeliveryNotesDataset('in', startDate, endDate),
      };
    case 'sj_out':
      return {
        key,
        sheetName: 'SJ Keluar (Kirim)',
        fileSlug: 'SJ_Keluar',
        label: 'Surat Jalan Keluar (Pengiriman)',
        rows: fetchDeliveryNotesDataset('out', startDate, endDate),
      };
    case 'sample':
      return {
        key,
        sheetName: 'Tanda Terima Sampel',
        fileSlug: 'Sample_Barang',
        label: 'Tanda Terima Sampel (SP)',
        rows: fetchSamplesDataset(startDate, endDate),
      };
    case 'invoice_in':
      return {
        key,
        sheetName: 'Invoice Hutang (IN)',
        fileSlug: 'Invoice_Hutang_IN',
        label: 'Invoice Pembelian / Hutang (IN)',
        rows: fetchInvoicesDataset('in', startDate, endDate),
      };
    case 'invoice_out':
      return {
        key,
        sheetName: 'Invoice Piutang (OUT)',
        fileSlug: 'Invoice_Piutang_OUT',
        label: 'Invoice Penjualan / Piutang (OUT)',
        rows: fetchInvoicesDataset('out', startDate, endDate),
      };
    case 'payment_in':
      return {
        key,
        sheetName: 'Pelunasan Piutang (IN)',
        fileSlug: 'Pelunasan_Piutang_IN',
        label: 'Pelunasan Piutang Customer (IN)',
        rows: fetchPaymentsDataset('in', startDate, endDate),
      };
    case 'payment_out':
      return {
        key,
        sheetName: 'Pelunasan Hutang (OUT)',
        fileSlug: 'Pelunasan_Hutang_OUT',
        label: 'Pembayaran Hutang Supplier (OUT)',
        rows: fetchPaymentsDataset('out', startDate, endDate),
      };
    case 'mutasi':
      return {
        key,
        sheetName: 'Mutasi Stok Barang',
        fileSlug: 'Mutasi_Stok_Barang',
        label: 'Mutasi Stok Barang',
        rows: fetchMutasiDataset(startDate, endDate),
      };
    case 'master_barang':
      return {
        key,
        sheetName: 'Master Barang',
        fileSlug: 'Master_Barang',
        label: 'Master Data Barang & Stok',
        rows: fetchMasterBarangDataset(),
      };
    case 'master_customer':
      return {
        key,
        sheetName: 'Master Customer',
        fileSlug: 'Master_Customer',
        label: 'Master Data Customer',
        rows: fetchMasterPartnerDataset('customer'),
      };
    case 'master_supplier':
      return {
        key,
        sheetName: 'Master Supplier',
        fileSlug: 'Master_Supplier',
        label: 'Master Data Supplier',
        rows: fetchMasterPartnerDataset('supplier'),
      };
  }
}

function rowsToWorksheet(rows: Record<string, any>[]): XLSX.WorkSheet {
  if (rows.length === 0) {
    return XLSX.utils.aoa_to_sheet([['Tidak ada data pada rentang tanggal yang dipilih']]);
  }
  const ws = XLSX.utils.json_to_sheet(rows);
  const headers = Object.keys(rows[0]);
  ws['!cols'] = headers.map((h) => {
    let maxLen = h.length;
    for (const r of rows) {
      const val = r[h] !== null && r[h] !== undefined ? String(r[h]) : '';
      if (val.length > maxLen) maxLen = val.length;
    }
    return { wch: Math.min(Math.max(maxLen + 3, 12), 45) };
  });
  return ws;
}

function rowsToCsv(rows: Record<string, any>[]): string {
  if (rows.length === 0) {
    return 'Keterangan\r\nTidak ada data pada rentang tanggal yang dipilih\r\n';
  }
  const headers = Object.keys(rows[0]);
  const escapeCell = (val: any): string => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [headers.join(';')];
  for (const r of rows) {
    lines.push(headers.map((h) => escapeCell(r[h])).join(';'));
  }
  // Tambahkan UTF-8 BOM agar Excel langsung membaca karakter & pemisah dengan benar
  return '\uFEFF' + lines.join('\r\n');
}

export async function exportHumanBackup(req: HumanBackupRequest): Promise<HumanBackupResult> {
  if (!req.datasets || req.datasets.length === 0) {
    throw new Error('Pilih minimal satu jenis data yang ingin di-backup.');
  }

  const specs = req.datasets.map((key) => buildDatasetSpec(key, req.startDate, req.endDate));
  const dateRangeTag =
    req.startDate && req.endDate
      ? `${req.startDate}_sd_${req.endDate}`
      : req.startDate
        ? `mulai_${req.startDate}`
        : req.endDate
          ? `sampai_${req.endDate}`
          : `all_${new Date().toISOString().slice(0, 10)}`;

  const sheetSummary = specs.map((s) => ({
    key: s.key,
    label: s.label,
    rows: s.rows.length,
  }));

  if (req.format === 'xlsx') {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Simpan Backup Laporan Excel (.xlsx)',
      defaultPath: `Backup_ERP_${dateRangeTag}.xlsx`,
      filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }],
    });

    if (canceled || !filePath) {
      return { saved: false };
    }

    const wb = XLSX.utils.book_new();

    // Sheet pertama: Ringkasan Backup
    const infoRows = [
      {
        Parameter: 'Tanggal Export',
        Nilai: new Date().toLocaleString('id-ID'),
      },
      {
        Parameter: 'Filter Dari Tanggal',
        Nilai: req.startDate || 'Semua (Awal)',
      },
      {
        Parameter: 'Filter Sampai Tanggal',
        Nilai: req.endDate || 'Semua (Akhir)',
      },
      {
        Parameter: 'Jumlah Sheet Data',
        Nilai: String(specs.length),
      },
    ];
    const summaryRows = specs.map((s, idx) => ({
      No: idx + 1,
      Nama_Sheet: s.sheetName,
      Jenis_Data: s.label,
      Jumlah_Baris_Detail: s.rows.length,
    }));

    const wsInfo = XLSX.utils.json_to_sheet(infoRows);
    XLSX.utils.sheet_add_json(wsInfo, summaryRows, { origin: 'A7' });
    wsInfo['!cols'] = [{ wch: 24 }, { wch: 28 }, { wch: 36 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(wb, wsInfo, 'Ringkasan Backup');

    for (const spec of specs) {
      const ws = rowsToWorksheet(spec.rows);
      XLSX.utils.book_append_sheet(wb, ws, spec.sheetName.slice(0, 31));
    }

    const xlsxBuf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    fs.writeFileSync(filePath, xlsxBuf);

    return {
      saved: true,
      filePath,
      fileCount: 1,
      sheetSummary,
    };
  }

  // Format CSV: jika 1 dataset simpan 1 file .csv, jika >1 dataset pilih folder tujuan dan simpan terpisah per file
  if (specs.length === 1) {
    const single = specs[0];
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: `Simpan Backup CSV (${single.label})`,
      defaultPath: `Backup_${single.fileSlug}_${dateRangeTag}.csv`,
      filters: [{ name: 'CSV (Semicolon Delimited)', extensions: ['csv'] }],
    });

    if (canceled || !filePath) {
      return { saved: false };
    }

    fs.writeFileSync(filePath, rowsToCsv(single.rows), 'utf-8');
    return {
      saved: true,
      filePath,
      fileCount: 1,
      sheetSummary,
    };
  }

  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Pilih Folder Tujuan Penyimpanan File CSV Terpisah',
    properties: ['openDirectory', 'createDirectory'],
  });

  if (canceled || filePaths.length === 0) {
    return { saved: false };
  }

  const targetDir = filePaths[0];
  const subFolder = path.join(targetDir, `Backup_CSV_ERP_${dateRangeTag}`);
  if (!fs.existsSync(subFolder)) {
    fs.mkdirSync(subFolder, { recursive: true });
  }

  for (const spec of specs) {
    const csvPath = path.join(subFolder, `${spec.fileSlug}.csv`);
    fs.writeFileSync(csvPath, rowsToCsv(spec.rows), 'utf-8');
  }

  return {
    saved: true,
    filePath: subFolder,
    fileCount: specs.length,
    sheetSummary,
  };
}
