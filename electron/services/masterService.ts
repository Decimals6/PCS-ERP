import { queryAll, queryOne, execute, runTransaction } from '../db/database';
import { Barang, Customer, Supplier } from '../../shared/types';

// ==================== BARANG ====================
export function listBarang(): Barang[] {
  return queryAll<Barang>(`
    SELECT b.*, s.nama AS supplier_nama
    FROM barang b
    LEFT JOIN supplier s ON b.supplier_id = s.id
    ORDER BY b.id DESC
  `);
}

export function createBarang(data: Omit<Barang, 'id'>): Barang {
  const res = execute(
    `INSERT INTO barang (kode, part_number, supplier_id, nama, satuan, keterangan, stock)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      data.kode || '',
      data.part_number || '',
      data.supplier_id ?? null,
      data.nama || '',
      data.satuan || 'PCS',
      data.keterangan || '',
      Number(data.stock || 0),
    ]
  );
  return queryOne<Barang>('SELECT * FROM barang WHERE id = ?', [res.lastInsertRowid])!;
}

export function updateBarang(id: number, data: Partial<Barang>): Barang {
  execute(
    `UPDATE barang
     SET kode = ?, part_number = ?, supplier_id = ?, nama = ?, satuan = ?, keterangan = ?, stock = ?
     WHERE id = ?`,
    [
      data.kode || '',
      data.part_number || '',
      data.supplier_id ?? null,
      data.nama || '',
      data.satuan || 'PCS',
      data.keterangan || '',
      Number(data.stock || 0),
      id,
    ]
  );
  return queryOne<Barang>('SELECT * FROM barang WHERE id = ?', [id])!;
}

export function deleteBarang(id: number): void {
  execute('DELETE FROM barang WHERE id = ?', [id]);
}

// ==================== CUSTOMER ====================
export function listCustomer(): Customer[] {
  return queryAll<Customer>('SELECT * FROM customer ORDER BY id DESC');
}

export function createCustomer(data: Omit<Customer, 'id'>): Customer {
  const res = execute(
    `INSERT INTO customer (kode, nama, alamat, email, telepon, UP)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      data.kode || '',
      data.nama || '',
      data.alamat || '',
      data.email || '',
      data.telepon || '',
      data.UP || '',
    ]
  );
  return queryOne<Customer>('SELECT * FROM customer WHERE id = ?', [res.lastInsertRowid])!;
}

export function updateCustomer(id: number, data: Partial<Customer>): Customer {
  execute(
    `UPDATE customer
     SET kode = ?, nama = ?, alamat = ?, email = ?, telepon = ?, UP = ?
     WHERE id = ?`,
    [
      data.kode || '',
      data.nama || '',
      data.alamat || '',
      data.email || '',
      data.telepon || '',
      data.UP || '',
      id,
    ]
  );
  return queryOne<Customer>('SELECT * FROM customer WHERE id = ?', [id])!;
}

export function deleteCustomer(id: number): void {
  execute('DELETE FROM customer WHERE id = ?', [id]);
}

// ==================== SUPPLIER ====================
export function listSupplier(): Supplier[] {
  return queryAll<Supplier>('SELECT * FROM supplier ORDER BY id DESC');
}

