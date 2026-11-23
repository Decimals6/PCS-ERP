import { queryAll, queryOne, execute, runTransaction } from '../db/database';
import {
  Invoice,
  InvoiceDetail,
  InvoiceStatus,
  Payment,
  PaymentDetail,
} from '../../shared/types';

function computeInvoiceStatus(total: number, ongkir: number, paid: number): InvoiceStatus {
  const grandTagihan = Number(total || 0) + Number(ongkir || 0);
  if (paid <= 0) return 'Belum Lunas';
  if (paid >= grandTagihan - 0.01) return 'Lunas';
  return 'Cicil';
}

function computeFullyPaid(total: number, ongkir: number, paid: number): number | null {
  const grandTagihan = Number(total || 0) + Number(ongkir || 0);
  if (grandTagihan > 0 && paid >= grandTagihan - 0.01) return 1;
  return null;
}

export function recalculateInvoicePaid(invoiceId: number): void {
  const inv = queryOne<{ total: number; ongkir: number }>(
    'SELECT total, ongkir FROM invoices WHERE id = ?',
    [invoiceId]
  );
  if (!inv) return;
  const paidRow = queryOne<{ sum_paid: number }>(
    'SELECT COALESCE(SUM(subtotal), 0) AS sum_paid FROM payment_details WHERE invoice_id = ?',
    [invoiceId]
  );
  const paid = paidRow ? Number(paidRow.sum_paid || 0) : 0;
  const status = computeInvoiceStatus(inv.total, inv.ongkir, paid);
  const fullyPaid = computeFullyPaid(inv.total, inv.ongkir, paid);
  execute(
    'UPDATE invoices SET paid = ?, status = ?, fully_paid = ? WHERE id = ?',
    [paid, status, fullyPaid, invoiceId],
    false
  );
}

// ==================== INVOICES ====================
export function listInvoices(type?: 'in' | 'out'): Invoice[] {
  const where = type ? 'WHERE i.type = ?' : '';
  const params = type ? [type] : [];
  return queryAll<Invoice>(
    `SELECT i.*,
            c.nama AS customer_nama,
            s.nama AS supplier_nama
     FROM invoices i
     LEFT JOIN customer c ON i.cust_id = c.id
     LEFT JOIN supplier s ON i.supp_id = s.id
     ${where}
     ORDER BY i.tgl DESC, i.id DESC`,
    params
  );
}

export function getInvoiceById(id: number): Invoice | null {
  const inv = queryOne<Invoice>(
    `SELECT i.*,
            c.nama AS customer_nama,
            s.nama AS supplier_nama
     FROM invoices i
     LEFT JOIN customer c ON i.cust_id = c.id
     LEFT JOIN supplier s ON i.supp_id = s.id
     WHERE i.id = ?`,
    [id]
  );
  if (!inv) return null;
  inv.details = queryAll<InvoiceDetail>(
    `SELECT idet.*,
            b.kode AS barang_kode,
            b.nama AS barang_nama,
            b.part_number
     FROM invoice_details idet
     LEFT JOIN barang b ON idet.barang_id = b.id
     WHERE idet.invoice_id = ?
     ORDER BY idet.id ASC`,
    [id]
  );
  return inv;
}

export function listUnpaidInvoicesByPartner(
  type: 'in' | 'out',
  partnerId: number
): Invoice[] {
  const col = type === 'out' ? 'cust_id' : 'supp_id';
  return queryAll<Invoice>(
    `SELECT i.*,
            c.nama AS customer_nama,
            s.nama AS supplier_nama
     FROM invoices i
     LEFT JOIN customer c ON i.cust_id = c.id
     LEFT JOIN supplier s ON i.supp_id = s.id
     WHERE i.type = ? AND i.${col} = ? AND i.fully_paid IS NULL
     ORDER BY i.tgl ASC, i.id ASC`,
    [type, partnerId]
  );
}

