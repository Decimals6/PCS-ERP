import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Printer, Share2, Edit2, Trash2, X } from 'lucide-react';
import { Barang, Customer, DocType, Order, OrderDetail, Supplier } from '../../shared/types';
import { formatRupiah, generateDocNumber, generateSalesOrderNumber, todayIso } from '../utils/format';
import { PdfPreviewModal } from '../components/PdfPreviewModal';
import { SearchableSelect } from '../components/SearchableSelect';
import { compareStringsNatural, SortableTh, SortConfig, toggleSort } from '../components/SortableTh';
import { useAppDialog } from '../components/AppDialogProvider';

export const OrdersPage: React.FC = () => {
  const { showConfirm, showAlert } = useAppDialog();
  const [filterType, setFilterType] = useState<'all' | 'in' | 'out'>('all');
  const [sortConfig, setSortConfig] = useState<SortConfig<'no' | 'tgl' | 'dpp' | 'total'> | null>({
    key: 'tgl',
    direction: 'desc',
  });
  const [orders, setOrders] = useState<Order[]>([]);
  const [barangList, setBarangList] = useState<Barang[]>([]);
  const [customerList, setCustomerList] = useState<Customer[]>([]);
  const [supplierList, setSupplierList] = useState<Supplier[]>([]);
  const [defaultPpn, setDefaultPpn] = useState<number>(11);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<Order>({
    tgl: todayIso(),
    no: '',
    type: 'out',
    cust_id: null,
    supp_id: null,
    dpp: 0,
    ppn: 11,
    diskon: 0,
    ongkir: 0,
    total: 0,
    deldate: '',
    po_subject: 'Label Barcode & Carbon Ribbon',
    details: [],
  });

  const [previewDoc, setPreviewDoc] = useState<{ type: DocType; id: number } | null>(null);

  const loadData = async () => {
    const [o, b, c, s, cfg] = await Promise.all([
      window.api.listOrders(filterType === 'all' ? undefined : filterType),
      window.api.listBarang(),
      window.api.listCustomer(),
      window.api.listSupplier(),
      window.api.getAppSettings(),
    ]);
    setOrders(o);
    setBarangList(b);
    setCustomerList(c);
    setSupplierList(s);
    setDefaultPpn(Number(cfg.default_ppn || 11));
  };

  useEffect(() => {
    loadData();
  }, [filterType]);

  const sortedOrders = useMemo(() => {
    if (!sortConfig) return orders;
    const factor = sortConfig.direction === 'asc' ? 1 : -1;
    return [...orders].sort((a, b) => {
      let cmp = 0;
      switch (sortConfig.key) {
        case 'no':
          cmp = compareStringsNatural(a.no, b.no);
          break;
        case 'tgl':
          cmp = String(a.tgl || '').localeCompare(String(b.tgl || ''));
          break;
        case 'dpp':
          cmp = Number(a.dpp || 0) - Number(b.dpp || 0);
          break;
        case 'total':
          cmp = Number(a.total || 0) - Number(b.total || 0);
          break;
      }
      if (cmp === 0) {
        cmp = Number(a.id || 0) - Number(b.id || 0);
      }
      return cmp * factor;
    });
  }, [orders, sortConfig]);

  const recalcTotals = (draft: Order): Order => {
    const details = (draft.details || []).map((d) => {
      const qty = Number(d.qty || 0);
      const price = Number(d.price || 0);
      return { ...d, subtotal: qty * price };
    });
    const dpp = details.reduce((s, d) => s + d.subtotal, 0);
    const diskon = Number(draft.diskon || 0);
    const ppn = Number(draft.ppn || 0);
    const ppnNominal = Math.max(0, dpp - diskon) * (ppn / 100);
    const total = Math.max(0, dpp - diskon) + ppnNominal;
    return { ...draft, details, dpp, total };
  };

  const openCreate = async (type: 'in' | 'out') => {
    setEditingId(null);
    const today = todayIso();
    let defaultNo = generateDocNumber('PO');
    if (type === 'out') {
      const allSalesOrders = await window.api.listOrders('out');
      defaultNo = generateSalesOrderNumber(
        allSalesOrders.map((o: { no: any; }) => o.no),
        today
      );
    }
    const initial: Order = {
      tgl: today,
      no: defaultNo,
      type,
      cust_id: null,
      supp_id: null,
      dpp: 0,
      ppn: defaultPpn,
      diskon: 0,
      ongkir: 0,
      total: 0,
      deldate: today,
      po_subject: 'Label Barcode & Carbon Ribbon',
      details: [{ barang_id: barangList[0]?.id || 0, qty: 1, qty_sent: 0, price: 0, satuan: barangList[0]?.satuan || 'PCS', subtotal: 0 }],
    };
    setForm(recalcTotals(initial));
    setModalOpen(true);
  };

  const openEdit = async (id: number) => {
    const full = await window.api.getOrderById(id);
    if (!full) return;
    setEditingId(id);
    setForm(recalcTotals(full));
    setModalOpen(true);
  };

  const updateItem = (idx: number, patch: Partial<OrderDetail>) => {
    const nextDetails = [...(form.details || [])];
    const current = { ...nextDetails[idx], ...patch };
    if (patch.barang_id !== undefined) {
      const b = barangList.find((x) => x.id === Number(patch.barang_id));
      if (b) current.satuan = b.satuan || 'PCS';
    }
    nextDetails[idx] = current;
    setForm(recalcTotals({ ...form, details: nextDetails }));
  };

  const addItem = () => {
    const b = barangList[0];
    const nextDetails = [
      ...(form.details || []),
      { barang_id: b?.id || 0, qty: 1, qty_sent: 0, price: 0, satuan: b?.satuan || 'PCS', subtotal: 0 },
    ];
    setForm(recalcTotals({ ...form, details: nextDetails }));
  };

  const removeItem = (idx: number) => {
    const nextDetails = (form.details || []).filter((_, i) => i !== idx);
    setForm(recalcTotals({ ...form, details: nextDetails }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const validDetails = (form.details || []).filter((d) => Number(d.barang_id) > 0 && Number(d.qty) > 0);
    if (validDetails.length === 0) {
      await showAlert('Minimal harus ada 1 item barang yang valid.');
      return;
    }
    const payload = recalcTotals({ ...form, details: validDetails });
    if (editingId) await window.api.updateOrder(editingId, payload);
    else await window.api.createOrder(payload);
    setModalOpen(false);
    loadData();
  };

  const handleDelete = async (id: number) => {
    const ok = await showConfirm({
      title: 'Hapus Dokumen Order',
      message: 'Hapus dokumen Order ini? Tindakan ini tidak dapat dibatalkan.',
      confirmText: 'Ya, Hapus',
    });
    if (!ok) return;
    await window.api.deleteOrder(id);
    loadData();
  };

  const handleExportTransfer = async (id: number) => {
    const res = await window.api.exportTransferJson('ORDER', id);
    if (res.saved) {
      await showAlert('File transfer JSON berhasil disimpan ke:\n' + res.filePath + '\n\nKirimkan file ini ke Divisi Finance untuk di-import menjadi Invoice.');
    }
  };

  const customerOptions = customerList.map((c) => ({
    value: c.id,
    label: `${c.kode ? `[${c.kode}] ` : ''}${c.nama}`,
    sublabel: [c.telepon, c.alamat].filter(Boolean).join(' | ') || undefined,
    searchText: `${c.kode || ''} ${c.nama} ${c.telepon || ''} ${c.UP || ''}`,
  }));

  const supplierOptions = supplierList.map((s) => ({
    value: s.id,
    label: `${s.kode ? `[${s.kode}] ` : ''}${s.nama}`,
    sublabel: [s.telepon, s.alamat].filter(Boolean).join(' | ') || undefined,
    searchText: `${s.kode || ''} ${s.nama} ${s.telepon || ''} ${s.UP || ''}`,
  }));

  const barangOptions = barangList.map((b) => ({
    value: b.id,
    label: `${b.kode ? `[${b.kode}] ` : ''}${b.nama}`,
    sublabel: `${b.part_number ? `Part No: ${b.part_number} | ` : ''}Stok: ${b.stock} ${b.satuan}`,
    searchText: `${b.kode || ''} ${b.part_number || ''} ${b.nama}`,
  }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Purchase Order (PO) &amp; Sales Order (SO)</h1>
          <p className="text-sm text-slate-500">Buat dokumen pesanan pembelian/penjualan, cetak PDF, dan transfer JSON ke Finance.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => openCreate('in')}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            Buat Purchase Order (PO)
          </button>
          <button
            onClick={() => openCreate('out')}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Buat Sales Order (SO)
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        {[
          { id: 'all', label: 'Semua Dokumen' },
          { id: 'in', label: 'Purchase Order (PO / Masuk)' },
          { id: 'out', label: 'Sales Order (SO / Keluar)' },
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
                label="No. Dokumen"
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
              <th className="px-4 py-3">Customer / Supplier</th>
              <SortableTh
                label="DPP"
                sortKey="dpp"
                sortConfig={sortConfig}
                onSort={(k) => setSortConfig((prev) => toggleSort(prev, k))}
                align="right"
              />
              <th className="px-4 py-3 text-right">PPN</th>
              <SortableTh
                label="Total"
                sortKey="total"
                sortConfig={sortConfig}
                onSort={(k) => setSortConfig((prev) => toggleSort(prev, k))}
                align="right"
              />
              <th className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sortedOrders.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                  Belum ada dokumen PO / SO.
                </td>
              </tr>
            ) : (
              sortedOrders.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-900">{o.no}</td>
                  <td className="px-4 py-3 text-slate-600">{o.tgl}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        o.type === 'in' ? 'bg-indigo-100 text-indigo-700' : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {o.type === 'in' ? 'PO (Pembelian)' : 'SO (Penjualan)'}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {o.type === 'out' ? o.customer_nama || '-' : o.supplier_nama || '-'}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">{formatRupiah(o.dpp)}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{o.ppn}%</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-900">{formatRupiah(o.total)}</td>
                  <td className="px-4 py-3 text-right space-x-1">
                    <button
                      onClick={() => setPreviewDoc({ type: o.type === 'in' ? 'PO' : 'SO', id: o.id! })}
                      title="Cetak / Preview PDF"
                      className="p-1.5 text-slate-600 hover:text-blue-600"
                    >
                      <Printer className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleExportTransfer(o.id!)}
                      title="Export JSON untuk Transfer ke Finance"
                      className="p-1.5 text-slate-600 hover:text-emerald-600"
                    >
                      <Share2 className="h-4 w-4" />
                    </button>
                    <button onClick={() => openEdit(o.id!)} title="Edit" className="p-1.5 text-slate-600 hover:text-amber-600">
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDelete(o.id!)} title="Hapus" className="p-1.5 text-slate-600 hover:text-rose-600">
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
          <form onSubmit={handleSave} className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="text-lg font-bold">
                {editingId ? 'Edit' : 'Buat'} {form.type === 'in' ? 'Purchase Order (PO)' : 'Sales Order (SO)'}
              </h2>
              <button type="button" onClick={() => setModalOpen(false)}>
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5 text-sm">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block font-medium">Nomor Dokumen *</label>
                  <input
                    type="text"
                    required
                    value={form.no}
                    onChange={(e) => setForm({ ...form, no: e.target.value })}
                    placeholder={form.type === 'out' ? '001/PCS-SO/XI/2026' : 'PO/202611/001'}
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
                    {form.type === 'out' ? 'Customer *' : 'Supplier *'}
                  </label>
                  {form.type === 'out' ? (
                    <SearchableSelect
                      required
                      options={customerOptions}
                      value={form.cust_id}
                      onChange={(val) => setForm({ ...form, cust_id: Number(val) || null })}
                      placeholder="-- Pilih Customer --"
                      searchPlaceholder="Cari kode / nama customer..."
                    />
                  ) : (
                    <SearchableSelect
                      required
                      options={supplierOptions}
                      value={form.supp_id}
                      onChange={(val) => setForm({ ...form, supp_id: Number(val) || null })}
                      placeholder="-- Pilih Supplier --"
                      searchPlaceholder="Cari kode / nama supplier..."
                    />
                  )}
                </div>
              </div>

              {form.type === 'in' && (
                <div className="grid grid-cols-1 gap-4 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3.5 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-indigo-950">Deldate (Tanggal Kirim)</label>
                    <input
                      type="date"
                      value={form.deldate || ''}
                      onChange={(e) => setForm({ ...form, deldate: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-semibold text-indigo-950">
                      Perihal / Jenis Spesifikasi PO
                    </label>
                    <input
                      type="text"
                      value={form.po_subject || ''}
                      onChange={(e) => setForm({ ...form, po_subject: e.target.value })}
                      placeholder="Contoh: Label Barcode & Carbon Ribbon"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
                    />
                  </div>
                </div>
              )}

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800">Rincian Item Barang</h3>
                  <button
                    type="button"
                    onClick={addItem}
                    className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                  >
                    + Tambah Baris Item
                  </button>
                </div>

                <div className="overflow-visible rounded-lg border">
                  <table className="w-full table-fixed text-left text-xs">
                    <thead className="border-b bg-slate-50 text-slate-600">
                      <tr>
                        <th className="p-2.5">Barang</th>
                        <th className="p-2.5 w-28 text-right">Qty</th>
                        <th className="p-2.5 w-24">Satuan</th>
                        <th className="p-2.5 w-40 text-right">Harga Satuan</th>
                        <th className="p-2.5 w-40 text-right">Subtotal</th>
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
                              onChange={(val) => updateItem(idx, { barang_id: Number(val) })}
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
                              className="w-full rounded border px-2 py-1.5 text-right"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={item.satuan}
                              onChange={(e) => updateItem(idx, { satuan: e.target.value })}
                              className="w-full rounded border px-2 py-1.5"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              step="any"
                              min="0"
                              value={item.price}
                              onChange={(e) => updateItem(idx, { price: Number(e.target.value) })}
                              className="w-full rounded border px-2 py-1.5 text-right"
                            />
                          </td>
                          <td className="p-2 text-right font-semibold">{formatRupiah(item.subtotal)}</td>
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

              <div className="grid grid-cols-1 gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Diskon (Rp)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.diskon}
                    onChange={(e) => setForm(recalcTotals({ ...form, diskon: Number(e.target.value) }))}
                    className="w-full rounded-lg border bg-white px-3 py-1.5 text-right"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">PPN (%)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={form.ppn}
                    onChange={(e) => setForm(recalcTotals({ ...form, ppn: Number(e.target.value) }))}
                    className="w-full rounded-lg border bg-white px-3 py-1.5 text-right"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Estimasi Ongkir (Info)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.ongkir}
                    onChange={(e) => setForm(recalcTotals({ ...form, ongkir: Number(e.target.value) }))}
                    className="w-full rounded-lg border bg-white px-3 py-1.5 text-right"
                  />
                </div>
                <div className="flex flex-col justify-center text-right">
                  <span className="text-xs text-slate-500">DPP: {formatRupiah(form.dpp)}</span>
                  <span className="text-xs text-slate-500">Total (DPP - Diskon + PPN):</span>
                  <span className="text-lg font-bold text-blue-700">{formatRupiah(form.total)}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t px-6 py-3.5">
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border px-4 py-2 text-sm">
                Batal
              </button>
              <button type="submit" className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700">
                Simpan Dokumen
              </button>
            </div>
          </form>
        </div>
      )}

      {previewDoc && (
        <PdfPreviewModal docType={previewDoc.type} docId={previewDoc.id} onClose={() => setPreviewDoc(null)} />
      )}
    </div>
  );
};
