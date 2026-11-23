import React, { useEffect, useState } from 'react';
import { Package, ShoppingCart, Truck, FileText, Wallet, ArrowRight } from 'lucide-react';
import { AppMode, Barang, DeliveryNote, Invoice, Order } from '../../shared/types';
import { formatRupiah } from '../utils/format';
import { NavPage } from '../components/Sidebar';

interface DashboardPageProps {
  appMode: AppMode;
  onNavigate: (page: NavPage) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ appMode, onNavigate }) => {
  const [barang, setBarang] = useState<Barang[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [dns, setDns] = useState<DeliveryNote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  useEffect(() => {
    Promise.all([
      window.api.listBarang(),
      window.api.listOrders(),
      window.api.listDeliveryNotes(),
      window.api.listInvoices(),
    ]).then(([b, o, d, i]) => {
      setBarang(b);
      setOrders(o);
      setDns(d);
      setInvoices(i);
    });
  }, []);

  const showGudang = appMode === 'mode_1_gudang' || appMode === 'all';
  const showFinance = appMode === 'mode_2_finance' || appMode === 'all';

  const sisaPiutang = invoices
    .filter((i) => i.type === 'out' && i.status !== 'Lunas')
    .reduce((sum, i) => sum + Math.max(0, i.total + i.ongkir - i.paid), 0);

  const sisaHutang = invoices
    .filter((i) => i.type === 'in' && i.status !== 'Lunas')
    .reduce((sum, i) => sum + Math.max(0, i.total + i.ongkir - i.paid), 0);

  const stokMenipis = barang.filter((b) => Number(b.stock) <= 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard Operasional</h1>
        <p className="text-sm text-slate-500">
          Ringkasan data lokal offline â€” mode aktif:{' '}
          <span className="font-semibold text-blue-600">
            {appMode === 'mode_1_gudang'
              ? 'Mode 1 (Order & Gudang)'
              : appMode === 'mode_2_finance'
                ? 'Mode 2 (Finance / Accounting)'
                : 'Semua Modul (Gabungan)'}
          </span>
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-500">Total Item Barang</span>
            <Package className="h-5 w-5 text-blue-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">{barang.length}</p>
          <p className="mt-1 text-xs text-slate-500">{stokMenipis.length} item stok menipis (&le; 5)</p>
        </div>

        {showGudang && (
          <>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-slate-500">Dokumen PO / SO</span>
                <ShoppingCart className="h-5 w-5 text-indigo-600" />
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900">{orders.length}</p>
              <p className="mt-1 text-xs text-slate-500">
                {orders.filter((o) => o.type === 'in').length} PO Masuk &bull;{' '}
                {orders.filter((o) => o.type === 'out').length} SO Keluar
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-slate-500">Surat Jalan</span>
                <Truck className="h-5 w-5 text-emerald-600" />
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900">{dns.length}</p>
              <p className="mt-1 text-xs text-slate-500">
                {dns.filter((d) => d.type === 'in').length} Penerimaan &bull;{' '}
                {dns.filter((d) => d.type === 'out').length} Pengiriman
              </p>
            </div>
          </>
        )}

        {showFinance && (
          <>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-slate-500">Sisa Piutang (Customer)</span>
                <FileText className="h-5 w-5 text-amber-600" />
              </div>
              <p className="mt-2 text-xl font-bold text-slate-900">{formatRupiah(sisaPiutang)}</p>
              <p className="mt-1 text-xs text-slate-500">
                {invoices.filter((i) => i.type === 'out' && i.status !== 'Lunas').length} invoice belum lunas
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-slate-500">Sisa Hutang (Supplier)</span>
                <Wallet className="h-5 w-5 text-rose-600" />
              </div>
              <p className="mt-2 text-xl font-bold text-slate-900">{formatRupiah(sisaHutang)}</p>
              <p className="mt-1 text-xs text-slate-500">
                {invoices.filter((i) => i.type === 'in' && i.status !== 'Lunas').length} tagihan supplier
              </p>
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold text-slate-800">Aksi Cepat Alur Kerja</h2>
          <div className="mt-3 space-y-2.5">
            <button
              onClick={() => onNavigate('master')}
              className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-4 py-3 text-left text-sm hover:border-blue-400 hover:bg-blue-50/40"
            >
              <div>
                <p className="font-semibold text-slate-800">Kelola / Import Master Data</p>
                <p className="text-xs text-slate-500">Barang, Customer, Supplier & Bulk Import CSV/JSON</p>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400" />
            </button>

            {showGudang && (
              <>
                <button
                  onClick={() => onNavigate('orders')}
                  className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-4 py-3 text-left text-sm hover:border-blue-400 hover:bg-blue-50/40"
                >
                  <div>
                    <p className="font-semibold text-slate-800">Buat Purchase Order / Sales Order</p>
                    <p className="text-xs text-slate-500">Cetak PDF & Export file transfer JSON ke Finance</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                </button>

                <button
                  onClick={() => onNavigate('delivery_notes')}
                  className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-4 py-3 text-left text-sm hover:border-blue-400 hover:bg-blue-50/40"
                >
                  <div>
                    <p className="font-semibold text-slate-800">Terbitkan Surat Jalan & Mutasi Stok</p>
                    <p className="text-xs text-slate-500">Tarik dari PO/SO, update stok & log mutasi otomatis</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                </button>
              </>
            )}

            {showFinance && (
              <>
                <button
                  onClick={() => onNavigate('invoices')}
                  className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-4 py-3 text-left text-sm hover:border-blue-400 hover:bg-blue-50/40"
                >
                  <div>
                    <p className="font-semibold text-slate-800">Buat Invoice / Import JSON Gudang</p>
                    <p className="text-xs text-slate-500">Tagihan piutang/hutang lengkap dengan DPP, PPN, Ongkir</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                </button>

                <button
                  onClick={() => onNavigate('payments')}
                  className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-4 py-3 text-left text-sm hover:border-blue-400 hover:bg-blue-50/40"
                >
                  <div>
                    <p className="font-semibold text-slate-800">Input Pelunasan Invoice (FIFO)</p>
                    <p className="text-xs text-slate-500">Alokasi otomatis ke invoice terlama + potongan bank</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                </button>
              </>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold text-slate-800">Peringatan Stok Menipis (&le; 5)</h2>
          {stokMenipis.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">Semua stok barang dalam kondisi aman.</p>
          ) : (
            <div className="mt-3 max-h-64 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="py-2">Kode</th>
                    <th className="py-2">Nama Barang</th>
                    <th className="py-2 text-right">Sisa Stok</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stokMenipis.map((b) => (
                    <tr key={b.id}>
                      <td className="py-2 font-mono text-slate-600">{b.kode || '-'}</td>
                      <td className="py-2 font-medium text-slate-800">{b.nama}</td>
                      <td className="py-2 text-right font-bold text-rose-600">
                        {b.stock} {b.satuan}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
