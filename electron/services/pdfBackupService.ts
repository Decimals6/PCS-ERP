import { BrowserWindow, dialog, shell } from 'electron';
import { execFile } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { queryAll, queryOne, execute, getDbPath, reloadDatabaseFromFile, saveDatabase } from '../db/database';
import { runMigrations } from '../db/migrations';
import { DEFAULT_PDF_TEMPLATES } from '../db/defaultTemplates';
import { AppSettings, DocType, PdfTemplate } from '../../shared/types';
import { getOrderById, getOrderByNo, getDeliveryNoteById, getSampleById } from './orderDeliveryService';
import { getInvoiceById } from './invoicePaymentService';

// ==================== SETTINGS & TEMPLATES ====================
export function getAppSettings(): AppSettings {
  const rows = queryAll<{ key: string; value: string }>('SELECT key, value FROM app_settings');
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;

  return {
    app_mode: (map.app_mode as any) || 'all',
    company_name: map.company_name || 'PT PILAR CERAH SEJAHTERA',
    company_address: map.company_address || '',
    company_city: map.company_city || 'Surabaya',
    company_phone: map.company_phone || '',
    company_email: map.company_email || '',
    company_logo: map.company_logo || '',
    po_signer_name: map.po_signer_name || 'Tri Tjahyono Eprijarto',
    po_signer_title: map.po_signer_title || 'Direktur',
    default_ppn: map.default_ppn || '11',
    custom_backup_dir: map.custom_backup_dir || '',
  };
}

export function updateAppSettings(settings: Partial<AppSettings>): AppSettings {
  for (const [k, v] of Object.entries(settings)) {
    if (v !== undefined) {
      execute(
        'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        [k, String(v)]
      );
    }
  }
  return getAppSettings();
}

export function listPdfTemplates(): PdfTemplate[] {
  const now = new Date().toISOString();
  for (const seed of DEFAULT_PDF_TEMPLATES) {
    const exists = queryOne('SELECT id FROM pdf_templates WHERE doc_type = ?', [seed.doc_type]);
    if (!exists) {
      execute(
        'INSERT INTO pdf_templates (doc_type, name, html_content, css_content, updated_at) VALUES (?, ?, ?, ?, ?)',
        [seed.doc_type, seed.name, seed.html_content, seed.css_content, now]
      );
    }
  }
  return queryAll<PdfTemplate>('SELECT * FROM pdf_templates ORDER BY id ASC');
}

export function getPdfTemplate(docType: DocType): PdfTemplate | null {
  let tpl = queryOne<PdfTemplate>('SELECT * FROM pdf_templates WHERE doc_type = ?', [docType]);
  if (!tpl) {
    const seed = DEFAULT_PDF_TEMPLATES.find((t) => t.doc_type === docType);
    if (seed) {
      const now = new Date().toISOString();
      execute(
        'INSERT INTO pdf_templates (doc_type, name, html_content, css_content, updated_at) VALUES (?, ?, ?, ?, ?)',
        [seed.doc_type, seed.name, seed.html_content, seed.css_content, now]
      );
      tpl = queryOne<PdfTemplate>('SELECT * FROM pdf_templates WHERE doc_type = ?', [docType]);
    }
  }
  return tpl;
}

export function updatePdfTemplate(
  docType: DocType,
  htmlContent: string,
  cssContent: string
): PdfTemplate {
  const now = new Date().toISOString();
  execute(
    'UPDATE pdf_templates SET html_content = ?, css_content = ?, updated_at = ? WHERE doc_type = ?',
    [htmlContent, cssContent, now, docType]
  );
  return getPdfTemplate(docType)!;
}

export function resetPdfTemplate(docType: DocType): PdfTemplate {
  const seed = DEFAULT_PDF_TEMPLATES.find((t) => t.doc_type === docType);
  if (!seed) throw new Error('Template default tidak ditemukan.');
  return updatePdfTemplate(docType, seed.html_content, seed.css_content);
}

// ==================== FORMATTER & RENDER HTML ====================
function formatRupiah(val: number): string {
  return 'Rp ' + Number(val || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 });
}

