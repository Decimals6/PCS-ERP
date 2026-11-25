import { contextBridge, ipcRenderer } from 'electron';
import {
  AppSettings,
  Barang,
  Customer,
  DeliveryNote,
  DocType,
  HumanBackupRequest,
  Invoice,
  MutasiBarangInput,
  Order,
  Payment,
  RebuildMutasiOptions,
  RebuildMutasiResult,
  Sample,
  Supplier,
  TransferDocumentPayload,
} from '../shared/types';

const api = {
  // Master Barang
  listBarang: () => ipcRenderer.invoke('barang:list'),
  createBarang: (data: Omit<Barang, 'id'>) => ipcRenderer.invoke('barang:create', data),
  updateBarang: (id: number, data: Partial<Barang>) => ipcRenderer.invoke('barang:update', id, data),
  deleteBarang: (id: number) => ipcRenderer.invoke('barang:delete', id),

  // Master Customer
  listCustomer: () => ipcRenderer.invoke('customer:list'),
  createCustomer: (data: Omit<Customer, 'id'>) => ipcRenderer.invoke('customer:create', data),
  updateCustomer: (id: number, data: Partial<Customer>) => ipcRenderer.invoke('customer:update', id, data),
  deleteCustomer: (id: number) => ipcRenderer.invoke('customer:delete', id),

  // Master Supplier
  listSupplier: () => ipcRenderer.invoke('supplier:list'),
  createSupplier: (data: Omit<Supplier, 'id'>) => ipcRenderer.invoke('supplier:create', data),
  updateSupplier: (id: number, data: Partial<Supplier>) => ipcRenderer.invoke('supplier:update', id, data),
  deleteSupplier: (id: number) => ipcRenderer.invoke('supplier:delete', id),

  // Bulk Import Master
  bulkImportMaster: (entity: 'barang' | 'customer' | 'supplier', rows: Record<string, any>[]) =>
    ipcRenderer.invoke('master:bulkImport', entity, rows),

  // Orders (PO / SO)
  listOrders: (type?: 'in' | 'out') => ipcRenderer.invoke('order:list', type),
  getOrderById: (id: number) => ipcRenderer.invoke('order:getById', id),
  getOrderByNo: (no: string) => ipcRenderer.invoke('order:getByNo', no),
  createOrder: (data: Order) => ipcRenderer.invoke('order:create', data),
  updateOrder: (id: number, data: Order) => ipcRenderer.invoke('order:update', id, data),
  deleteOrder: (id: number) => ipcRenderer.invoke('order:delete', id),

  // Delivery Notes (Surat Jalan)
  listDeliveryNotes: (type?: 'in' | 'out') => ipcRenderer.invoke('dn:list', type),
  getDeliveryNoteById: (id: number) => ipcRenderer.invoke('dn:getById', id),
  getDeliveryNoteForInvoice: (no: string) => ipcRenderer.invoke('dn:getForInvoice', no),
  createDeliveryNote: (data: DeliveryNote) => ipcRenderer.invoke('dn:create', data),
  updateDeliveryNote: (id: number, data: DeliveryNote) => ipcRenderer.invoke('dn:update', id, data),
  deleteDeliveryNote: (id: number) => ipcRenderer.invoke('dn:delete', id),

  // Mutasi Barang
  listMutasiBarang: (barangId?: number) => ipcRenderer.invoke('mutasi:list', barangId),
  createManualMutasi: (data: MutasiBarangInput) => ipcRenderer.invoke('mutasi:createManual', data),
  updateManualMutasi: (id: number, data: MutasiBarangInput) => ipcRenderer.invoke('mutasi:updateManual', id, data),
  deleteManualMutasi: (id: number) => ipcRenderer.invoke('mutasi:deleteManual', id),
  rebuildMutasiFromDocs: (options: RebuildMutasiOptions) =>
    ipcRenderer.invoke('mutasi:rebuildFromDocs', options) as Promise<RebuildMutasiResult>,

  // Samples
  listSamples: () => ipcRenderer.invoke('sample:list'),
  getSampleById: (id: number) => ipcRenderer.invoke('sample:getById', id),
  createSample: (data: Sample) => ipcRenderer.invoke('sample:create', data),
  updateSample: (id: number, data: Sample) => ipcRenderer.invoke('sample:update', id, data),
  deleteSample: (id: number) => ipcRenderer.invoke('sample:delete', id),

  // Invoices
  listInvoices: (type?: 'in' | 'out') => ipcRenderer.invoke('invoice:list', type),
  getInvoiceById: (id: number) => ipcRenderer.invoke('invoice:getById', id),
  listUnpaidInvoicesByPartner: (type: 'in' | 'out', partnerId: number) =>
    ipcRenderer.invoke('invoice:listUnpaidByPartner', type, partnerId),
  createInvoice: (data: Invoice) => ipcRenderer.invoke('invoice:create', data),
  updateInvoice: (id: number, data: Invoice) => ipcRenderer.invoke('invoice:update', id, data),
  deleteInvoice: (id: number) => ipcRenderer.invoke('invoice:delete', id),

  // Payments
  listPayments: (type?: 'in' | 'out') => ipcRenderer.invoke('payment:list', type),
  getPaymentById: (id: number) => ipcRenderer.invoke('payment:getById', id),
  createPayment: (data: Payment) => ipcRenderer.invoke('payment:create', data),
  updatePayment: (id: number, data: Payment) => ipcRenderer.invoke('payment:update', id, data),
  deletePayment: (id: number) => ipcRenderer.invoke('payment:delete', id),

  // Transfer JSON Antardivisi
  exportTransferJson: (docKind: 'ORDER' | 'DELIVERY_NOTE', id: number) =>
    ipcRenderer.invoke('transfer:exportJson', docKind, id),
  importTransferJson: () => ipcRenderer.invoke('transfer:importJson') as Promise<TransferDocumentPayload | null>,

  // PDF & Templates & Settings & Backup
  buildDocumentHtml: (docType: DocType, docId: number) => ipcRenderer.invoke('pdf:previewHtml', docType, docId),
  exportDocumentToPdf: (docType: DocType, docId: number) => ipcRenderer.invoke('pdf:export', docType, docId),
  printDocumentDirect: (docType: DocType, docId: number) => ipcRenderer.invoke('pdf:printDirect', docType, docId),
  listPdfTemplates: () => ipcRenderer.invoke('template:list'),
  updatePdfTemplate: (docType: DocType, htmlContent: string, cssContent: string) =>
    ipcRenderer.invoke('template:update', docType, htmlContent, cssContent),
  resetPdfTemplate: (docType: DocType) => ipcRenderer.invoke('template:reset', docType),
  getAppSettings: () => ipcRenderer.invoke('settings:get'),
  updateAppSettings: (settings: Partial<AppSettings>) => ipcRenderer.invoke('settings:update', settings),
  backupDatabase: () => ipcRenderer.invoke('db:backup'),
  restoreDatabase: () => ipcRenderer.invoke('db:restore'),
  getDbPath: () => ipcRenderer.invoke('db:path'),
  selectCustomBackupFolder: () => ipcRenderer.invoke('db:selectCustomBackupFolder'),
  openBackupLocation: (targetPath: string) => ipcRenderer.invoke('db:openLocation', targetPath),
  previewHumanBackupCounts: (startDate?: string, endDate?: string) =>
    ipcRenderer.invoke('backup:previewCounts', startDate, endDate),
  exportHumanBackup: (req: HumanBackupRequest) => ipcRenderer.invoke('backup:exportHuman', req),

  // OTA Auto-Update
  getCurrentAppVersion: () => ipcRenderer.invoke('updater:version') as Promise<string>,
  checkForOtaUpdate: () => ipcRenderer.invoke('updater:check'),
  applyOtaUpdate: (manifest: { version: string; bundleUrl: string; sha256: string }) =>
    ipcRenderer.invoke('updater:apply', manifest),
};

contextBridge.exposeInMainWorld('api', api);

export type ElectronApi = typeof api;
