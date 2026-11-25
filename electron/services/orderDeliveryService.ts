import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { queryAll, queryOne, execute, runTransaction, getDbPath, saveDatabase } from '../db/database';
import { copyBackupToCustomFolder } from './pdfBackupService';
import {
  Order,
  OrderDetail,
  DeliveryNote,
  DeliveryNoteDetail,
  DeliveryNoteForInvoiceResult,
  MutasiBarang,
  MutasiBarangInput,
  RebuildMutasiOptions,
  RebuildMutasiResult,
  Sample,
  SampleBarang,
  TransferDocumentPayload,
} from '../../shared/types';

// ==================== ORDERS (PO / SO) ====================
export function listOrders(type?: 'in' | 'out'): Order[] {
  const where = type ? 'WHERE o.type = ?' : '';
  const params = type ? [type] : [];
  return queryAll<Order>(
    `SELECT o.*,
            c.nama AS customer_nama,
            s.nama AS supplier_nama
     FROM orders o
     LEFT JOIN customer c ON o.cust_id = c.id
     LEFT JOIN supplier s ON o.supp_id = s.id
     ${where}
     ORDER BY o.tgl DESC, o.id DESC`,
    params
  );
}

export function getOrderById(id: number): Order | null {
  const order = queryOne<Order>(
    `SELECT o.*,
            c.nama AS customer_nama,
            s.nama AS supplier_nama
     FROM orders o
     LEFT JOIN customer c ON o.cust_id = c.id
     LEFT JOIN supplier s ON o.supp_id = s.id
     WHERE o.id = ?`,
    [id]
  );
  if (!order) return null;
  order.details = queryAll<OrderDetail>(
    `SELECT od.*,
            b.kode AS barang_kode,
            b.nama AS barang_nama,
            b.part_number,
            b.keterangan AS barang_keterangan
     FROM order_details od
     LEFT JOIN barang b ON od.barang_id = b.id
     WHERE od.order_id = ?
     ORDER BY od.id ASC`,
    [id]
  );
  return order;
}

export function getOrderByNo(no: string): Order | null {
  const row = queryOne<{ id: number }>('SELECT id FROM orders WHERE no = ?', [no]);
  return row ? getOrderById(row.id) : null;
}

export function createOrder(data: Order): Order {
  let newId = 0;
  runTransaction(() => {
    const details = data.details || [];
    const dpp = details.reduce((sum, item) => sum + Number(item.qty || 0) * Number(item.price || 0), 0);
    const diskon = Number(data.diskon || 0);
    const ppn = Number(data.ppn || 0);
    const ongkir = Number(data.ongkir || 0);
    const ppnNominal = Math.max(0, dpp - diskon) * (ppn / 100);
    const total = Math.max(0, dpp - diskon) + ppnNominal;

    const res = execute(
      `INSERT INTO orders (tgl, no, type, cust_id, supp_id, dpp, ppn, diskon, ongkir, total, deldate, po_subject)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.tgl,
        data.no,
        data.type,
        data.type === 'out' ? data.cust_id ?? null : null,
        data.type === 'in' ? data.supp_id ?? null : null,
        dpp,
        ppn,
        diskon,
        ongkir,
        total,
        data.type === 'in' ? data.deldate || '' : '',
        data.type === 'in' ? data.po_subject || '' : '',
      ],
      false
    );
    newId = res.lastInsertRowid;

    for (const item of details) {
      const qty = Number(item.qty || 0);
      const price = Number(item.price || 0);
      const subtotal = qty * price;
      execute(
        `INSERT INTO order_details (order_id, barang_id, qty, qty_sent, price, satuan, subtotal)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [newId, item.barang_id, qty, Number(item.qty_sent || 0), price, item.satuan || 'PCS', subtotal],
        false
      );
    }
  });
  return getOrderById(newId)!;
}

