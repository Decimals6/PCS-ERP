import React, { useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Filter } from 'lucide-react';
import { Barang, MutasiBarang } from '../../shared/types';

export const MutasiBarangPage: React.FC = () => {
  const [selectedBarangId, setSelectedBarangId] = useState<string>('');
  const [barangList, setBarangList] = useState<Barang[]>([]);
  const [mutasiList, setMutasiList] = useState<MutasiBarang[]>([]);

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

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Buku Besar Mutasi Stok Barang</h1>
          <p className="text-sm text-slate-500">
            Riwayat pergerakan keluar-masuk stok yang tercatat otomatis dari dokumen Surat Jalan.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={selectedBarangId}
            onChange={(e) => setSelectedBarangId(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="">Semua Barang</option>
            {barangList.map((b) => (
              <option key={b.id} value={b.id}>
                {b.kode ? `[${b.kode}] ` : ''}{b.nama} (Stok: {b.stock} {b.satuan})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-600">
            <tr>
              <th className="px-4 py-3">Tanggal</th>
              <th className="px-4 py-3">Sumber Dokumen</th>
              <th className="px-4 py-3">Barang</th>
              <th className="px-4 py-3">Jenis</th>
              <th className="px-4 py-3 text-right">Stok Sebelum</th>
              <th className="px-4 py-3 text-right">Qty Mutasi</th>
              <th className="px-4 py-3 text-right">Stok Sesudah</th>
              <th className="px-4 py-3">Keterangan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {mutasiList.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                  Belum ada catatan mutasi stok.
                </td>
              </tr>
            ) : (
              mutasiList.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-600">{m.tgl}</td>
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-800">{m.source || '-'}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {m.barang_kode ? `[${m.barang_kode}] ` : ''}{m.barang_nama || '-'}
                  </td>
                  <td className="px-4 py-3">
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
                  <td className="px-4 py-3 text-right text-slate-500">{m.stok_sebelum}</td>
                  <td className={`px-4 py-3 text-right font-bold ${m.type === 'in' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {m.type === 'in' ? `+${m.qty}` : `-${m.qty}`} {m.barang_satuan || ''}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-slate-900">{m.stok_sesudah}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{m.keterangan || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
