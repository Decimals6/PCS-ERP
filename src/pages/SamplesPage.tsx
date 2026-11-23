import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Printer, Edit2, Trash2, X, Search } from 'lucide-react';
import { Barang, Customer, Sample, SampleBarang } from '../../shared/types';
import { generateSequentialDocNumber, todayIso } from '../utils/format';
import { PdfPreviewModal } from '../components/PdfPreviewModal';
import { SearchableSelect } from '../components/SearchableSelect';
import { compareStringsNatural, SortableTh, SortConfig, toggleSort } from '../components/SortableTh';
import { PaginationBar } from '../components/PaginationBar';
import { useAppDialog } from '../components/AppDialogProvider';

export const SamplesPage: React.FC = () => {
  const { showConfirm, showAlert } = useAppDialog();
  const [samples, setSamples] = useState<Sample[]>([]);
  const [customerList, setCustomerList] = useState<Customer[]>([]);
  const [barangList, setBarangList] = useState<Barang[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig<'no' | 'tgl' | 'customer'> | null>({
    key: 'tgl',
    direction: 'desc',
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<Sample>({
    no: '',
    tgl: todayIso(),
    id_customer: null,
    penerima_nama: '',
    keterangan: 'SAMPLE UNTUK CUSTOMER',
    details: [],
  });

  const [previewId, setPreviewId] = useState<number | null>(null);

  const loadData = async () => {
    const [spList, cust, brg] = await Promise.all([
      window.api.listSamples(),
      window.api.listCustomer(),
      window.api.listBarang(),
    ]);
    setSamples(spList);
    setCustomerList(cust);
    setBarangList(brg);
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredAndSorted = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = q
      ? samples.filter((s) => {
          const penerima = (s.customer_nama || s.penerima_nama || '').toLowerCase();
          return (
            (s.no || '').toLowerCase().includes(q) ||
            (s.tgl || '').toLowerCase().includes(q) ||
            penerima.includes(q) ||
            (s.keterangan || '').toLowerCase().includes(q)
          );
        })
      : samples;

    if (!sortConfig) return filtered;
    const factor = sortConfig.direction === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortConfig.key) {
        case 'no':
          cmp = compareStringsNatural(a.no, b.no);
          break;
        case 'tgl':
          cmp = String(a.tgl || '').localeCompare(String(b.tgl || ''));
          break;
        case 'customer':
          cmp = compareStringsNatural(
            a.customer_nama || a.penerima_nama || '',
            b.customer_nama || b.penerima_nama || ''
          );
          break;
      }
      if (cmp === 0) {
        cmp = Number(a.id || 0) - Number(b.id || 0);
      }
      return cmp * factor;
    });
  }, [samples, searchQuery, sortConfig]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, sortConfig]);

  const paginatedSamples = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredAndSorted.slice(start, start + pageSize);
  }, [filteredAndSorted, page, pageSize]);

  const openCreate = async () => {
    setEditingId(null);
    const today = todayIso();
    const allSp: Sample[] = await window.api.listSamples();
    const defaultNo = generateSequentialDocNumber(
      'PCS-SP',
      allSp.map((s) => s.no),
      today
    );
    const defaultBarang = barangList[0];
    setForm({
      no: defaultNo,
      tgl: today,
      id_customer: null,
      penerima_nama: '',
      keterangan: 'SAMPLE UNTUK CUSTOMER',
      details: [
        {
          id_barangs: defaultBarang?.id || 0,
          qty: 1,
          satuan: defaultBarang?.satuan || 'PCS',
        },
      ],
    });
    setModalOpen(true);
  };

  const openEdit = async (id: number) => {
    const full = await window.api.getSampleById(id);
    if (!full) return;
    setEditingId(id);
    setForm({
      ...full,
      details: (full.details || []).map((d: SampleBarang) => ({
        ...d,
        satuan: d.satuan || d.barang_satuan || 'PCS',
      })),
    });
    setModalOpen(true);
  };

  const handleSelectCustomer = (val: string | number) => {
    if (!val) {
      setForm((prev) => ({ ...prev, id_customer: null }));
      return;
    }
    const custId = Number(val);
    const matched = customerList.find((c) => c.id === custId);
    setForm((prev) => ({
      ...prev,
      id_customer: custId,
      penerima_nama: matched ? matched.nama : prev.penerima_nama,
    }));
  };

  const updateItem = (idx: number, patch: Partial<SampleBarang>) => {
    const next = [...(form.details || [])];
    const updated = { ...next[idx], ...patch };
    if (patch.id_barangs !== undefined) {
      const brg = barangList.find((b) => b.id === Number(patch.id_barangs));
      if (brg) {
        updated.satuan = brg.satuan || 'PCS';
      }
    }
    next[idx] = updated;
    setForm({ ...form, details: next });
  };

  const addItem = () => {
    const defaultBarang = barangList[0];
    setForm({
      ...form,
      details: [
        ...(form.details || []),
        {
          id_barangs: defaultBarang?.id || 0,
          qty: 1,
          satuan: defaultBarang?.satuan || 'PCS',
        },
      ],
    });
  };

  const removeItem = (idx: number) => {
    setForm({
      ...form,
      details: (form.details || []).filter((_, i) => i !== idx),
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const valid = (form.details || []).filter(
      (d) => Number(d.id_barangs) > 0 && Number(d.qty) > 0
    );
    if (valid.length === 0) {
      await showAlert('Minimal harus ada 1 barang sample dengan jumlah lebih dari 0.');
      return;
    }
    if (!form.id_customer && !(form.penerima_nama || '').trim()) {
      await showAlert('Pilih Customer atau isi nama penerima sampel terlebih dahulu.');
      return;
    }

    try {
      const payload: Sample = { ...form, details: valid };
      if (editingId) {
        await window.api.updateSample(editingId, payload);
      } else {
        await window.api.createSample(payload);
      }
      setModalOpen(false);
      loadData();
    } catch (err: any) {
      await showAlert(err?.message || 'Gagal menyimpan dokumen sample.');
    }
  };

  const handleDelete = async (id: number) => {
    const ok = await showConfirm({
      title: 'Hapus Dokumen Sample',
      message:
        'Hapus dokumen sample ini? Stok barang & catatan mutasi SP terkait akan otomatis di-rollback.',
      confirmText: 'Ya, Hapus',
    });
    if (!ok) return;
    try {
      await window.api.deleteSample(id);
      loadData();
    } catch (err: any) {
      await showAlert(err?.message || 'Gagal menghapus dokumen sample.');
    }
  };

  const customerOptions = [
    { value: '', label: '-- Input Manual / Non-Master Customer --', searchText: 'manual non master kosong' },
    ...customerList.map((c) => ({
      value: c.id,
      label: `${c.kode ? `[${c.kode}] ` : ''}${c.nama}`,
      sublabel: c.alamat || undefined,
      searchText: `${c.kode || ''} ${c.nama} ${c.alamat || ''}`,
    })),
  ];

  const barangOptions = barangList.map((b) => ({
    value: b.id,
    label: `${b.kode ? `[${b.kode}] ` : ''}${b.nama}`,
    sublabel: `${b.part_number ? `Part No: ${b.part_number} | ` : ''}Stok tersedia: ${b.stock} ${b.satuan}`,
    searchText: `${b.kode || ''} ${b.part_number || ''} ${b.nama}`,
  }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tanda Terima Sampel (Sample Barang)</h1>
          <p className="text-sm text-slate-500">
            Pengeluaran barang sampel untuk customer. Otomatis memotong stok &amp; mencatat mutasi dengan sumber{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-700">SP: No.Sample</code>.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Buat Dokumen Sample
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari No. Sample, Customer, Keterangan..."
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-600">
            <tr>
              <SortableTh
                label="No. Sample"
                sortKey="no"
                sortConfig={sortConfig}
                onSort={(k) => setSortConfig((prev) => toggleSort(prev, k))}
              />
              <SortableTh
                label="Tanggal"
                sortKey="tgl"
                sortConfig={sortConfig}
                onSort={(k) => setSortConfig((prev) => toggleSort(prev, k))}
              />
              <SortableTh
                label="Di Terima Oleh (Customer)"
                sortKey="customer"
                sortConfig={sortConfig}
                onSort={(k) => setSortConfig((prev) => toggleSort(prev, k))}
              />
              <th className="px-4 py-3">Keterangan</th>
              <th className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedSamples.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  Belum ada data dokumen sample.
                </td>
              </tr>
            ) : (
              paginatedSamples.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-900">{s.no}</td>
                  <td className="px-4 py-3 text-slate-600">{s.tgl}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {s.customer_nama || s.penerima_nama || '-'}
                  </td>
                  <td className="px-4 py-3 text-slate-600 max-w-md truncate">{s.keterangan || '-'}</td>
                  <td className="px-4 py-3 text-right space-x-1">
                    <button
                      onClick={() => setPreviewId(s.id!)}
                      title="Cetak / Preview Tanda Terima Sampel (A4)"
                      className="p-1.5 text-slate-600 hover:text-blue-600"
                    >
                      <Printer className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => openEdit(s.id!)}
                      title="Edit"
                      className="p-1.5 text-slate-600 hover:text-amber-600"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(s.id!)}
                      title="Hapus"
                      className="p-1.5 text-slate-600 hover:text-rose-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <PaginationBar
          totalItems={filteredAndSorted.length}
          currentPage={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(sz) => {
            setPageSize(sz);
            setPage(1);
          }}
        />
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <form
            onSubmit={handleSave}
            className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="text-lg font-bold">
                {editingId ? 'Edit' : 'Buat'} Dokumen Tanda Terima Sampel
              </h2>
              <button type="button" onClick={() => setModalOpen(false)}>
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 text-sm">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-medium">No. Dokumen Sample *</label>
                  <input
                    type="text"
                    required
                    value={form.no}
                    onChange={(e) => setForm({ ...form, no: e.target.value })}
                    placeholder="001/PCS-SP/XI/2026"
                    className="w-full rounded-lg border px-3 py-2 font-mono focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium">Tanggal *</label>
                  <input
                    type="date"
                    required
                    value={form.tgl}
                    onChange={(e) => setForm({ ...form, tgl: e.target.value })}
                    className="w-full rounded-lg border px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-medium">Customer (Di Terima Oleh)</label>
                  <SearchableSelect
                    options={customerOptions}
                    value={form.id_customer ?? ''}
                    onChange={handleSelectCustomer}
                    placeholder="-- Pilih Customer --"
                    searchPlaceholder="Cari nama / kode customer..."
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium">Nama Penerima di Dokumen *</label>
                  <input
                    type="text"
                    required
                    value={form.penerima_nama || ''}
                    onChange={(e) => setForm({ ...form, penerima_nama: e.target.value })}
                    placeholder="Contoh: CV. DJOJO MULIO"
                    className="w-full rounded-lg border px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block font-medium">Keterangan</label>
                <input
                  type="text"
                  value={form.keterangan}
                  onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
                  placeholder="SAMPLE UNTUK CUSTOMER"
                  className="w-full rounded-lg border px-3 py-2"
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800">Daftar Barang Sample</h3>
                  <button
                    type="button"
                    onClick={addItem}
                    className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                  >
                    + Tambah Baris
                  </button>
                </div>

                <div className="overflow-visible rounded-lg border">
                  <table className="w-full table-fixed text-left text-xs">
                    <thead className="border-b bg-slate-50 text-slate-600">
                      <tr>
                        <th className="p-2.5">Barang</th>
                        <th className="p-2.5 w-28 text-right">Qty</th>
                        <th className="p-2.5 w-24">Satuan</th>
                        <th className="p-2.5 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {(form.details || []).map((item, idx) => (
                        <tr key={idx}>
                          <td className="p-2">
                            <SearchableSelect
                              compact
                              options={barangOptions}
                              value={item.id_barangs || ''}
                              onChange={(val) => updateItem(idx, { id_barangs: Number(val) })}
                              placeholder="-- Pilih Barang --"
                              searchPlaceholder="Cari nama / kode / part no..."
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              step="any"
                              min="0.01"
                              value={item.qty}
                              onChange={(e) => updateItem(idx, { qty: Number(e.target.value) })}
                              className="w-full rounded border px-2 py-1.5 text-right font-semibold"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={item.satuan || 'PCS'}
                              onChange={(e) => updateItem(idx, { satuan: e.target.value })}
                              className="w-full rounded border px-2 py-1.5 uppercase"
                            />
                          </td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeItem(idx)}
                              className="text-rose-500 hover:text-rose-700"
                            >
                              &times;
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t px-6 py-3.5">
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border px-4 py-2 text-sm">
                Batal
              </button>
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Simpan &amp; Mutasi Stok
              </button>
            </div>
          </form>
        </div>
      )}

      {previewId !== null && (
        <PdfPreviewModal docType="SAMPLE" docId={previewId} onClose={() => setPreviewId(null)} />
      )}
    </div>
  );
};
