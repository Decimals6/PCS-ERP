import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { initDatabase, getDbPath } from './db/database';
import { runMigrations } from './db/migrations';
import * as masterService from './services/masterService';
import * as orderDeliveryService from './services/orderDeliveryService';
import * as invoicePaymentService from './services/invoicePaymentService';
import * as pdfBackupService from './services/pdfBackupService';
import * as exportBackupService from './services/exportBackupService';
import * as updaterService from './services/updaterService';
import { HumanBackupRequest, TransferDocumentPayload } from '../shared/types';

let mainWindow: BrowserWindow | null = null;

function createMainWindow(): void {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, '../build/icon.ico')
    : path.join(__dirname, '../../build/icon.ico');

  mainWindow = new BrowserWindow({
    width: 1340,
    height: 840,
    minWidth: 1080,
    minHeight: 680,
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    title: 'PCS-ERP - Sistem Administrasi & Dokumen Offline',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // <-- Tambahkan ini!
    },
  });

  if (!app.isPackaged) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }
}

function registerIpcHandlers(): void {
  // Master Barang
  ipcMain.handle('barang:list', () => masterService.listBarang());
  ipcMain.handle('barang:create', (_e, data) => masterService.createBarang(data));
  ipcMain.handle('barang:update', (_e, id, data) => masterService.updateBarang(id, data));
  ipcMain.handle('barang:delete', (_e, id) => masterService.deleteBarang(id));

  // Master Customer
  ipcMain.handle('customer:list', () => masterService.listCustomer());
  ipcMain.handle('customer:create', (_e, data) => masterService.createCustomer(data));
  ipcMain.handle('customer:update', (_e, id, data) => masterService.updateCustomer(id, data));
  ipcMain.handle('customer:delete', (_e, id) => masterService.deleteCustomer(id));

  // Master Supplier
  ipcMain.handle('supplier:list', () => masterService.listSupplier());
  ipcMain.handle('supplier:create', (_e, data) => masterService.createSupplier(data));
  ipcMain.handle('supplier:update', (_e, id, data) => masterService.updateSupplier(id, data));
  ipcMain.handle('supplier:delete', (_e, id) => masterService.deleteSupplier(id));

  // Bulk Import
  ipcMain.handle('master:bulkImport', (_e, entity, rows) =>
    masterService.bulkImportMaster(entity, rows)
  );

  // Orders
  ipcMain.handle('order:list', (_e, type) => orderDeliveryService.listOrders(type));
  ipcMain.handle('order:getById', (_e, id) => orderDeliveryService.getOrderById(id));
  ipcMain.handle('order:getByNo', (_e, no) => orderDeliveryService.getOrderByNo(no));
  ipcMain.handle('order:create', (_e, data) => orderDeliveryService.createOrder(data));
  ipcMain.handle('order:update', (_e, id, data) => orderDeliveryService.updateOrder(id, data));
  ipcMain.handle('order:delete', (_e, id) => orderDeliveryService.deleteOrder(id));

  // Delivery Notes
  ipcMain.handle('dn:list', (_e, type) => orderDeliveryService.listDeliveryNotes(type));
  ipcMain.handle('dn:getById', (_e, id) => orderDeliveryService.getDeliveryNoteById(id));
  ipcMain.handle('dn:getForInvoice', (_e, no) => orderDeliveryService.getDeliveryNoteForInvoice(no));
  ipcMain.handle('dn:create', (_e, data) => orderDeliveryService.createDeliveryNote(data));
  ipcMain.handle('dn:update', (_e, id, data) => orderDeliveryService.updateDeliveryNote(id, data));
  ipcMain.handle('dn:delete', (_e, id) => orderDeliveryService.deleteDeliveryNote(id));

  // Mutasi Barang
  ipcMain.handle('mutasi:list', (_e, barangId) => orderDeliveryService.listMutasiBarang(barangId));
  ipcMain.handle('mutasi:createManual', (_e, data) => orderDeliveryService.createManualMutasi(data));
  ipcMain.handle('mutasi:updateManual', (_e, id, data) => orderDeliveryService.updateManualMutasi(id, data));
  ipcMain.handle('mutasi:deleteManual', (_e, id) => orderDeliveryService.deleteManualMutasi(id));
  ipcMain.handle('mutasi:rebuildFromDocs', (_e, options) =>
    orderDeliveryService.rebuildMutasiAndStockFromDocuments(options)
  );

  // Samples
  ipcMain.handle('sample:list', () => orderDeliveryService.listSamples());
  ipcMain.handle('sample:getById', (_e, id) => orderDeliveryService.getSampleById(id));
  ipcMain.handle('sample:create', (_e, data) => orderDeliveryService.createSample(data));
  ipcMain.handle('sample:update', (_e, id, data) => orderDeliveryService.updateSample(id, data));
  ipcMain.handle('sample:delete', (_e, id) => orderDeliveryService.deleteSample(id));

  // Invoices
  ipcMain.handle('invoice:list', (_e, type) => invoicePaymentService.listInvoices(type));
  ipcMain.handle('invoice:getById', (_e, id) => invoicePaymentService.getInvoiceById(id));
  ipcMain.handle('invoice:listUnpaidByPartner', (_e, type, partnerId) =>
    invoicePaymentService.listUnpaidInvoicesByPartner(type, partnerId)
  );
  ipcMain.handle('invoice:create', (_e, data) => invoicePaymentService.createInvoice(data));
  ipcMain.handle('invoice:update', (_e, id, data) => invoicePaymentService.updateInvoice(id, data));
  ipcMain.handle('invoice:delete', (_e, id) => invoicePaymentService.deleteInvoice(id));

  // Payments
  ipcMain.handle('payment:list', (_e, type) => invoicePaymentService.listPayments(type));
  ipcMain.handle('payment:getById', (_e, id) => invoicePaymentService.getPaymentById(id));
  ipcMain.handle('payment:create', (_e, data) => invoicePaymentService.createPayment(data));
  ipcMain.handle('payment:update', (_e, id, data) => invoicePaymentService.updatePayment(id, data));
  ipcMain.handle('payment:delete', (_e, id) => invoicePaymentService.deletePayment(id));

  // Transfer JSON Antardivisi
  ipcMain.handle('transfer:exportJson', async (_e, docKind: 'ORDER' | 'DELIVERY_NOTE', id: number) => {
    const payload = orderDeliveryService.buildTransferPayload(docKind, id);
    const safeNo = String(payload.header.no || id).replace(/[^a-zA-Z0-9-_]/g, '_');
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: `Export Dokumen Transfer (${docKind})`,
      defaultPath: `TRANSFER_${docKind}_${safeNo}.json`,
      filters: [{ name: 'JSON Transfer File', extensions: ['json'] }],
    });
    if (canceled || !filePath) return { saved: false };
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8');
    return { saved: true, filePath };
  });

  ipcMain.handle('transfer:importJson', async (): Promise<TransferDocumentPayload | null> => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Pilih File Dokumen Transfer (.json)',
      filters: [{ name: 'JSON Transfer File', extensions: ['json'] }],
      properties: ['openFile'],
    });
    if (canceled || filePaths.length === 0) return null;
    const raw = fs.readFileSync(filePaths[0], 'utf-8');
    const parsed = JSON.parse(raw) as TransferDocumentPayload;
    if (!parsed.doc_kind || !Array.isArray(parsed.items)) {
      throw new Error('Format file transfer JSON tidak valid.');
    }
    return parsed;
  });

  // PDF, Templates, Settings & Backup
  ipcMain.handle('pdf:previewHtml', (_e, docType, docId) =>
    pdfBackupService.buildDocumentHtml(docType, docId)
  );
  ipcMain.handle('pdf:export', (_e, docType, docId) =>
    pdfBackupService.exportDocumentToPdf(docType, docId)
  );
  ipcMain.handle('pdf:printDirect', (_e, docType, docId) =>
    pdfBackupService.printDocumentDirect(docType, docId)
  );
  ipcMain.handle('template:list', () => pdfBackupService.listPdfTemplates());
  ipcMain.handle('template:update', (_e, docType, html, css) =>
    pdfBackupService.updatePdfTemplate(docType, html, css)
  );
  ipcMain.handle('template:reset', (_e, docType) => pdfBackupService.resetPdfTemplate(docType));
  ipcMain.handle('settings:get', () => pdfBackupService.getAppSettings());
  ipcMain.handle('settings:update', (_e, settings) => pdfBackupService.updateAppSettings(settings));
  ipcMain.handle('db:backup', () => pdfBackupService.backupDatabase());
  ipcMain.handle('db:restore', () => pdfBackupService.restoreDatabase());
  ipcMain.handle('db:path', () => getDbPath());
  ipcMain.handle('db:selectCustomBackupFolder', () => pdfBackupService.selectCustomBackupFolder());
  ipcMain.handle('db:openLocation', (_e, targetPath: string) => pdfBackupService.openBackupLocation(targetPath));

  // Human-Readable Excel / CSV Backup
  ipcMain.handle('backup:previewCounts', (_e, startDate?: string, endDate?: string) =>
    exportBackupService.previewHumanBackupCounts(startDate, endDate)
  );
  ipcMain.handle('backup:exportHuman', (_e, req: HumanBackupRequest) =>
    exportBackupService.exportHumanBackup(req)
  );

  // OTA Auto-Update
  ipcMain.handle('updater:version', () => updaterService.getCurrentAppVersion());
  ipcMain.handle('updater:check', () => updaterService.checkForOtaUpdate());
  ipcMain.handle('updater:apply', (_e, manifest) => updaterService.downloadAndApplyOtaUpdate(manifest));
}

app.whenReady().then(async () => {
  await initDatabase();
  runMigrations();
  registerIpcHandlers();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