function formatPlainNumber(val: number, maxDecimals = 0): string {
  return Number(val || 0).toLocaleString('id-ID', { maximumFractionDigits: maxDecimals });
}

function formatQtyPdf(val: number): string {
  const num = Number(val || 0);
  return num.toFixed(2);
}

function formatQtyDot(val: number): string {
  const num = Number(val || 0);
  return num.toLocaleString('id-ID', { maximumFractionDigits: 2 });
}

function formatLongDate(isoStr: string): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const m = String(isoStr || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const year = m[1];
    const monthIdx = parseInt(m[2], 10) - 1;
    const day = parseInt(m[3], 10);
    if (monthIdx >= 0 && monthIdx < 12) {
      return `${day} ${months[monthIdx]} ${year}`;
    }
  }
  return isoStr || '-';
}

function formatIndoDate(isoStr: string): string {
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];
  const m = String(isoStr || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const year = m[1];
    const monthIdx = parseInt(m[2], 10) - 1;
    const day = String(parseInt(m[3], 10)).padStart(2, '0');
    if (monthIdx >= 0 && monthIdx < 12) {
      return `${day} ${months[monthIdx]} ${year}`;
    }
  }
  return isoStr || '-';
}

function formatPoUnitPrice(val: number): string {
  const num = Number(val || 0);
  const hasDecimals = Math.abs(num - Math.round(num)) > 0.0001;
  return num.toLocaleString('id-ID', {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  });
}

