import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Edit2, Trash2, X, Wand2, Filter } from 'lucide-react';
import {
  Customer,
  Invoice,
  Payment,
  PaymentDetail,
  PaymentPrefillDraft,
  Supplier,
} from '../../shared/types';
import { formatRupiah, generateDocNumber, todayIso } from '../utils/format';
import { SearchableSelect } from '../components/SearchableSelect';
import { PaginationBar } from '../components/PaginationBar';
import { useAppDialog } from '../components/AppDialogProvider';

interface PaymentsPageProps {
  onDataChanged?: () => void;
  prefillDraft?: PaymentPrefillDraft | null;
  onPrefillConsumed?: () => void;
}

export const PaymentsPage: React.FC<PaymentsPageProps> = ({
  onDataChanged,
  prefillDraft,
  onPrefillConsumed,
}) => {
  const { showConfirm, showAlert } = useAppDialog();
  const [filterType, setFilterType] = useState<'all' | 'in' | 'out'>('all');
  const [filterPartnerKey, setFilterPartnerKey] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  const [payments, setPayments] = useState<Payment[]>([]);
  const [customerList, setCustomerList] = useState<Customer[]>([]);
  const [supplierList, setSupplierList] = useState<Supplier[]>([]);
  const [partnerInvoices, setPartnerInvoices] = useState<Invoice[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<Payment>({
    no: '',
    tgl: todayIso(),
    type: 'in',
    cust_id: null,
    supp_id: null,
    total: 0,
    received: 0,
    deduction: 0,
    deduction_note: '',
    keterangan: '',
    details: [],
  });

  const loadData = async () => {
    const [p, c, s] = await Promise.all([
      window.api.listPayments(filterType === 'all' ? undefined : filterType),
      window.api.listCustomer(),
      window.api.listSupplier(),
    ]);
    setPayments(p);
    setCustomerList(c);
    setSupplierList(s);
  };

  useEffect(() => {
    loadData();
  }, [filterType]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterType, filterPartnerKey]);

  const fetchPartnerInvoicesForForm = async (
    payType: 'in' | 'out',
    partnerId: number | null,
    existingDetails: PaymentDetail[] = []
  ) => {
    if (!partnerId) {
      setPartnerInvoices([]);
      return [];
    }
    const invType = payType === 'in' ? 'out' : 'in';
    const [unpaidList, allTypeInvoices] = await Promise.all([
      window.api.listUnpaidInvoicesByPartner(invType, partnerId),
      window.api.listInvoices(invType),
    ]);

    const map = new Map<number, Invoice>();
    for (const inv of unpaidList) {
      if (inv.id) map.set(inv.id, inv);
    }
    for (const d of existingDetails) {
      if (d.invoice_id && !map.has(d.invoice_id)) {
        const found = allTypeInvoices.find((x: Invoice) => x.id === d.invoice_id);
        if (found) map.set(d.invoice_id, found);
      }
    }

    const merged = Array.from(map.values()).sort((a, b) => {
      const cmp = (a.tgl || '').localeCompare(b.tgl || '');
      return cmp !== 0 ? cmp : (a.id || 0) - (b.id || 0);
    });
    setPartnerInvoices(merged);
    return merged;
  };

  // Tangani handover pre-filled dari halaman Invoices
  useEffect(() => {
    if (!prefillDraft) return;
    let cancelled = false;

    const initFromPrefill = async () => {
      const { type, partnerId, invoices: selectedInvs } = prefillDraft;
      const sortedInvs = [...selectedInvs].sort((a, b) => {
        const cmp = (a.tgl || '').localeCompare(b.tgl || '');
        return cmp !== 0 ? cmp : (a.id || 0) - (b.id || 0);
      });

      const prefilledDetails: PaymentDetail[] = [];
      for (const inv of sortedInvs) {
        if (!inv.id) continue;
        const grand = Number(inv.total || 0) + Number(inv.ongkir || 0);
        const sisa = Math.max(0, grand - Number(inv.paid || 0));
        if (sisa <= 0) continue;
        prefilledDetails.push({
          invoice_id: inv.id,
          subtotal: sisa,
          invoice_no: inv.no,
          invoice_tgl: inv.tgl,
          invoice_total_tagihan: grand,
          invoice_sisa: sisa,
        });
      }

      await fetchPartnerInvoicesForForm(type, partnerId, prefilledDetails);
      if (cancelled) return;

      const totalSum = prefilledDetails.reduce((s, d) => s + Number(d.subtotal || 0), 0);
      setEditingId(null);
      setForm({
        no: generateDocNumber(type === 'in' ? 'PAY-IN' : 'PAY-OUT'),
        tgl: todayIso(),
        type,
        cust_id: type === 'in' ? partnerId : null,
        supp_id: type === 'out' ? partnerId : null,
        total: totalSum,
        received: totalSum,
        deduction: 0,
        deduction_note: '',
        keterangan: '',
        details: prefilledDetails,
      });
      setModalOpen(true);
      onPrefillConsumed?.();
    };

    initFromPrefill();
    return () => {
      cancelled = true;
    };
  }, [prefillDraft]);

  const openCreate = (type: 'in' | 'out') => {
    setEditingId(null);
    setPartnerInvoices([]);
    setForm({
      no: generateDocNumber(type === 'in' ? 'PAY-IN' : 'PAY-OUT'),
      tgl: todayIso(),
      type,
      cust_id: null,
      supp_id: null,
      total: 0,
      received: 0,
      deduction: 0,
      deduction_note: '',
      keterangan: '',
      details: [],
    });
    setModalOpen(true);
  };

  const openEdit = async (id: number) => {
    const full = await window.api.getPaymentById(id);
    if (!full) return;
    setEditingId(id);
    const partnerId = full.type === 'in' ? full.cust_id : full.supp_id;
    await fetchPartnerInvoicesForForm(full.type, partnerId, full.details || []);
    setForm({
      ...full,
      total: Number(full.total || 0),
      received: Number(full.received || 0),
      deduction: Number(full.deduction || 0),
      deduction_note: full.deduction_note || '',
      keterangan: full.keterangan || '',
    });
    setModalOpen(true);
  };

  const applyFifoAllocation = (
    grossTargetAmount: number,
    invoiceSource: Invoice[] = partnerInvoices,
    baseForm: Payment = form,
    currentEditingId: number | null = editingId
  ) => {
    let remaining = Math.max(0, Number(grossTargetAmount || 0));
    const allocated: PaymentDetail[] = [];

    for (const inv of invoiceSource) {
      if (remaining <= 0) break;
      const grand = Number(inv.total || 0) + Number(inv.ongkir || 0);
      const existingAllocInEdit = currentEditingId
        ? (baseForm.details || []).find((d) => d.invoice_id === inv.id)?.subtotal || 0
        : 0;
      const sisaTagihan = Math.max(0, grand - Number(inv.paid || 0) + Number(existingAllocInEdit));
      if (sisaTagihan <= 0) continue;

      const bayarIni = Math.min(remaining, sisaTagihan);
      allocated.push({
        invoice_id: inv.id!,
        subtotal: bayarIni,
        invoice_no: inv.no,
        invoice_tgl: inv.tgl,
        invoice_total_tagihan: grand,
        invoice_sisa: sisaTagihan,
      });
      remaining -= bayarIni;
    }

    const totalAllocated = allocated.reduce((s, d) => s + Number(d.subtotal || 0), 0);
    const deduction = Number(baseForm.deduction || 0);
    const finalTotal = totalAllocated > 0 ? totalAllocated : grossTargetAmount;
    const received = Math.max(0, finalTotal - deduction);

    setForm({
      ...baseForm,
      total: finalTotal,
      received,
      details: allocated,
    });
  };

  const handlePartnerChange = async (partnerId: number | null) => {
    const updated: Payment = {
      ...form,
      cust_id: form.type === 'in' ? partnerId : null,
      supp_id: form.type === 'out' ? partnerId : null,
      details: [],
    };
    setForm(updated);
    const unpaid = await fetchPartnerInvoicesForForm(form.type, partnerId, []);
    if (Number(updated.total || 0) > 0 && unpaid.length > 0) {
      applyFifoAllocation(Number(updated.total), unpaid, updated, null);
    }
  };

  const handleTotalPelunasanChange = (val: number) => {
    const gross = Math.max(0, Number(val || 0));
    const deduction = Number(form.deduction || 0);
    const received = Math.max(0, gross - deduction);
    setForm({ ...form, total: gross, received });
  };

  const handleDeductionChange = (val: number) => {
    const deduction = Math.max(0, Number(val || 0));
    const gross = Number(form.total || 0);
    const received = Math.max(0, gross - deduction);
    setForm({ ...form, deduction, received });
  };

  const addManualAllocationRow = async () => {
    const usedIds = new Set((form.details || []).map((d) => d.invoice_id));
    const nextInv = partnerInvoices.find((inv) => inv.id && !usedIds.has(inv.id)) || partnerInvoices[0];
    if (!nextInv) {
      await showAlert('Pilih Customer / Supplier yang memiliki invoice belum lunas terlebih dahulu.');
      return;
    }
    const grand = Number(nextInv.total || 0) + Number(nextInv.ongkir || 0);
    const existingAlloc = editingId
      ? (form.details || []).find((d) => d.invoice_id === nextInv.id)?.subtotal || 0
      : 0;
    const sisa = Math.max(0, grand - Number(nextInv.paid || 0) + Number(existingAlloc));

    const nextDetails: PaymentDetail[] = [
      ...(form.details || []),
      {
        invoice_id: nextInv.id!,
        subtotal: sisa,
        invoice_no: nextInv.no,
        invoice_tgl: nextInv.tgl,
        invoice_total_tagihan: grand,
        invoice_sisa: sisa,
      },
    ];
    const sumAllocated = nextDetails.reduce((s, d) => s + Number(d.subtotal || 0), 0);
    const received = Math.max(0, sumAllocated - Number(form.deduction || 0));
    setForm({
      ...form,
      details: nextDetails,
      total: sumAllocated,
      received,
    });
  };

  const updateAllocationRow = (idx: number, patch: Partial<PaymentDetail>) => {
    const next = [...(form.details || [])];
    const curr = { ...next[idx], ...patch };
    if (patch.invoice_id !== undefined) {
      const inv = partnerInvoices.find((x) => x.id === Number(patch.invoice_id));
      if (inv) {
        const grand = Number(inv.total || 0) + Number(inv.ongkir || 0);
        const sisa = Math.max(0, grand - Number(inv.paid || 0));
        curr.invoice_no = inv.no;
        curr.invoice_tgl = inv.tgl;
        curr.invoice_total_tagihan = grand;
        curr.invoice_sisa = sisa;
        curr.subtotal = sisa;
      }
    }
    next[idx] = curr;
    const sumAllocated = next.reduce((s, d) => s + Number(d.subtotal || 0), 0);
    const received = Math.max(0, sumAllocated - Number(form.deduction || 0));
    setForm({ ...form, details: next, total: sumAllocated, received });
  };

  const removeAllocationRow = (idx: number) => {
    const next = (form.details || []).filter((_, i) => i !== idx);
    const sumAllocated = next.reduce((s, d) => s + Number(d.subtotal || 0), 0);
    const received = Math.max(0, sumAllocated - Number(form.deduction || 0));
    setForm({ ...form, details: next, total: sumAllocated, received });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const validDetails = (form.details || []).filter((d) => Number(d.invoice_id) > 0 && Number(d.subtotal) > 0);
    if (validDetails.length === 0) {
      await showAlert('Minimal harus ada 1 alokasi pelunasan invoice dengan nominal lebih dari 0.');
      return;
    }
    const sumAllocated = validDetails.reduce((s, d) => s + Number(d.subtotal || 0), 0);
    const deduction = Number(form.deduction || 0);
    const received = Math.max(0, sumAllocated - deduction);

    const payload: Payment = {
      ...form,
      total: sumAllocated,
      received,
      deduction,
      details: validDetails,
    };
    if (editingId) await window.api.updatePayment(editingId, payload);
    else await window.api.createPayment(payload);
    setModalOpen(false);
    await loadData();
    onDataChanged?.();
  };

  const handleDelete = async (id: number) => {
    const ok = await showConfirm({
      title: 'Hapus Bukti Pelunasan',
      message: 'Hapus bukti pelunasan ini? Saldo terbayar pada invoice terkait akan dikembalikan otomatis.',
      confirmText: 'Ya, Hapus',
    });
    if (!ok) return;
    await window.api.deletePayment(id);
    await loadData();
    onDataChanged?.();
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

  const partnerFilterOptions = useMemo(() => {
    const opts: Array<{ value: string; label: string; sublabel?: string; searchText: string }> = [
      { value: '', label: '-- Semua Customer / Supplier --', searchText: 'semua all' },
    ];
    if (filterType === 'all' || filterType === 'in') {
      for (const c of customerList) {
        opts.push({
          value: `in-${c.id}`,
          label: `${filterType === 'all' ? '[Customer] ' : ''}${c.kode ? `[${c.kode}] ` : ''}${c.nama}`,
          sublabel: [c.telepon, c.alamat].filter(Boolean).join(' | ') || undefined,
          searchText: `customer ${c.kode || ''} ${c.nama} ${c.telepon || ''}`,
        });
      }
    }
    if (filterType === 'all' || filterType === 'out') {
      for (const s of supplierList) {
        opts.push({
          value: `out-${s.id}`,
          label: `${filterType === 'all' ? '[Supplier] ' : ''}${s.kode ? `[${s.kode}] ` : ''}${s.nama}`,
          sublabel: [s.telepon, s.alamat].filter(Boolean).join(' | ') || undefined,
          searchText: `supplier ${s.kode || ''} ${s.nama} ${s.telepon || ''}`,
        });
      }
    }
    return opts;
  }, [filterType, customerList, supplierList]);

  const filteredPayments = useMemo(() => {
    if (!filterPartnerKey) return payments;
    return payments.filter((p) => {
      const key = p.type === 'in' ? `in-${p.cust_id ?? 0}` : `out-${p.supp_id ?? 0}`;
      return key === filterPartnerKey;
    });
  }, [payments, filterPartnerKey]);

  const paginatedPayments = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredPayments.slice(start, start + pageSize);
  }, [filteredPayments, currentPage, pageSize]);

  const totalTeralokasi = (form.details || []).reduce((s, d) => s + Number(d.subtotal || 0), 0);
  const netDiterimaDibayar = Math.max(0, Number(form.total || 0) - Number(form.deduction || 0));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pelunasan Hutang &amp; Piutang (FIFO)</h1>
          <p className="text-sm text-slate-500">
            Alokasi pelunasan otomatis ke invoice terlama (FIFO), mendukung cicilan, edit/hapus baris, dan potongan admin bank.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => openCreate('in')}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" />
            Terima Piutang (Customer)
          </button>
          <button
            onClick={() => openCreate('out')}
            className="flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700"
          >
            <Plus className="h-4 w-4" />
            Bayar Hutang (Supplier)
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'all', label: 'Semua Pembayaran' },
            { id: 'in', label: 'Penerimaan Piutang (In)' },
            { id: 'out', label: 'Pembayaran Hutang (Out)' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setFilterType(t.id as any);
                setFilterPartnerKey('');
              }}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold ${
                filterType === t.id ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex w-full items-center gap-2 sm:w-80">
          <Filter className="h-4 w-4 flex-shrink-0 text-slate-400" />
          <div className="flex-1">
            <SearchableSelect
              compact
              options={partnerFilterOptions}
              value={filterPartnerKey}
              onChange={(val) => setFilterPartnerKey(String(val || ''))}
              placeholder="-- Filter Customer / Supplier --"
              searchPlaceholder="Cari nama / kode partner..."
            />
          </div>
          {filterPartnerKey && (
            <button
              type="button"
              onClick={() => setFilterPartnerKey('')}
              className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-600">
              <tr>
                <th className="px-4 py-3">No. Bukti</th>
                <th className="px-4 py-3">Tanggal</th>
                <th className="px-4 py-3">Jenis</th>
                <th className="px-4 py-3">Customer / Supplier</th>
                <th className="px-4 py-3 text-right">Total Pelunasan</th>
                <th className="px-4 py-3 text-right">Potongan Bank</th>
                <th className="px-4 py-3 text-right">Kas Netto</th>
                <th className="px-4 py-3">Keterangan</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedPayments.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                    Belum ada data pelunasan yang sesuai filter.
                  </td>
                </tr>
              ) : (
                paginatedPayments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-900">{p.no}</td>
                    <td className="px-4 py-3 text-slate-600">{p.tgl}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          p.type === 'in' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                        }`}
                      >
                        {p.type === 'in' ? 'Piutang Masuk' : 'Hutang Keluar'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {p.type === 'in' ? p.customer_nama || '-' : p.supplier_nama || '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">{formatRupiah(p.total)}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{formatRupiah(p.deduction)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-700">{formatRupiah(p.received)}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 max-w-xs truncate">{p.keterangan || '-'}</td>
                    <td className="px-4 py-3 text-right space-x-1">
                      <button onClick={() => openEdit(p.id!)} title="Edit Alokasi" className="p-1.5 text-slate-600 hover:text-amber-600">
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDelete(p.id!)} title="Hapus" className="p-1.5 text-slate-600 hover:text-rose-600">
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
          totalItems={filteredPayments.length}
          currentPage={currentPage}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          itemLabel="pembayaran"
        />
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <form onSubmit={handleSave} className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="text-lg font-bold">
                {editingId ? 'Edit' : 'Input'}{' '}
                {form.type === 'in' ? 'Penerimaan Pelunasan Piutang (Customer)' : 'Pembayaran Pelunasan Hutang (Supplier)'}
              </h2>
              <button type="button" onClick={() => setModalOpen(false)}>
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5 text-sm">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block font-medium">No. Bukti Pembayaran *</label>
                  <input
                    type="text"
                    required
                    value={form.no}
                    onChange={(e) => setForm({ ...form, no: e.target.value })}
                    className="w-full rounded-lg border px-3 py-2 font-mono"
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
                    {form.type === 'in' ? 'Customer *' : 'Supplier *'}
                  </label>
                  {form.type === 'in' ? (
                    <SearchableSelect
                      required
                      options={customerOptions}
                      value={form.cust_id}
                      onChange={(val) => handlePartnerChange(Number(val) || null)}
                      placeholder="-- Pilih Customer --"
                      searchPlaceholder="Cari kode / nama customer..."
                    />
                  ) : (
                    <SearchableSelect
                      required
                      options={supplierOptions}
                      value={form.supp_id}
                      onChange={(val) => handlePartnerChange(Number(val) || null)}
                      placeholder="-- Pilih Supplier --"
                      searchPlaceholder="Cari kode / nama supplier..."
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 rounded-xl border border-blue-100 bg-blue-50/50 p-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Nominal Pelunasan (Rp)
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={form.total}
                      onChange={(e) => handleTotalPelunasanChange(Number(e.target.value))}
                      className="w-full rounded-lg border bg-white px-3 py-2 text-right font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => applyFifoAllocation(Number(form.total))}
                      title="Hitung Alokasi FIFO Otomatis ke Invoice Terlama"
                      className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                    >
                      <Wand2 className="h-3.5 w-3.5" />
                      FIFO
                    </button>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Potongan Biaya Admin Bank (Rp)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={form.deduction}
                    onChange={(e) => handleDeductionChange(Number(e.target.value))}
                    className="w-full rounded-lg border bg-white px-3 py-2 text-right"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Keterangan / Rekening</label>
                  <input
                    type="text"
                    value={form.keterangan}
                    onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
                    placeholder="Transfer BCA / Mandiri..."
                    className="w-full rounded-lg border bg-white px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-800">Rincian Alokasi ke Invoice (Urutan FIFO)</h3>
                    <p className="text-xs text-slate-500">
                      Anda dapat menambah, menghapus, atau mengubah nominal pelunasan per baris invoice secara manual.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addManualAllocationRow}
                    className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                  >
                    + Tambah Baris Invoice
                  </button>
                </div>

                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b bg-slate-50 text-slate-600">
                      <tr>
                        <th className="p-2.5">Nomor Invoice</th>
                        <th className="p-2.5">Tanggal Inv</th>
                        <th className="p-2.5 text-right">Total Tagihan</th>
                        <th className="p-2.5 text-right">Sisa Sebelum</th>
                        <th className="p-2.5 w-40 text-right">Nominal Dilunasi</th>
                        <th className="p-2.5 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {(form.details || []).length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-6 text-center text-slate-400">
                            Pilih Partner lalu masukkan nominal dan klik tombol <strong>FIFO</strong>, atau klik <strong>+ Tambah Baris Invoice</strong>.
                          </td>
                        </tr>
                      ) : (
                        (form.details || []).map((row, idx) => (
                          <tr key={idx}>
                            <td className="p-2">
                              <select
                                value={row.invoice_id}
                                onChange={(e) => updateAllocationRow(idx, { invoice_id: Number(e.target.value) })}
                                className="w-full rounded border px-2 py-1.5 font-mono"
                              >
                                {partnerInvoices.map((inv) => {
                                  const grand = Number(inv.total || 0) + Number(inv.ongkir || 0);
                                  const sisa = Math.max(0, grand - Number(inv.paid || 0));
                                  return (
                                    <option key={inv.id} value={inv.id}>
                                      {inv.no} ({inv.tgl}) - Sisa: {formatRupiah(sisa)}
                                    </option>
                                  );
                                })}
                              </select>
                            </td>
                            <td className="p-2 text-slate-600">{row.invoice_tgl || '-'}</td>
                            <td className="p-2 text-right text-slate-600">{formatRupiah(row.invoice_total_tagihan || 0)}</td>
                            <td className="p-2 text-right text-amber-700 font-medium">{formatRupiah(row.invoice_sisa || 0)}</td>
                            <td className="p-2">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={row.subtotal}
                                onChange={(e) => updateAllocationRow(idx, { subtotal: Number(e.target.value) })}
                                className="w-full rounded border px-2 py-1.5 text-right font-bold text-emerald-700"
                              />
                            </td>
                            <td className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() => removeAllocationRow(idx)}
                                className="text-rose-500 hover:text-rose-700"
                              >
                                &times;
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-end gap-6 rounded-lg bg-slate-50 px-4 py-2.5 text-xs">
                  <div>
                    Total Teralokasi ke Invoice:{' '}
                    <strong className="text-sm text-slate-900">{formatRupiah(totalTeralokasi)}</strong>
                  </div>
                  <div>
                    Potongan Bank: <strong className="text-rose-600">{formatRupiah(form.deduction)}</strong>
                  </div>
                  <div>
                    Kas Netto {form.type === 'in' ? 'Diterima' : 'Dibayarkan'}:{' '}
                    <strong className="text-sm text-emerald-700">{formatRupiah(netDiterimaDibayar)}</strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t px-6 py-3.5">
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border px-4 py-2 text-sm">
                Batal
              </button>
              <button type="submit" className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700">
                Simpan Pelunasan
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
