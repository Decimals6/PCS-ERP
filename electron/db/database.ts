import initSqlJs, { Database, SqlValue } from 'sql.js';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';

let dbInstance: Database | null = null;
let dbFilePath = '';

function resolveWasmPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'sql-wasm.wasm');
  }
  return require.resolve('sql.js/dist/sql-wasm.wasm');
}

export function getDbPath(): string {
  if (!dbFilePath) {
    const userDataDir = app.getPath('userData');
    if (!fs.existsSync(userDataDir)) {
      fs.mkdirSync(userDataDir, { recursive: true });
    }
    dbFilePath = path.join(userDataDir, 'erp_offline.db');
  }
  return dbFilePath;
}

export async function initDatabase(): Promise<Database> {
  if (dbInstance) return dbInstance;

  const wasmPath = resolveWasmPath();
  const rawWasm = fs.readFileSync(wasmPath);
  const wasmBinary = rawWasm.buffer.slice(
    rawWasm.byteOffset,
    rawWasm.byteOffset + rawWasm.byteLength
  ) as ArrayBuffer;

  const SQL = await initSqlJs({
    wasmBinary,
    useOldExtensionFunctions: false,
  });

  const filePath = getDbPath();
  if (fs.existsSync(filePath)) {
    const fileBuffer = fs.readFileSync(filePath);
    dbInstance = new SQL.Database(new Uint8Array(fileBuffer));
  } else {
    dbInstance = new SQL.Database();
  }

  saveDatabase();
  return dbInstance;
}

export function getDb(): Database {
  if (!dbInstance) {
    throw new Error('Database belum diinisialisasi.');
  }
  return dbInstance;
}

export function saveDatabase(): void {
  if (!dbInstance) return;
  const data = dbInstance.export();
  const buffer = Buffer.from(data);
  const filePath = getDbPath();
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, buffer);
  fs.renameSync(tempPath, filePath);
}

export function queryAll<T = Record<string, any>>(
  sql: string,
  params: SqlValue[] = []
): T[] {
  const db = getDb();
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows: T[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return rows;
}

export function queryOne<T = Record<string, any>>(
  sql: string,
  params: SqlValue[] = []
): T | null {
  const rows = queryAll<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

export function execute(
  sql: string,
  params: SqlValue[] = [],
  autoSave = true
): { lastInsertRowid: number; changes: number } {
  const db = getDb();
  db.run(sql, params);
  const idRes = queryOne<{ id: number }>('SELECT last_insert_rowid() AS id');
  const changes = db.getRowsModified();
  if (autoSave) {
    saveDatabase();
  }
  return {
    lastInsertRowid: idRes ? Number(idRes.id) : 0,
    changes,
  };
}

export function runTransaction<T>(fn: () => T): T {
  const db = getDb();
  db.run('BEGIN TRANSACTION');
  try {
    const result = fn();
    db.run('COMMIT');
    saveDatabase();
    return result;
  } catch (err) {
    try {
      db.run('ROLLBACK');
    } catch {
      // ignore rollback error
    }
    throw err;
  }
}

export async function reloadDatabaseFromFile(sourcePath: string): Promise<void> {
  const wasmPath = resolveWasmPath();
  const rawWasm = fs.readFileSync(wasmPath);
  const wasmBinary = rawWasm.buffer.slice(
    rawWasm.byteOffset,
    rawWasm.byteOffset + rawWasm.byteLength
  ) as ArrayBuffer;
  const SQL = await initSqlJs({ wasmBinary, useOldExtensionFunctions: false });
  const fileBuffer = fs.readFileSync(sourcePath);
  if (dbInstance) {
    dbInstance.close();
  }
  dbInstance = new SQL.Database(new Uint8Array(fileBuffer));
  saveDatabase();
}