function formatSatuanTitle(sat?: string): string {
  const raw = String(sat || 'PCS').trim();
  if (!raw) return 'Pcs';
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

function numberToWordsId(n: number): string {
  const num = Math.round(Math.abs(Number(n || 0)));
  if (num === 0) return 'Nol';

  const satuan = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'];

  const convert = (x: number): string => {
    if (x < 12) return satuan[x];
    if (x < 20) return `${satuan[x - 10]} Belas`;
    if (x < 100) {
      const puluh = Math.floor(x / 10);
      const sisa = x % 10;
      return `${satuan[puluh]} Puluh${sisa > 0 ? ' ' + convert(sisa) : ''}`;
    }
    if (x < 200) return `Seratus${x - 100 > 0 ? ' ' + convert(x - 100) : ''}`;
    if (x < 1000) {
      const ratus = Math.floor(x / 100);
      const sisa = x % 100;
      return `${satuan[ratus]} Ratus${sisa > 0 ? ' ' + convert(sisa) : ''}`;
    }
    if (x < 2000) return `Seribu${x - 1000 > 0 ? ' ' + convert(x - 1000) : ''}`;
    if (x < 1000000) {
      const ribu = Math.floor(x / 1000);
      const sisa = x % 1000;
      return `${convert(ribu)} Ribu${sisa > 0 ? ' ' + convert(sisa) : ''}`;
    }
    if (x < 1000000000) {
      const juta = Math.floor(x / 1000000);
      const sisa = x % 1000000;
      return `${convert(juta)} Juta${sisa > 0 ? ' ' + convert(sisa) : ''}`;
    }
    if (x < 1000000000000) {
      const milyar = Math.floor(x / 1000000000);
      const sisa = x % 1000000000;
      return `${convert(milyar)} Milyar${sisa > 0 ? ' ' + convert(sisa) : ''}`;
    }
    const triliun = Math.floor(x / 1000000000000);
    const sisa = x % 1000000000000;
    return `${convert(triliun)} Triliun${sisa > 0 ? ' ' + convert(sisa) : ''}`;
  };

  return convert(num).trim();
}

function terbilangRupiah(val: number): string {
  return `${numberToWordsId(val)} Rupiah`;
}

function escapeHtml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function applyPlaceholders(html: string, vars: Record<string, string>): string {
  let out = html;
  for (const [key, val] of Object.entries(vars)) {
    out = out.split(`{{${key}}}`).join(val);
  }
  return out;
}

export function buildDocumentHtml(docType: DocType, docId: number): { html: string; defaultFilename: string } {
  const tpl = getPdfTemplate(docType);
  if (!tpl) throw new Error(`Template PDF untuk ${docType} tidak ditemukan.`);
  const settings = getAppSettings();

  const rawLogo = String(settings.company_logo || '').trim();
  const companyLogoImg =
    rawLogo && (rawLogo.startsWith('data:image/') || rawLogo.startsWith('http'))
      ? `<img src="${rawLogo.replace(/"/g, '&quot;')}" alt="Logo Perusahaan" />`
      : '';

  let vars: Record<string, string> = {
    company_name: escapeHtml(settings.company_name),
    company_address: escapeHtml(settings.company_address),
    company_city: escapeHtml(settings.company_city || 'Surabaya'),
    company_phone: escapeHtml(settings.company_phone),
    company_email: escapeHtml(settings.company_email),
    company_logo: rawLogo,
    company_logo_img: companyLogoImg,
    po_signer_name: escapeHtml(settings.po_signer_name || 'Tri Tjahyono Eprijarto'),
    po_signer_title: escapeHtml(settings.po_signer_title || 'Direktur'),
  };
  let defaultFilename = `${docType}-${docId}.pdf`;

  if (docType === 'PO' || docType === 'SO') {
    const order = getOrderById(docId);
    if (!order) throw new Error('Dokumen Order tidak ditemukan.');
    defaultFilename = `${docType}_${order.no.replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`;

    const partner =
      order.type === 'out' && order.cust_id
        ? queryOne<any>('SELECT * FROM customer WHERE id = ?', [order.cust_id])
        : order.type === 'in' && order.supp_id
          ? queryOne<any>('SELECT * FROM supplier WHERE id = ?', [order.supp_id])
          : null;

    const dppNet = Math.max(0, Number(order.dpp || 0) - Number(order.diskon || 0));
    const ppnNominal = dppNet * (Number(order.ppn || 0) / 100);
    const itemsRows = (order.details || [])
      .map(
        (d, idx) => `<tr><td class="text-center">${idx + 1}</td><td>${escapeHtml(d.barang_kode || '-')} ${d.part_number ? '/ ' + escapeHtml(d.part_number) : ''}</td><td>${escapeHtml(d.barang_nama || '-')}</td><td class="text-right">${d.qty}</td><td>${escapeHtml(d.satuan)}</td><td class="text-right">${formatRupiah(d.price)}</td><td class="text-right">${formatRupiah(d.subtotal)}</td></tr>`
      )
      .join('');

    const itemsRowsPoPdf = (order.details || [])
      .map((d, idx) => {
        const specText = String(d.barang_keterangan || '').trim();
        const specHtml = specText ? `<div class="item-spec">${escapeHtml(specText)}</div>` : '';
        return `<tr>
          <td class="item-cell text-center">${idx + 1}</td>
          <td class="item-cell"><div>${escapeHtml(d.barang_nama || '-')}</div>${specHtml}</td>
          <td class="item-cell text-center">${formatPlainNumber(d.qty, 2)}</td>
          <td class="item-cell text-center">${escapeHtml(formatSatuanTitle(d.satuan))}</td>
          <td class="item-cell text-center">${formatPoUnitPrice(d.price)}</td>
          <td class="item-cell text-right">${formatPlainNumber(d.subtotal, 0)}</td>
        </tr>`;
      })
      .join('');

    const poSubject = String(order.po_subject || '').trim() || 'Label Barcode & Carbon Ribbon';
    const deldateIndo = order.deldate ? formatIndoDate(order.deldate) : '-';

    vars = {
      ...vars,
      no: escapeHtml(order.no),
      tgl: escapeHtml(order.tgl),
      tgl_indo: escapeHtml(formatIndoDate(order.tgl)),
      deldate: escapeHtml(order.deldate || '-'),
      deldate_indo: escapeHtml(deldateIndo),
      po_subject: escapeHtml(poSubject),
      partner_nama: escapeHtml(partner?.nama || '-'),
      partner_alamat: escapeHtml(partner?.alamat || '-'),
      partner_telepon: escapeHtml(partner?.telepon || '-'),
      partner_up: escapeHtml(partner?.UP || '-'),
      items_rows: itemsRows,
      items_rows_po_pdf: itemsRowsPoPdf,
      dpp: formatRupiah(order.dpp),
      dpp_net_plain: formatPlainNumber(dppNet, 0),
      diskon: formatRupiah(order.diskon),
      ppn: String(order.ppn),
      ppn_nominal: formatRupiah(ppnNominal),
      ppn_nominal_plain: formatPlainNumber(ppnNominal, 0),
      ongkir: formatRupiah(order.ongkir),
      total: formatRupiah(order.total),
      total_plain: formatPlainNumber(order.total, 0),
      terbilang: escapeHtml(terbilangRupiah(order.total)),
    };
  } else if (docType === 'SJ' || docType === 'SJ_DOT') {
    const dn = getDeliveryNoteById(docId);
    if (!dn) throw new Error('Dokumen Surat Jalan tidak ditemukan.');
    const suffixTag = docType === 'SJ_DOT' ? '_DOT' : '';
    defaultFilename = `SJ_${dn.no.replace(/[^a-zA-Z0-9-_]/g, '_')}${suffixTag}.pdf`;

    const order = dn.order_no ? getOrderByNo(dn.order_no) : null;
    const partner =
      dn.type === 'out' && order?.cust_id
        ? queryOne<any>('SELECT * FROM customer WHERE id = ?', [order.cust_id])
        : dn.type === 'in' && order?.supp_id
          ? queryOne<any>('SELECT * FROM supplier WHERE id = ?', [order.supp_id])
          : null;

    const formatSatuanSj = (sat?: string): string => {
      const raw = String(sat || 'PCS').trim();
      if (!raw) return 'Pcs';
      return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
    };

    const itemsRows = (dn.details || [])
      .map(
        (d, idx) => `<tr><td class="text-center">${idx + 1}</td><td>${escapeHtml(d.barang_kode || '-')}</td><td>${escapeHtml(d.part_number || '-')}</td><td>${escapeHtml(d.barang_nama || '-')}</td><td class="text-right">${d.qty_sent}</td><td>${escapeHtml(d.barang_satuan || 'PCS')}</td></tr>`
      )
      .join('');

    const itemsRowsSjPdf = (dn.details || [])
      .map(
        (d, idx) => `<tr><td class="text-center">${idx + 1}</td><td class="text-center">${formatQtyDot(d.qty_sent)} ${escapeHtml(formatSatuanSj(d.barang_satuan))}</td><td>${escapeHtml(d.barang_nama || '-')}</td><td></td></tr>`
      )
      .join('');

    const itemsRowsSjDot = (dn.details || [])
      .map(
        (d, idx) => `<tr><td class="text-center">${idx + 1}</td><td class="text-center">${formatQtyDot(d.qty_sent)} ${escapeHtml(formatSatuanSj(d.barang_satuan))}</td><td>${escapeHtml(d.barang_nama || '-')}</td><td></td></tr>`
      )
      .join('');

    const partnerNama = partner?.nama || '';
    const partnerUp = partner?.UP ? String(partner.UP).trim() : '';
    const customerLine = partnerNama
      ? partnerUp
        ? `${partnerNama.toUpperCase()}, UP : ${partnerUp.toUpperCase()}`
        : partnerNama.toUpperCase()
      : '-';

    vars = {
      ...vars,
      no: escapeHtml(dn.no),
      tgl: escapeHtml(dn.tgl),
      tgl_long: escapeHtml(formatLongDate(dn.tgl)),
      order_no: escapeHtml(dn.order_no || '-'),
      po_no_display: escapeHtml(dn.order_no || ''),
      partner_nama: escapeHtml(partnerNama || '-'),
      partner_up: escapeHtml(partnerUp || '-'),
      customer_line: escapeHtml(customerLine),
      partner_alamat: escapeHtml(partner?.alamat || dn.alamat_tujuan || '-'),
      partner_telepon: escapeHtml(partner?.telepon || '-'),
      alamat_tujuan: escapeHtml(dn.alamat_tujuan || partner?.alamat || '-'),
      keterangan: escapeHtml(dn.keterangan || '-'),
      jenis_sj: dn.type === 'in' ? 'Penerimaan Barang (Masuk)' : 'Pengiriman Barang (Keluar)',
      items_rows: itemsRows,
      items_rows_sj_pdf: itemsRowsSjPdf,
      items_rows_sj_dot: itemsRowsSjDot,
    };
  } else if (docType === 'INVOICE' || docType === 'INVOICE_DOT') {
    const inv = getInvoiceById(docId);
    if (!inv) throw new Error('Dokumen Invoice tidak ditemukan.');
    const suffixTag = docType === 'INVOICE_DOT' ? '_DOT' : '';
    defaultFilename = `INV_${inv.no.replace(/[^a-zA-Z0-9-_]/g, '_')}${suffixTag}.pdf`;

    const partner =
      inv.type === 'out' && inv.cust_id
        ? queryOne<any>('SELECT * FROM customer WHERE id = ?', [inv.cust_id])
        : inv.type === 'in' && inv.supp_id
          ? queryOne<any>('SELECT * FROM supplier WHERE id = ?', [inv.supp_id])
          : null;

    const itemsRows = (inv.details || [])
      .map(
        (d, idx) => `<tr><td class="text-center">${idx + 1}</td><td>${escapeHtml(d.barang_kode || '-')} ${d.part_number ? '/ ' + escapeHtml(d.part_number) : ''}</td><td>${escapeHtml(d.barang_nama || '-')}</td><td class="text-right">${d.qty}</td><td>${escapeHtml(d.satuan)}</td><td class="text-right">${formatRupiah(d.price)}</td><td class="text-right">${formatRupiah(d.subtotal)}</td></tr>`
      )
      .join('');

    const itemsRowsPdf = (inv.details || [])
      .map(
        (d, idx) => `<tr><td class="text-center">${idx + 1}</td><td>${escapeHtml(d.barang_nama || '-')}</td><td class="text-right">${formatQtyPdf(d.qty)}</td><td class="text-right">${formatPlainNumber(d.price, 2)}</td><td class="text-right">${formatPlainNumber(d.subtotal, 0)}</td></tr>`
      )
      .join('');

    const itemsRowsDot = (inv.details || [])
      .map(
        (d, idx) => `<tr><td class="text-center">${idx + 1}</td><td>${escapeHtml(d.barang_nama || '-')}</td><td class="text-center">${formatQtyDot(d.qty)}</td><td class="text-right">${formatPlainNumber(d.price, 2)}</td><td class="text-right">${formatPlainNumber(d.subtotal, 0)}</td></tr>`
      )
      .join('');

    const dppNet = Math.max(0, Number(inv.dpp || 0) - Number(inv.diskon || 0));
    const grandTotalVal = Number(inv.total || 0) + Number(inv.ongkir || 0);

    vars = {
      ...vars,
      no: escapeHtml(inv.no),
      tgl: escapeHtml(inv.tgl),
      tgl_long: escapeHtml(formatLongDate(inv.tgl)),
      order_no: escapeHtml(inv.order_no || '-'),
      delivery_note_no: escapeHtml(inv.delivery_note_no || '-'),
      status: escapeHtml(inv.status),
      jenis_invoice: inv.type === 'out' ? 'Invoice Penjualan (Piutang)' : 'Invoice Pembelian (Hutang)',
      partner_nama: escapeHtml(partner?.nama || '-'),
      partner_alamat: escapeHtml(partner?.alamat || '-'),
      partner_telepon: escapeHtml(partner?.telepon || '-'),
      partner_up: escapeHtml(partner?.UP || '-'),
      items_rows: itemsRows,
      items_rows_pdf: itemsRowsPdf,
      items_rows_dot: itemsRowsDot,
      dpp: formatRupiah(inv.dpp),
      dpp_net: docType === 'INVOICE_DOT' ? formatPlainNumber(dppNet, 0) : formatRupiah(dppNet),
      diskon: formatRupiah(inv.diskon),
      ppn: String(inv.ppn),
      ppn_nominal: formatRupiah(inv.ppn_nominal),
      ongkir: formatRupiah(inv.ongkir),
      total: formatRupiah(inv.total),
      grand_total: formatRupiah(grandTotalVal),
      grand_total_plain: formatPlainNumber(grandTotalVal, 0),
      pembulatan: '0',
      terbilang: escapeHtml(terbilangRupiah(grandTotalVal)),
      bank_name: 'BCA',
      bank_account: '009-3333-095',
      bank_account_spaced: '009 - 3333 - 095',
    };
  } else if (docType === 'SAMPLE') {
    const sp = getSampleById(docId);
    if (!sp) throw new Error('Dokumen Sample tidak ditemukan.');
    defaultFilename = `SAMPLE_${sp.no.replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`;

    const formatCompanyTitle = (raw: string): string => {
      const trimmed = String(raw || '').trim();
      if (!trimmed) return 'PT Pilar Cerah Sejahtera';
      return trimmed
        .split(/\s+/)
        .map((w) => (w.toUpperCase() === 'PT' || w.toUpperCase() === 'CV' ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
        .join(' ');
    };

    const itemDescriptions = (sp.details || []).map((d) => {
      const qtyStr = formatPlainNumber(d.qty, 2);
      const satStr = escapeHtml(d.satuan || d.barang_satuan || 'PCS');
      const namaStr = escapeHtml(d.barang_nama || '-');
      return `${namaStr} = ${qtyStr} ${satStr}`;
    });

    const sampleItemsLines =
      itemDescriptions.length <= 1
        ? `<div class="line-val">${itemDescriptions[0] || '-'}</div><div class="line-sub"></div>`
        : itemDescriptions.map((line) => `<div class="line-val">${line}</div>`).join('');

    const penerimaNama = sp.customer_nama || sp.penerima_nama || '-';
    const companyTitle = formatCompanyTitle(settings.company_name);
    const companyCityUpper = String(settings.company_city || 'KEC. DRIYOREJO, KAB. GRESIK').toUpperCase();

    vars = {
      ...vars,
      no: escapeHtml(sp.no),
      tgl: escapeHtml(sp.tgl),
      tgl_long: escapeHtml(formatLongDate(sp.tgl)),
      company_name_title: escapeHtml(companyTitle),
      company_city_upper: escapeHtml(companyCityUpper),
      penerima_nama: escapeHtml(penerimaNama),
      keterangan: escapeHtml(sp.keterangan || 'SAMPLE UNTUK CUSTOMER'),
      sample_items_lines: sampleItemsLines,
    };
  }

  const renderedBody = applyPlaceholders(tpl.html_content, vars);
  const fullHtml = `<!doctype html><html><head><meta charset="utf-8" /><style>${tpl.css_content}</style></head><body>${renderedBody}</body></html>`;

  return { html: fullHtml, defaultFilename };
}

export async function exportDocumentToPdf(
  docType: DocType,
  docId: number
): Promise<{ saved: boolean; filePath?: string }> {
  const { html, defaultFilename } = buildDocumentHtml(docType, docId);

  const { canceled, filePath } = await dialog.showSaveDialog({
    title: `Simpan PDF ${docType}`,
    defaultPath: defaultFilename,
    filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
  });

  if (canceled || !filePath) {
    return { saved: false };
  }

  const printWin = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: true,
    },
  });

  try {
    await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const isDotMatrix = docType === 'INVOICE_DOT' || docType === 'SJ_DOT';
    const pdfBuffer = await printWin.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true,
      pageSize: isDotMatrix ? { width: 9.5, height: 5.5 } : 'A4',
      margins: isDotMatrix
        ? { top: 0.1, bottom: 0.1, left: 0.1, right: 0.1 }
        : { top: 0.25, bottom: 0.25, left: 0.25, right: 0.25 },
    });
    fs.writeFileSync(filePath, pdfBuffer);
    return { saved: true, filePath };
  } finally {
    printWin.destroy();
  }
}

