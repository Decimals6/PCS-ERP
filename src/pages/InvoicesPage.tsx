import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus,
  Printer,
  Upload,
  Edit2,
  Trash2,
  X,
  FileText,
  ChevronDown,
  ChevronRight,
  Check,
  Layers,
  List,
  Wallet,
  Filter,
} from 'lucide-react';
import {
  Barang,
  Customer,
  DeliveryNote,
  Invoice,
  InvoiceDetail,
  PaymentPrefillDraft,
  Supplier,
} from '../../shared/types';
import { formatRupiah, generateDocNumber, todayIso } from '../utils/format';
import { PdfPreviewModal } from '../components/PdfPreviewModal';
import { SearchableSelect } from '../components/SearchableSelect';
import { PaginationBar } from '../components/PaginationBar';
import { compareStringsNatural, SortableTh, SortConfig, toggleSort } from '../components/SortableTh';

interface InvoicesPageProps {
  onPayInvoices?: (draft: PaymentPrefillDraft) => void;
  onDataChanged?: () => void;
}

interface PartnerGroup {
  key: string;
  type: 'in' | 'out';
  partnerId: number | null;
  partnerName: string;
  invoices: Invoice[];
  totalGrand: number;
  totalPaid: number;
  totalSisa: number;
  unpaidInvoices: Invoice[];
}

interface DeliveryRefComboboxProps {
  value: string;
  options: DeliveryNote[];
  usedNos: string[];
  onChangeText: (val: string) => void;
  onSelectExisting: (dnNo: string) => void;
  onRemove: () => void;
}

