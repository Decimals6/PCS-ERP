import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  DatabaseBackup,
  Edit2,
  Lock,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { Barang, MutasiBarang, MutasiBarangInput, RebuildMutasiOptions } from '../../shared/types';
import { todayIso } from '../utils/format';
import { SearchableSelect } from '../components/SearchableSelect';
import { compareStringsNatural, SortableTh, SortConfig, toggleSort } from '../components/SortableTh';
import { PaginationBar } from '../components/PaginationBar';
import { useAppDialog } from '../components/AppDialogProvider';

const SOURCE_PRESETS = [
  'MANUAL',
  'STOCK OPNAME',
  'RETUR / KERUSAKAN',
  'PENYESUAIAN GUDANG',
  'PRODUKSI / REPACK',
];

export const MutasiBarangPage: React.FC = () => {
  const { showConfirm, showAlert } = useAppDialog();
  const [selectedBarangId, setSelectedBarangId] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'in' | 'out'>('all');
  const [originFilter, setOriginFilter] = useState<'all' | 'manual' | 'auto'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [barangList, setBarangList] = useState<Barang[]>([]);
  const [mutasiList, setMutasiList] = useState<MutasiBarang[]>([]);

  const [sortConfig, setSortConfig] = useState<SortConfig<
    'tgl' | 'source' | 'barang' | 'type' | 'qty' | 'stok_sesudah'
  > | null>({
    key: 'tgl',
    direction: 'desc',
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MutasiBarang | null>(null);
  const [form, setForm] = useState<MutasiBarangInput>({
    barang_id: 0,
    type: 'in',
    qty: 1,
    tgl: todayIso(),
    source: 'MANUAL',
    keterangan: '',
  });

  const [rebuildModalOpen, setRebuildModalOpen] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [rebuildForm, setRebuildForm] = useState<RebuildMutasiOptions>({
    mode: 'all',
    fromDate: todayIso(),
    keepManualMutasi: true,
  });

  const loadData = async () => {
    const [b, m] = await Promise.all([
      window.api.listBarang(),
      window.api.listMutasiBarang(selectedBarangId ? Number(selectedBarangId) : undefined),
    ]);
    setBarangList(b);
    setMutasiList(m);
  };

  useEffect(() => {
    loadData();
  }, [selectedBarangId]);

  const filteredAndSorted = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = mutasiList.filter((m) => {
      const isAuto = Boolean(m.delivery_note_id || m.sample_id);
      if (typeFilter !== 'all' && m.type !== typeFilter) return false;
      if (originFilter === 'manual' && isAuto) return false;
      if (originFilter === 'auto' && !isAuto) return false;
      if (!q) return true;
      return (
        (m.tgl || '').toLowerCase().includes(q) ||
        (m.source || '').toLowerCase().includes(q) ||
        (m.barang_kode || '').toLowerCase().includes(q) ||
        (m.barang_nama || '').toLowerCase().includes(q) ||
        (m.keterangan || '').toLowerCase().includes(q)
      );
    });

    if (!sortConfig) return filtered;
    const factor = sortConfig.direction === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortConfig.key) {
        case 'tgl':
          cmp = String(a.tgl || '').localeCompare(String(b.tgl || ''));
          break;
        case 'source':
          cmp = compareStringsNatural(a.source || '', b.source || '');
          break;
        case 'barang':
          cmp = compareStringsNatural(
            `${a.barang_kode || ''} ${a.barang_nama || ''}`,
            `${b.barang_kode || ''} ${b.barang_nama || ''}`
          );
          break;
        case 'type':
          cmp = String(a.type || '').localeCompare(String(b.type || ''));
          break;
        case 'qty':
          cmp = Number(a.qty || 0) - Number(b.qty || 0);
          break;
        case 'stok_sesudah':
          cmp = Number(a.stok_sesudah || 0) - Number(b.stok_sesudah || 0);
          break;
      }
      if (cmp === 0) {
        cmp = Number(a.id || 0) - Number(b.id || 0);
      }
      return cmp * factor;
    });
  }, [mutasiList, searchQuery, typeFilter, originFilter, sortConfig]);

  useEffect(() => {
    setPage(1);
  }, [selectedBarangId, searchQuery, typeFilter, originFilter, sortConfig]);

  const paginatedMutasi = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredAndSorted.slice(start, start + pageSize);
  }, [filteredAndSorted, page, pageSize]);

  const openCreate = () => {
    setEditingItem(null);
    const preselectedId = selectedBarangId
      ? Number(selectedBarangId)
      : barangList[0]?.id || 0;
    setForm({
      barang_id: preselectedId,
      type: 'in',
      qty: 1,
      tgl: todayIso(),
      source: 'MANUAL',
      keterangan: '',
    });
    setModalOpen(true);
  };

  const openEdit = (item: MutasiBarang) => {
    if (item.delivery_note_id || item.sample_id) return;
    setEditingItem(item);
    setForm({
      barang_id: item.barang_id,
      type: item.type,
      qty: Number(item.qty || 0),
      tgl: item.tgl,
      source: item.source || 'MANUAL',
      keterangan: item.keterangan || '',
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.barang_id || Number(form.barang_id) <= 0) {
      await showAlert('Pilih barang terlebih dahulu.');
      return;
    }
    if (!form.qty || Number(form.qty) <= 0) {
      await showAlert('Jumlah mutasi harus lebih dari 0.');
      return;
    }
    if (!form.tgl) {
      await showAlert('Tanggal mutasi wajib diisi.');
      return;
    }

    try {
      const payload: MutasiBarangInput = {
        barang_id: Number(form.barang_id),
        type: form.type,
        qty: Number(form.qty),
        tgl: form.tgl,
        source: (form.source || '').trim() || 'MANUAL',
        keterangan: (form.keterangan || '').trim(),
      };

      if (editingItem) {
        await window.api.updateManualMutasi(editingItem.id, payload);
      } else {
        await window.api.createManualMutasi(payload);
      }
      setModalOpen(false);
      await loadData();
    } catch (err: any) {
      await showAlert(err?.message || 'Gagal menyimpan mutasi barang.');
    }
  };

  const handleDelete = async (item: MutasiBarang) => {
    if (item.delivery_note_id || item.sample_id) return;
    const ok = await showConfirm({
      title: 'Hapus Mutasi Manual',
      message: `Hapus catatan mutasi manual "${item.barang_nama || '-'}" (${item.type === 'in' ? '+' : '-'}${item.qty}) tanggal ${item.tgl}?\n\nStok berjalan pada mutasi berikutnya dan stok akhir barang akan otomatis dihitung ulang.`,
      confirmText: 'Ya, Hapus',
    });
    if (!ok) return;

    try {
      await window.api.deleteManualMutasi(item.id);
      await loadData();
    } catch (err: any) {
      await showAlert(err?.message || 'Gagal menghapus mutasi barang.');
    }
  };

  const openRebuildModal = () => {
    setRebuildForm({
      mode: 'all',
      fromDate: todayIso(),
      keepManualMutasi: true,
    });
    setRebuildModalOpen(true);
  };

  const handleRunRebuild = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rebuildForm.mode === 'from_date' && !rebuildForm.fromDate) {
      await showAlert('Pilih tanggal awal rebuild terlebih dahulu.');
      return;
    }

    const scopeDesc =
      rebuildForm.mode === 'all'
        ? 'ROMBAK TOTAL (seluruh stok barang di-reset ke 0 lalu dihitung ulang dari seluruh Surat Jalan & Sample)'
        : `ROMBAK MULAI TANGGAL ${rebuildForm.fromDate} s/d sekarang`;
    const manualDesc = rebuildForm.keepManualMutasi
      ? 'Mutasi manual tetap dipertahankan dan dihitung ulang saldonya sesuai tanggal.'
      : 'Seluruh mutasi manual dalam rentang tersebut AKAN DIHAPUS.';

    const ok = await showConfirm({
      title: 'Konfirmasi Rebuild Stok & Mutasi',
      message: `Anda akan menjalankan:\n- Scope: ${scopeDesc}\n- Mutasi Manual: ${manualDesc}\n\nDatabase akan otomatis di-backup ke folder backups sebelum proses dimulai. Lanjutkan?`,
      confirmText: 'Ya, Jalankan Rebuild',
    });
    if (!ok) return;

    setRebuilding(true);
    try {
      const res = await window.api.rebuildMutasiFromDocs({
        mode: rebuildForm.mode,
        fromDate: rebuildForm.mode === 'from_date' ? rebuildForm.fromDate : undefined,
        keepManualMutasi: rebuildForm.keepManualMutasi,
      });
      setRebuildModalOpen(false);
      await loadData();
      const customCopyLine = res.customBackupPath
        ? '\n- Salinan di folder pilihan: ' + res.customBackupPath
        : '';
      await showAlert(
        'Rebuild stok & mutasi selesai!\n\n' +
          '- Barang diperbarui: ' + res.affectedBarangCount + ' item\n' +
          '- Mutasi otomatis (SJ & Sample) dibangun ulang: ' + res.rebuiltAutoCount + ' baris\n' +
          '- Mutasi manual dihitung ulang: ' + res.recalculatedManualCount + ' baris\n' +
          '- File auto-backup utama: ' + res.backupPath +
          customCopyLine
      );
    } catch (err: any) {
      await showAlert(err?.message || 'Gagal menjalankan rebuild stok & mutasi.');
    } finally {
      setRebuilding(false);
    }
  };

  const filterBarangOptions = useMemo(
    () => [
      { value: '', label: 'Semua Barang', searchText: 'semua barang all' },
      ...barangList.map((b) => ({
        value: b.id,
        label: `${b.kode ? `[${b.kode}] ` : ''}${b.nama}`,
        sublabel: `${b.part_number ? `Part No: ${b.part_number} | ` : ''}Stok saat ini: ${b.stock} ${b.satuan}`,
        searchText: `${b.kode || ''} ${b.part_number || ''} ${b.nama}`,
      })),
    ],
    [barangList]
  );

  const formBarangOptions = useMemo(
    () =>
      barangList.map((b) => ({
        value: b.id,
        label: `${b.kode ? `[${b.kode}] ` : ''}${b.nama}`,
        sublabel: `${b.part_number ? `Part No: ${b.part_number} | ` : ''}Stok saat ini: ${b.stock} ${b.satuan}`,
        searchText: `${b.kode || ''} ${b.part_number || ''} ${b.nama}`,
      })),
    [barangList]
  );

  const selectedFormBarang = barangList.find((b) => b.id === Number(form.barang_id));

  const projectedStock = useMemo(() => {
    if (!selectedFormBarang) return null;
    const currentStock = Number(selectedFormBarang.stock || 0);
    const qtyVal = Number(form.qty || 0);
    const oldAdjustment =
      editingItem && Number(editingItem.barang_id) === Number(form.barang_id)
        ? editingItem.type === 'in'
          ? -Number(editingItem.qty || 0)
          : Number(editingItem.qty || 0)
        : 0;
    const baseAfterRollback = currentStock + oldAdjustment;
    const finalAfterNew =
      form.type === 'in' ? baseAfterRollback + qtyVal : baseAfterRollback - qtyVal;
    return {
      currentStock,
      finalAfterNew,
    };
  }, [selectedFormBarang, form.qty, form.type, form.barang_id, editingItem]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Buku Besar Mutasi Stok Barang</h1>
          <p className="text-sm text-slate-500">
            Riwayat pergerakan stok dari Surat Jalan, Tanda Terima Sampel, maupun penyesuaian mutasi manual.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openRebuildModal}
            className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2 text-sm font-medium text-amber-800 shadow-sm hover:bg-amber-100"
          >
            <RefreshCw className="h-4 w-4" />
            Rebuild Stok &amp; Mutasi
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Tambah Mutasi Manual
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm md:grid-cols-12">
        <div className="md:col-span-4">
          <SearchableSelect
            options={filterBarangOptions}
            value={selectedBarangId}
            onChange={(val) => setSelectedBarangId(String(val))}
            placeholder="Filter Berdasarkan Barang..."
            searchPlaceholder="Cari kode / part no / nama barang..."
          />
        </div>

        <div className="relative md:col-span-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari sumber dokumen, barang, keterangan..."
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="md:col-span-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as 'all' | 'in' | 'out')}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="all">Semua Jenis</option>
            <option value="in">Masuk (+)</option>
            <option value="out">Keluar (-)</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <select
            value={originFilter}
            onChange={(e) => setOriginFilter(e.target.value as 'all' | 'manual' | 'auto')}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="all">Semua Sumber</option>
            <option value="manual">Mutasi Manual</option>
            <option value="auto">Otomatis (SJ / Sample)</option>
          </select>
        </div>
      </div>

      {/* Tabel Mutasi */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-600">
              <tr>
                <SortableTh
                  label="Tanggal"
                  sortKey="tgl"
                  sortConfig={sortConfig}
                  onSort={(k) => setSortConfig((prev) => toggleSort(prev, k))}
                />
                <SortableTh
                  label="Sumber Dokumen"
                  sortKey="source"
                  sortConfig={sortConfig}
                  onSort={(k) => setSortConfig((prev) => toggleSort(prev, k))}
                />
                <SortableTh
                  label="Barang"
                  sortKey="barang"
                  sortConfig={sortConfig}
                  onSort={(k) => setSortConfig((prev) => toggleSort(prev, k))}
                />
                <SortableTh
                  label="Jenis"
                  sortKey="type"
                  sortConfig={sortConfig}
                  onSort={(k) => setSortConfig((prev) => toggleSort(prev, k))}
                />
                <th className="px-4 py-3 text-right">Stok Sebelum</th>
                <SortableTh
                  label="Qty Mutasi"
                  sortKey="qty"
                  align="right"
                  sortConfig={sortConfig}
                  onSort={(k) => setSortConfig((prev) => toggleSort(prev, k))}
                />
                <SortableTh
                  label="Stok Sesudah"
                  sortKey="stok_sesudah"
                  align="right"
                  sortConfig={sortConfig}
                  onSort={(k) => setSortConfig((prev) => toggleSort(prev, k))}
                />
                <th className="px-4 py-3">Keterangan</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedMutasi.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                    Belum ada catatan mutasi stok yang sesuai filter.
                  </td>
                </tr>
              ) : (
                paginatedMutasi.map((m) => {
                  const isAuto = Boolean(m.delivery_note_id || m.sample_id);
                  return (
                    <tr key={m.id} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">{m.tgl}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 font-mono text-xs font-semibold ${
                            isAuto
                              ? 'bg-slate-100 text-slate-700'
                              : 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200'
                          }`}
                        >
                          {m.source || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {m.barang_kode ? `[${m.barang_kode}] ` : ''}
                        {m.barang_nama || '-'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {m.type === 'in' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                            <ArrowDownLeft className="h-3.5 w-3.5" /> Masuk
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-700">
                            <ArrowUpRight className="h-3.5 w-3.5" /> Keluar
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-slate-500">
                        {m.stok_sebelum}
                      </td>
                      <td
                        className={`whitespace-nowrap px-4 py-3 text-right font-bold ${
                          m.type === 'in' ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {m.type === 'in' ? `+${m.qty}` : `-${m.qty}`} {m.barang_satuan || ''}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-bold text-slate-900">
                        {m.stok_sesudah}
                      </td>
                      <td className="max-w-xs truncate px-4 py-3 text-xs text-slate-500" title={m.keterangan || ''}>
                        {m.keterangan || '-'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {isAuto ? (
                          <span
                            title="Mutasi otomatis dari Surat Jalan / Sample. Edit atau hapus melalui dokumen asalnya."
                            className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-500"
                          >
                            <Lock className="h-3 w-3" />
                            Dokumen Asal
                          </span>
                        ) : (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEdit(m)}
                              title="Edit Mutasi Manual"
                              className="rounded p-1.5 text-slate-600 hover:bg-amber-50 hover:text-amber-600"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(m)}
                              title="Hapus Mutasi Manual"
                              className="rounded p-1.5 text-slate-600 hover:bg-rose-50 hover:text-rose-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <PaginationBar
          totalItems={filteredAndSorted.length}
          currentPage={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(sz) => {
            setPageSize(sz);
            setPage(1);
          }}
          itemLabel="mutasi"
        />
      </div>

      {/* Modal Create / Edit Mutasi Manual */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <form
            onSubmit={handleSave}
            className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="text-lg font-bold text-slate-900">
                {editingItem ? 'Edit Mutasi Stok Manual' : 'Tambah Mutasi Stok Manual'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-6 text-sm">
              <div>
                <label className="mb-1 block font-medium text-slate-700">Barang *</label>
                <SearchableSelect
                  required
                  options={formBarangOptions}
                  value={form.barang_id || ''}
                  onChange={(val) => setForm({ ...form, barang_id: Number(val) })}
                  placeholder="-- Pilih Barang --"
                  searchPlaceholder="Cari kode / part no / nama barang..."
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-medium text-slate-700">Jenis Mutasi *</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, type: 'in' })}
                      className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                        form.type === 'in'
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                          : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <ArrowDownLeft className="h-4 w-4" />
                      Masuk (+)
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, type: 'out' })}
                      className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                        form.type === 'out'
                          ? 'border-rose-600 bg-rose-50 text-rose-700'
                          : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <ArrowUpRight className="h-4 w-4" />
                      Keluar (-)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block font-medium text-slate-700">Tanggal *</label>
                  <input
                    type="date"
                    required
                    value={form.tgl}
                    onChange={(e) => setForm({ ...form, tgl: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-medium text-slate-700">
                    Qty Mutasi {selectedFormBarang ? `(${selectedFormBarang.satuan})` : ''} *
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    required
                    value={form.qty}
                    onChange={(e) => setForm({ ...form, qty: Number(e.target.value) })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-semibold focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block font-medium text-slate-700">Sumber / Referensi</label>
                  <input
                    type="text"
                    value={form.source || ''}
                    onChange={(e) => setForm({ ...form, source: e.target.value })}
                    placeholder="MANUAL / STOCK OPNAME"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs uppercase focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Preset Sumber Cepat */}
              <div className="flex flex-wrap gap-1.5">
                {SOURCE_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setForm({ ...form, source: preset })}
                    className={`rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                      (form.source || '').toUpperCase() === preset
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>

              <div>
                <label className="mb-1 block font-medium text-slate-700">Keterangan</label>
                <textarea
                  rows={2}
                  value={form.keterangan || ''}
                  onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
                  placeholder="Catatan alasan penyesuaian stok (misal: hasil stock opname bulanan, barang rusak, dll.)"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                />
              </div>

              {projectedStock && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Stok Master Saat Ini:</span>
                    <span className="font-semibold text-slate-900">
                      {projectedStock.currentStock} {selectedFormBarang?.satuan || ''}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-slate-600">
                    <span>Estimasi Stok Master Setelah Simpan:</span>
                    <span
                      className={`font-bold ${
                        projectedStock.finalAfterNew < 0 ? 'text-rose-600' : 'text-blue-700'
                      }`}
                    >
                      {projectedStock.finalAfterNew} {selectedFormBarang?.satuan || ''}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-400">
                    Jika tanggal mutasi disisipkan di tengah riwayat lama, seluruh saldo{' '}
                    <code className="text-slate-600">stok_sebelum</code> &amp;{' '}
                    <code className="text-slate-600">stok_sesudah</code> berikutnya akan dihitung ulang otomatis sesuai urutan tanggal.
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t bg-slate-50 px-6 py-3.5">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
              >
                {editingItem ? 'Simpan Perubahan' : 'Simpan Mutasi'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Rebuild Stok & Mutasi dari Dokumen */}
      {rebuildModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <form
            onSubmit={handleRunRebuild}
            className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-amber-600" />
                <h2 className="text-lg font-bold text-slate-900">Rebuild Stok &amp; Mutasi dari Dokumen</h2>
              </div>
              <button
                type="button"
                disabled={rebuilding}
                onClick={() => setRebuildModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-6 text-sm">
              <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-900">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <div className="space-y-1">
                    <p className="font-semibold">Utilitas Sinkronisasi Ulang Buku Besar Stok</p>
                    <p className="text-amber-800">
                      Sistem akan membangun ulang catatan mutasi stok berdasarkan dokumen{' '}
                      <strong>Surat Jalan (SJ)</strong> dan <strong>Tanda Terima Sampel (SP)</strong>{' '}
                      secara kronologis, lalu menghitung ulang stok berjalan dan stok akhir di Master Barang.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-2 block font-medium text-slate-700">Pilih Scope Rebuild</label>
                <div className="space-y-2">
                  <label
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                      rebuildForm.mode === 'all'
                        ? 'border-blue-500 bg-blue-50/50'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="rebuildMode"
                      checked={rebuildForm.mode === 'all'}
                      onChange={() => setRebuildForm({ ...rebuildForm, mode: 'all' })}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="font-semibold text-slate-900">
                        Rombak Total (Reset Stok Awal ke 0)
                      </div>
                      <div className="text-xs text-slate-500">
                        Mengosongkan stok awal semua barang menjadi 0, lalu membangun ulang seluruh riwayat mutasi dari awal dokumen.
                      </div>
                    </div>
                  </label>

                  <label
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                      rebuildForm.mode === 'from_date'
                        ? 'border-blue-500 bg-blue-50/50'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="rebuildMode"
                      checked={rebuildForm.mode === 'from_date'}
                      onChange={() => setRebuildForm({ ...rebuildForm, mode: 'from_date' })}
                      className="mt-0.5"
                    />
                    <div className="flex-1">
                      <div className="font-semibold text-slate-900">
                        Mulai Tanggal Tertentu s/d Sekarang
                      </div>
                      <div className="text-xs text-slate-500">
                        Mempertahankan saldo &amp; mutasi sebelum tanggal dipilih, dan hanya merombak mutasi mulai tanggal tersebut hingga hari ini.
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {rebuildForm.mode === 'from_date' && (
                <div>
                  <label className="mb-1 block font-medium text-slate-700">
                    Mulai Dari Tanggal (Wajib s/d Sekarang) *
                  </label>
                  <input
                    type="date"
                    required
                    value={rebuildForm.fromDate || ''}
                    onChange={(e) => setRebuildForm({ ...rebuildForm, fromDate: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              )}

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <label className="flex cursor-pointer items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={rebuildForm.keepManualMutasi}
                    onChange={(e) =>
                      setRebuildForm({ ...rebuildForm, keepManualMutasi: e.target.checked })
                    }
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600"
                  />
                  <div className="text-xs">
                    <span className="font-semibold text-slate-800">
                      Pertahankan Mutasi Manual yang Sudah Ada
                    </span>
                    <p className="mt-0.5 text-slate-500">
                      {rebuildForm.keepManualMutasi
                        ? 'Mutasi manual (seperti Stock Opname / Stok Awal) tidak dihapus dan akan disisipkan kembali ke perhitungan saldo sesuai urutan tanggalnya.'
                        : 'PERHATIAN: Seluruh catatan mutasi manual dalam rentang rebuild akan ikut dihapus permanen.'}
                    </p>
                  </div>
                </label>
              </div>

              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2.5 text-xs text-emerald-800">
                <DatabaseBackup className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>
                  <strong>Auto-Backup Aktif:</strong> Salinan file <code>.db</code> akan otomatis disimpan ke folder{' '}
                  <code>backups/</code> sebelum proses dimulai.
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t bg-slate-50 px-6 py-3.5">
              <button
                type="button"
                disabled={rebuilding}
                onClick={() => setRebuildModalOpen(false)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={rebuilding}
                className="flex items-center gap-2 rounded-lg bg-amber-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-amber-700 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${rebuilding ? 'animate-spin' : ''}`} />
                {rebuilding ? 'Memproses Rebuild...' : 'Jalankan Rebuild'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