function openPdfInChromeOrDefault(pdfPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (process.platform === 'win32') {
      const candidates = [
        path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
        path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
        path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
        path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
        path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      ];
      const browserExe = candidates.find((p) => p && fs.existsSync(p));
      if (browserExe) {
        const child = execFile(browserExe, [pdfPath], { windowsHide: false }, (err) => {
          if (err) {
            shell.openPath(pdfPath).then((msg) => (msg ? reject(new Error(msg)) : resolve()));
          }
        });
        child.unref();
        resolve();
        return;
      }
    }
    shell.openPath(pdfPath).then((msg) => (msg ? reject(new Error(msg)) : resolve()));
  });
}

export async function printDocumentDirect(
  docType: DocType,
  docId: number
): Promise<{ printed: boolean; filePath?: string }> {
  const { html, defaultFilename } = buildDocumentHtml(docType, docId);

  const printWin = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: true,
    },
  });

  try {
    await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const isDotMatrix = docType === 'INVOICE_DOT' || docType === 'SJ_DOT';
    const pdfBuffer = await printWin.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true,
      pageSize: isDotMatrix ? { width: 9.5, height: 5.5 } : 'A4',
      margins: isDotMatrix
        ? { top: 0.1, bottom: 0.1, left: 0.1, right: 0.1 }
        : { top: 0.25, bottom: 0.25, left: 0.25, right: 0.25 },
    });

    const tempDir = path.join(os.tmpdir(), 'desktop-erp-lite-print');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempPdfPath = path.join(tempDir, `${Date.now()}_${defaultFilename}`);
    fs.writeFileSync(tempPdfPath, pdfBuffer);

    await openPdfInChromeOrDefault(tempPdfPath);
    return { printed: true, filePath: tempPdfPath };
  } finally {
    printWin.destroy();
  }
}