export function createSupplier(data: Omit<Supplier, 'id'>): Supplier {
  const res = execute(
    `INSERT INTO supplier (kode, nama, alamat, email, telepon, UP)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      data.kode || '',
      data.nama || '',
      data.alamat || '',
      data.email || '',
      data.telepon || '',
      data.UP || '',
    ]
  );
  return queryOne<Supplier>('SELECT * FROM supplier WHERE id = ?', [res.lastInsertRowid])!;
}

export function updateSupplier(id: number, data: Partial<Supplier>): Supplier {
  execute(
    `UPDATE supplier
     SET kode = ?, nama = ?, alamat = ?, email = ?, telepon = ?, UP = ?
     WHERE id = ?`,
    [
      data.kode || '',
      data.nama || '',
      data.alamat || '',
      data.email || '',
      data.telepon || '',
      data.UP || '',
      id,
    ]
  );
  return queryOne<Supplier>('SELECT * FROM supplier WHERE id = ?', [id])!;
}

export function deleteSupplier(id: number): void {
  execute('DELETE FROM supplier WHERE id = ?', [id]);
}

// ==================== BULK IMPORT (CSV / JSON) ====================
export function bulkImportMaster(
  entity: 'barang' | 'customer' | 'supplier',
  rows: Record<string, any>[]
): { inserted: number; updated: number } {
  let inserted = 0;
  let updated = 0;

  runTransaction(() => {
    for (const row of rows) {
      const kode = String(row.kode ?? row.code ?? '').trim();
      const nama = String(row.nama ?? row.name ?? '').trim();
      if (!nama && !kode) continue;

      if (entity === 'barang') {
        const partNumber = String(row.part_number ?? row.partNumber ?? '').trim();
        const satuan = String(row.satuan ?? row.unit ?? 'PCS').trim() || 'PCS';
        const keterangan = String(row.keterangan ?? row.notes ?? '').trim();
        const stock = Number(row.stock ?? row.stok ?? 0) || 0;
        const supplierId = row.supplier_id ? Number(row.supplier_id) : null;

        const existing = kode
          ? queryOne<{ id: number }>('SELECT id FROM barang WHERE kode = ?', [kode])
          : null;

        if (existing) {
          execute(
            `UPDATE barang SET part_number = ?, supplier_id = ?, nama = ?, satuan = ?, keterangan = ?, stock = ? WHERE id = ?`,
            [partNumber, supplierId, nama, satuan, keterangan, stock, existing.id],
            false
          );
          updated++;
        } else {
          execute(
            `INSERT INTO barang (kode, part_number, supplier_id, nama, satuan, keterangan, stock) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [kode, partNumber, supplierId, nama, satuan, keterangan, stock],
            false
          );
          inserted++;
        }
      } else if (entity === 'customer') {
        const alamat = String(row.alamat ?? row.address ?? '').trim();
        const email = String(row.email ?? '').trim();
        const telepon = String(row.telepon ?? row.phone ?? '').trim();
        const up = String(row.UP ?? row.up ?? '').trim();

        const existing = kode
          ? queryOne<{ id: number }>('SELECT id FROM customer WHERE kode = ?', [kode])
          : null;

        if (existing) {
          execute(
            `UPDATE customer SET nama = ?, alamat = ?, email = ?, telepon = ?, UP = ? WHERE id = ?`,
            [nama, alamat, email, telepon, up, existing.id],
            false
          );
          updated++;
        } else {
          execute(
            `INSERT INTO customer (kode, nama, alamat, email, telepon, UP) VALUES (?, ?, ?, ?, ?, ?)`,
            [kode, nama, alamat, email, telepon, up],
            false
          );
          inserted++;
        }
      } else if (entity === 'supplier') {
        const alamat = String(row.alamat ?? row.address ?? '').trim();
        const email = String(row.email ?? '').trim();
        const telepon = String(row.telepon ?? row.phone ?? '').trim();
        const up = String(row.UP ?? row.up ?? '').trim();

        const existing = kode
          ? queryOne<{ id: number }>('SELECT id FROM supplier WHERE kode = ?', [kode])
          : null;

        if (existing) {
          execute(
            `UPDATE supplier SET nama = ?, alamat = ?, email = ?, telepon = ?, UP = ? WHERE id = ?`,
            [nama, alamat, email, telepon, up, existing.id],
            false
          );
          updated++;
        } else {
          execute(
            `INSERT INTO supplier (kode, nama, alamat, email, telepon, UP) VALUES (?, ?, ?, ?, ?, ?)`,
            [kode, nama, alamat, email, telepon, up],
            false
          );
          inserted++;
        }
      }
    }
  });

  return { inserted, updated };
}
