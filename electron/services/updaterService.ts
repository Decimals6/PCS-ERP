import { app } from 'electron';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFile } from 'child_process';
import { OtaManifest, UpdateApplyResult, UpdateCheckResult } from '../../shared/types';

const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/Decimals6/PCS-ERP/main/ota';
const MANIFEST_URL = `${GITHUB_RAW_BASE}/version.json`;

function compareSemver(a: string, b: string): number {
  const pa = String(a || '')
    .replace(/^v/i, '')
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
  const pb = String(b || '')
    .replace(/^v/i, '')
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export function getCurrentAppVersion(): string {
  try {
    const pkgPath = path.join(app.getAppPath(), 'package.json');
    if (fs.existsSync(pkgPath)) {
      const parsed = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      if (parsed.version) return String(parsed.version);
    }
  } catch {
    // fallback to app.getVersion()
  }
  return app.getVersion();
}

export async function checkForOtaUpdate(): Promise<UpdateCheckResult> {
  const currentVersion = getCurrentAppVersion();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(`${MANIFEST_URL}?t=${Date.now()}`, {
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return {
        hasUpdate: false,
        currentVersion,
        latestVersion: currentVersion,
        error:
          res.status === 404
            ? 'Manifest update belum dipublikasikan di repository GitHub.'
            : `Server GitHub merespons HTTP ${res.status}`,
      };
    }

    const manifest = (await res.json()) as OtaManifest;
    const latestVersion = String(manifest.version || currentVersion).trim();
    const isNewer = compareSemver(latestVersion, currentVersion) > 0;

    return {
      hasUpdate: isNewer,
      currentVersion,
      latestVersion,
      releaseDate: manifest.releaseDate,
      notes: manifest.notes,
      bundleUrl: manifest.bundleUrl,
      sha256: manifest.sha256,
    };
  } catch {
    return {
      hasUpdate: false,
      currentVersion,
      latestVersion: currentVersion,
      offline: true,
      error: 'Tidak dapat terhubung ke GitHub (Mode Offline / Koneksi terputus).',
    };
  }
}

function extractZipArchive(zipPath: string, destDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (process.platform === 'win32') {
      execFile(
        'powershell.exe',
        [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${destDir.replace(/'/g, "''")}' -Force`,
        ],
        (err) => (err ? reject(err) : resolve())
      );
    } else {
      execFile('unzip', ['-o', zipPath, '-d', destDir], (err) => (err ? reject(err) : resolve()));
    }
  });
}

export async function downloadAndApplyOtaUpdate(manifest: {
  version: string;
  bundleUrl: string;
  sha256: string;
}): Promise<UpdateApplyResult> {
  if (!app.isPackaged) {
    return {
      success: false,
      message: 'Auto-update hanya dapat dijalankan pada aplikasi terinstal (production build), bukan mode development.',
    };
  }

  const appRoot = app.getAppPath();
  if (appRoot.toLowerCase().endsWith('.asar')) {
    return {
      success: false,
      message:
        'Instalasi lama masih menggunakan paket .asar terkunci. Silakan install ulang sekali menggunakan installer terbaru (asar: false) agar update otomatis aktif.',
    };
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcs-erp-ota-'));
  const zipPath = path.join(tempDir, 'app-bundle.zip');
  const extractDir = path.join(tempDir, 'extracted');

  try {
    const res = await fetch(`${manifest.bundleUrl}?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) {
      throw new Error(`Gagal mengunduh paket update (HTTP ${res.status})`);
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(zipPath, buffer);

    const actualHash = crypto.createHash('sha256').update(buffer).digest('hex');
    if (manifest.sha256 && actualHash.toLowerCase() !== manifest.sha256.toLowerCase()) {
      throw new Error('Verifikasi keamanan file (SHA-256) gagal. File korup atau tidak cocok.');
    }

    fs.mkdirSync(extractDir, { recursive: true });
    await extractZipArchive(zipPath, extractDir);

    const newDist = path.join(extractDir, 'dist');
    const newDistElectron = path.join(extractDir, 'dist-electron');
    const newPkg = path.join(extractDir, 'package.json');

    if (!fs.existsSync(newDist) || !fs.existsSync(newDistElectron)) {
      throw new Error('Struktur paket update tidak valid (folder dist / dist-electron tidak ditemukan).');
    }

    const targetDist = path.join(appRoot, 'dist');
    const targetDistElectron = path.join(appRoot, 'dist-electron');
    const targetPkg = path.join(appRoot, 'package.json');

    const bakDist = path.join(tempDir, 'dist.bak');
    const bakDistElectron = path.join(tempDir, 'dist-electron.bak');

    if (fs.existsSync(targetDist)) fs.cpSync(targetDist, bakDist, { recursive: true });
    if (fs.existsSync(targetDistElectron)) fs.cpSync(targetDistElectron, bakDistElectron, { recursive: true });

    try {
      fs.rmSync(targetDist, { recursive: true, force: true });
      fs.rmSync(targetDistElectron, { recursive: true, force: true });

      fs.cpSync(newDist, targetDist, { recursive: true });
      fs.cpSync(newDistElectron, targetDistElectron, { recursive: true });
      if (fs.existsSync(newPkg)) {
        fs.copyFileSync(newPkg, targetPkg);
      }
    } catch (swapErr) {
      if (fs.existsSync(bakDist)) {
        fs.rmSync(targetDist, { recursive: true, force: true });
        fs.cpSync(bakDist, targetDist, { recursive: true });
      }
      if (fs.existsSync(bakDistElectron)) {
        fs.rmSync(targetDistElectron, { recursive: true, force: true });
        fs.cpSync(bakDistElectron, targetDistElectron, { recursive: true });
      }
      throw swapErr;
    }

    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore temp cleanup error
    }

    setTimeout(() => {
      app.relaunch();
      app.exit(0);
    }, 700);

    return {
      success: true,
      message: `Berhasil memperbarui ke v${manifest.version}. Aplikasi akan dimulai ulang...`,
    };
  } catch (err: any) {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
    return {
      success: false,
      message: err?.message || 'Terjadi kesalahan saat memperbarui aplikasi.',
    };
  }
}
