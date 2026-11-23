export type OrderType = 'in' | 'out'; // 'in' = PO (Beli), 'out' = SO (Jual)
export type DeliveryType = 'in' | 'out'; // 'in' = Terima Barang, 'out' = Kirim Barang
export type InvoiceType = 'in' | 'out'; // 'in' = Hutang (Supplier), 'out' = Piutang (Customer)
export type InvoiceStatus = 'Belum Lunas' | 'Cicil' | 'Lunas';
export type PaymentType = 'in' | 'out'; // 'in' = Terima Pelunasan Piutang, 'out' = Bayar Hutang
export type MutasiType = 'in' | 'out';
export type DocType = 'PO' | 'SO' | 'SJ' | 'SJ_DOT' | 'INVOICE' | 'INVOICE_DOT' | 'SAMPLE';
export type AppMode = 'mode_1_gudang' | 'mode_2_finance' | 'all';

// --- MASTER DATA ---
export interface Barang {
  id: number;
  kode: string;
  part_number: string;
  supplier_id: number | null;
  nama: string;
  satuan: string;
  keterangan: string;
  stock: number;
  supplier_nama?: string;
}

export interface Customer {
  id: number;
  kode: string;
  nama: string;
  alamat: string;
  email: string;
  telepon: string;
  UP: string;
}

export interface Supplier {
  id: number;
  kode: string;
  nama: string;
  alamat: string;
  email: string;
  telepon: string;
  UP: string;
}

// --- TRANSAKSI: ORDERS (PO / SO) ---
export interface OrderDetail {
  id?: number;
  order_id?: number;
  barang_id: number;
  qty: number;
  qty_sent: number;
  price: number;
  satuan: string;
  subtotal: number;
  // Joined fields
  barang_kode?: string;
  barang_nama?: string;
  part_number?: string;
  barang_keterangan?: string;
}

export interface Order {
  id?: number;
  tgl: string;
  no: string;
  type: OrderType;
  cust_id: number | null;
  supp_id: number | null;
  dpp: number;
  ppn: number; // persentase misal 11
  diskon: number;
  ongkir: number;
  total: number; // (dpp - diskon) + ppn_nominal
  deldate?: string;
  po_subject?: string;
  // Joined fields
  customer_nama?: string;
  supplier_nama?: string;
  details?: OrderDetail[];
}

// --- TRANSAKSI: DELIVERY NOTES (SURAT JALAN) ---
export interface DeliveryNoteDetail {
  id?: number;
  delivery_note_id?: number;
  order_detail_id: number | null;
  barang_id: number;
  qty_sent: number;
  // Joined fields
  barang_kode?: string;
  barang_nama?: string;
  barang_satuan?: string;
  part_number?: string;
}

export interface DeliveryNote {
  id?: number;
  no: string;
  tgl: string;
  order_no: string;
  alamat_tujuan: string;
  keterangan: string;
  type: DeliveryType;
  details?: DeliveryNoteDetail[];
}

export interface DeliveryNoteForInvoiceResult {
  delivery_note: DeliveryNote;
  order: Order | null;
  items: Array<{
    barang_id: number;
    barang_kode?: string;
    barang_nama?: string;
    part_number?: string;
    qty: number;
    satuan: string;
    price: number;
  }>;
}

// --- TRANSAKSI: INVOICES ---
export interface InvoiceDetail {
  id?: number;
  invoice_id?: number;
  barang_id: number;
  qty: number;
  satuan: string;
  price: number;
  subtotal: number;
  // Joined fields
  barang_kode?: string;
  barang_nama?: string;
  part_number?: string;
}

export interface Invoice {
  id?: number;
  no: string;
  tgl: string;
  type: InvoiceType;
  order_no: string;
  delivery_note_no: string;
  dpp: number;
  ppn: number; // persentase misal 11
  ppn_nominal: number;
  cust_id: number | null;
  supp_id: number | null;
  diskon: number;
  ongkir: number;
  total: number; // (dpp - diskon) + ppn_nominal
  paid: number;
  fully_paid?: number | null;
  status: InvoiceStatus;
  // Joined fields
  customer_nama?: string;
  supplier_nama?: string;
  details?: InvoiceDetail[];
}

// --- TRANSAKSI: PAYMENTS (PELUNASAN HUTANG / PIUTANG) ---
export interface PaymentDetail {
  id?: number;
  payment_id?: number;
  invoice_id: number;
  subtotal: number;
  // Joined fields
  invoice_no?: string;
  invoice_tgl?: string;
  invoice_total_tagihan?: number; // total + ongkir
  invoice_sisa?: number;
}

