import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Printer, Share2, Edit2, Trash2, X } from 'lucide-react';
import { Barang, Customer, DeliveryNote, DeliveryNoteDetail, Order } from '../../shared/types';
import { generateDocNumber, generateSuratJalanKeluarNumber, todayIso } from '../utils/format';
import { PdfPreviewModal } from '../components/PdfPreviewModal';
import { SearchableSelect } from '../components/SearchableSelect';
import { compareStringsNatural, SortableTh, SortConfig, toggleSort } from '../components/SortableTh';
import { useAppDialog } from '../components/AppDialogProvider';

export const DeliveryNotesPage: React.FC = () => {
  const { showConfirm, showAlert } = useAppDialog();
  const [filterType, setFilterType] = useState<'all' | 'in' | 'out'>('all');
  const [sortConfig, setSortConfig] = useState<SortConfig<'no' | 'tgl'> | null>({
    key: 'tgl',
    direction: 'desc',
  });
  const [notes, setNotes] = useState<DeliveryNote[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [barangList, setBarangList] = useState<Barang[]>([]);
  const [customerList, setCustomerList] = useState<Customer[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<DeliveryNote>({
    no: '',
    tgl: todayIso(),
    order_no: '',
    alamat_tujuan: '',
    keterangan: '',
    type: 'out',
    details: [],
  });

  const [previewId, setPreviewId] = useState<number | null>(null);

  const loadData = async () => {
    const [dn, ord, brg, cust] = await Promise.all([
      window.api.listDeliveryNotes(filterType === 'all' ? undefined : filterType),
      window.api.listOrders(),
      window.api.listBarang(),
      window.api.listCustomer(),
    ]);
    setNotes(dn);
    setOrders(ord);
    setBarangList(brg);
    setCustomerList(cust);
  };

  useEffect(() => {
    loadData();
  }, [filterType]);

  const sortedNotes = useMemo(() => {
    if (!sortConfig) return notes;
    const factor = sortConfig.direction === 'asc' ? 1 : -1;
    return [...notes].sort((a, b) => {
      let cmp = 0;
      switch (sortConfig.key) {
        case 'no':
          cmp = compareStringsNatural(a.no, b.no);
          break;
        case 'tgl':
          cmp = String(a.tgl || '').localeCompare(String(b.tgl || ''));
          break;
      }
      if (cmp === 0) {
        cmp = Number(a.id || 0) - Number(b.id || 0);
      }
      return cmp * factor;
    });
  }, [notes, sortConfig]);

  const openCreate = async (type: 'in' | 'out') => {
    setEditingId(null);
    const today = todayIso();
    let defaultNo = generateDocNumber('SJM');
    if (type === 'out') {
      const allSjOut: DeliveryNote[] = await window.api.listDeliveryNotes('out');
      defaultNo = generateSuratJalanKeluarNumber(
        allSjOut.map((n: DeliveryNote) => n.no),
        today
      );
    }
    setForm({
      no: defaultNo,
      tgl: today,
      order_no: '',
      alamat_tujuan: '',
      keterangan: '',
      type,
      details: [{ order_detail_id: null, barang_id: barangList[0]?.id || 0, qty_sent: 1 }],
    });
    setModalOpen(true);
  };

  const openEdit = async (id: number) => {
    const full = await window.api.getDeliveryNoteById(id);
    if (!full) return;
    setEditingId(id);
    setForm(full);
    setModalOpen(true);
  };

  const applyOrderReference = async (orderNo: string) => {
    const trimmedNo = orderNo.trim();
    if (!trimmedNo) {
      setForm((prev) => ({ ...prev, order_no: '' }));
      return;
    }

    const order = await window.api.getOrderByNo(trimmedNo);
    if (!order) {
      setForm((prev) => ({ ...prev, order_no: trimmedNo }));
      return;
    }

    const mappedDetails: DeliveryNoteDetail[] = (order.details || [])
      .map((d: any) => {
        const sisa = Math.max(0, Number(d.qty || 0) - Number(d.qty_sent || 0));
        return {
          order_detail_id: d.id ?? null,
          barang_id: d.barang_id,
          qty_sent: sisa > 0 ? sisa : Number(d.qty || 0),
          barang_kode: d.barang_kode,
          barang_nama: d.barang_nama,
          barang_satuan: d.satuan,
        };
      })
      .filter((x: DeliveryNoteDetail) => x.qty_sent > 0);

    const matchedCust = order.type === 'out' && order.cust_id
      ? customerList.find((c) => c.id === order.cust_id)
      : null;

    setForm((prev) => ({
      ...prev,
      order_no: order.no,
      type: order.type,
      alamat_tujuan: matchedCust?.alamat ? matchedCust.alamat : prev.alamat_tujuan,
      details: mappedDetails.length > 0 ? mappedDetails : prev.details,
    }));
  };

  const updateItem = (idx: number, patch: Partial<DeliveryNoteDetail>) => {
    const next = [...(form.details || [])];
    next[idx] = { ...next[idx], ...patch };
    setForm({ ...form, details: next });
  };

  const addItem = () => {
    setForm({
      ...form,
      details: [
        ...(form.details || []),
        { order_detail_id: null, barang_id: barangList[0]?.id || 0, qty_sent: 1 },
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
    const valid = (form.details || []).filter((d) => Number(d.barang_id) > 0 && Number(d.qty_sent) > 0);
    if (valid.length === 0) {
      await showAlert('Minimal harus ada 1 barang dengan jumlah kirim lebih dari 0.');
      return;
    }
    const payload: DeliveryNote = { ...form, details: valid };
    if (editingId) await window.api.updateDeliveryNote(editingId, payload);
    else await window.api.createDeliveryNote(payload);
    setModalOpen(false);
    loadData();
  };

  const handleDelete = async (id: number) => {
    const ok = await showConfirm({
      title: 'Hapus Surat Jalan',
      message: 'Hapus Surat Jalan ini? Stok barang & riwayat mutasi akan otomatis di-rollback.',
      confirmText: 'Ya, Hapus',
    });
    if (!ok) return;
    await window.api.deleteDeliveryNote(id);
    loadData();
  };

  const handleExportTransfer = async (id: number) => {
    const res = await window.api.exportTransferJson('DELIVERY_NOTE', id);
    if (res.saved) {
      await showAlert('File transfer Surat Jalan (.json) berhasil disimpan ke:\n' + res.filePath);
    }
  };

  const orderOptions = [
    { value: '', label: '-- Tanpa Referensi PO / SO --', searchText: 'tanpa referensi kosong' },
    ...orders
      .filter((o) => o.type === form.type)
      .map((o) => ({
        value: o.no,
        label: o.no,
        sublabel: `${o.tgl} | ${o.type === 'out' ? o.customer_nama || '-' : o.supplier_nama || '-'}`,
        searchText: `${o.no} ${o.customer_nama || ''} ${o.supplier_nama || ''} ${o.tgl}`,
      })),
  ];

  const barangOptions = barangList.map((b) => ({
    value: b.id,
    label: `${b.kode ? `[${b.kode}] ` : ''}${b.nama}`,
    sublabel: `${b.part_number ? `Part No: ${b.part_number} | ` : ''}Stok saat ini: ${b.stock} ${b.satuan}`,
    searchText: `${b.kode || ''} ${b.part_number || ''} ${b.nama}`,
  }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Surat Jalan (Penerimaan &amp; Pengiriman)</h1>
          <p className="text-sm text-slate-500">
            Menerbitkan Surat Jalan akan otomatis memperbarui stok barang dan mencatat riwayat mutasi stok.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => openCreate('in')}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" />
            SJ Masuk (Terima Barang)
          </button>
          <button
            onClick={() => openCreate('out')}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            SJ Keluar (Kirim Barang)
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        {[
          { id: 'all', label: 'Semua Surat Jalan' },
          { id: 'in', label: 'SJ Masuk (In)' },
          { id: 'out', label: 'SJ Keluar (Out)' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setFilterType(t.id as any)}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold ${
              filterType === t.id ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-600">
            <tr>
              <SortableTh
                label="No. Surat Jalan"
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
              <th className="px-4 py-3">Jenis</th>
              <th className="px-4 py-3">Ref. PO / SO</th>
              <th className="px-4 py-3">Alamat Tujuan</th>
              <th className="px-4 py-3">Keterangan</th>
              <th className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sortedNotes.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  Belum ada data Surat Jalan.
                </td>
              </tr>
            ) : (
              sortedNotes.map((n) => (
                <tr key={n.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-900">{n.no}</td>
                  <td className="px-4 py-3 text-slate-600">{n.tgl}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        n.type === 'in' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {n.type === 'in' ? 'Masuk (+Stok)' : 'Keluar (-Stok)'}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">{n.order_no || '-'}</td>
                  <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{n.alamat_tujuan || '-'}</td>
                  <td className="px-4 py-3 text-slate-500 max-w-xs truncate">{n.keterangan || '-'}</td>
                  <td className="px-4 py-3 text-right space-x-1">
                    <button
                      onClick={() => setPreviewId(n.id!)}
                      title="Cetak / Preview PDF"
                      className="p-1.5 text-slate-600 hover:text-blue-600"
                    >
                      <Printer className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleExportTransfer(n.id!)}
                      title="Export JSON untuk Transfer ke Finance"
                      className="p-1.5 text-slate-600 hover:text-emerald-600"
                    >
                      <Share2 className="h-4 w-4" />
                    </button>
                    <button onClick={() => openEdit(n.id!)} title="Edit" className="p-1.5 text-slate-600 hover:text-amber-600">
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDelete(n.id!)} title="Hapus" className="p-1.5 text-slate-600 hover:text-rose-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <form onSubmit={handleSave} className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="text-lg font-bold">
                {editingId ? 'Edit' : 'Buat'} Surat Jalan ({form.type === 'in' ? 'Barang Masuk' : 'Barang Keluar'})
              </h2>
              <button type="button" onClick={() => setModalOpen(false)}>
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 text-sm">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block font-medium">No. Surat Jalan *</label>
                  <input
                    type="text"
                    required
                    value={form.no}
                    onChange={(e) => setForm({ ...form, no: e.target.value })}
                    placeholder={form.type === 'out' ? '001/PCS-SJ/XI/2026' : 'SJM/202611/001'}
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
                <div>
                  <label className="mb-1 block font-medium">
                    Ref. Nomor {form.type === 'out' ? 'SO' : 'PO'}
                  </label>
                  <SearchableSelect
                    options={orderOptions}
                    value={form.order_no}
                    onChange={(val) => applyOrderReference(String(val))}
                    placeholder={`-- Pilih ${form.type === 'out' ? 'Sales Order (SO)' : 'Purchase Order (PO)'} --`}
                    searchPlaceholder="Cari nomor order / partner..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-medium">Alamat Tujuan / Gudang</label>
                  <input
                    type="text"
                    value={form.alamat_tujuan}
                    onChange={(e) => setForm({ ...form, alamat_tujuan: e.target.value })}
                    className="w-full rounded-lg border px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium">Keterangan / Ekspedisi</label>
                  <input
                    type="text"
                    value={form.keterangan}
                    onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
                    className="w-full rounded-lg border px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800">Daftar Barang Dikirim / Diterima</h3>
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
                        <th className="p-2.5 w-32 text-right">Qty ({form.type === 'in' ? 'Masuk' : 'Keluar'})</th>
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
                              value={item.barang_id || ''}
                              onChange={(val) => updateItem(idx, { barang_id: Number(val), order_detail_id: null })}
                              placeholder="-- Pilih Barang --"
                              searchPlaceholder="Cari nama / kode / part no..."
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              step="any"
                              min="0.01"
                              value={item.qty_sent}
                              onChange={(e) => updateItem(idx, { qty_sent: Number(e.target.value) })}
                              className="w-full rounded border px-2 py-1.5 text-right font-semibold"
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
              <button type="submit" className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700">
                Simpan &amp; Update Stok
              </button>
            </div>
          </form>
        </div>
      )}

      {previewId !== null && (
        <PdfPreviewModal docType="SJ" docId={previewId} onClose={() => setPreviewId(null)} />
      )}
    </div>
  );
};