// ==================== BACKUP & RESTORE DB ====================
export function copyBackupToCustomFolder(sourceBackupPath: string): string | undefined {
  const settings = getAppSettings();
  const customDir = String(settings.custom_backup_dir || '').trim();
  if (!customDir) return undefined;

  try {
    if (!fs.existsSync(customDir)) {
      fs.mkdirSync(customDir, { recursive: true });
    }
    const destPath = path.join(customDir, path.basename(sourceBackupPath));
    if (path.resolve(sourceBackupPath) !== path.resolve(destPath)) {
      fs.copyFileSync(sourceBackupPath, destPath);
    }
    return destPath;
  } catch (err) {
    console.error('Gagal menyalin backup ke custom folder:', err);
    return undefined;
  }
}

export async function selectCustomBackupFolder(): Promise<{ selected: boolean; folderPath?: string }> {
  const settings = getAppSettings();
  const currentDir = String(settings.custom_backup_dir || '').trim();
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Pilih Folder Salinan Backup Database',
    defaultPath: currentDir && fs.existsSync(currentDir) ? currentDir : undefined,
    properties: ['openDirectory', 'createDirectory'],
  });

  if (canceled || !filePaths?.[0]) {
    return { selected: false };
  }

  const folderPath = filePaths[0];
  updateAppSettings({ custom_backup_dir: folderPath });
  return { selected: true, folderPath };
}

