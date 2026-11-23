import { execSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const pkgPath = path.join(rootDir, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
const version = pkg.version;
const notes = process.argv.slice(2).join(' ').trim() || `Pembaruan aplikasi PCS-ERP v${version}`;

console.log(`[1/4] Membuild aplikasi PCS-ERP v${version}...`);
execSync('npm run build', { cwd: rootDir, stdio: 'inherit' });

const otaDir = path.join(rootDir, 'ota');
fs.mkdirSync(otaDir, { recursive: true });

const zipPath = path.join(otaDir, 'app-bundle.zip');
if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath);
}

console.log('[2/4] Mengemas dist/, dist-electron/, dan package.json ke ota/app-bundle.zip...');
const psCommand = `Compress-Archive -Path '${path.join(rootDir, 'dist')}', '${path.join(rootDir, 'dist-electron')}', '${pkgPath}' -DestinationPath '${zipPath}' -Force`;
execSync(`powershell -NoProfile -NonInteractive -Command "${psCommand}"`, { stdio: 'inherit' });

console.log('[3/4] Menghitung hash SHA-256 & membuat ota/version.json...');
const zipBuffer = fs.readFileSync(zipPath);
const sha256 = crypto.createHash('sha256').update(zipBuffer).digest('hex');

const releaseDate = new Date().toLocaleDateString('id-ID', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const manifest = {
  version,
  releaseDate,
  notes,
  bundleUrl: 'https://raw.githubusercontent.com/Decimals6/PCS-ERP/main/ota/app-bundle.zip',
  sha256,
};

fs.writeFileSync(path.join(otaDir, 'version.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf-8');

console.log('[4/4] Selesai! Manifest OTA siap di-push ke GitHub:');
console.log(manifest);
console.log('\nJalankan perintah berikut untuk merilis update ke semua PC client:');
console.log(`git add ota package.json src/data/changelog.ts && git commit -m "chore(release): ota v${version}" && git push origin main`);