export function createInvoice(data: Invoice): Invoice {
  let newId = 0;
  runTransaction(() => {
    const details = data.details || [];
    const dpp = details.reduce((sum, item) => sum + Number(item.qty || 0) * Number(item.price || 0), 0);
    const diskon = Number(data.diskon || 0);
    const ppn = Number(data.ppn || 0);
    const ongkir = Number(data.ongkir || 0);
    const ppnNominal = Math.max(0, dpp - diskon) * (ppn / 100);
    const total = Math.max(0, dpp - diskon) + ppnNominal;
    const paid = Number(data.paid || 0);
    const status = computeInvoiceStatus(total, ongkir, paid);
    const fullyPaid = computeFullyPaid(total, ongkir, paid);

    const res = execute(
      `INSERT INTO invoices (
         no, tgl, type, order_no, delivery_note_no,
         dpp, ppn, ppn_nominal, cust_id, supp_id,
         diskon, ongkir, total, paid, fully_paid, status
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.no,
        data.tgl,
        data.type,
        data.order_no || '',
        data.delivery_note_no || '',
        dpp,
        ppn,
        ppnNominal,
        data.type === 'out' ? data.cust_id ?? null : null,
        data.type === 'in' ? data.supp_id ?? null : null,
        diskon,
        ongkir,
        total,
        paid,
        fullyPaid,
        status,
      ],
      false
    );
    newId = res.lastInsertRowid;

    for (const item of details) {
      const qty = Number(item.qty || 0);
      const price = Number(item.price || 0);
      const subtotal = qty * price;
      execute(
        `INSERT INTO invoice_details (invoice_id, barang_id, qty, satuan, price, subtotal)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [newId, item.barang_id, qty, item.satuan || 'PCS', price, subtotal],
        false
      );
    }
  });
  return getInvoiceById(newId)!;
}