export function openBackupLocation(targetPath: string): void {
  if (!targetPath || !fs.existsSync(targetPath)) return;
  const stat = fs.statSync(targetPath);
  if (stat.isDirectory()) {
    shell.openPath(targetPath);
  } else {
    shell.showItemInFolder(targetPath);
  }
}

export async function backupDatabase(): Promise<{
  saved: boolean;
  filePath?: string;
  customBackupPath?: string;
}> {
  saveDatabase();
  const currentDbPath = getDbPath();
  const settings = getAppSettings();
  const customDir = String(settings.custom_backup_dir || '').trim();
  const dateStamp = new Date().toISOString().slice(0, 10);
  const defaultFilename = `backup_erp_offline_${dateStamp}.db`;
  const defaultPath =
    customDir && fs.existsSync(customDir) ? path.join(customDir, defaultFilename) : defaultFilename;

  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Backup Database Lokal (.db)',
    defaultPath,
    filters: [{ name: 'SQLite Database', extensions: ['db'] }],
  });

  if (canceled || !filePath) {
    return { saved: false };
  }

  fs.copyFileSync(currentDbPath, filePath);
  const customBackupPath = copyBackupToCustomFolder(filePath);
  return { saved: true, filePath, customBackupPath };
}

export async function restoreDatabase(): Promise<{ restored: boolean; filePath?: string }> {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Pilih File Backup Database (.db)',
    filters: [{ name: 'SQLite Database', extensions: ['db'] }],
    properties: ['openFile'],
  });

  if (canceled || filePaths.length === 0) {
    return { restored: false };
  }

  await reloadDatabaseFromFile(filePaths[0]);
  runMigrations();
  return { restored: true, filePath: filePaths[0] };
}
