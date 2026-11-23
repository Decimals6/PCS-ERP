import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Edit2, Trash2, Upload, Download, FileSpreadsheet, X } from 'lucide-react';
import { Barang, Customer, Supplier } from '../../shared/types';
import { parseCsvOrJson } from '../utils/format';
import { PaginationBar } from '../components/PaginationBar';
import { compareStringsNatural, SortableTh, SortConfig, toggleSort } from '../components/SortableTh';

type MasterTab = 'barang' | 'customer' | 'supplier';

const CSV_TEMPLATES: Record<
  MasterTab,
  { filename: string; columns: string[]; sampleCsv: string; notes: string }
> = {
  barang: {
    filename: 'template_import_barang.csv',
    columns: ['kode', 'part_number', 'nama', 'satuan', 'stock', 'keterangan', 'supplier_id'],
    sampleCsv: [
      'kode,part_number,nama,satuan,stock,keterangan,supplier_id',
      'BRG-001,PN-1001,"Filter Oli Mesin Diesel",PCS,25,"Stok awal gudang utama",',
      'BRG-002,PN-2045,"Selang Hidrolik 1/2 Inch",METER,50,"Tahan tekanan tinggi",1',
    ].join('\n'),
    notes:
      'Kolom wajib minimal: nama (atau kode). Kolom supplier_id opsional (isi angka ID supplier dari Master Supplier, atau kosongkan).',
  },
  customer: {
    filename: 'template_import_customer.csv',
    columns: ['kode', 'nama', 'alamat', 'email', 'telepon', 'UP'],
    sampleCsv: [
      'kode,nama,alamat,email,telepon,UP',
      'CUST-001,"PT Maju Jaya Teknik","Jl. Rungkut Industri No. 12, Surabaya",purchasing@majujaya.co.id,031-8412345,"Bpk. Hendra"',
      'CUST-002,"CV Sumber Makmur","Jl. Margomulyo Permai Blok A-5, Surabaya",admin@sumbermakmur.id,081234567890,"Ibu Sinta"',
    ].join('\n'),
    notes:
      'Kolom wajib minimal: nama (atau kode). Gunakan tanda kutip ganda ("...") jika alamat mengandung tanda koma.',
  },
  supplier: {
    filename: 'template_import_supplier.csv',
    columns: ['kode', 'nama,alamat,email,telepon,UP'.split(',')].flat(),
    sampleCsv: [
      'kode,nama,alamat,email,telepon,UP',
      'SUP-001,"PT Karya Logam Nusantara","Jl. Raya Driyorejo KM 24, Gresik",sales@karyalogam.co.id,031-7501122,"Bpk. Rudi"',
      'SUP-002,"UD Sentosa Abadi","Jl. Kalianak Barat No. 88, Surabaya",order@sentosaabadi.com,081987654321,"Ibu Dewi"',
    ].join('\n'),
    notes:
      'Kolom wajib minimal: nama (atau kode). Jika kode sudah terdaftar, data supplier lama akan otomatis diperbarui.',
  },
};