export function updateOrder(id: number, data: Order): Order {
  runTransaction(() => {
    const existingDetails = queryAll<OrderDetail>('SELECT * FROM order_details WHERE order_id = ?', [id]);
    const sentById = new Map<number, number>();
    for (const ed of existingDetails) {
      if (ed.id) sentById.set(ed.id, Number(ed.qty_sent || 0));
    }

    const details = data.details || [];
    const dpp = details.reduce((sum, item) => sum + Number(item.qty || 0) * Number(item.price || 0), 0);
    const diskon = Number(data.diskon || 0);
    const ppn = Number(data.ppn || 0);
    const ongkir = Number(data.ongkir || 0);
    const ppnNominal = Math.max(0, dpp - diskon) * (ppn / 100);
    const total = Math.max(0, dpp - diskon) + ppnNominal;

    execute(
      `UPDATE orders
       SET tgl = ?, no = ?, type = ?, cust_id = ?, supp_id = ?, dpp = ?, ppn = ?, diskon = ?, ongkir = ?, total = ?, deldate = ?, po_subject = ?
       WHERE id = ?`,
      [
        data.tgl,
        data.no,
        data.type,
        data.type === 'out' ? data.cust_id ?? null : null,
        data.type === 'in' ? data.supp_id ?? null : null,
        dpp,
        ppn,
        diskon,
        ongkir,
        total,
        data.type === 'in' ? data.deldate || '' : '',
        data.type === 'in' ? data.po_subject || '' : '',
        id,
      ],
      false
    );

    execute('DELETE FROM order_details WHERE order_id = ?', [id], false);

    for (const item of details) {
      const qty = Number(item.qty || 0);
      const price = Number(item.price || 0);
      const subtotal = qty * price;
      const preservedSent = item.id && sentById.has(item.id) ? sentById.get(item.id)! : Number(item.qty_sent || 0);
      execute(
        `INSERT INTO order_details (order_id, barang_id, qty, qty_sent, price, satuan, subtotal)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, item.barang_id, qty, preservedSent, price, item.satuan || 'PCS', subtotal],
        false
      );
    }
  });
  return getOrderById(id)!;
}

export function deleteOrder(id: number): void {
  runTransaction(() => {
    execute('DELETE FROM order_details WHERE order_id = ?', [id], false);
    execute('DELETE FROM orders WHERE id = ?', [id], false);
  });
}

// ==================== DELIVERY NOTES (SURAT JALAN) ====================
export function listDeliveryNotes(type?: 'in' | 'out'): DeliveryNote[] {
  const where = type ? 'WHERE dn.type = ?' : '';
  const params = type ? [type] : [];
  return queryAll<DeliveryNote>(
    `SELECT dn.* FROM delivery_notes dn ${where} ORDER BY dn.tgl DESC, dn.id DESC`,
    params
  );
}

export function getDeliveryNoteById(id: number): DeliveryNote | null {
  const dn = queryOne<DeliveryNote>('SELECT * FROM delivery_notes WHERE id = ?', [id]);
  if (!dn) return null;
  dn.details = queryAll<DeliveryNoteDetail>(
    `SELECT dnd.*,
            b.kode AS barang_kode,
            b.nama AS barang_nama,
            b.satuan AS barang_satuan,
            b.part_number
     FROM delivery_note_details dnd
     LEFT JOIN barang b ON dnd.barang_id = b.id
     WHERE dnd.delivery_note_id = ?
     ORDER BY dnd.id ASC`,
    [id]
  );
  return dn;
}

export function getDeliveryNoteForInvoice(no: string): DeliveryNoteForInvoiceResult | null {
  const trimmedNo = String(no || '').trim();
  if (!trimmedNo) return null;
  const row = queryOne<{ id: number }>('SELECT id FROM delivery_notes WHERE no = ?', [trimmedNo]);
  if (!row) return null;

  const dn = getDeliveryNoteById(row.id);
  if (!dn) return null;

  const order = dn.order_no ? getOrderByNo(dn.order_no) : null;
  const orderDetails = order?.details || [];

  const items = (dn.details || []).map((d) => {
    const matchedOrderDetail =
      (d.order_detail_id
        ? orderDetails.find((od) => od.id === d.order_detail_id)
        : undefined) ||
      orderDetails.find((od) => Number(od.barang_id) === Number(d.barang_id));

    return {
      barang_id: d.barang_id,
      barang_kode: d.barang_kode,
      barang_nama: d.barang_nama,
      part_number: d.part_number,
      qty: Number(d.qty_sent || 0),
      satuan: matchedOrderDetail?.satuan || d.barang_satuan || 'PCS',
      price: matchedOrderDetail ? Number(matchedOrderDetail.price || 0) : 0,
    };
  });

  return {
    delivery_note: dn,
    order,
    items,
  };
}

/**
 * Menyusun ulang saldo berjalan (stok_sebelum, stok_sesudah) secara kronologis
 * (tgl ASC, id ASC) untuk satu barang dan menyinkronkan barang.stock akhir.
 * Baseline awal diturunkan dari stok sebelum mutasi pertama yang tercatat,
 * atau dari (barang.stock - netDeltaSaatIni) bila mutasi pertama disisipkan sebelum riwayat lama.
 */
function recalculateBarangLedger(barangId: number, explicitInitialStock?: number): void {
  const barang = queryOne<{ stock: number }>('SELECT stock FROM barang WHERE id = ?', [barangId]);
  if (!barang) return;

  const rows = queryAll<{
    id: number;
    type: 'in' | 'out';
    qty: number;
    stok_sebelum: number;
    stok_sesudah: number;
  }>(
    `SELECT id, type, qty, stok_sebelum, stok_sesudah
     FROM mutasi_barang
     WHERE barang_id = ?
     ORDER BY tgl ASC, id ASC`,
    [barangId]
  );

  let runningStock =
    explicitInitialStock !== undefined
      ? Number(explicitInitialStock)
      : rows.length > 0
        ? Number(rows[0].stok_sebelum || 0)
        : Number(barang.stock || 0);

  for (const row of rows) {
    const qty = Number(row.qty || 0);
    const stokSebelum = runningStock;
    const stokSesudah = row.type === 'in' ? stokSebelum + qty : stokSebelum - qty;

    if (Number(row.stok_sebelum) !== stokSebelum || Number(row.stok_sesudah) !== stokSesudah) {
      execute(
        'UPDATE mutasi_barang SET stok_sebelum = ?, stok_sesudah = ? WHERE id = ?',
        [stokSebelum, stokSesudah, row.id],
        false
      );
    }
    runningStock = stokSesudah;
  }

  if (Number(barang.stock) !== runningStock) {
    execute('UPDATE barang SET stock = ? WHERE id = ?', [runningStock, barangId], false);
  }
}

function getBarangInitialBaseline(barangId: number): number {
  const barang = queryOne<{ stock: number }>('SELECT stock FROM barang WHERE id = ?', [barangId]);
  const currentStock = barang ? Number(barang.stock || 0) : 0;
  const existingRows = queryAll<{ type: 'in' | 'out'; qty: number }>(
    'SELECT type, qty FROM mutasi_barang WHERE barang_id = ?',
    [barangId]
  );
  const netDelta = existingRows.reduce(
    (acc, r) => acc + (r.type === 'in' ? Number(r.qty || 0) : -Number(r.qty || 0)),
    0
  );
  return currentStock - netDelta;
}

function rollbackDeliveryEffects(dnId: number): void {
  const existingDn = queryOne<DeliveryNote>('SELECT * FROM delivery_notes WHERE id = ?', [dnId]);
  if (!existingDn) return;

  const existingDetails = queryAll<DeliveryNoteDetail>(
    'SELECT * FROM delivery_note_details WHERE delivery_note_id = ?',
    [dnId]
  );

  const affectedBarangIds = new Set<number>();
  const baselines = new Map<number, number>();

  for (const item of existingDetails) {
    const qtySent = Number(item.qty_sent || 0);
    if (!baselines.has(item.barang_id)) {
      baselines.set(item.barang_id, getBarangInitialBaseline(item.barang_id));
    }
    affectedBarangIds.add(item.barang_id);

    if (item.order_detail_id) {
      const od = queryOne<{ qty_sent: number }>('SELECT qty_sent FROM order_details WHERE id = ?', [
        item.order_detail_id,
      ]);
      if (od) {
        const restoredSent = Math.max(0, Number(od.qty_sent || 0) - qtySent);
        execute('UPDATE order_details SET qty_sent = ? WHERE id = ?', [restoredSent, item.order_detail_id], false);
      }
    }
  }

  execute('DELETE FROM mutasi_barang WHERE delivery_note_id = ?', [dnId], false);
  execute('DELETE FROM delivery_note_details WHERE delivery_note_id = ?', [dnId], false);

  for (const bId of affectedBarangIds) {
    recalculateBarangLedger(bId, baselines.get(bId));
  }
}

function applyDeliveryEffects(dnId: number, data: DeliveryNote): void {
  const details = data.details || [];
  const affectedBarangIds = new Set<number>();
  const baselines = new Map<number, number>();

  for (const item of details) {
    const qtySent = Number(item.qty_sent || 0);
    if (qtySent <= 0) continue;

    if (!baselines.has(item.barang_id)) {
      baselines.set(item.barang_id, getBarangInitialBaseline(item.barang_id));
    }
    affectedBarangIds.add(item.barang_id);

    execute(
      `INSERT INTO delivery_note_details (delivery_note_id, order_detail_id, barang_id, qty_sent)
       VALUES (?, ?, ?, ?)`,
      [dnId, item.order_detail_id ?? null, item.barang_id, qtySent],
      false
    );

    const barang = queryOne<{ stock: number }>('SELECT stock FROM barang WHERE id = ?', [item.barang_id]);
    const stokSebelum = barang ? Number(barang.stock || 0) : 0;
    const stokSesudah = data.type === 'in' ? stokSebelum + qtySent : stokSebelum - qtySent;

    execute(
      `INSERT INTO mutasi_barang (barang_id, type, qty, stok_sebelum, stok_sesudah, tgl, source, delivery_note_id, keterangan)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.barang_id,
        data.type,
        qtySent,
        stokSebelum,
        stokSesudah,
        data.tgl,
        `SJ: ${data.no}`,
        dnId,
        data.keterangan || (data.type === 'in' ? 'Penerimaan Barang' : 'Pengiriman Barang'),
      ],
      false
    );

    if (item.order_detail_id) {
      const od = queryOne<{ qty_sent: number }>('SELECT qty_sent FROM order_details WHERE id = ?', [
        item.order_detail_id,
      ]);
      if (od) {
        const updatedSent = Number(od.qty_sent || 0) + qtySent;
        execute('UPDATE order_details SET qty_sent = ? WHERE id = ?', [updatedSent, item.order_detail_id], false);
      }
    }
  }

  for (const bId of affectedBarangIds) {
    recalculateBarangLedger(bId, baselines.get(bId));
  }
}

export function createDeliveryNote(data: DeliveryNote): DeliveryNote {
  let newId = 0;
  runTransaction(() => {
    const res = execute(
      `INSERT INTO delivery_notes (no, tgl, order_no, alamat_tujuan, keterangan, type)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [data.no, data.tgl, data.order_no || '', data.alamat_tujuan || '', data.keterangan || '', data.type],
      false
    );
    newId = res.lastInsertRowid;
    applyDeliveryEffects(newId, data);
  });
  return getDeliveryNoteById(newId)!;
}

export function updateDeliveryNote(id: number, data: DeliveryNote): DeliveryNote {
  runTransaction(() => {
    rollbackDeliveryEffects(id);
    execute(
      `UPDATE delivery_notes
       SET no = ?, tgl = ?, order_no = ?, alamat_tujuan = ?, keterangan = ?, type = ?
       WHERE id = ?`,
      [data.no, data.tgl, data.order_no || '', data.alamat_tujuan || '', data.keterangan || '', data.type, id],
      false
    );
    applyDeliveryEffects(id, data);
  });
  return getDeliveryNoteById(id)!;
}

export function deleteDeliveryNote(id: number): void {
  runTransaction(() => {
    rollbackDeliveryEffects(id);
    execute('DELETE FROM delivery_notes WHERE id = ?', [id], false);
  });
}

export function listMutasiBarang(barangId?: number): MutasiBarang[] {
  const where = barangId ? 'WHERE m.barang_id = ?' : '';
  const params = barangId ? [barangId] : [];
  return queryAll<MutasiBarang>(
    `SELECT m.*,
            b.kode AS barang_kode,
            b.nama AS barang_nama,
            b.satuan AS barang_satuan
     FROM mutasi_barang m
     LEFT JOIN barang b ON m.barang_id = b.id
     ${where}
     ORDER BY m.tgl DESC, m.id DESC`,
    params
  );
}

export function createManualMutasi(data: MutasiBarangInput): MutasiBarang {
  let newId = 0;
  runTransaction(() => {
    const barangId = Number(data.barang_id);
    const qty = Number(data.qty || 0);
    if (!barangId || qty <= 0) {
      throw new Error('Barang dan jumlah mutasi (> 0) wajib diisi.');
    }
    const barang = queryOne<{ stock: number }>('SELECT stock FROM barang WHERE id = ?', [barangId]);
    if (!barang) {
      throw new Error('Data barang tidak ditemukan.');
    }

    const initialBaseline = getBarangInitialBaseline(barangId);
    const stokSebelum = Number(barang.stock || 0);
    const stokSesudah = data.type === 'in' ? stokSebelum + qty : stokSebelum - qty;

    const sourceText = String(data.source || '').trim() || 'MANUAL';
    const res = execute(
      `INSERT INTO mutasi_barang (barang_id, type, qty, stok_sebelum, stok_sesudah, tgl, source, delivery_note_id, sample_id, keterangan)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?)`,
      [barangId, data.type, qty, stokSebelum, stokSesudah, data.tgl, sourceText, data.keterangan || ''],
      false
    );
    newId = res.lastInsertRowid;

    recalculateBarangLedger(barangId, initialBaseline);
  });
  return queryOne<MutasiBarang>(
    `SELECT m.*, b.kode AS barang_kode, b.nama AS barang_nama, b.satuan AS barang_satuan
     FROM mutasi_barang m LEFT JOIN barang b ON m.barang_id = b.id WHERE m.id = ?`,
    [newId]
  )!;
}

export function updateManualMutasi(id: number, data: MutasiBarangInput): MutasiBarang {
  runTransaction(() => {
    const existing = queryOne<MutasiBarang>('SELECT * FROM mutasi_barang WHERE id = ?', [id]);
    if (!existing) {
      throw new Error('Data mutasi barang tidak ditemukan.');
    }
    if (existing.delivery_note_id || existing.sample_id) {
      throw new Error('Mutasi otomatis dari Surat Jalan / Sample hanya dapat diubah melalui dokumen asalnya.');
    }

    const newBarangId = Number(data.barang_id);
    const newQty = Number(data.qty || 0);
    if (!newBarangId || newQty <= 0) {
      throw new Error('Barang dan jumlah mutasi (> 0) wajib diisi.');
    }
    const targetBarang = queryOne<{ stock: number }>('SELECT stock FROM barang WHERE id = ?', [newBarangId]);
    if (!targetBarang) {
      throw new Error('Data barang tujuan tidak ditemukan.');
    }

    const oldBarangId = Number(existing.barang_id);
    const oldBaseline = getBarangInitialBaseline(oldBarangId);
    const newBaseline = oldBarangId === newBarangId ? oldBaseline : getBarangInitialBaseline(newBarangId);

    const sourceText = String(data.source || '').trim() || 'MANUAL';
    execute(
      `UPDATE mutasi_barang
       SET barang_id = ?, type = ?, qty = ?, tgl = ?, source = ?, keterangan = ?
       WHERE id = ?`,
      [newBarangId, data.type, newQty, data.tgl, sourceText, data.keterangan || '', id],
      false
    );

    recalculateBarangLedger(oldBarangId, oldBaseline);
    if (newBarangId !== oldBarangId) {
      recalculateBarangLedger(newBarangId, newBaseline);
    }
  });
  return queryOne<MutasiBarang>(
    `SELECT m.*, b.kode AS barang_kode, b.nama AS barang_nama, b.satuan AS barang_satuan
     FROM mutasi_barang m LEFT JOIN barang b ON m.barang_id = b.id WHERE m.id = ?`,
    [id]
  )!;
}

export function deleteManualMutasi(id: number): void {
  runTransaction(() => {
    const existing = queryOne<MutasiBarang>('SELECT * FROM mutasi_barang WHERE id = ?', [id]);
    if (!existing) return;
    if (existing.delivery_note_id || existing.sample_id) {
      throw new Error('Mutasi otomatis dari Surat Jalan / Sample tidak dapat dihapus langsung dari sini.');
    }

    const barangId = Number(existing.barang_id);
    const baseline = getBarangInitialBaseline(barangId);

    execute('DELETE FROM mutasi_barang WHERE id = ?', [id], false);

    recalculateBarangLedger(barangId, baseline);
  });
}

// ==================== SAMPLES (TANDA TERIMA SAMPEL) ====================
export function listSamples(): Sample[] {
  return queryAll<Sample>(
    `SELECT sp.*,
            c.nama AS customer_nama,
            c.alamat AS customer_alamat
     FROM samples sp
     LEFT JOIN customer c ON sp.id_customer = c.id
     ORDER BY sp.tgl DESC, sp.id DESC`
  );
}

export function getSampleById(id: number): Sample | null {
  const sp = queryOne<Sample>(
    `SELECT sp.*,
            c.nama AS customer_nama,
            c.alamat AS customer_alamat
     FROM samples sp
     LEFT JOIN customer c ON sp.id_customer = c.id
     WHERE sp.id = ?`,
    [id]
  );
  if (!sp) return null;
  sp.details = queryAll<SampleBarang>(
    `SELECT sb.*,
            b.kode AS barang_kode,
            b.nama AS barang_nama,
            b.satuan AS barang_satuan,
            b.part_number
     FROM sample_barangs sb
     LEFT JOIN barang b ON sb.id_barangs = b.id
     WHERE sb.id_sample = ?
     ORDER BY sb.id ASC`,
    [id]
  );
  return sp;
}

function rollbackSampleEffects(sampleId: number): void {
  const existingDetails = queryAll<SampleBarang>(
    'SELECT * FROM sample_barangs WHERE id_sample = ?',
    [sampleId]
  );

  const affectedBarangIds = new Set<number>();
  const baselines = new Map<number, number>();

  for (const item of existingDetails) {
    if (!baselines.has(item.id_barangs)) {
      baselines.set(item.id_barangs, getBarangInitialBaseline(item.id_barangs));
    }
    affectedBarangIds.add(item.id_barangs);
  }

  execute('DELETE FROM mutasi_barang WHERE sample_id = ?', [sampleId], false);
  execute('DELETE FROM sample_barangs WHERE id_sample = ?', [sampleId], false);

  for (const bId of affectedBarangIds) {
    recalculateBarangLedger(bId, baselines.get(bId));
  }
}

function applySampleEffects(sampleId: number, data: Sample): void {
  const details = data.details || [];
  const affectedBarangIds = new Set<number>();
  const baselines = new Map<number, number>();

  for (const item of details) {
    const qty = Number(item.qty || 0);
    if (qty <= 0) continue;

    if (!baselines.has(item.id_barangs)) {
      baselines.set(item.id_barangs, getBarangInitialBaseline(item.id_barangs));
    }
    affectedBarangIds.add(item.id_barangs);

    const barang = queryOne<{ stock: number; satuan: string }>('SELECT stock, satuan FROM barang WHERE id = ?', [
      item.id_barangs,
    ]);
    const satuanFinal = String(item.satuan || '').trim() || barang?.satuan || 'PCS';

    execute(
      `INSERT INTO sample_barangs (id_sample, id_barangs, qty, satuan)
       VALUES (?, ?, ?, ?)`,
      [sampleId, item.id_barangs, qty, satuanFinal],
      false
    );

    const stokSebelum = barang ? Number(barang.stock || 0) : 0;
    const stokSesudah = stokSebelum - qty;

    execute(
      `INSERT INTO mutasi_barang (barang_id, type, qty, stok_sebelum, stok_sesudah, tgl, source, sample_id, keterangan)
       VALUES (?, 'out', ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.id_barangs,
        qty,
        stokSebelum,
        stokSesudah,
        data.tgl,
        `SP: ${data.no}`,
        sampleId,
        data.keterangan || 'Sample Barang untuk Customer',
      ],
      false
    );
  }

  for (const bId of affectedBarangIds) {
    recalculateBarangLedger(bId, baselines.get(bId));
  }
}

export function createSample(data: Sample): Sample {
  let newId = 0;
  runTransaction(() => {
    const res = execute(
      `INSERT INTO samples (no, tgl, id_customer, penerima_nama, keterangan)
       VALUES (?, ?, ?, ?, ?)`,
      [data.no, data.tgl, data.id_customer ?? null, data.penerima_nama || '', data.keterangan || ''],
      false
    );
    newId = res.lastInsertRowid;
    applySampleEffects(newId, data);
  });
  return getSampleById(newId)!;
}

export function updateSample(id: number, data: Sample): Sample {
  runTransaction(() => {
    rollbackSampleEffects(id);
    execute(
      `UPDATE samples
       SET no = ?, tgl = ?, id_customer = ?, penerima_nama = ?, keterangan = ?
       WHERE id = ?`,
      [data.no, data.tgl, data.id_customer ?? null, data.penerima_nama || '', data.keterangan || '', id],
      false
    );
    applySampleEffects(id, data);
  });
  return getSampleById(id)!;
}

export function deleteSample(id: number): void {
  runTransaction(() => {
    rollbackSampleEffects(id);
    execute('DELETE FROM samples WHERE id = ?', [id], false);
  });
}

// ==================== REBUILD STOK & MUTASI DARI DOKUMEN ====================
export function rebuildMutasiAndStockFromDocuments(
  options: RebuildMutasiOptions
): RebuildMutasiResult {
  const mode = options?.mode === 'from_date' ? 'from_date' : 'all';
  const fromDate = mode === 'from_date' ? String(options.fromDate || '').trim() : '';
  const keepManual = Boolean(options?.keepManualMutasi);

  if (mode === 'from_date' && !fromDate) {
    throw new Error('Tanggal awal (fromDate) wajib diisi untuk mode rebuild mulai tanggal tertentu.');
  }

  // 1. Auto-backup database sebelum melakukan perubahan apa pun
  saveDatabase();
  const activeDbPath = getDbPath();
  const backupDir = path.join(app.getPath('userData'), 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    '_',
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('');
  const backupPath = path.join(backupDir, `auto_backup_before_rebuild_${stamp}.db`);
  fs.copyFileSync(activeDbPath, backupPath);
  const customBackupPath = copyBackupToCustomFolder(backupPath);

  let rebuiltAutoCount = 0;
  let recalculatedManualCount = 0;
  let affectedBarangCount = 0;

  runTransaction(() => {
    const allBarang = queryAll<{ id: number; stock: number }>('SELECT id, stock FROM barang');
    const baselines = new Map<number, number>();

    // 2. Tentukan baseline saldo awal per barang sebelum titik rebuild
    for (const b of allBarang) {
      if (mode === 'all') {
        baselines.set(b.id, 0);
      } else {
        const lastBefore = queryOne<{ stok_sesudah: number }>(
          `SELECT stok_sesudah FROM mutasi_barang
           WHERE barang_id = ? AND tgl < ?
           ORDER BY tgl DESC, id DESC
           LIMIT 1`,
          [b.id, fromDate]
        );
        if (lastBefore) {
          baselines.set(b.id, Number(lastBefore.stok_sesudah || 0));
        } else {
          baselines.set(b.id, getBarangInitialBaseline(b.id));
        }
      }
    }

    // 3. Bersihkan mutasi lama sesuai scope & opsi keepManual
    if (mode === 'all') {
      if (keepManual) {
        execute('DELETE FROM mutasi_barang WHERE delivery_note_id IS NOT NULL OR sample_id IS NOT NULL', [], false);
      } else {
        execute('DELETE FROM mutasi_barang', [], false);
      }
    } else {
      if (keepManual) {
        execute(
          'DELETE FROM mutasi_barang WHERE tgl >= ? AND (delivery_note_id IS NOT NULL OR sample_id IS NOT NULL)',
          [fromDate],
          false
        );
      } else {
        execute('DELETE FROM mutasi_barang WHERE tgl >= ?', [fromDate], false);
      }
    }

    // 4. Kumpulkan seluruh item mutasi otomatis dari Surat Jalan & Sample
    interface DocMutationSeed {
      barang_id: number;
      type: 'in' | 'out';
      qty: number;
      tgl: string;
      source: string;
      delivery_note_id: number | null;
      sample_id: number | null;
      doc_id: number;
      detail_id: number;
      keterangan: string;
    }

    const seeds: DocMutationSeed[] = [];

    const dnWhere = mode === 'from_date' ? 'WHERE dn.tgl >= ?' : '';
    const dnParams = mode === 'from_date' ? [fromDate] : [];
    const dnItems = queryAll<{
      detail_id: number;
      dn_id: number;
      no: string;
      tgl: string;
      type: 'in' | 'out';
      keterangan: string;
      barang_id: number;
      qty_sent: number;
    }>(
      `SELECT dnd.id AS detail_id,
              dn.id AS dn_id,
              dn.no,
              dn.tgl,
              dn.type,
              dn.keterangan,
              dnd.barang_id,
              dnd.qty_sent
       FROM delivery_note_details dnd
       INNER JOIN delivery_notes dn ON dnd.delivery_note_id = dn.id
       ${dnWhere}`,
      dnParams
    );

    for (const row of dnItems) {
      const qty = Number(row.qty_sent || 0);
      if (qty <= 0 || !row.barang_id) continue;
      seeds.push({
        barang_id: Number(row.barang_id),
        type: row.type === 'in' ? 'in' : 'out',
        qty,
        tgl: row.tgl,
        source: `SJ: ${row.no}`,
        delivery_note_id: Number(row.dn_id),
        sample_id: null,
        doc_id: Number(row.dn_id),
        detail_id: Number(row.detail_id),
        keterangan: row.keterangan || (row.type === 'in' ? 'Penerimaan Barang' : 'Pengiriman Barang'),
      });
    }

    const spWhere = mode === 'from_date' ? 'WHERE sp.tgl >= ?' : '';
    const spParams = mode === 'from_date' ? [fromDate] : [];
    const spItems = queryAll<{
      detail_id: number;
      sp_id: number;
      no: string;
      tgl: string;
      keterangan: string;
      barang_id: number;
      qty: number;
    }>(
      `SELECT sb.id AS detail_id,
              sp.id AS sp_id,
              sp.no,
              sp.tgl,
              sp.keterangan,
              sb.id_barangs AS barang_id,
              sb.qty
       FROM sample_barangs sb
       INNER JOIN samples sp ON sb.id_sample = sp.id
       ${spWhere}`,
      spParams
    );

    for (const row of spItems) {
      const qty = Number(row.qty || 0);
      if (qty <= 0 || !row.barang_id) continue;
      seeds.push({
        barang_id: Number(row.barang_id),
        type: 'out',
        qty,
        tgl: row.tgl,
        source: `SP: ${row.no}`,
        delivery_note_id: null,
        sample_id: Number(row.sp_id),
        doc_id: Number(row.sp_id),
        detail_id: Number(row.detail_id),
        keterangan: row.keterangan || 'Sample Barang untuk Customer',
      });
    }

    // Urutkan kronologis: tgl ASC, lalu 'in' lebih dulu dari 'out', lalu doc_id & detail_id ASC
    seeds.sort((a, b) => {
      const dateCmp = String(a.tgl || '').localeCompare(String(b.tgl || ''));
      if (dateCmp !== 0) return dateCmp;
      if (a.type !== b.type) return a.type === 'in' ? -1 : 1;
      if (a.doc_id !== b.doc_id) return a.doc_id - b.doc_id;
      return a.detail_id - b.detail_id;
    });

    // 5. Insert ulang mutasi otomatis
    for (const s of seeds) {
      execute(
        `INSERT INTO mutasi_barang (barang_id, type, qty, stok_sebelum, stok_sesudah, tgl, source, delivery_note_id, sample_id, keterangan)
         VALUES (?, ?, ?, 0, 0, ?, ?, ?, ?, ?)`,
        [
          s.barang_id,
          s.type,
          s.qty,
          s.tgl,
          s.source,
          s.delivery_note_id,
          s.sample_id,
          s.keterangan,
        ],
        false
      );
      rebuiltAutoCount++;
    }

    // 6. Hitung ulang saldo berjalan seluruh barang (otomatis menyisipkan mutasi manual pada tanggalnya)
    for (const b of allBarang) {
      const baseline = baselines.get(b.id) ?? 0;
      recalculateBarangLedger(b.id, baseline);
      affectedBarangCount++;
    }

    if (keepManual) {
      const manualRes = queryOne<{ cnt: number }>(
        mode === 'from_date'
          ? 'SELECT COUNT(*) AS cnt FROM mutasi_barang WHERE tgl >= ? AND delivery_note_id IS NULL AND sample_id IS NULL'
          : 'SELECT COUNT(*) AS cnt FROM mutasi_barang WHERE delivery_note_id IS NULL AND sample_id IS NULL',
        mode === 'from_date' ? [fromDate] : []
      );
      recalculatedManualCount = manualRes ? Number(manualRes.cnt || 0) : 0;
    }
  });

  return {
    backupPath,
    customBackupPath,
    affectedBarangCount,
    rebuiltAutoCount,
    recalculatedManualCount,
  };
}

// ==================== TRANSFER DOKUMEN ANTARDIVISI (.JSON) ====================
export function buildTransferPayload(
  docKind: 'ORDER' | 'DELIVERY_NOTE',
  id: number
): TransferDocumentPayload {
  if (docKind === 'ORDER') {
    const order = getOrderById(id);
    if (!order) throw new Error('Dokumen Order tidak ditemukan.');
    const partner =
      order.type === 'out' && order.cust_id
        ? queryOne('SELECT * FROM customer WHERE id = ?', [order.cust_id])
        : order.type === 'in' && order.supp_id
          ? queryOne('SELECT * FROM supplier WHERE id = ?', [order.supp_id])
          : null;

    return {
      format_version: '1.0',
      exported_at: new Date().toISOString(),
      doc_kind: 'ORDER',
      header: {
        no: order.no,
        tgl: order.tgl,
        type: order.type,
        dpp: order.dpp,
        ppn: order.ppn,
        diskon: order.diskon,
        ongkir: order.ongkir,
        total: order.total,
      },
      partner,
      items: (order.details || []).map((d) => ({
        barang_kode: d.barang_kode || '',
        barang_nama: d.barang_nama || '',
        part_number: d.part_number || '',
        satuan: d.satuan,
        qty: d.qty,
        price: d.price,
        subtotal: d.subtotal,
      })),
    };
  }

  const dn = getDeliveryNoteById(id);
  if (!dn) throw new Error('Dokumen Surat Jalan tidak ditemukan.');
  return {
    format_version: '1.0',
    exported_at: new Date().toISOString(),
    doc_kind: 'DELIVERY_NOTE',
    header: {
      no: dn.no,
      tgl: dn.tgl,
      order_no: dn.order_no,
      alamat_tujuan: dn.alamat_tujuan,
      keterangan: dn.keterangan,
      type: dn.type,
    },
    partner: null,
    items: (dn.details || []).map((d) => ({
      barang_kode: d.barang_kode || '',
      barang_nama: d.barang_nama || '',
      part_number: d.part_number || '',
      satuan: d.barang_satuan || 'PCS',
      qty: d.qty_sent,
    })),
  };
}