export function updateInvoice(id: number, data: Invoice): Invoice {
  runTransaction(() => {
    const existing = queryOne<{ paid: number }>('SELECT paid FROM invoices WHERE id = ?', [id]);
    const paidFromPaymentsRow = queryOne<{ sum_paid: number }>(
      'SELECT COALESCE(SUM(subtotal), 0) AS sum_paid FROM payment_details WHERE invoice_id = ?',
      [id]
    );
    const paidFromPayments = paidFromPaymentsRow ? Number(paidFromPaymentsRow.sum_paid || 0) : 0;

    const details = data.details || [];
    const dpp = details.reduce((sum, item) => sum + Number(item.qty || 0) * Number(item.price || 0), 0);
    const diskon = Number(data.diskon || 0);
    const ppn = Number(data.ppn || 0);
    const ongkir = Number(data.ongkir || 0);
    const ppnNominal = Math.max(0, dpp - diskon) * (ppn / 100);
    const total = Math.max(0, dpp - diskon) + ppnNominal;
    const grandTagihan = total + ongkir;

    let paid = existing ? Number(existing.paid || 0) : 0;
    if (data.fully_paid === 1 || data.status === 'Lunas') {
      paid = Math.max(paidFromPayments, grandTagihan);
    } else if (data.fully_paid === null) {
      paid = paidFromPayments;
    }

    const status = computeInvoiceStatus(total, ongkir, paid);
    const fullyPaid = computeFullyPaid(total, ongkir, paid);

    execute(
      `UPDATE invoices
       SET no = ?, tgl = ?, type = ?, order_no = ?, delivery_note_no = ?,
           dpp = ?, ppn = ?, ppn_nominal = ?, cust_id = ?, supp_id = ?,
           diskon = ?, ongkir = ?, total = ?, paid = ?, fully_paid = ?, status = ?
       WHERE id = ?`,
      [
        data.no,
        data.tgl,
        data.type,
        data.order_no || '',
        data.delivery_note_no || '',
        dpp,
        ppn,
        ppnNominal,
        data.type === 'out' ? data.cust_id ?? null : null,
        data.type === 'in' ? data.supp_id ?? null : null,
        diskon,
        ongkir,
        total,
        paid,
        fullyPaid,
        status,
        id,
      ],
      false
    );

    execute('DELETE FROM invoice_details WHERE invoice_id = ?', [id], false);
    for (const item of details) {
      const qty = Number(item.qty || 0);
      const price = Number(item.price || 0);
      const subtotal = qty * price;
      execute(
        `INSERT INTO invoice_details (invoice_id, barang_id, qty, satuan, price, subtotal)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, item.barang_id, qty, item.satuan || 'PCS', price, subtotal],
        false
      );
    }
  });
  return getInvoiceById(id)!;
}

export function deleteInvoice(id: number): void {
  runTransaction(() => {
    execute('DELETE FROM payment_details WHERE invoice_id = ?', [id], false);
    execute('DELETE FROM invoice_details WHERE invoice_id = ?', [id], false);
    execute('DELETE FROM invoices WHERE id = ?', [id], false);
  });
}

// ==================== PAYMENTS (PELUNASAN HUTANG / PIUTANG) ====================
export function listPayments(type?: 'in' | 'out'): Payment[] {
  const where = type ? 'WHERE p.type = ?' : '';
  const params = type ? [type] : [];
  return queryAll<Payment>(
    `SELECT p.*,
            c.nama AS customer_nama,
            s.nama AS supplier_nama
     FROM payments p
     LEFT JOIN customer c ON p.cust_id = c.id
     LEFT JOIN supplier s ON p.supp_id = s.id
     ${where}
     ORDER BY p.tgl DESC, p.id DESC`,
    params
  );
}

export function getPaymentById(id: number): Payment | null {
  const pay = queryOne<Payment>(
    `SELECT p.*,
            c.nama AS customer_nama,
            s.nama AS supplier_nama
     FROM payments p
     LEFT JOIN customer c ON p.cust_id = c.id
     LEFT JOIN supplier s ON p.supp_id = s.id
     WHERE p.id = ?`,
    [id]
  );
  if (!pay) return null;
  pay.details = queryAll<PaymentDetail>(
    `SELECT pd.*,
            i.no AS invoice_no,
            i.tgl AS invoice_tgl,
            (i.total + i.ongkir) AS invoice_total_tagihan,
            ((i.total + i.ongkir) - i.paid) AS invoice_sisa
     FROM payment_details pd
     LEFT JOIN invoices i ON pd.invoice_id = i.id
     WHERE pd.payment_id = ?
     ORDER BY pd.id ASC`,
    [id]
  );
  return pay;
}

export function createPayment(data: Payment): Payment {
  let newId = 0;
  runTransaction(() => {
    const details = (data.details || []).filter((d) => Number(d.subtotal || 0) > 0);
    const totalAllocated = details.reduce((s, d) => s + Number(d.subtotal || 0), 0);
    const deduction = Number(data.deduction || 0);
    const received = data.received !== undefined ? Number(data.received) : Math.max(0, totalAllocated - deduction);

    const res = execute(
      `INSERT INTO payments (no, tgl, total, received, deduction, deduction_note, keterangan, type, cust_id, supp_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.no,
        data.tgl,
        totalAllocated,
        received,
        deduction,
        data.deduction_note || '',
        data.keterangan || '',
        data.type,
        data.type === 'in' ? data.cust_id ?? null : null,
        data.type === 'out' ? data.supp_id ?? null : null,
      ],
      false
    );
    newId = res.lastInsertRowid;

    const affectedInvoiceIds = new Set<number>();
    for (const item of details) {
      execute(
        `INSERT INTO payment_details (payment_id, invoice_id, subtotal) VALUES (?, ?, ?)`,
        [newId, item.invoice_id, Number(item.subtotal || 0)],
        false
      );
      affectedInvoiceIds.add(item.invoice_id);
    }

    for (const invId of affectedInvoiceIds) {
      recalculateInvoicePaid(invId);
    }
  });
  return getPaymentById(newId)!;
}

export function updatePayment(id: number, data: Payment): Payment {
  runTransaction(() => {
    const oldDetails = queryAll<{ invoice_id: number }>(
      'SELECT invoice_id FROM payment_details WHERE payment_id = ?',
      [id]
    );
    const affectedInvoiceIds = new Set<number>(oldDetails.map((d) => d.invoice_id));

    execute('DELETE FROM payment_details WHERE payment_id = ?', [id], false);

    const details = (data.details || []).filter((d) => Number(d.subtotal || 0) > 0);
    const totalAllocated = details.reduce((s, d) => s + Number(d.subtotal || 0), 0);
    const deduction = Number(data.deduction || 0);
    const received = data.received !== undefined ? Number(data.received) : Math.max(0, totalAllocated - deduction);

    execute(
      `UPDATE payments
       SET no = ?, tgl = ?, total = ?, received = ?, deduction = ?, deduction_note = ?, keterangan = ?, type = ?, cust_id = ?, supp_id = ?
       WHERE id = ?`,
      [
        data.no,
        data.tgl,
        totalAllocated,
        received,
        deduction,
        data.deduction_note || '',
        data.keterangan || '',
        data.type,
        data.type === 'in' ? data.cust_id ?? null : null,
        data.type === 'out' ? data.supp_id ?? null : null,
        id,
      ],
      false
    );

    for (const item of details) {
      execute(
        `INSERT INTO payment_details (payment_id, invoice_id, subtotal) VALUES (?, ?, ?)`,
        [id, item.invoice_id, Number(item.subtotal || 0)],
        false
      );
      affectedInvoiceIds.add(item.invoice_id);
    }

    for (const invId of affectedInvoiceIds) {
      recalculateInvoicePaid(invId);
    }
  });
  return getPaymentById(id)!;
}

export function deletePayment(id: number): void {
  runTransaction(() => {
    const oldDetails = queryAll<{ invoice_id: number }>(
      'SELECT invoice_id FROM payment_details WHERE payment_id = ?',
      [id]
    );
    const affectedInvoiceIds = new Set<number>(oldDetails.map((d) => d.invoice_id));

    execute('DELETE FROM payment_details WHERE payment_id = ?', [id], false);
    execute('DELETE FROM payments WHERE id = ?', [id], false);

    for (const invId of affectedInvoiceIds) {
      recalculateInvoicePaid(invId);
    }
  });
}