export const MasterDataPage: React.FC = () => {
  const [tab, setTab] = useState<MasterTab>('barang');
  const [search, setSearch] = useState('');

  const [barangSort, setBarangSort] = useState<SortConfig<'kode' | 'part_number' | 'nama' | 'stock'> | null>({
    key: 'kode',
    direction: 'asc',
  });
  const [partnerSort, setPartnerSort] = useState<SortConfig<'kode' | 'nama'> | null>({
    key: 'kode',
    direction: 'asc',
  });

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  const [barangList, setBarangList] = useState<Barang[]>([]);
  const [customerList, setCustomerList] = useState<Customer[]>([]);
  const [supplierList, setSupplierList] = useState<Supplier[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});

  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');

  const loadAll = async () => {
    const [b, c, s] = await Promise.all([
      window.api.listBarang(),
      window.api.listCustomer(),
      window.api.listSupplier(),
    ]);
    setBarangList(b);
    setCustomerList(c);
    setSupplierList(s);
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [tab, search, barangSort, partnerSort]);

  const openCreate = () => {
    setEditingId(null);
    if (tab === 'barang') {
      setForm({
        kode: '',
        part_number: '',
        supplier_id: '',
        nama: '',
        satuan: 'PCS',
        keterangan: '',
        stock: 0,
      });
    } else {
      setForm({
        kode: '',
        nama: '',
        alamat: '',
        email: '',
        telepon: '',
        UP: '',
      });
    }
    setModalOpen(true);
  };

  const openEdit = (item: any) => {
    setEditingId(item.id);
    setForm({ ...item, supplier_id: item.supplier_id ?? '' });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tab === 'barang') {
      const payload = {
        kode: form.kode || '',
        part_number: form.part_number || '',
        supplier_id: form.supplier_id ? Number(form.supplier_id) : null,
        nama: form.nama || '',
        satuan: form.satuan || 'PCS',
        keterangan: form.keterangan || '',
        stock: Number(form.stock || 0),
      };
      if (editingId) await window.api.updateBarang(editingId, payload);
      else await window.api.createBarang(payload);
    } else if (tab === 'customer') {
      const payload = {
        kode: form.kode || '',
        nama: form.nama || '',
        alamat: form.alamat || '',
        email: form.email || '',
        telepon: form.telepon || '',
        UP: form.UP || '',
      };
      if (editingId) await window.api.updateCustomer(editingId, payload);
      else await window.api.createCustomer(payload);
    } else {
      const payload = {
        kode: form.kode || '',
        nama: form.nama || '',
        alamat: form.alamat || '',
        email: form.email || '',
        telepon: form.telepon || '',
        UP: form.UP || '',
      };
      if (editingId) await window.api.updateSupplier(editingId, payload);
      else await window.api.createSupplier(payload);
    }
    setModalOpen(false);
    loadAll();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Hapus data master ini?')) return;
    if (tab === 'barang') await window.api.deleteBarang(id);
    else if (tab === 'customer') await window.api.deleteCustomer(id);
    else await window.api.deleteSupplier(id);
    loadAll();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImportText(String(reader.result || ''));
    reader.readAsText(file);
  };

  const handleDownloadCsvTemplate = () => {
    const tpl = CSV_TEMPLATES[tab];
    const bom = '\uFEFF';
    const blob = new Blob([bom + tpl.sampleCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = tpl.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleLoadSampleTemplate = () => {
    setImportText(CSV_TEMPLATES[tab].sampleCsv);
  };

  const handleBulkImport = async () => {
    try {
      const rows = parseCsvOrJson(importText);
      if (rows.length === 0) {
        alert('Tidak ada baris data yang valid untuk di-import.');
        return;
      }
      const res = await window.api.bulkImportMaster(tab, rows);
      alert('Import selesai!\nData baru ditambahkan: ' + res.inserted + '\nData diperbarui: ' + res.updated);
      setImportModalOpen(false);
      setImportText('');
      loadAll();
    } catch (err: any) {
      alert('Gagal memproses file import: ' + (err?.message || err));
    }
  };

  const q = search.toLowerCase();

  const sortedBarang = useMemo(() => {
    const filtered = barangList.filter(
      (b) =>
        b.nama.toLowerCase().includes(q) ||
        b.kode.toLowerCase().includes(q) ||
        b.part_number.toLowerCase().includes(q)
    );
    if (!barangSort) return filtered;
    const factor = barangSort.direction === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (barangSort.key) {
        case 'kode':
          cmp = compareStringsNatural(a.kode, b.kode);
          break;
        case 'part_number':
          cmp = compareStringsNatural(a.part_number, b.part_number);
          break;
        case 'nama':
          cmp = compareStringsNatural(a.nama, b.nama);
          break;
        case 'stock':
          cmp = Number(a.stock || 0) - Number(b.stock || 0);
          break;
      }
      if (cmp === 0) cmp = Number(a.id || 0) - Number(b.id || 0);
      return cmp * factor;
    });
  }, [barangList, q, barangSort]);

  const sortedCustomer = useMemo(() => {
    const filtered = customerList.filter(
      (c) => c.nama.toLowerCase().includes(q) || c.kode.toLowerCase().includes(q)
    );
    if (!partnerSort) return filtered;
    const factor = partnerSort.direction === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const cmp =
        partnerSort.key === 'kode'
          ? compareStringsNatural(a.kode, b.kode)
          : compareStringsNatural(a.nama, b.nama);
      return (cmp !== 0 ? cmp : Number(a.id || 0) - Number(b.id || 0)) * factor;
    });
  }, [customerList, q, partnerSort]);

  const sortedSupplier = useMemo(() => {
    const filtered = supplierList.filter(
      (s) => s.nama.toLowerCase().includes(q) || s.kode.toLowerCase().includes(q)
    );
    if (!partnerSort) return filtered;
    const factor = partnerSort.direction === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const cmp =
        partnerSort.key === 'kode'
          ? compareStringsNatural(a.kode, b.kode)
          : compareStringsNatural(a.nama, b.nama);
      return (cmp !== 0 ? cmp : Number(a.id || 0) - Number(b.id || 0)) * factor;
    });
  }, [supplierList, q, partnerSort]);

  const paginatedBarang = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedBarang.slice(start, start + pageSize);
  }, [sortedBarang, currentPage, pageSize]);

  const activePartners = tab === 'customer' ? sortedCustomer : sortedSupplier;
  const paginatedPartners = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return activePartners.slice(start, start + pageSize);
  }, [activePartners, currentPage, pageSize]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Master Data</h1>
          <p className="text-sm text-slate-500">Kelola katalog barang, customer, supplier, dan migrasi data massal.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setImportModalOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Upload className="h-4 w-4" />
            Bulk Import CSV / JSON
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Tambah {tab === 'barang' ? 'Barang' : tab === 'customer' ? 'Customer' : 'Supplier'}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex gap-2">
          {(['barang', 'customer', 'supplier'] as MasterTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold capitalize transition-colors ${
                tab === t
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {t} ({t === 'barang' ? barangList.length : t === 'customer' ? customerList.length : supplierList.length})
            </button>
          ))}
        </div>

        <div className="relative w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari kode, part no, atau nama..."
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {tab === 'barang' ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-600">
                  <tr>
                    <SortableTh
                      label="Kode"
                      sortKey="kode"
                      sortConfig={barangSort}
                      onSort={(k) => setBarangSort((prev) => toggleSort(prev, k))}
                      className="whitespace-nowrap"
                    />
                    <SortableTh
                      label="Part Number"
                      sortKey="part_number"
                      sortConfig={barangSort}
                      onSort={(k) => setBarangSort((prev) => toggleSort(prev, k))}
                      className="whitespace-nowrap"
                    />
                    <SortableTh
                      label="Nama Barang"
                      sortKey="nama"
                      sortConfig={barangSort}
                      onSort={(k) => setBarangSort((prev) => toggleSort(prev, k))}
                    />
                    <th className="px-4 py-3 whitespace-nowrap">Supplier Utama</th>
                    <SortableTh
                      label="Stok"
                      sortKey="stock"
                      sortConfig={barangSort}
                      onSort={(k) => setBarangSort((prev) => toggleSort(prev, k))}
                      align="right"
                      className="whitespace-nowrap"
                    />
                    <th className="px-4 py-3 whitespace-nowrap">Satuan</th>
                    <th className="px-4 py-3 text-right whitespace-nowrap">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedBarang.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                        Belum ada data barang.
                      </td>
                    </tr>
                  ) : (
                    paginatedBarang.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{item.kode || '-'}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-600 whitespace-nowrap">{item.part_number || '-'}</td>
                        <td className="px-4 py-3 font-medium text-slate-900">{item.nama}</td>
                        <td className="px-4 py-3 text-slate-600">{item.supplier_nama || '-'}</td>
                        <td className="px-4 py-3 text-right font-bold text-slate-900 whitespace-nowrap">{item.stock}</td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{item.satuan}</td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <button onClick={() => openEdit(item)} className="p-1.5 text-slate-500 hover:text-blue-600">
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleDelete(item.id!)} className="p-1.5 text-slate-500 hover:text-rose-600">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <PaginationBar
              totalItems={sortedBarang.length}
              currentPage={currentPage}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
              itemLabel="barang"
            />
          </>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-600">
                  <tr>
                    <SortableTh
                      label="Kode"
                      sortKey="kode"
                      sortConfig={partnerSort}
                      onSort={(k) => setPartnerSort((prev) => toggleSort(prev, k))}
                      className="whitespace-nowrap"
                    />
                    <SortableTh
                      label="Nama Perusahaan / Partner"
                      sortKey="nama"
                      sortConfig={partnerSort}
                      onSort={(k) => setPartnerSort((prev) => toggleSort(prev, k))}
                    />
                    <th className="px-4 py-3">Alamat</th>
                    <th className="px-4 py-3 whitespace-nowrap">Telepon / Email</th>
                    <th className="px-4 py-3 whitespace-nowrap">UP (Kontak)</th>
                    <th className="px-4 py-3 text-right whitespace-nowrap">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedPartners.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                        Belum ada data {tab}.
                      </td>
                    </tr>
                  ) : (
                    paginatedPartners.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{item.kode || '-'}</td>
                        <td className="px-4 py-3 font-medium text-slate-900">{item.nama}</td>
                        <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{item.alamat || '-'}</td>
                        <td className="px-4 py-3 text-xs text-slate-600">
                          {item.telepon || '-'}
                          {item.email ? ` | ${item.email}` : ''}
                        </td>
                        <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{item.UP || '-'}</td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <button onClick={() => openEdit(item)} className="p-1.5 text-slate-500 hover:text-blue-600">
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleDelete(item.id!)} className="p-1.5 text-slate-500 hover:text-rose-600">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <PaginationBar
              totalItems={activePartners.length}
              currentPage={currentPage}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
              itemLabel={tab}
            />
          </>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <form onSubmit={handleSave} className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-lg font-bold capitalize">
                {editingId ? 'Edit' : 'Tambah'} {tab}
              </h2>
              <button type="button" onClick={() => setModalOpen(false)}>
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            {tab === 'barang' ? (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <label className="mb-1 block font-medium">Kode Barang</label>
                  <input
                    type="text"
                    value={form.kode || ''}
                    onChange={(e) => setForm({ ...form, kode: e.target.value })}
                    className="w-full rounded-lg border px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium">Part Number</label>
                  <input
                    type="text"
                    value={form.part_number || ''}
                    onChange={(e) => setForm({ ...form, part_number: e.target.value })}
                    className="w-full rounded-lg border px-3 py-2"
                  />
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block font-medium">Nama Barang *</label>
                  <input
                    type="text"
                    required
                    value={form.nama || ''}
                    onChange={(e) => setForm({ ...form, nama: e.target.value })}
                    className="w-full rounded-lg border px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium">Satuan</label>
                  <input
                    type="text"
                    value={form.satuan || 'PCS'}
                    onChange={(e) => setForm({ ...form, satuan: e.target.value })}
                    className="w-full rounded-lg border px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium">Stok Awal / Saat Ini</label>
                  <input
                    type="number"
                    step="any"
                    value={form.stock ?? 0}
                    onChange={(e) => setForm({ ...form, stock: e.target.value })}
                    className="w-full rounded-lg border px-3 py-2"
                  />
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block font-medium">Supplier Utama</label>
                  <select
                    value={form.supplier_id || ''}
                    onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
                    className="w-full rounded-lg border px-3 py-2"
                  >
                    <option value="">-- Pilih Supplier (Opsional) --</option>
                    {supplierList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.kode ? `[${s.kode}] ` : ''}{s.nama}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block font-medium">Keterangan</label>
                  <textarea
                    rows={2}
                    value={form.keterangan || ''}
                    onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
                    className="w-full rounded-lg border px-3 py-2"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <label className="mb-1 block font-medium">Kode</label>
                  <input
                    type="text"
                    value={form.kode || ''}
                    onChange={(e) => setForm({ ...form, kode: e.target.value })}
                    className="w-full rounded-lg border px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium">UP (Up. / PIC)</label>
                  <input
                    type="text"
                    value={form.UP || ''}
                    onChange={(e) => setForm({ ...form, UP: e.target.value })}
                    className="w-full rounded-lg border px-3 py-2"
                  />
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block font-medium">Nama *</label>
                  <input
                    type="text"
                    required
                    value={form.nama || ''}
                    onChange={(e) => setForm({ ...form, nama: e.target.value })}
                    className="w-full rounded-lg border px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium">Telepon</label>
                  <input
                    type="text"
                    value={form.telepon || ''}
                    onChange={(e) => setForm({ ...form, telepon: e.target.value })}
                    className="w-full rounded-lg border px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium">Email</label>
                  <input
                    type="email"
                    value={form.email || ''}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full rounded-lg border px-3 py-2"
                  />
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block font-medium">Alamat</label>
                  <textarea
                    rows={2}
                    value={form.alamat || ''}
                    onChange={(e) => setForm({ ...form, alamat: e.target.value })}
                    className="w-full rounded-lg border px-3 py-2"
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 border-t pt-3">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg border px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Simpan Data
              </button>
            </div>
          </form>
        </div>
      )}

      {importModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-lg font-bold capitalize">Bulk Import Data {tab} (CSV / JSON)</h2>
              <button onClick={() => setImportModalOpen(false)}>
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-3.5 text-xs text-slate-700 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 font-semibold text-blue-900">
                  <FileSpreadsheet className="h-4 w-4 text-blue-600" />
                  <span>Template Format CSV ({CSV_TEMPLATES[tab].filename})</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleLoadSampleTemplate}
                    className="rounded-md border border-blue-300 bg-white px-2.5 py-1 font-medium text-blue-700 hover:bg-blue-50"
                  >
                    Isi Contoh ke Editor
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadCsvTemplate}
                    className="flex items-center gap-1.5 rounded-md bg-blue-600 px-2.5 py-1 font-medium text-white hover:bg-blue-700"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download Template CSV
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-medium text-slate-600">Susunan Kolom:</span>
                {CSV_TEMPLATES[tab].columns.map((col) => (
                  <code
                    key={col}
                    className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-800 border border-blue-200"
                  >
                    {col}
                  </code>
                ))}
              </div>

              <p className="text-[11px] leading-relaxed text-slate-600">
                {CSV_TEMPLATES[tab].notes} Jika <strong>kode</strong> sudah ada di database lokal, data akan diperbarui otomatis (upsert).
              </p>
            </div>

            <input
              type="file"
              accept=".csv,.json,.txt"
              onChange={handleFileUpload}
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-blue-700"
            />
            <textarea
              rows={8}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="Atau tempel (paste) isi file CSV / JSON dari export database lama di sini..."
              className="w-full rounded-lg border p-3 font-mono text-xs"
            />
            <div className="flex justify-end gap-2 border-t pt-3">
              <button
                onClick={() => setImportModalOpen(false)}
                className="rounded-lg border px-4 py-2 text-sm text-slate-600"
              >
                Batal
              </button>
              <button
                onClick={handleBulkImport}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Proses Import Sekarang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