const DeliveryRefCombobox: React.FC<DeliveryRefComboboxProps> = ({
  value,
  options,
  usedNos,
  onChangeText,
  onSelectExisting,
  onRemove,
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const q = value.trim().toLowerCase();
  const filtered = options.filter((dn) => {
    if (!q) return true;
    const haystack = `${dn.no} ${dn.tgl} ${dn.order_no || ''} ${dn.alamat_tujuan || ''} ${dn.keterangan || ''}`.toLowerCase();
    return haystack.includes(q);
  });

  return (
    <div ref={containerRef} className="relative flex items-center gap-1.5">
      <div className="relative flex-1">
        <input
          type="text"
          value={value}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            onChangeText(e.target.value);
            setOpen(true);
          }}
          placeholder="Ketik manual atau pilih dari daftar Surat Jalan..."
          className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-3 pr-8 font-mono text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          title="Lihat daftar Surat Jalan"
          className="absolute inset-y-0 right-0 flex items-center px-2 text-slate-400 hover:text-slate-600"
        >
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div className="absolute left-0 z-50 mt-1 w-full min-w-[300px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
            <div className="border-b border-slate-100 bg-slate-50 px-3 py-1.5 text-[11px] font-medium text-slate-500">
              Pilih Surat Jalan tersimpan (otomatis isi item &amp; harga PO/SO) atau lanjut ketik manual
            </div>
            <div className="max-h-52 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <div className="px-3 py-2.5 text-center text-xs text-slate-400">
                  Tidak ada Surat Jalan yang cocok - nomor manual tetap dapat disimpan
                </div>
              ) : (
                filtered.map((dn) => {
                  const isAlreadyUsed = usedNos.includes(dn.no) && dn.no !== value;
                  const isCurrent = dn.no === value;
                  return (
                    <button
                      key={dn.id}
                      type="button"
                      onClick={() => {
                        onSelectExisting(dn.no);
                        setOpen(false);
                      }}
                      className={`flex w-full items-start justify-between gap-2 px-3 py-2 text-left text-xs transition-colors ${
                        isCurrent
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 font-mono font-semibold">
                          <span>{dn.no}</span>
                          {isAlreadyUsed && (
                            <span className="rounded bg-amber-100 px-1.5 py-0.5 font-sans text-[10px] font-medium text-amber-700">
                              Sudah dipilih
                            </span>
                          )}
                        </div>
                        <div className="truncate text-[11px] text-slate-500">
                          Tgl: {dn.tgl}
                          {dn.order_no ? ` | Order: ${dn.order_no}` : ''}
                          {dn.alamat_tujuan ? ` | ${dn.alamat_tujuan}` : ''}
                        </div>
                      </div>
                      {isCurrent && <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-blue-600" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onRemove}
        title="Hapus referensi Surat Jalan ini"
        className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};

function parseDeliveryNoteRefs(raw: string): string[] {
  return String(raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export const InvoicesPage: React.FC<InvoicesPageProps> = ({ onPayInvoices, onDataChanged }) => {
  const [filterType, setFilterType] = useState<'all' | 'in' | 'out'>('all');
  const [filterPartnerKey, setFilterPartnerKey] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'unpaid' | 'paid'>('all');
  const [sortConfig, setSortConfig] = useState<SortConfig<'no' | 'tgl' | 'grand' | 'paid' | 'sisa'> | null>({
    key: 'tgl',
    direction: 'desc',
  });
  const [viewMode, setViewMode] = useState<'flat' | 'grouped'>('flat');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Multi-select invoice IDs untuk pelunasan gabungan
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [barangList, setBarangList] = useState<Barang[]>([]);
  const [customerList, setCustomerList] = useState<Customer[]>([]);
  const [supplierList, setSupplierList] = useState<Supplier[]>([]);
  const [deliveryNotesList, setDeliveryNotesList] = useState<DeliveryNote[]>([]);
  const [defaultPpn, setDefaultPpn] = useState<number>(11);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isLunas, setIsLunas] = useState<boolean>(false);
  const [deliveryNoteRefs, setDeliveryNoteRefs] = useState<string[]>([]);
  const [form, setForm] = useState<Invoice>({
    no: '',
    tgl: todayIso(),
    type: 'out',
    order_no: '',
    delivery_note_no: '',
    dpp: 0,
    ppn: 11,
    ppn_nominal: 0,
    cust_id: null,
    supp_id: null,
    diskon: 0,
    ongkir: 0,
    total: 0,
    paid: 0,
    fully_paid: null,
    status: 'Belum Lunas',
    details: [],
  });

  const [previewId, setPreviewId] = useState<number | null>(null);

  const loadData = async () => {
    const [inv, b, c, s, dns, cfg] = await Promise.all([
      window.api.listInvoices(filterType === 'all' ? undefined : filterType),
      window.api.listBarang(),
      window.api.listCustomer(),
      window.api.listSupplier(),
      window.api.listDeliveryNotes(),
      window.api.getAppSettings(),
    ]);
    setInvoices(inv);
    setBarangList(b);
    setCustomerList(c);
    setSupplierList(s);
    setDeliveryNotesList(dns);
    setDefaultPpn(Number(cfg.default_ppn || 11));
  };

  useEffect(() => {
    loadData();
  }, [filterType]);

  // Reset halaman & seleksi jika filter berubah
  useEffect(() => {
    setCurrentPage(1);
  }, [filterType, filterPartnerKey, filterStatus, viewMode, sortConfig]);

  // Filter opsi partner sesuai tab jenis invoice yang aktif
  const partnerFilterOptions = useMemo(() => {
    const opts: Array<{ value: string; label: string; sublabel?: string; searchText: string }> = [
      { value: '', label: '-- Semua Customer / Supplier --', searchText: 'semua all' },
    ];
    if (filterType === 'all' || filterType === 'out') {
      for (const c of customerList) {
        opts.push({
          value: `out-${c.id}`,
          label: `${filterType === 'all' ? '[Customer] ' : ''}${c.kode ? `[${c.kode}] ` : ''}${c.nama}`,
          sublabel: [c.telepon, c.alamat].filter(Boolean).join(' | ') || undefined,
          searchText: `customer ${c.kode || ''} ${c.nama} ${c.telepon || ''}`,
        });
      }
    }
    if (filterType === 'all' || filterType === 'in') {
      for (const s of supplierList) {
        opts.push({
          value: `in-${s.id}`,
          label: `${filterType === 'all' ? '[Supplier] ' : ''}${s.kode ? `[${s.kode}] ` : ''}${s.nama}`,
          sublabel: [s.telepon, s.alamat].filter(Boolean).join(' | ') || undefined,
          searchText: `supplier ${s.kode || ''} ${s.nama} ${s.telepon || ''}`,
        });
      }
    }
    return opts;
  }, [filterType, customerList, supplierList]);

  // Terapkan filter Partner & Status di sisi UI
  const filteredInvoices = useMemo(() => {
    const filtered = invoices.filter((inv) => {
      if (filterPartnerKey) {
        const invKey = inv.type === 'out' ? `out-${inv.cust_id ?? 0}` : `in-${inv.supp_id ?? 0}`;
        if (invKey !== filterPartnerKey) return false;
      }
      const grand = Number(inv.total || 0) + Number(inv.ongkir || 0);
      const sisa = Math.max(0, grand - Number(inv.paid || 0));
      const isPaid = inv.fully_paid === 1 || inv.status === 'Lunas' || sisa <= 0.01;
      if (filterStatus === 'unpaid' && isPaid) return false;
      if (filterStatus === 'paid' && !isPaid) return false;
      return true;
    });

    if (!sortConfig) return filtered;
    const factor = sortConfig.direction === 'asc' ? 1 : -1;

    return [...filtered].sort((a, b) => {
      const grandA = Number(a.total || 0) + Number(a.ongkir || 0);
      const grandB = Number(b.total || 0) + Number(b.ongkir || 0);
      const paidA = Number(a.paid || 0);
      const paidB = Number(b.paid || 0);
      const sisaA = Math.max(0, grandA - paidA);
      const sisaB = Math.max(0, grandB - paidB);

      let cmp = 0;
      switch (sortConfig.key) {
        case 'no':
          cmp = compareStringsNatural(a.no, b.no);
          break;
        case 'tgl':
          cmp = String(a.tgl || '').localeCompare(String(b.tgl || ''));
          break;
        case 'grand':
          cmp = grandA - grandB;
          break;
        case 'paid':
          cmp = paidA - paidB;
          break;
        case 'sisa':
          cmp = sisaA - sisaB;
          break;
      }
      if (cmp === 0) {
        cmp = Number(a.id || 0) - Number(b.id || 0);
      }
      return cmp * factor;
    });
  }, [invoices, filterPartnerKey, filterStatus, sortConfig]);

  // Kelompokkan per Customer / Supplier untuk mode Layered List
  const partnerGroups = useMemo<PartnerGroup[]>(() => {
    const map = new Map<string, PartnerGroup>();
    for (const inv of filteredInvoices) {
      const partnerId = inv.type === 'out' ? inv.cust_id : inv.supp_id;
      const key = `${inv.type}-${partnerId ?? 0}`;
      const partnerName =
        inv.type === 'out'
          ? inv.customer_nama || 'Customer Tanpa Nama'
          : inv.supplier_nama || 'Supplier Tanpa Nama';
      const grand = Number(inv.total || 0) + Number(inv.ongkir || 0);
      const paid = Number(inv.paid || 0);
      const sisa = Math.max(0, grand - paid);
      const isUnpaid = inv.fully_paid !== 1 && inv.status !== 'Lunas' && sisa > 0.01;

      let group = map.get(key);
      if (!group) {
        group = {
          key,
          type: inv.type,
          partnerId,
          partnerName,
          invoices: [],
          totalGrand: 0,
          totalPaid: 0,
          totalSisa: 0,
          unpaidInvoices: [],
        };
        map.set(key, group);
      }
      group.invoices.push(inv);
      group.totalGrand += grand;
      group.totalPaid += paid;
      group.totalSisa += sisa;
      if (isUnpaid) group.unpaidInvoices.push(inv);
    }
    return Array.from(map.values()).sort((a, b) => b.totalSisa - a.totalSisa);
  }, [filteredInvoices]);

  // Pagination slicing (flat rows atau partner groups)
  const paginatedFlatInvoices = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredInvoices.slice(start, start + pageSize);
  }, [filteredInvoices, currentPage, pageSize]);

  const paginatedGroups = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return partnerGroups.slice(start, start + pageSize);
  }, [partnerGroups, currentPage, pageSize]);

  // Konteks seleksi checkbox (terkunci ke 1 partner & 1 jenis transaksi)
  const selectedInvoices = useMemo(
    () => invoices.filter((inv) => inv.id && selectedIds.includes(inv.id)),
    [invoices, selectedIds]
  );

  const activeSelectionLock = useMemo(() => {
    if (selectedInvoices.length === 0) return null;
    const first = selectedInvoices[0];
    return {
      type: first.type,
      partnerId: first.type === 'out' ? first.cust_id : first.supp_id,
      partnerName: first.type === 'out' ? first.customer_nama || '-' : first.supplier_nama || '-',
    };
  }, [selectedInvoices]);

  const selectedTotalSisa = useMemo(() => {
    return selectedInvoices.reduce((sum, inv) => {
      const grand = Number(inv.total || 0) + Number(inv.ongkir || 0);
      return sum + Math.max(0, grand - Number(inv.paid || 0));
    }, 0);
  }, [selectedInvoices]);

  const canSelectInvoice = (inv: Invoice): boolean => {
    if (!inv.id) return false;
    const grand = Number(inv.total || 0) + Number(inv.ongkir || 0);
    const sisa = Math.max(0, grand - Number(inv.paid || 0));
    if (inv.fully_paid === 1 || inv.status === 'Lunas' || sisa <= 0.01) return false;
    const partnerId = inv.type === 'out' ? inv.cust_id : inv.supp_id;
    if (!partnerId) return false;
    if (!activeSelectionLock) return true;
    return inv.type === activeSelectionLock.type && partnerId === activeSelectionLock.partnerId;
  };

  const toggleSelectInvoice = (inv: Invoice) => {
    if (!inv.id) return;
    if (selectedIds.includes(inv.id)) {
      setSelectedIds((prev) => prev.filter((id) => id !== inv.id));
      return;
    }
    if (!canSelectInvoice(inv)) return;
    setSelectedIds((prev) => [...prev, inv.id!]);
  };

  const triggerPayForInvoices = (targetInvoices: Invoice[]) => {
    if (!onPayInvoices || targetInvoices.length === 0) return;
    const first = targetInvoices[0];
    const partnerId = first.type === 'out' ? first.cust_id : first.supp_id;
    if (!partnerId) {
      alert('Invoice ini belum memiliki data Customer / Supplier.');
      return;
    }
    // Invoice 'out' (Penjualan/Piutang) -> Payment 'in' (Terima Piutang)
    // Invoice 'in' (Pembelian/Hutang) -> Payment 'out' (Bayar Hutang)
    const payType = first.type === 'out' ? 'in' : 'out';
    onPayInvoices({
      type: payType,
      partnerId,
      invoices: targetInvoices,
    });
  };

  const recalcTotals = (draft: Invoice, lunasFlag = isLunas): Invoice => {
    const details = (draft.details || []).map((d) => {
      const qty = Number(d.qty || 0);
      const price = Number(d.price || 0);
      return { ...d, subtotal: qty * price };
    });
    const dpp = details.reduce((s, d) => s + d.subtotal, 0);
    const diskon = Number(draft.diskon || 0);
    const ppn = Number(draft.ppn || 0);
    const ongkir = Number(draft.ongkir || 0);
    const ppnNominal = Math.max(0, dpp - diskon) * (ppn / 100);
    const total = Math.max(0, dpp - diskon) + ppnNominal;
    const grandTagihan = total + ongkir;

    const paid = lunasFlag ? grandTagihan : Number(draft.paid || 0);
    const fully_paid = lunasFlag && grandTagihan > 0 ? 1 : null;
    const status = lunasFlag && grandTagihan > 0 ? 'Lunas' : paid > 0 ? 'Cicil' : 'Belum Lunas';

    return { ...draft, details, dpp, ppn_nominal: ppnNominal, total, paid, fully_paid, status };
  };

  const openCreate = (type: 'in' | 'out') => {
    setEditingId(null);
    setIsLunas(false);
    setDeliveryNoteRefs([]);
    const initial: Invoice = {
      no: generateDocNumber(type === 'out' ? 'INV-J' : 'INV-B'),
      tgl: todayIso(),
      type,
      order_no: '',
      delivery_note_no: '',
      dpp: 0,
      ppn: defaultPpn,
      ppn_nominal: 0,
      cust_id: null,
      supp_id: null,
      diskon: 0,
      ongkir: 0,
      total: 0,
      paid: 0,
      fully_paid: null,
      status: 'Belum Lunas',
      details: [{ barang_id: barangList[0]?.id || 0, qty: 1, satuan: barangList[0]?.satuan || 'PCS', price: 0, subtotal: 0 }],
    };
    setForm(recalcTotals(initial, false));
    setModalOpen(true);
  };

  const openEdit = async (id: number) => {
    const full = await window.api.getInvoiceById(id);
    if (!full) return;
    const lunasFlag = full.fully_paid === 1 || full.status === 'Lunas';
    setEditingId(id);
    setIsLunas(lunasFlag);
    setDeliveryNoteRefs(parseDeliveryNoteRefs(full.delivery_note_no));
    setForm(recalcTotals(full, lunasFlag));
    setModalOpen(true);
  };

  const handlePaymentStatusChange = (lunasFlag: boolean) => {
    setIsLunas(lunasFlag);
    setForm((prev) => recalcTotals({ ...prev, paid: lunasFlag ? prev.paid : 0 }, lunasFlag));
  };

  const syncDeliveryRefsToForm = (refs: string[], currentForm: Invoice): Invoice => {
    const joined = refs
      .map((r) => r.trim())
      .filter(Boolean)
      .join(', ');
    return { ...currentForm, delivery_note_no: joined };
  };

  const handleAddDeliveryRef = () => {
    setDeliveryNoteRefs((prev) => [...prev, '']);
  };

  const handleChangeDeliveryRefText = (idx: number, val: string) => {
    const nextRefs = [...deliveryNoteRefs];
    nextRefs[idx] = val;
    setDeliveryNoteRefs(nextRefs);
    setForm((prev) => syncDeliveryRefsToForm(nextRefs, prev));
  };

  const handleRemoveDeliveryRef = (idx: number) => {
    const nextRefs = deliveryNoteRefs.filter((_, i) => i !== idx);
    setDeliveryNoteRefs(nextRefs);
    setForm((prev) => syncDeliveryRefsToForm(nextRefs, prev));
  };

  const handleSelectExistingDeliveryNote = async (idx: number, dnNo: string) => {
    const nextRefs = [...deliveryNoteRefs];
    nextRefs[idx] = dnNo;
    setDeliveryNoteRefs(nextRefs);

    const fetched = await window.api.getDeliveryNoteForInvoice(dnNo);
    setForm((prev) => {
      let updated = syncDeliveryRefsToForm(nextRefs, prev);
      if (!fetched) return updated;

      const { delivery_note, order, items } = fetched;

      const refOrderNo = (delivery_note.order_no || order?.no || '').trim();
      if (refOrderNo) {
        const existingOrders = updated.order_no
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        if (!existingOrders.includes(refOrderNo)) {
          updated.order_no = [...existingOrders, refOrderNo].join(', ');
        }
      }

      if (order) {
        if (updated.type === 'out' && !updated.cust_id && order.cust_id) {
          updated.cust_id = order.cust_id;
        }
        if (updated.type === 'in' && !updated.supp_id && order.supp_id) {
          updated.supp_id = order.supp_id;
        }
        if (order.ppn !== undefined && order.ppn !== null) {
          updated.ppn = Number(order.ppn);
        }
      }

      if (items.length > 0) {
        const currentDetails = (updated.details || []).filter(
          (d) => !(Number(d.price || 0) === 0 && Number(d.qty || 0) <= 1)
        );

        const incomingDetails: InvoiceDetail[] = items.map((it: any) => ({
          barang_id: it.barang_id,
          qty: Number(it.qty || 0),
          satuan: it.satuan || 'PCS',
          price: Number(it.price || 0),
          subtotal: Number(it.qty || 0) * Number(it.price || 0),
        }));

        updated = { ...updated, details: [...currentDetails, ...incomingDetails] };
      }

      return recalcTotals(updated);
    });
  };

  const handleImportTransferJson = async () => {
    try {
      const payload = await window.api.importTransferJson();
      if (!payload) return;

      const docType: 'in' | 'out' = payload.header.type === 'in' ? 'in' : 'out';
      let custId: number | null = null;
      let suppId: number | null = null;

      const partnerInfo = payload.partner;
      if (partnerInfo) {
        if (docType === 'out') {
          const found = customerList.find(
            (c) => (partnerInfo.kode && c.kode === partnerInfo.kode) || c.nama === partnerInfo.nama
          );
          if (found) custId = found.id!;
        } else {
          const found = supplierList.find(
            (s) => (partnerInfo.kode && s.kode === partnerInfo.kode) || s.nama === partnerInfo.nama
          );
          if (found) suppId = found.id!;
        }
      }

      const mappedDetails: InvoiceDetail[] = payload.items.map((it) => {
        const matchedBarang = barangList.find(
          (b) => (it.barang_kode && b.kode === it.barang_kode) || b.nama === it.barang_nama
        );
        const qty = Number(it.qty || 0);
        const price = Number(it.price || 0);
        return {
          barang_id: matchedBarang?.id || 0,
          qty,
          satuan: it.satuan || matchedBarang?.satuan || 'PCS',
          price,
          subtotal: qty * price,
        };
      });

      const initialDnNo = payload.doc_kind === 'DELIVERY_NOTE' ? payload.header.no || '' : '';
      setEditingId(null);
      setIsLunas(false);
      setDeliveryNoteRefs(parseDeliveryNoteRefs(initialDnNo));
      const importedDraft: Invoice = {
        no: generateDocNumber(docType === 'out' ? 'INV-J' : 'INV-B'),
        tgl: todayIso(),
        type: docType,
        order_no: payload.doc_kind === 'ORDER' ? payload.header.no || '' : payload.header.order_no || '',
        delivery_note_no: initialDnNo,
        dpp: 0,
        ppn: payload.header.ppn !== undefined ? Number(payload.header.ppn) : defaultPpn,
        ppn_nominal: 0,
        cust_id: custId,
        supp_id: suppId,
        diskon: Number(payload.header.diskon || 0),
        ongkir: Number(payload.header.ongkir || 0),
        total: 0,
        paid: 0,
        fully_paid: null,
        status: 'Belum Lunas',
        details: mappedDetails,
      };

      setForm(recalcTotals(importedDraft, false));
      setModalOpen(true);
    } catch (err: any) {
      alert('Gagal membaca file transfer JSON: ' + (err?.message || err));
    }
  };

  const updateItem = (idx: number, patch: Partial<InvoiceDetail>) => {
    const next = [...(form.details || [])];
    const curr = { ...next[idx], ...patch };
    if (patch.barang_id !== undefined) {
      const b = barangList.find((x) => x.id === Number(patch.barang_id));
      if (b) curr.satuan = b.satuan || 'PCS';
    }
    next[idx] = curr;
    setForm(recalcTotals({ ...form, details: next }));
  };

  const addItem = () => {
    const b = barangList[0];
    setForm(
      recalcTotals({
        ...form,
        details: [
          ...(form.details || []),
          { barang_id: b?.id || 0, qty: 1, satuan: b?.satuan || 'PCS', price: 0, subtotal: 0 },
        ],
      })
    );
  };

  const removeItem = (idx: number) => {
    setForm(recalcTotals({ ...form, details: (form.details || []).filter((_, i) => i !== idx) }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const valid = (form.details || []).filter((d) => Number(d.barang_id) > 0 && Number(d.qty) > 0);
    if (valid.length === 0) {
      alert('Minimal harus ada 1 item barang yang valid.');
      return;
    }
    const syncedForm = syncDeliveryRefsToForm(deliveryNoteRefs, form);
    const payload = recalcTotals({ ...syncedForm, details: valid }, isLunas);
    if (editingId) await window.api.updateInvoice(editingId, payload);
    else await window.api.createInvoice(payload);
    setModalOpen(false);
    await loadData();
    onDataChanged?.();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Hapus dokumen Invoice ini?')) return;
    await window.api.deleteInvoice(id);
    setSelectedIds((prev) => prev.filter((x) => x !== id));
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

  const barangOptions = barangList.map((b) => ({
    value: b.id,
    label: `${b.kode ? `[${b.kode}] ` : ''}${b.nama}`,
    sublabel: `${b.part_number ? `Part No: ${b.part_number} | ` : ''}Stok: ${b.stock} ${b.satuan}`,
    searchText: `${b.kode || ''} ${b.part_number || ''} ${b.nama}`,
  }));

  const filteredDeliveryNotes = deliveryNotesList.filter((dn) => dn.type === form.type);
  const grandTagihan = Number(form.total || 0) + Number(form.ongkir || 0);

  const renderInvoiceRow = (inv: Invoice, hidePartnerColumn = false) => {
    const grand = Number(inv.total || 0) + Number(inv.ongkir || 0);
    const sisa = Math.max(0, grand - Number(inv.paid || 0));
    const isPaid = inv.fully_paid === 1 || inv.status === 'Lunas' || sisa <= 0.01;
    const isChecked = inv.id ? selectedIds.includes(inv.id) : false;
    const selectable = canSelectInvoice(inv);

    return (
      <tr
        key={inv.id}
        className={`transition-colors ${isChecked ? 'bg-blue-50/70' : 'hover:bg-slate-50'}`}
      >
        <td className="w-10 px-3 py-3 text-center">
          <input
            type="checkbox"
            checked={isChecked}
            disabled={!selectable && !isChecked}
            onChange={() => toggleSelectInvoice(inv)}
            title={
              isPaid
                ? 'Invoice sudah lunas'
                : !selectable && !isChecked
                  ? 'Kosongkan pilihan partner lain terlebih dahulu'
                  : 'Pilih invoice untuk dilunasi'
            }
            className="h-4 w-4 cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-30"
          />
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          <div className="font-mono text-xs font-semibold text-slate-900">{inv.no}</div>
          <div className="text-[11px] text-slate-400">
            {inv.type === 'out' ? 'Piutang' : 'Hutang'}
            {inv.order_no ? ` | Ref: ${inv.order_no}` : ''}
            {inv.delivery_note_no ? ` | SJ: ${inv.delivery_note_no}` : ''}
          </div>
        </td>
        <td className="px-4 py-3 whitespace-nowrap text-slate-600">{inv.tgl}</td>
        {!hidePartnerColumn && (
          <td className="px-4 py-3 font-medium text-slate-800">
            {inv.type === 'out' ? inv.customer_nama || '-' : inv.supplier_nama || '-'}
          </td>
        )}
        <td className="px-4 py-3 whitespace-nowrap text-right font-semibold text-slate-900">{formatRupiah(grand)}</td>
        <td className="px-4 py-3 whitespace-nowrap text-right text-emerald-700">{formatRupiah(inv.paid)}</td>
        <td className="px-4 py-3 whitespace-nowrap text-right font-bold text-rose-600">{formatRupiah(sisa)}</td>
        <td className="px-4 py-3 whitespace-nowrap">
          <span
            className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              inv.status === 'Lunas'
                ? 'bg-emerald-100 text-emerald-700'
                : inv.status === 'Cicil'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-rose-100 text-rose-700'
            }`}
          >
            {inv.status}
          </span>
        </td>
        <td className="px-4 py-3 text-right whitespace-nowrap space-x-1">
          {!isPaid && onPayInvoices && (
            <button
              onClick={() => triggerPayForInvoices([inv])}
              title={inv.type === 'out' ? 'Terima Pelunasan Piutang Ini' : 'Bayar Hutang Invoice Ini'}
              className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
            >
              <Wallet className="h-3.5 w-3.5" />
              Bayar
            </button>
          )}
          {inv.type === 'out' && (
            <button
              onClick={() => setPreviewId(inv.id!)}
              title="Cetak / Preview Faktur Penjualan"
              className="p-1.5 text-slate-600 hover:text-blue-600"
            >
              <Printer className="h-4 w-4" />
            </button>
          )}
          <button onClick={() => openEdit(inv.id!)} title="Edit" className="p-1.5 text-slate-600 hover:text-amber-600">
            <Edit2 className="h-4 w-4" />
          </button>
          <button onClick={() => handleDelete(inv.id!)} title="Hapus" className="p-1.5 text-slate-600 hover:text-rose-600">
            <Trash2 className="h-4 w-4" />
          </button>
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-5 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Invoice (Piutang &amp; Hutang)</h1>
          <p className="text-sm text-slate-500">
            Kelola tagihan penjualan/pembelian, kelompokkan per Customer/Supplier, dan lunasi satu atau beberapa invoice sekaligus.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleImportTransferJson}
            className="flex items-center gap-2 rounded-lg border border-emerald-600 bg-emerald-50 px-3.5 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
          >
            <Upload className="h-4 w-4" />
            Import JSON Gudang
          </button>
          <button
            onClick={() => openCreate('out')}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Invoice Penjualan (Out)
          </button>
          <button
            onClick={() => openCreate('in')}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            Invoice Pembelian (In)
          </button>
        </div>
      </div>

      {/* Tab Jenis Invoice */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'all', label: 'Semua Invoice' },
            { id: 'out', label: 'Invoice Penjualan / Piutang (Out)' },
            { id: 'in', label: 'Invoice Pembelian / Hutang (In)' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setFilterType(t.id as any);
                setFilterPartnerKey('');
                setSelectedIds([]);
              }}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                filterType === t.id ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Mode Tampilan: Tabel Datar vs Kelompok per Partner */}
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
          <button
            type="button"
            onClick={() => setViewMode('flat')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              viewMode === 'flat' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <List className="h-3.5 w-3.5" />
            Daftar Tabel
          </button>
          <button
            type="button"
            onClick={() => setViewMode('grouped')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              viewMode === 'grouped' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            Grup per Partner ({partnerGroups.length})
          </button>
        </div>
      </div>

      {/* Sub-Filter: Customer/Supplier & Status Tagihan */}
      <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm sm:grid-cols-12">
        <div className="flex items-center gap-2 sm:col-span-6">
          <Filter className="h-4 w-4 flex-shrink-0 text-slate-400" />
          <div className="flex-1">
            <SearchableSelect
              compact
              options={partnerFilterOptions}
              value={filterPartnerKey}
              onChange={(val) => {
                setFilterPartnerKey(String(val || ''));
                setSelectedIds([]);
              }}
              placeholder="-- Filter Customer / Supplier --"
              searchPlaceholder="Cari nama atau kode Customer / Supplier..."
            />
          </div>
          {filterPartnerKey && (
            <button
              type="button"
              onClick={() => {
                setFilterPartnerKey('');
                setSelectedIds([]);
              }}
              className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              Reset
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-1.5 sm:col-span-6">
          {[
            { id: 'all', label: 'Semua Status' },
            { id: 'unpaid', label: 'Belum Lunas & Cicil' },
            { id: 'paid', label: 'Sudah Lunas' },
          ].map((st) => (
            <button
              key={st.id}
              type="button"
              onClick={() => setFilterStatus(st.id as any)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                filterStatus === st.id
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* MODE 1: DAFTAR TABEL BIASA */}
      {viewMode === 'flat' ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-600">
                <tr>
                  <th className="w-10 px-3 py-3 text-center whitespace-nowrap">Pilih</th>
                  <SortableTh
                    label="No. Invoice"
                    sortKey="no"
                    sortConfig={sortConfig}
                    onSort={(k) => setSortConfig((prev) => toggleSort(prev, k))}
                    className="whitespace-nowrap"
                  />
                  <SortableTh
                    label="Tanggal"
                    sortKey="tgl"
                    sortConfig={sortConfig}
                    onSort={(k) => setSortConfig((prev) => toggleSort(prev, k))}
                    className="whitespace-nowrap"
                  />
                  <th className="px-4 py-3">Partner</th>
                  <SortableTh
                    label="Total + Ongkir"
                    sortKey="grand"
                    sortConfig={sortConfig}
                    onSort={(k) => setSortConfig((prev) => toggleSort(prev, k))}
                    align="right"
                    className="whitespace-nowrap"
                  />
                  <SortableTh
                    label="Terbayar"
                    sortKey="paid"
                    sortConfig={sortConfig}
                    onSort={(k) => setSortConfig((prev) => toggleSort(prev, k))}
                    align="right"
                    className="whitespace-nowrap"
                  />
                  <SortableTh
                    label="Sisa Tagihan"
                    sortKey="sisa"
                    sortConfig={sortConfig}
                    onSort={(k) => setSortConfig((prev) => toggleSort(prev, k))}
                    align="right"
                    className="whitespace-nowrap"
                  />
                  <th className="px-4 py-3 whitespace-nowrap">Status</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedFlatInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                      Tidak ada dokumen Invoice yang sesuai dengan filter.
                    </td>
                  </tr>
                ) : (
                  paginatedFlatInvoices.map((inv) => renderInvoiceRow(inv, false))
                )}
              </tbody>
            </table>
          </div>
          <PaginationBar
            totalItems={filteredInvoices.length}
            currentPage={currentPage}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            itemLabel="invoice"
          />
        </div>
      ) : (
        /* MODE 2: LAYERED LIST / KELOMPOK PER CUSTOMER / SUPPLIER */
        <div className="space-y-4">
          {paginatedGroups.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-400 shadow-sm">
              Tidak ada kelompok tagihan yang sesuai dengan filter.
            </div>
          ) : (
            paginatedGroups.map((grp) => {
              const isCollapsed = !!collapsedGroups[grp.key];
              const allUnpaidSelected =
                grp.unpaidInvoices.length > 0 &&
                grp.unpaidInvoices.every((inv) => inv.id && selectedIds.includes(inv.id));
              const canSelectGroup =
                grp.unpaidInvoices.length > 0 &&
                (!activeSelectionLock ||
                  (activeSelectionLock.type === grp.type &&
                    activeSelectionLock.partnerId === grp.partnerId));

              return (
                <div
                  key={grp.key}
                  className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                >
                  {/* Header Layer Partner */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          setCollapsedGroups((prev) => ({ ...prev, [grp.key]: !prev[grp.key] }))
                        }
                        className="rounded-md p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-800"
                        title={isCollapsed ? 'Tampilkan rincian invoice' : 'Sembunyikan rincian invoice'}
                      >
                        {isCollapsed ? (
                          <ChevronRight className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                              grp.type === 'out'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-indigo-100 text-indigo-700'
                            }`}
                          >
                            {grp.type === 'out' ? 'Customer (Piutang)' : 'Supplier (Hutang)'}
                          </span>
                          <h3 className="text-base font-bold text-slate-900">{grp.partnerName}</h3>
                          <span className="text-xs text-slate-500">
                            ({grp.invoices.length} invoice)
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-4 text-xs text-slate-600">
                          <span>
                            Total Tagihan: <strong>{formatRupiah(grp.totalGrand)}</strong>
                          </span>
                          <span>
                            Sudah Dibayar:{' '}
                            <strong className="text-emerald-700">{formatRupiah(grp.totalPaid)}</strong>
                          </span>
                          <span>
                            Sisa {grp.type === 'out' ? 'Piutang' : 'Hutang'}:{' '}
                            <strong className="text-sm text-rose-600">
                              {formatRupiah(grp.totalSisa)}
                            </strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    {grp.unpaidInvoices.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={!canSelectGroup}
                          onClick={() => {
                            const grpIds = grp.unpaidInvoices
                              .map((i) => i.id!)
                              .filter(Boolean);
                            if (allUnpaidSelected) {
                              setSelectedIds((prev) => prev.filter((id) => !grpIds.includes(id)));
                            } else {
                              setSelectedIds(grpIds);
                            }
                          }}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {allUnpaidSelected
                            ? 'Batal Centang Semua'
                            : `Centang Semua Belum Lunas (${grp.unpaidInvoices.length})`}
                        </button>
                        {onPayInvoices && (
                          <button
                            type="button"
                            onClick={() => triggerPayForInvoices(grp.unpaidInvoices)}
                            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
                          >
                            <Wallet className="h-3.5 w-3.5" />
                            Lunasi Semua Sisa ({formatRupiah(grp.totalSisa)})
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Tabel Invoice Anak di Dalam Grup */}
                  {!isCollapsed && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-semibold uppercase text-slate-500">
                          <tr>
                            <th className="w-10 px-3 py-2.5 text-center whitespace-nowrap">Pilih</th>
                            <SortableTh
                              label="No. Invoice"
                              sortKey="no"
                              sortConfig={sortConfig}
                              onSort={(k) => setSortConfig((prev) => toggleSort(prev, k))}
                              className="py-2.5 whitespace-nowrap"
                            />
                            <SortableTh
                              label="Tanggal"
                              sortKey="tgl"
                              sortConfig={sortConfig}
                              onSort={(k) => setSortConfig((prev) => toggleSort(prev, k))}
                              className="py-2.5 whitespace-nowrap"
                            />
                            <SortableTh
                              label="Total + Ongkir"
                              sortKey="grand"
                              sortConfig={sortConfig}
                              onSort={(k) => setSortConfig((prev) => toggleSort(prev, k))}
                              align="right"
                              className="py-2.5 whitespace-nowrap"
                            />
                            <SortableTh
                              label="Terbayar"
                              sortKey="paid"
                              sortConfig={sortConfig}
                              onSort={(k) => setSortConfig((prev) => toggleSort(prev, k))}
                              align="right"
                              className="py-2.5 whitespace-nowrap"
                            />
                            <SortableTh
                              label="Sisa Tagihan"
                              sortKey="sisa"
                              sortConfig={sortConfig}
                              onSort={(k) => setSortConfig((prev) => toggleSort(prev, k))}
                              align="right"
                              className="py-2.5 whitespace-nowrap"
                            />
                            <th className="px-4 py-2.5 whitespace-nowrap">Status</th>
                            <th className="px-4 py-2.5 text-right whitespace-nowrap">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {grp.invoices.map((inv) => renderInvoiceRow(inv, true))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })
          )}

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <PaginationBar
              totalItems={partnerGroups.length}
              currentPage={currentPage}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
              itemLabel="partner"
            />
          </div>
        </div>
      )}

      {/* Floating Action Bar saat ada invoice dicentang */}
      {selectedInvoices.length > 0 && activeSelectionLock && (
        <div className="fixed bottom-5 left-1/2 z-40 flex w-[94%] max-w-3xl -translate-x-1/2 flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-slate-900 px-5 py-3.5 text-white shadow-2xl">
          <div>
            <div className="text-xs text-slate-300">
              {selectedInvoices.length} invoice terpilih &bull;{' '}
              <strong className="text-white">{activeSelectionLock.partnerName}</strong>
            </div>
            <div className="text-sm font-bold text-emerald-400">
              Total Sisa Tagihan: {formatRupiah(selectedTotalSisa)}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="rounded-lg border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
            >
              Batal Pilih
            </button>
            {onPayInvoices && (
              <button
                type="button"
                onClick={() => triggerPayForInvoices(selectedInvoices)}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400"
              >
                <Wallet className="h-4 w-4" />
                Bayar / Lunasi Terpilih
              </button>
            )}
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <form onSubmit={handleSave} className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="text-lg font-bold">
                {editingId ? 'Edit' : 'Buat'} {form.type === 'out' ? 'Invoice Penjualan (Piutang)' : 'Invoice Pembelian (Hutang)'}
              </h2>
              <button type="button" onClick={() => setModalOpen(false)}>
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5 text-sm">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block font-medium">Nomor Invoice *</label>
                  <input
                    type="text"
                    required
                    value={form.no}
                    onChange={(e) => setForm({ ...form, no: e.target.value })}
                    className="w-full rounded-lg border px-3 py-2 font-mono focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium">Tanggal Invoice *</label>
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
                <div>
                  <label className="mb-1 block font-medium">Ref. No. PO / SO</label>
                  <input
                    type="text"
                    value={form.order_no}
                    onChange={(e) => setForm({ ...form, order_no: e.target.value })}
                    placeholder="Otomatis terisi dari SJ atau ketik manual"
                    className="w-full rounded-lg border px-3 py-2 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium">Status Pembayaran *</label>
                  <select
                    value={isLunas ? 'lunas' : 'belum'}
                    onChange={(e) => handlePaymentStatusChange(e.target.value === 'lunas')}
                    className={`w-full rounded-lg border px-3 py-2 font-semibold ${
                      isLunas
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                        : 'border-amber-300 bg-amber-50 text-amber-800'
                    }`}
                  >
                    <option value="belum">
                      {form.type === 'out' ? 'Piutang (Belum Lunas)' : 'Hutang (Belum Lunas)'}
                    </option>
                    <option value="lunas">Lunas (Langsung Terbayar Penuh)</option>
                  </select>
                </div>
              </div>

              {/* Referensi Multi Surat Jalan */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-600" />
                    <div>
                      <span className="font-semibold text-slate-800">Referensi Surat Jalan</span>
                      <span className="ml-2 text-xs text-slate-500">
                        ({form.type === 'out' ? 'SJ Pengiriman / Penjualan' : 'SJ Penerimaan / Pembelian'} | Bisa lebih dari 1 SJ)
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddDeliveryRef}
                    className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Tambahkan Referensi Surat Jalan
                  </button>
                </div>

                {deliveryNoteRefs.length > 0 && (
                  <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {deliveryNoteRefs.map((refVal, idx) => (
                      <DeliveryRefCombobox
                        key={idx}
                        value={refVal}
                        options={filteredDeliveryNotes}
                        usedNos={deliveryNoteRefs}
                        onChangeText={(val) => handleChangeDeliveryRefText(idx, val)}
                        onSelectExisting={(dnNo) => handleSelectExistingDeliveryNote(idx, dnNo)}
                        onRemove={() => handleRemoveDeliveryRef(idx)}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800">Rincian Tagihan Barang</h3>
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
                            <button type="button" onClick={() => removeItem(idx)} className="text-rose-500 hover:text-rose-700">
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
                  <label className="mb-1 block text-xs font-medium text-slate-600">Ongkir Tagihan (Rp)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.ongkir}
                    onChange={(e) => setForm(recalcTotals({ ...form, ongkir: Number(e.target.value) }))}
                    className="w-full rounded-lg border bg-white px-3 py-1.5 text-right"
                  />
                </div>
                <div className="flex flex-col justify-center text-right">
                  <span className="text-xs text-slate-500">Total Barang+PPN: {formatRupiah(form.total)}</span>
                  <span className="text-xs text-slate-500">Grand Tagihan (+Ongkir):</span>
                  <span className="text-lg font-bold text-blue-700">{formatRupiah(grandTagihan)}</span>
                  {isLunas && (
                    <span className="mt-0.5 text-[11px] font-semibold text-emerald-700">
                      Terbayar otomatis: {formatRupiah(form.paid)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t px-6 py-3.5">
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border px-4 py-2 text-sm">
                Batal
              </button>
              <button type="submit" className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700">
                Simpan Invoice
              </button>
            </div>
          </form>
        </div>
      )}

      {previewId !== null && (
        <PdfPreviewModal docType="INVOICE" docId={previewId} onClose={() => setPreviewId(null)} />
      )}
    </div>
  );
};
