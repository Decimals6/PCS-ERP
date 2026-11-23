import React, { useEffect, useRef, useState } from 'react';
import { Save, RotateCcw, Database, Upload, Download, Eye, Image as ImageIcon, Trash2 } from 'lucide-react';
import { AppMode, AppSettings, DocType, PdfTemplate } from '../../shared/types';

interface SettingsTemplatesPageProps {
  settings: AppSettings;
  onSettingsSaved: (updated: AppSettings) => void;
}

export const SettingsTemplatesPage: React.FC<SettingsTemplatesPageProps> = ({
  settings,
  onSettingsSaved,
}) => {
  const [formSettings, setFormSettings] = useState<AppSettings>(settings);
  const [templates, setTemplates] = useState<PdfTemplate[]>([]);
  const [selectedDocType, setSelectedDocType] = useState<DocType>('INVOICE');
  const [htmlCode, setHtmlCode] = useState('');
  const [cssCode, setCssCode] = useState('');
  const [dbPath, setDbPath] = useState('');
  const [previewSampleOpen, setPreviewSampleOpen] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setFormSettings(settings);
  }, [settings]);

  const loadTemplatesAndDb = async () => {
    const [tpls, p] = await Promise.all([window.api.listPdfTemplates(), window.api.getDbPath()]);
    setTemplates(tpls);
    setDbPath(p);
    const active = tpls.find((t: PdfTemplate) => t.doc_type === selectedDocType) || tpls[0];
    if (active) {
      setSelectedDocType(active.doc_type);
      setHtmlCode(active.html_content || '');
      setCssCode(active.css_content || '');
    }
  };

  useEffect(() => {
    loadTemplatesAndDb();
  }, []);

  const handleSelectDocType = (docType: DocType) => {
    setSelectedDocType(docType);
    const found = templates.find((t) => t.doc_type === docType);
    if (found) {
      setHtmlCode(found.html_content || '');
      setCssCode(found.css_content || '');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const updated = await window.api.updateAppSettings(formSettings);
    onSettingsSaved(updated);
    alert('Pengaturan perusahaan & mode aplikasi berhasil disimpan!');
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const rawDataUrl = String(reader.result || '');
      if (file.type === 'image/svg+xml') {
        setFormSettings((prev) => ({ ...prev, company_logo: rawDataUrl }));
        return;
      }
      const img = new window.Image();
      img.onload = () => {
        const maxW = 480;
        const maxH = 240;
        let width = img.width;
        let height = img.height;
        if (width > maxW || height > maxH) {
          const ratio = Math.min(maxW / width, maxH / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/png');
          setFormSettings((prev) => ({ ...prev, company_logo: compressed }));
        } else {
          setFormSettings((prev) => ({ ...prev, company_logo: rawDataUrl }));
        }
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSaveTemplate = async () => {
    await window.api.updatePdfTemplate(selectedDocType, htmlCode, cssCode);
    await loadTemplatesAndDb();
    alert('Template PDF untuk ' + selectedDocType + ' berhasil disimpan!');
  };

  const handleResetTemplate = async () => {
    if (!confirm('Kembalikan template ' + selectedDocType + ' ke desain bawaan pabrik?')) return;
    await window.api.resetPdfTemplate(selectedDocType);
    await loadTemplatesAndDb();
  };

  const handleBackupDb = async () => {
    const res = await window.api.backupDatabase();
    if (res.saved) {
      alert('Backup database SQLite berhasil disimpan ke:\n' + res.filePath);
    }
  };

  const handleRestoreDb = async () => {
    if (!confirm('Restore database akan menimpa seluruh data saat ini dengan file backup yang dipilih. Lanjutkan?')) {
      return;
    }
    const res = await window.api.restoreDatabase();
    if (res.restored) {
      alert('Database berhasil di-restore! Aplikasi akan memuat ulang data.');
      window.location.reload();
    }
  };

  const logoImgTag = formSettings.company_logo
    ? `<img src="${formSettings.company_logo}" alt="Logo Perusahaan" />`
    : '';

  const sampleRenderedHtml = '<!DOCTYPE html>\n<html>\n<head><meta charset="utf-8" /><style>' +
    cssCode +
    '</style></head>\n<body>\n' +
    htmlCode
      .replace(/\{\{company_logo_img\}\}/g, logoImgTag)
      .replace(/\{\{company_logo\}\}/g, formSettings.company_logo || '')
      .replace(/\{\{company_name\}\}/g, formSettings.company_name || 'PT. PILAR CERAH SEJAHTERA')
      .replace(/\{\{company_address\}\}/g, formSettings.company_address || 'Jl. Jemursari I no. 35 Surabaya, Jawa Timur')
      .replace(/\{\{company_city\}\}/g, formSettings.company_city || 'Surabaya')
      .replace(/\{\{company_phone\}\}/g, formSettings.company_phone || '081175500095')
      .replace(/\{\{company_email\}\}/g, formSettings.company_email || 'marketing.pcs01@gmail.com')
      .replace(/\{\{po_signer_name\}\}/g, formSettings.po_signer_name || 'Tri Tjahyono Eprijarto')
      .replace(/\{\{po_signer_title\}\}/g, formSettings.po_signer_title || 'Direktur')
      .replace(/\{\{no\}\}/g, selectedDocType + '/202611/001')
      .replace(/\{\{doc_no\}\}/g, selectedDocType + '/202611/001')
      .replace(/\{\{tgl\}\}/g, '2026-11-03')
      .replace(/\{\{tgl_indo\}\}/g, '03 November 2026')
      .replace(/\{\{tgl_long\}\}/g, '3 November 2026')
      .replace(/\{\{deldate_indo\}\}/g, '06 November 2026')
      .replace(/\{\{po_subject\}\}/g, 'Label Barcode & Carbon Ribbon')
      .replace(/\{\{partner_label\}\}/g, 'Customer / Supplier')
      .replace(/\{\{partner_nama\}\}/g, 'CV. Mandiri Label')
      .replace(/\{\{partner_name\}\}/g, 'CV. Mandiri Label')
      .replace(/\{\{partner_alamat\}\}/g, 'Jl. Nangka III No. 95, RT 033, RW 003\nGeluran, Taman, Sidoarjo')
      .replace(/\{\{partner_address\}\}/g, 'Jl. Nangka III No. 95, Sidoarjo')
      .replace(/\{\{partner_telepon\}\}/g, '0812-3456-7890')
      .replace(/\{\{partner_phone\}\}/g, '0812-3456-7890')
      .replace(/\{\{partner_up\}\}/g, 'Bapak Toni / Ibu Dita')
      .replace(/\{\{order_no\}\}/g, 'SO/202611/001')
      .replace(/\{\{delivery_note_no\}\}/g, 'SJK/202611/001')
      .replace(/\{\{alamat_tujuan\}\}/g, 'Gudang Pusat Surabaya')
      .replace(/\{\{keterangan\}\}/g, 'Pengiriman via Armada Internal')
      .replace(
        /\{\{items_rows_po_pdf\}\}/g,
        '<tr><td class="item-cell text-center">1</td><td class="item-cell"><div>LB - 33 X 15 G2L Blank FI</div><div class="item-spec">Bahan : Semicoated\nIsi : 5.554 Pcs\nCore : 1"\nInclude :</div></td><td class="item-cell text-center">111.080</td><td class="item-cell text-center">Pcs</td><td class="item-cell text-center">7,50</td><td class="item-cell text-right">833.100</td></tr>'
      )
      .replace(
        /\{\{items_rows\}\}/g,
        '<tr><td style="text-align:center">1</td><td>BRG-001</td><td>Contoh Barang Komponen A</td><td style="text-align:right">10</td><td>PCS</td><td style="text-align:right">Rp 150.000</td><td style="text-align:right">Rp 1.500.000</td></tr>'
      )
      .replace(/\{\{dpp\}\}/g, 'Rp 833.100')
      .replace(/\{\{dpp_net_plain\}\}/g, '833.100')
      .replace(/\{\{diskon\}\}/g, 'Rp 0')
      .replace(/\{\{ppn\}\}/g, String(formSettings.default_ppn || '11'))
      .replace(/\{\{ppn_nominal\}\}/g, 'Rp 91.641')
      .replace(/\{\{ppn_nominal_plain\}\}/g, '91.641')
      .replace(/\{\{ongkir\}\}/g, 'Rp 0')
      .replace(/\{\{total\}\}/g, 'Rp 924.741')
      .replace(/\{\{total_plain\}\}/g, '924.741')
      .replace(/\{\{grand_total\}\}/g, 'Rp 924.741')
      .replace(/\{\{terbilang\}\}/g, 'Sembilan Ratus Dua Puluh Empat Ribu Tujuh Ratus Empat Puluh Satu Rupiah') +
    '\n</body>\n</html>';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Template PDF &amp; Pengaturan Sistem</h1>
        <p className="text-sm text-slate-500">
          Atur identitas perusahaan, mode operasi per PC/divisi, desain template PDF (HTML/CSS), dan backup database lokal.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <form
          onSubmit={handleSaveSettings}
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4 lg:col-span-2"
        >
          <h2 className="border-b pb-2.5 text-base font-bold text-slate-800">Profil Perusahaan &amp; Mode Operasi</h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-sm">
            <div>
              <label className="mb-1 block font-medium">Mode Operasi Aplikasi</label>
              <select
                value={formSettings.app_mode}
                onChange={(e) => setFormSettings({ ...formSettings, app_mode: e.target.value as AppMode })}
                className="w-full rounded-lg border px-3 py-2 font-medium"
              >
                <option value="all">Semua Modul (Gabungan)</option>
                <option value="mode_1_gudang">Mode 1: Order &amp; Gudang</option>
                <option value="mode_2_finance">Mode 2: Finance / Accounting</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block font-medium">Default PPN (%)</label>
              <input
                type="number"
                step="any"
                value={formSettings.default_ppn}
                onChange={(e) => setFormSettings({ ...formSettings, default_ppn: e.target.value })}
                className="w-full rounded-lg border px-3 py-2"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block font-medium">Nama Perusahaan (Header PDF)</label>
              <input
                type="text"
                value={formSettings.company_name}
                onChange={(e) => setFormSettings({ ...formSettings, company_name: e.target.value })}
                className="w-full rounded-lg border px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium">Kota Kop Surat (Tanggal PO)</label>
              <input
                type="text"
                value={formSettings.company_city || ''}
                onChange={(e) => setFormSettings({ ...formSettings, company_city: e.target.value })}
                placeholder="Surabaya"
                className="w-full rounded-lg border px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium">Telepon Perusahaan</label>
              <input
                type="text"
                value={formSettings.company_phone}
                onChange={(e) => setFormSettings({ ...formSettings, company_phone: e.target.value })}
                className="w-full rounded-lg border px-3 py-2"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block font-medium">Email Perusahaan</label>
              <input
                type="text"
                value={formSettings.company_email}
                onChange={(e) => setFormSettings({ ...formSettings, company_email: e.target.value })}
                className="w-full rounded-lg border px-3 py-2"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block font-medium">Alamat Perusahaan</label>
              <textarea
                rows={2}
                value={formSettings.company_address}
                onChange={(e) => setFormSettings({ ...formSettings, company_address: e.target.value })}
                className="w-full rounded-lg border px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium">Nama Penandatangan PO</label>
              <input
                type="text"
                value={formSettings.po_signer_name || ''}
                onChange={(e) => setFormSettings({ ...formSettings, po_signer_name: e.target.value })}
                placeholder="Tri Tjahyono Eprijarto"
                className="w-full rounded-lg border px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium">Jabatan Penandatangan PO</label>
              <input
                type="text"
                value={formSettings.po_signer_title || ''}
                onChange={(e) => setFormSettings({ ...formSettings, po_signer_title: e.target.value })}
                placeholder="Direktur"
                className="w-full rounded-lg border px-3 py-2"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block font-medium">Logo Perusahaan (Kop Surat PDF)</label>
              <div className="flex flex-wrap items-center gap-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-3.5">
                <div className="flex h-16 w-32 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white p-1.5">
                  {formSettings.company_logo ? (
                    <img
                      src={formSettings.company_logo}
                      alt="Logo Perusahaan"
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <div className="flex flex-col items-center text-[11px] text-slate-400">
                      <ImageIcon className="h-5 w-5 mb-0.5" />
                      <span>Belum ada logo</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-1.5">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      {formSettings.company_logo ? 'Ganti Logo' : 'Upload Logo'}
                    </button>
                    {formSettings.company_logo && (
                      <button
                        type="button"
                        onClick={() => setFormSettings({ ...formSettings, company_logo: '' })}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Hapus Logo
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Format PNG / JPG / WEBP / SVG. Otomatis dioptimalkan agar tajam di kop surat PDF &amp; ringan di database.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Save className="h-4 w-4" />
              Simpan Pengaturan
            </button>
          </div>
        </form>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b pb-2.5">
            <Database className="h-5 w-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-800">Backup &amp; Restore SQLite</h2>
          </div>
          <p className="text-xs text-slate-600">
            Seluruh data tersimpan offline dalam satu file database lokal. Lakukan backup berkala ke flashdisk atau folder cloud.
          </p>
          <div className="rounded-lg bg-slate-50 p-2.5 font-mono text-[11px] text-slate-600 break-all">
            Lokasi DB: {dbPath || '-'}
          </div>
          <div className="space-y-2.5 pt-2">
            <button
              type="button"
              onClick={handleBackupDb}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700"
            >
              <Download className="h-4 w-4" />
              Backup Database (.db)
            </button>
            <button
              type="button"
              onClick={handleRestoreDb}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-rose-300 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700 hover:bg-rose-100"
            >
              <Upload className="h-4 w-4" />
              Restore dari File Backup
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-800">Editor Desain Template Cetak PDF (HTML + CSS)</h2>
            <p className="text-xs text-slate-500">
              Ubah layout, kop surat, ukuran font, atau tabel untuk setiap jenis dokumen menggunakan placeholder{' '}
              <code>{'{{doc_no}}'}</code>, <code>{'{{partner_name}}'}</code>, <code>{'{{items_rows}}'}</code>, dll.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(['PO', 'SO', 'SJ', 'INVOICE', 'INVOICE_DOT'] as DocType[]).map((dt) => (
              <button
                key={dt}
                type="button"
                onClick={() => handleSelectDocType(dt)}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-bold ${
                  selectedDocType === dt ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {dt === 'INVOICE' ? 'Template Invoice (PDF)' : dt === 'INVOICE_DOT' ? 'Template Invoice (Dot Matrix)' : `Template ${dt}`}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-600">HTML Template</label>
            <textarea
              rows={14}
              value={htmlCode}
              onChange={(e) => setHtmlCode(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-slate-950 p-3 font-mono text-xs text-emerald-300 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-600">CSS Styling</label>
            <textarea
              rows={14}
              value={cssCode}
              onChange={(e) => setCssCode(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-slate-950 p-3 font-mono text-xs text-sky-300 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <button
            type="button"
            onClick={handleResetTemplate}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset ke Template Bawaan
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPreviewSampleOpen(!previewSampleOpen)}
              className="flex items-center gap-1.5 rounded-lg border border-blue-600 px-3.5 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50"
            >
              <Eye className="h-3.5 w-3.5" />
              {previewSampleOpen ? 'Tutup Live Preview' : 'Live Preview Contoh'}
            </button>
            <button
              type="button"
              onClick={handleSaveTemplate}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
            >
              <Save className="h-3.5 w-3.5" />
              Simpan Template {selectedDocType}
            </button>
          </div>
        </div>

        {previewSampleOpen && (
          <div className="mt-4 rounded-xl border border-slate-300 bg-slate-100 p-4">
            <p className="mb-2 text-xs font-semibold text-slate-600">Live Preview Hasil Render PDF:</p>
            <iframe
              title="Template Sample Preview"
              srcDoc={sampleRenderedHtml}
              className="h-[520px] w-full rounded-lg border bg-white"
            />
          </div>
        )}
      </div>
    </div>
  );
};