export interface PaymentPrefillDraft {
  type: PaymentType;
  partnerId: number;
  invoices: Invoice[];
}

export interface Payment {
  id?: number;
  no: string;
  tgl: string;
  total: number; // total dialokasikan ke invoice (received + deduction)
  received: number; // nominal riil diterima/dibayarkan
  deduction: number; // potongan admin/bank
  deduction_note: string;
  keterangan: string;
  type: PaymentType;
  cust_id: number | null;
  supp_id: number | null;
  // Joined fields
  customer_nama?: string;
  supplier_nama?: string;
  details?: PaymentDetail[];
}

// --- LOG MUTASI BARANG ---
export interface MutasiBarang {
  id: number;
  barang_id: number;
  type: MutasiType;
  qty: number;
  stok_sebelum: number;
  stok_sesudah: number;
  tgl: string;
  source: string;
  delivery_note_id: number | null;
  sample_id?: number | null;
  keterangan: string;
  // Joined fields
  barang_kode?: string;
  barang_nama?: string;
  barang_satuan?: string;
}

export interface MutasiBarangInput {
  barang_id: number;
  type: MutasiType;
  qty: number;
  tgl: string;
  source?: string;
  keterangan?: string;
}

// --- TRANSAKSI: SAMPLES ---
export interface SampleBarang {
  id?: number;
  id_sample?: number;
  id_barangs: number;
  qty: number;
  satuan?: string;
  // Joined fields
  barang_kode?: string;
  barang_nama?: string;
  barang_satuan?: string;
  part_number?: string;
}

export interface Sample {
  id?: number;
  no: string;
  tgl: string;
  id_customer: number | null;
  penerima_nama?: string;
  keterangan: string;
  // Joined fields
  customer_nama?: string;
  customer_alamat?: string;
  details?: SampleBarang[];
}

// --- OTA AUTO-UPDATE ---
export interface OtaManifest {
  version: string;
  releaseDate: string;
  notes: string;
  bundleUrl: string;
  sha256: string;
}

export interface UpdateCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseDate?: string;
  notes?: string;
  bundleUrl?: string;
  sha256?: string;
  offline?: boolean;
  error?: string;
}

export interface UpdateApplyResult {
  success: boolean;
  message: string;
}

// --- TEMPLATE & SETTINGS ---
export interface PdfTemplate {
  id: number;
  doc_type: DocType;
  name: string;
  html_content: string;
  css_content: string;
  updated_at: string;
}

export interface AppSettings {
  app_mode: AppMode;
  company_name: string;
  company_address: string;
  company_city: string;
  company_phone: string;
  company_email: string;
  company_logo: string;
  po_signer_name: string;
  po_signer_title: string;
  default_ppn: string;
}

// --- INTER-DIVISION JSON TRANSFER ---
export interface TransferDocumentPayload {
  format_version: '1.0';
  exported_at: string;
  doc_kind: 'ORDER' | 'DELIVERY_NOTE';
  header: Record<string, any>;
  partner?: Partial<Customer | Supplier> | null;
  items: Array<{
    barang_kode: string;
    barang_nama: string;
    part_number?: string;
    satuan: string;
    qty: number;
    price?: number;
    subtotal?: number;
  }>;
}

// --- HUMAN-READABLE EXCEL / CSV BACKUP ---
export type ExportDatasetKey =
  | 'po'
  | 'so'
  | 'sj_in'
  | 'sj_out'
  | 'sample'
  | 'invoice_in'
  | 'invoice_out'
  | 'payment_in'
  | 'payment_out'
  | 'mutasi'
  | 'master_barang'
  | 'master_customer'
  | 'master_supplier';

export interface HumanBackupRequest {
  format: 'xlsx' | 'csv';
  startDate?: string;
  endDate?: string;
  datasets: ExportDatasetKey[];
}

export interface HumanBackupPreviewCounts {
  po: number;
  so: number;
  sj_in: number;
  sj_out: number;
  sample: number;
  invoice_in: number;
  invoice_out: number;
  payment_in: number;
  payment_out: number;
  mutasi: number;
  master_barang: number;
  master_customer: number;
  master_supplier: number;
}

export interface HumanBackupResult {
  saved: boolean;
  filePath?: string;
  fileCount?: number;
  sheetSummary?: Array<{ key: ExportDatasetKey; label: string; rows: number }>;
}
