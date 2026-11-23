import { queryAll, queryOne, execute, runTransaction } from '../db/database';
import {
  Order,
  OrderDetail,
  DeliveryNote,
  DeliveryNoteDetail,
  DeliveryNoteForInvoiceResult,
  MutasiBarang,
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

function rollbackDeliveryEffects(dnId: number): void {
  const existingDn = queryOne<DeliveryNote>('SELECT * FROM delivery_notes WHERE id = ?', [dnId]);
  if (!existingDn) return;

  const existingDetails = queryAll<DeliveryNoteDetail>(
    'SELECT * FROM delivery_note_details WHERE delivery_note_id = ?',
    [dnId]
  );

  for (const item of existingDetails) {
    const qtySent = Number(item.qty_sent || 0);
    const barang = queryOne<{ stock: number }>('SELECT stock FROM barang WHERE id = ?', [item.barang_id]);
    if (barang) {
      // Jika sebelumnya 'in' (stok bertambah), maka rollback mengurangi stok; jika 'out', rollback menambah stok
      const delta = existingDn.type === 'in' ? -qtySent : qtySent;
      const newStock = Number(barang.stock || 0) + delta;
      execute('UPDATE barang SET stock = ? WHERE id = ?', [newStock, item.barang_id], false);
    }

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
}

function applyDeliveryEffects(dnId: number, data: DeliveryNote): void {
  const details = data.details || [];
  for (const item of details) {
    const qtySent = Number(item.qty_sent || 0);
    if (qtySent <= 0) continue;

    execute(
      `INSERT INTO delivery_note_details (delivery_note_id, order_detail_id, barang_id, qty_sent)
       VALUES (?, ?, ?, ?)`,
      [dnId, item.order_detail_id ?? null, item.barang_id, qtySent],
      false
    );

    const barang = queryOne<{ stock: number }>('SELECT stock FROM barang WHERE id = ?', [item.barang_id]);
    const stokSebelum = barang ? Number(barang.stock || 0) : 0;
    const stokSesudah = data.type === 'in' ? stokSebelum + qtySent : stokSebelum - qtySent;

    if (barang) {
      execute('UPDATE barang SET stock = ? WHERE id = ?', [stokSesudah, item.barang_id], false);
    }

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
