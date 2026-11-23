import { getDb, queryOne, queryAll, execute, saveDatabase } from './database';
import { DEFAULT_PDF_TEMPLATES } from './defaultTemplates';

const LATEST_SCHEMA_VERSION = 7;

function addColumnIfNotExists(table: string, column: string, definition: string): void {
  const cols = queryAll<{ name: string }>(`PRAGMA table_info(${table})`);
  const exists = cols.some((c) => c.name === column);
  if (!exists) {
    execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`, [], false);
  }
}

export function runMigrations(): void {
  const db = getDb();
  const res = db.exec('PRAGMA user_version');
  const currentVersion =
    res.length > 0 && res[0].values.length > 0 ? Number(res[0].values[0][0]) : 0;

  if (currentVersion < 1) {
    migrateToV1();
  }

  if (currentVersion < 2) {
    migrateToV2();
  }

  if (currentVersion < 3) {
    migrateToV3();
  }

  if (currentVersion < 4) {
    migrateToV4();
  }

  if (currentVersion < 5) {
    migrateToV5();
  }

  if (currentVersion < 6) {
    migrateToV6();
  }

  if (currentVersion < 7) {
    migrateToV7();
  }

  if (currentVersion < LATEST_SCHEMA_VERSION) {
    db.run(`PRAGMA user_version = ${LATEST_SCHEMA_VERSION}`);
    saveDatabase();
  }
}

function migrateToV1(): void {
  const db = getDb();

  db.run(`
    CREATE TABLE IF NOT EXISTS barang (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kode TEXT NOT NULL DEFAULT '',
      part_number TEXT NOT NULL DEFAULT '',
      supplier_id INTEGER,
      nama TEXT NOT NULL DEFAULT '',
      satuan TEXT NOT NULL DEFAULT 'PCS',
      keterangan TEXT NOT NULL DEFAULT '',
      stock REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS customer (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kode TEXT NOT NULL DEFAULT '',
      nama TEXT NOT NULL DEFAULT '',
      alamat TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      telepon TEXT NOT NULL DEFAULT '',
      UP TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS supplier (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kode TEXT NOT NULL DEFAULT '',
      nama TEXT NOT NULL DEFAULT '',
      alamat TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      telepon TEXT NOT NULL DEFAULT '',
      UP TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tgl TEXT NOT NULL DEFAULT '',
      no TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL DEFAULT 'out',
      cust_id INTEGER,
      supp_id INTEGER,
      dpp REAL NOT NULL DEFAULT 0,
      ppn REAL NOT NULL DEFAULT 0,
      diskon REAL NOT NULL DEFAULT 0,
      ongkir REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS order_details (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      barang_id INTEGER NOT NULL,
      qty REAL NOT NULL DEFAULT 0,
      qty_sent REAL NOT NULL DEFAULT 0,
      price REAL NOT NULL DEFAULT 0,
      satuan TEXT NOT NULL DEFAULT 'PCS',
      subtotal REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS delivery_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      no TEXT NOT NULL DEFAULT '',
      tgl TEXT NOT NULL DEFAULT '',
      order_no TEXT NOT NULL DEFAULT '',
      alamat_tujuan TEXT NOT NULL DEFAULT '',
      keterangan TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL DEFAULT 'out'
    );

    CREATE TABLE IF NOT EXISTS delivery_note_details (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      delivery_note_id INTEGER NOT NULL,
      order_detail_id INTEGER,
      barang_id INTEGER NOT NULL,
      qty_sent REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      no TEXT NOT NULL DEFAULT '',
      tgl TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL DEFAULT 'out',
      order_no TEXT NOT NULL DEFAULT '',
      delivery_note_no TEXT NOT NULL DEFAULT '',
      dpp REAL NOT NULL DEFAULT 0,
      ppn REAL NOT NULL DEFAULT 0,
      ppn_nominal REAL NOT NULL DEFAULT 0,
      cust_id INTEGER,
      supp_id INTEGER,
      diskon REAL NOT NULL DEFAULT 0,
      ongkir REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      paid REAL NOT NULL DEFAULT 0,
      fully_paid TINYINT DEFAULT NULL,
      status TEXT NOT NULL DEFAULT 'Belum Lunas'
    );

    CREATE TABLE IF NOT EXISTS invoice_details (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL,
      barang_id INTEGER NOT NULL,
      qty REAL NOT NULL DEFAULT 0,
      satuan TEXT NOT NULL DEFAULT 'PCS',
      price REAL NOT NULL DEFAULT 0,
      subtotal REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      no TEXT NOT NULL DEFAULT '',
      tgl TEXT NOT NULL DEFAULT '',
      total REAL NOT NULL DEFAULT 0,
      received REAL NOT NULL DEFAULT 0,
      deduction REAL NOT NULL DEFAULT 0,
      deduction_note TEXT NOT NULL DEFAULT '',
      keterangan TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL DEFAULT 'in',
      cust_id INTEGER,
      supp_id INTEGER
    );

    CREATE TABLE IF NOT EXISTS payment_details (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_id INTEGER NOT NULL,
      invoice_id INTEGER NOT NULL,
      subtotal REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS mutasi_barang (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      barang_id INTEGER NOT NULL,
      type TEXT NOT NULL DEFAULT 'in',
      qty REAL NOT NULL DEFAULT 0,
      stok_sebelum REAL NOT NULL DEFAULT 0,
      stok_sesudah REAL NOT NULL DEFAULT 0,
      tgl TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT '',
      delivery_note_id INTEGER,
      keterangan TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS pdf_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doc_type TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL DEFAULT '',
      html_content TEXT NOT NULL DEFAULT '',
      css_content TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    );
  `);

  // Seed default app settings
  const defaultSettings: Record<string, string> = {
    app_mode: 'all',
    company_name: 'PT PILAR CERAH SEJAHTERA',
    company_address: 'Jl. Jemursari I no. 35 Surabaya, Jawa Timur',
    company_city: 'Surabaya',
    company_phone: '081175500095',
    company_email: 'marketing.pcs01@gmail.com',
    company_logo: '',
    po_signer_name: 'Tri Tjahyono Eprijarto',
    po_signer_title: 'Direktur',
    default_ppn: '11',
  };

  for (const [k, v] of Object.entries(defaultSettings)) {
    const existing = queryOne('SELECT key FROM app_settings WHERE key = ?', [k]);
    if (!existing) {
      execute('INSERT INTO app_settings (key, value) VALUES (?, ?)', [k, v], false);
    }
  }

  // Seed default PDF templates
  const now = new Date().toISOString();
  for (const tpl of DEFAULT_PDF_TEMPLATES) {
    const existing = queryOne('SELECT id FROM pdf_templates WHERE doc_type = ?', [tpl.doc_type]);
    if (!existing) {
      execute(
        'INSERT INTO pdf_templates (doc_type, name, html_content, css_content, updated_at) VALUES (?, ?, ?, ?, ?)',
        [tpl.doc_type, tpl.name, tpl.html_content, tpl.css_content, now],
        false
      );
    }
  }
}

function migrateToV2(): void {
  addColumnIfNotExists('invoices', 'fully_paid', 'TINYINT DEFAULT NULL');

  // Backfill invoice lama yang sudah lunas
  execute(
    `UPDATE invoices
     SET fully_paid = 1
     WHERE fully_paid IS NULL
       AND (total + ongkir) > 0
       AND paid >= (total + ongkir) - 0.01`,
    [],
    false
  );
}

function migrateToV3(): void {
  const now = new Date().toISOString();

  // Pastikan template INVOICE_DOT tersedia
  const dotSeed = DEFAULT_PDF_TEMPLATES.find((t) => t.doc_type === 'INVOICE_DOT');
  if (dotSeed) {
    const existingDot = queryOne('SELECT id FROM pdf_templates WHERE doc_type = ?', ['INVOICE_DOT']);
    if (!existingDot) {
      execute(
        'INSERT INTO pdf_templates (doc_type, name, html_content, css_content, updated_at) VALUES (?, ?, ?, ?, ?)',
        [dotSeed.doc_type, dotSeed.name, dotSeed.html_content, dotSeed.css_content, now],
        false
      );
    }
  }

  // Perbarui template INVOICE bawaan ke format Faktur Penjualan A4
  const invSeed = DEFAULT_PDF_TEMPLATES.find((t) => t.doc_type === 'INVOICE');
  if (invSeed) {
    execute(
      'UPDATE pdf_templates SET name = ?, html_content = ?, css_content = ?, updated_at = ? WHERE doc_type = ?',
      [invSeed.name, invSeed.html_content, invSeed.css_content, now, 'INVOICE'],
      false
    );
  }
}

function migrateToV4(): void {
  const now = new Date().toISOString();
  for (const docType of ['INVOICE', 'INVOICE_DOT'] as const) {
    const seed = DEFAULT_PDF_TEMPLATES.find((t) => t.doc_type === docType);
    if (seed) {
      execute(
        'UPDATE pdf_templates SET html_content = ?, css_content = ?, updated_at = ? WHERE doc_type = ?',
        [seed.html_content, seed.css_content, now, docType],
        false
      );
    }
  }
}

function migrateToV5(): void {
  const now = new Date().toISOString();

  const sjDotSeed = DEFAULT_PDF_TEMPLATES.find((t) => t.doc_type === 'SJ_DOT');
  if (sjDotSeed) {
    const existingSjDot = queryOne('SELECT id FROM pdf_templates WHERE doc_type = ?', ['SJ_DOT']);
    if (!existingSjDot) {
      execute(
        'INSERT INTO pdf_templates (doc_type, name, html_content, css_content, updated_at) VALUES (?, ?, ?, ?, ?)',
        [sjDotSeed.doc_type, sjDotSeed.name, sjDotSeed.html_content, sjDotSeed.css_content, now],
        false
      );
    } else {
      execute(
        'UPDATE pdf_templates SET name = ?, html_content = ?, css_content = ?, updated_at = ? WHERE doc_type = ?',
        [sjDotSeed.name, sjDotSeed.html_content, sjDotSeed.css_content, now, 'SJ_DOT'],
        false
      );
    }
  }

  const sjSeed = DEFAULT_PDF_TEMPLATES.find((t) => t.doc_type === 'SJ');
  if (sjSeed) {
    execute(
      'UPDATE pdf_templates SET name = ?, html_content = ?, css_content = ?, updated_at = ? WHERE doc_type = ?',
      [sjSeed.name, sjSeed.html_content, sjSeed.css_content, now, 'SJ'],
      false
    );
  }
}

function migrateToV6(): void {
  addColumnIfNotExists('orders', 'deldate', "TEXT NOT NULL DEFAULT ''");
  addColumnIfNotExists('orders', 'po_subject', "TEXT NOT NULL DEFAULT ''");

  const extraSettings: Record<string, string> = {
    company_city: 'Surabaya',
    company_logo: '',
    po_signer_name: 'Tri Tjahyono Eprijarto',
    po_signer_title: 'Direktur',
  };
  for (const [k, v] of Object.entries(extraSettings)) {
    const existing = queryOne('SELECT key FROM app_settings WHERE key = ?', [k]);
    if (!existing) {
      execute('INSERT INTO app_settings (key, value) VALUES (?, ?)', [k, v], false);
    }
  }

  const now = new Date().toISOString();
  const poSeed = DEFAULT_PDF_TEMPLATES.find((t) => t.doc_type === 'PO');
  if (poSeed) {
    execute(
      'UPDATE pdf_templates SET name = ?, html_content = ?, css_content = ?, updated_at = ? WHERE doc_type = ?',
      [poSeed.name, poSeed.html_content, poSeed.css_content, now, 'PO'],
      false
    );
  }
}

function migrateToV7(): void {
  const db = getDb();
  db.run(`
    CREATE TABLE IF NOT EXISTS samples (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      no TEXT NOT NULL DEFAULT '',
      tgl TEXT NOT NULL DEFAULT '',
      id_customer INTEGER,
      penerima_nama TEXT NOT NULL DEFAULT '',
      keterangan TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS sample_barangs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_sample INTEGER NOT NULL,
      id_barangs INTEGER NOT NULL,
      qty REAL NOT NULL DEFAULT 0,
      satuan TEXT NOT NULL DEFAULT 'PCS'
    );
  `);

  addColumnIfNotExists('mutasi_barang', 'sample_id', 'INTEGER DEFAULT NULL');

  const now = new Date().toISOString();
  const sampleSeed = DEFAULT_PDF_TEMPLATES.find((t) => t.doc_type === 'SAMPLE');
  if (sampleSeed) {
    const existing = queryOne('SELECT id FROM pdf_templates WHERE doc_type = ?', ['SAMPLE']);
    if (!existing) {
      execute(
        'INSERT INTO pdf_templates (doc_type, name, html_content, css_content, updated_at) VALUES (?, ?, ?, ?, ?)',
        [sampleSeed.doc_type, sampleSeed.name, sampleSeed.html_content, sampleSeed.css_content, now],
        false
      );
    }
  }
}

