import { DocType } from '../../shared/types';

export interface DefaultTemplateSeed {
  doc_type: DocType;
  name: string;
  html_content: string;
  css_content: string;
}

const BASE_CSS = `* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #1e293b; padding: 28px; line-height: 1.45; }
.header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 14px; margin-bottom: 18px; }
.company-name { font-size: 18px; font-weight: 700; color: #0f172a; }
.company-info { font-size: 11px; color: #475569; margin-top: 4px; max-width: 340px; }
.doc-title { text-align: right; }
.doc-title h1 { font-size: 20px; font-weight: 800; letter-spacing: 0.5px; color: #0f172a; }
.doc-meta { font-size: 11px; margin-top: 4px; color: #334155; }
.info-grid { display: flex; justify-content: space-between; gap: 20px; margin-bottom: 18px; }
.info-box { flex: 1; border: 1px solid #cbd5e1; border-radius: 4px; padding: 10px 12px; background: #f8fafc; }
.info-box h3 { font-size: 10px; text-transform: uppercase; color: #64748b; margin-bottom: 4px; letter-spacing: 0.5px; }
.info-box p { font-size: 12px; }
table.items { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
table.items th { background: #0f172a; color: #ffffff; font-weight: 600; text-align: left; padding: 8px 10px; font-size: 11px; }
table.items td { border-bottom: 1px solid #e2e8f0; padding: 7px 10px; font-size: 11.5px; }
table.items tr:nth-child(even) td { background: #f8fafc; }
.text-right { text-align: right !important; }
.text-center { text-align: center !important; }
.bottom-section { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; margin-top: 10px; }
.notes { flex: 1; font-size: 11px; color: #475569; border: 1px dashed #cbd5e1; padding: 10px; border-radius: 4px; }
.totals { width: 270px; }
.totals table { width: 100%; border-collapse: collapse; }
.totals td { padding: 5px 8px; font-size: 12px; }
.totals tr.grand td { font-weight: 700; font-size: 13.5px; border-top: 2px solid #0f172a; border-bottom: 2px solid #0f172a; background: #f1f5f9; }
.signatures { display: flex; justify-content: space-between; margin-top: 42px; padding: 0 20px; }
.sig-box { text-align: center; width: 180px; }
.sig-space { height: 64px; }
.sig-line { border-top: 1px solid #334155; padding-top: 4px; font-size: 11px; font-weight: 600; }`;

export const DEFAULT_PDF_TEMPLATES: DefaultTemplateSeed[] = [
  {
    doc_type: 'PO',
    name: 'Purchase Order (Supplier)',
    css_content: `* { box-sizing: border-box; margin: 0; padding: 0; }
@page { size: A4 portrait; margin: 14mm 16mm; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #000000; padding: 0; line-height: 1.45; }
.kop-wrap { display: flex; align-items: center; gap: 16px; padding-bottom: 10px; }
.kop-logo { width: 130px; flex-shrink: 0; display: flex; align-items: center; justify-content: flex-start; }
.kop-logo img { max-width: 125px; max-height: 76px; object-fit: contain; }
.kop-center { flex: 1; text-align: center; padding-right: 40px; }
.kop-company { font-size: 19px; font-weight: 800; color: #0066b3; letter-spacing: 0.4px; text-transform: uppercase; }
.kop-addr { font-size: 11px; color: #111827; margin-top: 2px; white-space: pre-line; }
.kop-contact { font-size: 11px; color: #111827; margin-top: 1px; }
.kop-contact a { color: #0066b3; text-decoration: underline; }
.kop-divider { border-top: 3px solid #2b6cb0; border-bottom: 1px solid #2b6cb0; height: 6px; margin-bottom: 14px; }
.addr-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; margin-bottom: 22px; }
.supplier-col { width: 58%; }
.supplier-name { font-weight: 700; }
.supplier-addr { white-space: pre-line; }
.supplier-up { margin-top: 14px; }
.city-date { width: 38%; text-align: right; }
.doc-title-block { text-align: center; margin-bottom: 22px; }
.doc-title-block .title { font-size: 12px; font-weight: 700; text-decoration: underline; text-transform: uppercase; letter-spacing: 0.3px; }
.doc-title-block .doc-no { font-size: 11.5px; font-weight: 700; margin-top: 2px; }
.intro-block { margin-bottom: 14px; }
.spec-heading { text-decoration: underline; margin-bottom: 2px; }
table.items { width: 100%; border-collapse: collapse; margin-bottom: 16px; border: 1px solid #000000; }
table.items th { border: 1px solid #000000; padding: 5px 8px; font-weight: 400; font-size: 11px; text-align: center; vertical-align: middle; }
table.items td.item-cell { border-left: 1px solid #000000; border-right: 1px solid #000000; padding: 5px 8px; font-size: 11px; vertical-align: top; }
table.items tr.spacer-row td.item-cell { height: 78px; }
table.items tr.total-row td { border-top: 1px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000; padding: 3px 8px; font-size: 11px; vertical-align: middle; }
table.items tr.total-row.mid td { border-top: none; }
table.items tr.total-row.last td { border-top: none; border-bottom: 1px solid #000000; }
.total-val-flex { display: flex; justify-content: space-between; align-items: center; width: 100%; }
.text-center { text-align: center; }
.text-right { text-align: right; }
.item-spec { white-space: pre-line; margin-top: 1px; }
.terbilang-line { margin-bottom: 16px; font-size: 11px; }
.deldate-line { font-weight: 700; margin-bottom: 36px; font-size: 11px; }
.sig-block { width: 220px; text-align: center; margin-left: 18px; }
.sig-space { height: 64px; }
.sig-name { font-weight: 700; text-decoration: underline; }`,
    html_content: `<div class="kop-wrap">
  <div class="kop-logo">{{company_logo_img}}</div>
  <div class="kop-center">
    <div class="kop-company">{{company_name}}</div>
    <div class="kop-addr">{{company_address}}</div>
    <div class="kop-contact">Email : <a href="mailto:{{company_email}}">{{company_email}}</a>, Telp : {{company_phone}}</div>
  </div>
</div>
<div class="kop-divider"></div>

<div class="addr-row">
  <div class="supplier-col">
    <div>Kepada Yth.</div>
    <div class="supplier-name">{{partner_nama}}</div>
    <div class="supplier-addr">{{partner_alamat}}</div>
    <div class="supplier-up">Up : {{partner_up}}</div>
  </div>
  <div class="city-date">{{company_city}}, {{tgl_indo}}</div>
</div>

<div class="doc-title-block">
  <div class="title">PURCHASE ORDER</div>
  <div class="doc-no">NO. PO : {{no}}</div>
</div>

<div class="intro-block">
  <div>Dengan hormat,</div>
  <div>Bersama ini kami lampirkan PO untuk {{po_subject}} dengan spesifikasi sebagai berikut :</div>
</div>

<div class="spec-heading">1. Spesifikasi {{po_subject}}</div>

<table class="items">
  <thead>
    <tr>
      <th style="width: 44px;">No.</th>
      <th>Nama Barang</th>
      <th style="width: 86px;">Jumlah</th>
      <th style="width: 72px;">Satuan</th>
      <th style="width: 96px;">Harga Satuan</th>
      <th style="width: 112px;">Total</th>
    </tr>
  </thead>
  <tbody>
    {{items_rows_po_pdf}}
    <tr class="spacer-row">
      <td class="item-cell"></td>
      <td class="item-cell"></td>
      <td class="item-cell"></td>
      <td class="item-cell"></td>
      <td class="item-cell"></td>
      <td class="item-cell"></td>
    </tr>
    <tr class="total-row">
      <td></td>
      <td></td>
      <td></td>
      <td colspan="2">Sub Total</td>
      <td><div class="total-val-flex"><span>Rp</span><span>{{dpp_net_plain}}</span></div></td>
    </tr>
    <tr class="total-row mid">
      <td></td>
      <td></td>
      <td></td>
      <td colspan="2">Ppn {{ppn}}%</td>
      <td class="text-right">{{ppn_nominal_plain}}</td>
    </tr>
    <tr class="total-row last">
      <td></td>
      <td></td>
      <td></td>
      <td colspan="2">Grand Total</td>
      <td><div class="total-val-flex"><span>Rp</span><span>{{total_plain}}</span></div></td>
    </tr>
  </tbody>
</table>

<div class="terbilang-line">Terbilang : # {{terbilang}} #</div>
<div class="deldate-line">Deldate : {{deldate_indo}}</div>

<div class="sig-block">
  <div>Hormat Kami,</div>
  <div class="sig-space"></div>
  <div class="sig-name">{{po_signer_name}}</div>
  <div>{{po_signer_title}}</div>
</div>`
  },
  {
    doc_type: 'SO',
    name: 'Sales Order (Standar)',
    css_content: BASE_CSS,
    html_content: `<div class="header">
  <div>
    <div class="company-name">{{company_name}}</div>
    <div class="company-info">{{company_address}}<br/>Telp: {{company_phone}} | Email: {{company_email}}</div>
  </div>
  <div class="doc-title">
    <h1>SALES ORDER</h1>
    <div class="doc-meta">No. SO: <strong>{{no}}</strong><br/>Tanggal: {{tgl}}</div>
  </div>
</div>
<div class="info-grid">
  <div class="info-box">
    <h3>Customer</h3>
    <p><strong>{{partner_nama}}</strong><br/>{{partner_alamat}}<br/>Telp: {{partner_telepon}} | UP: {{partner_up}}</p>
  </div>
  <div class="info-box">
    <h3>Informasi Order</h3>
    <p>Dokumen konfirmasi pesanan penjualan internal & persiapan gudang.</p>
  </div>
</div>
<table class="items">
  <thead>
    <tr>
      <th class="text-center" style="width:36px;">No</th>
      <th>Kode / Part No</th>
      <th>Nama Barang</th>
      <th class="text-right">Qty</th>
      <th>Satuan</th>
      <th class="text-right">Harga Satuan</th>
      <th class="text-right">Subtotal</th>
    </tr>
  </thead>
  <tbody>{{items_rows}}</tbody>
</table>
<div class="bottom-section">
  <div class="notes">
    <strong>Catatan:</strong><br/>
    Pesanan akan diproses untuk pengiriman sesuai ketersediaan stok.
  </div>
  <div class="totals">
    <table>
      <tr><td>DPP</td><td class="text-right">{{dpp}}</td></tr>
      <tr><td>Diskon</td><td class="text-right">- {{diskon}}</td></tr>
      <tr><td>PPN ({{ppn}}%)</td><td class="text-right">{{ppn_nominal}}</td></tr>
      <tr class="grand"><td>TOTAL</td><td class="text-right">{{total}}</td></tr>
    </table>
  </div>
</div>
<div class="signatures">
  <div class="sig-box"><p>Sales Admin,</p><div class="sig-space"></div><div class="sig-line">Admin Penjualan</div></div>
  <div class="sig-box"><p>Mengetahui,</p><div class="sig-space"></div><div class="sig-line">Kepala Gudang</div></div>
</div>`
  },
  {
    doc_type: 'SJ',
    name: 'Surat Jalan (PDF / A4)',
    css_content: `* { box-sizing: border-box; margin: 0; padding: 0; }
@page { size: A4 portrait; margin: 12mm 14mm; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 11.5px; color: #000000; padding: 0; line-height: 1.45; }
.company-block { margin-bottom: 10px; }
.company-block .company-name { font-weight: 700; font-size: 12.5px; text-transform: uppercase; margin-bottom: 2px; }
.company-block .company-addr { white-space: pre-line; text-transform: uppercase; }
.doc-title { text-align: center; font-size: 14px; font-weight: 700; letter-spacing: 0.6px; margin: 6px 0 14px; text-transform: uppercase; }
.meta-grid { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; margin-bottom: 14px; }
.meta-left { width: 58%; }
.meta-right { width: 36%; }
.meta-table { width: 100%; border-collapse: collapse; }
.meta-table td { padding: 2.5px 0; vertical-align: top; font-size: 11.5px; }
.meta-table td.lbl { width: 92px; font-weight: 600; }
.meta-table td.sep { width: 14px; text-align: center; }
.ship-label { font-weight: 600; margin-bottom: 2px; }
.ship-addr { white-space: pre-line; text-transform: uppercase; margin-bottom: 12px; }
.po-line { font-weight: 600; }
table.items { width: 100%; border-collapse: collapse; margin-bottom: 20px; border: 1.5px solid #000000; }
table.items th { border: 1px solid #000000; padding: 6px 8px; font-weight: 700; font-size: 11.5px; text-align: center; background: #f8fafc; }
table.items td { border: 1px solid #000000; padding: 6px 8px; font-size: 11.5px; vertical-align: top; }
.text-center { text-align: center; }
.text-right { text-align: right; }
.signatures { display: flex; justify-content: space-between; align-items: flex-start; margin-top: 24px; padding: 0 18px; }
.sig-col { width: 180px; text-align: center; }
.sig-space { height: 56px; }`,
    html_content: `<div class="company-block">
  <div class="company-name">{{company_name}}</div>
  <div class="company-addr">{{company_address}}</div>
</div>

<div class="doc-title">SURAT JALAN</div>

<div class="meta-grid">
  <div class="meta-left">
    <table class="meta-table">
      <tr><td class="lbl">NO. SJ</td><td class="sep">:</td><td>{{no}}</td></tr>
      <tr><td class="lbl">TANGGAL</td><td class="sep">:</td><td>{{tgl_long}}</td></tr>
      <tr><td class="lbl">CUSTOMER</td><td class="sep">:</td><td>{{customer_line}}</td></tr>
      <tr><td class="lbl">ALAMAT</td><td class="sep">:</td><td style="white-space: pre-line;">{{partner_alamat}}</td></tr>
      <tr><td class="lbl">NO. TELP</td><td class="sep">:</td><td>{{partner_telepon}}</td></tr>
    </table>
  </div>
  <div class="meta-right">
    <div class="ship-label">Alamat Kirim :</div>
    <div class="ship-addr">{{alamat_tujuan}}</div>
    <div class="po-line">PO No. : {{po_no_display}}</div>
  </div>
</div>

<table class="items">
  <thead>
    <tr>
      <th style="width: 48px;">NO</th>
      <th style="width: 115px;">JUMLAH</th>
      <th>NAMA BARANG</th>
      <th style="width: 180px;">KETERANGAN</th>
    </tr>
  </thead>
  <tbody>{{items_rows_sj_pdf}}</tbody>
</table>

<div class="signatures">
  <div class="sig-col"><div>Hormat kami</div><div class="sig-space"></div></div>
  <div class="sig-col"><div>Driver</div><div class="sig-space"></div></div>
  <div class="sig-col"><div>Penerima</div><div class="sig-space"></div></div>
</div>`
  },
  {
    doc_type: 'SJ_DOT',
    name: 'Surat Jalan (Dot Matrix)',
    css_content: `* { box-sizing: border-box; margin: 0; padding: 0; }
@page { size: 9.5in 5.5in; margin: 3mm 4mm; }
body { font-family: 'Courier New', Consolas, 'Liberation Mono', monospace; font-size: 11px; color: #000000; padding: 0; line-height: 1.32; }
.company-block { margin-bottom: 4px; }
.company-block .company-name { text-transform: uppercase; }
.company-block .company-addr { white-space: pre-line; text-transform: uppercase; }
.doc-title { text-align: center; font-size: 13.5px; font-weight: 700; letter-spacing: 0.6px; margin: 2px 0 8px; text-transform: uppercase; }
.meta-grid { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 8px; }
.meta-left { width: 62%; }
.meta-right { width: 34%; }
.meta-table { width: 100%; border-collapse: collapse; }
.meta-table td { padding: 1px 0; vertical-align: top; font-size: 11px; }
.meta-table td.lbl { width: 86px; }
.meta-table td.sep { width: 14px; }
.ship-label { margin-bottom: 1px; }
.ship-addr { white-space: pre-line; text-transform: uppercase; margin-bottom: 10px; }
table.items { width: 100%; border-collapse: collapse; margin-bottom: 10px; border: 1.5px solid #000000; }
table.items th { border: 1px solid #000000; padding: 3px 6px; font-weight: 400; font-size: 11px; text-align: center; vertical-align: middle; }
table.items td { border-left: 1px solid #000000; border-right: 1px solid #000000; padding: 4px 7px; font-size: 11px; vertical-align: top; }
table.items tr.spacer-row td { height: 64px; }
.text-center { text-align: center; }
.text-right { text-align: right; }
.signatures { display: flex; justify-content: space-between; align-items: flex-start; margin-top: 8px; padding: 0 24px; }
.sig-col { width: 170px; text-align: center; }`,
    html_content: `<div class="company-block">
  <div class="company-name">{{company_name}}</div>
  <div class="company-addr">{{company_address}}</div>
</div>

<div class="doc-title">SURAT JALAN</div>

<div class="meta-grid">
  <div class="meta-left">
    <table class="meta-table">
      <tr><td class="lbl">NO. SJ</td><td class="sep">:</td><td>{{no}}</td></tr>
      <tr><td class="lbl">TANGGAL</td><td class="sep">:</td><td>{{tgl_long}}</td></tr>
      <tr><td class="lbl">CUSTOMER</td><td class="sep">:</td><td>{{customer_line}}</td></tr>
      <tr><td class="lbl">ALAMAT</td><td class="sep">:</td><td style="white-space: pre-line;">{{partner_alamat}}</td></tr>
      <tr><td class="lbl">NO. TELP</td><td class="sep">:</td><td>{{partner_telepon}}</td></tr>
    </table>
  </div>
  <div class="meta-right">
    <div class="ship-label">Alamat Kirim :</div>
    <div class="ship-addr">{{alamat_tujuan}}</div>
    <div>PO No. : {{po_no_display}}</div>
  </div>
</div>

<table class="items">
  <thead>
    <tr>
      <th style="width: 52px;">NO</th>
      <th style="width: 118px;">JUMLAH</th>
      <th>NAMA BARANG</th>
      <th style="width: 190px;">KETERANGAN</th>
    </tr>
  </thead>
  <tbody>
    {{items_rows_sj_dot}}
    <tr class="spacer-row"><td></td><td></td><td></td><td></td></tr>
  </tbody>
</table>

<div class="signatures">
  <div class="sig-col">Hormat kami</div>
  <div class="sig-col">Driver</div>
  <div class="sig-col">Penerima</div>
</div>`
  },
  {
    doc_type: 'INVOICE',
    name: 'Faktur Penjualan (PDF / A4)',
    css_content: `* { box-sizing: border-box; margin: 0; padding: 0; }
@page { size: A4 portrait; margin: 12mm 14mm; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 11.5px; color: #000000; padding: 0; line-height: 1.45; }
.top-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; margin-bottom: 18px; }
.company-block { width: 52%; }
.company-block .company-name { font-weight: 700; font-size: 12px; margin-bottom: 2px; }
.company-block .company-addr { white-space: pre-line; text-transform: uppercase; }
.customer-block { width: 42%; }
.customer-block .cust-label { margin-bottom: 2px; }
.customer-block .cust-name { font-weight: 700; text-transform: uppercase; }
.customer-block .cust-addr { white-space: pre-line; text-transform: uppercase; }
.doc-title { text-align: center; font-size: 14px; font-weight: 700; letter-spacing: 0.4px; margin: 12px 0 18px; text-transform: uppercase; }
.meta-grid { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; margin-bottom: 16px; }
.meta-col { width: 48%; }
.meta-table { width: 100%; border-collapse: collapse; }
.meta-table td { padding: 3px 0; vertical-align: top; font-size: 11.5px; }
.meta-table td.lbl { width: 115px; }
.meta-table td.sep { width: 16px; text-align: center; }
table.items { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
table.items th { border: 1px solid #000000; padding: 6px 8px; font-weight: 700; font-size: 11.5px; text-align: center; }
table.items td { border: 1px solid #000000; padding: 6px 8px; font-size: 11.5px; vertical-align: top; }
.text-center { text-align: center; }
.text-right { text-align: right; }
.totals-wrap { display: flex; justify-content: flex-end; margin-bottom: 16px; }
.totals-table { width: 44%; border-collapse: collapse; }
.totals-table td { padding: 3.5px 4px; font-size: 11.5px; }
.totals-table tr.grand td { font-weight: 700; padding-top: 5px; }
.sig-right-wrap { display: flex; justify-content: flex-end; margin-top: 6px; margin-bottom: 6px; }
.sig-right-box { width: 210px; text-align: center; }
.terbilang-line { margin-top: 6px; margin-bottom: 4px; font-size: 11.5px; }
.bank-block { font-size: 11.5px; line-height: 1.45; margin-bottom: 24px; }
.bank-block .bank-holder { font-weight: 700; }
.sig-bottom-wrap { display: flex; justify-content: flex-end; margin-top: 28px; }
.sig-bottom-box { width: 210px; text-align: center; }`,
    html_content: `<div class="top-row">
  <div class="company-block">
    <div class="company-name">{{company_name}}</div>
    <div class="company-addr">{{company_address}}</div>
  </div>
  <div class="customer-block">
    <div class="cust-label">Kepada Yth,</div>
    <div class="cust-name">{{partner_nama}}</div>
    <div class="cust-addr">{{partner_alamat}}</div>
  </div>
</div>

<div class="doc-title">FAKTUR PENJUALAN</div>

<div class="meta-grid">
  <div class="meta-col">
    <table class="meta-table">
      <tr><td class="lbl">No SJ</td><td class="sep">:</td><td>{{delivery_note_no}}</td></tr>
      <tr><td class="lbl">No Faktur</td><td class="sep">:</td><td>{{no}}</td></tr>
    </table>
  </div>
  <div class="meta-col">
    <table class="meta-table">
      <tr><td class="lbl">No PO</td><td class="sep">:</td><td>{{order_no}}</td></tr>
      <tr><td class="lbl">Tanggal Invoice</td><td class="sep">:</td><td>{{tgl_long}}</td></tr>
    </table>
  </div>
</div>

<table class="items">
  <thead>
    <tr>
      <th style="width: 42px;">No</th>
      <th>Nama Barang</th>
      <th style="width: 96px;">Jumlah</th>
      <th style="width: 130px;">Harga Satuan (Rp)</th>
      <th style="width: 135px;">Total (Rp)</th>
    </tr>
  </thead>
  <tbody>{{items_rows_pdf}}</tbody>
</table>

<div class="totals-wrap">
  <table class="totals-table">
    <tr><td>Diskon</td><td class="text-right">{{diskon}}</td></tr>
    <tr><td>Dasar Pengenaan Pajak</td><td class="text-right">{{dpp_net}}</td></tr>
    <tr><td>PPN {{ppn}}%</td><td class="text-right">{{ppn_nominal}}</td></tr>
    <tr class="grand"><td>Grand Total</td><td class="text-right">{{grand_total}}</td></tr>
  </table>
</div>

<div class="sig-right-wrap">
  <div class="sig-right-box">Hormat Kami,</div>
</div>

<div class="terbilang-line">Jumlah Yang Harus Dibayar # {{terbilang}} #</div>

<div class="bank-block">
  <div>Pembayaran ditransfer ke:</div>
  <div class="bank-holder">{{company_name}}</div>
  <div>{{bank_name}}</div>
  <div>{{bank_account}}</div>
</div>

<div class="sig-bottom-wrap">
  <div class="sig-bottom-box">{{company_name}}</div>
</div>`
  },
  {
    doc_type: 'INVOICE_DOT',
    name: 'Faktur Penjualan (Dot Matrix)',
    css_content: `* { box-sizing: border-box; margin: 0; padding: 0; }
@page { size: 9.5in 5.5in; margin: 3mm 4mm; }
body { font-family: 'Courier New', Consolas, 'Liberation Mono', monospace; font-size: 11px; color: #000000; padding: 0; line-height: 1.3; }
.top-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 6px; }
.company-block { width: 55%; }
.company-block .company-name { text-transform: uppercase; }
.company-block .company-addr { white-space: pre-line; text-transform: uppercase; }
.customer-block { width: 40%; }
.customer-block .cust-addr { white-space: pre-line; }
.doc-title { text-align: center; font-size: 13.5px; font-weight: 700; letter-spacing: 0.6px; margin: 4px 0 8px; text-transform: uppercase; }
.meta-grid { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 6px; }
.meta-left { width: 55%; }
.meta-right { width: 40%; }
.meta-table { width: 100%; border-collapse: collapse; }
.meta-table td { padding: 1px 0; vertical-align: top; font-size: 11px; }
.meta-table td.lbl-left { width: 88px; }
.meta-table td.lbl-right { width: 126px; }
.meta-table td.sep { width: 14px; }
table.items { width: 100%; border-collapse: collapse; margin-bottom: 6px; border: 1.5px solid #000000; }
table.items th { border: 1px solid #000000; padding: 3px 5px; font-weight: 400; font-size: 10.5px; text-align: center; vertical-align: middle; }
table.items td { border-left: 1px solid #000000; border-right: 1px solid #000000; padding: 4px 6px; font-size: 11px; vertical-align: top; }
table.items tr.spacer-row td { height: 42px; }
.text-center { text-align: center; }
.text-right { text-align: right; }
.totals-wrap { display: flex; justify-content: flex-end; margin-bottom: 6px; }
.totals-table { width: 46%; border-collapse: collapse; }
.totals-table td { padding: 1.5px 4px; font-size: 11px; }
.terbilang-line { margin-bottom: 6px; font-size: 11px; }
.bottom-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-top: 2px; }
.bank-col { width: 48%; }
.bank-table { border-collapse: collapse; margin-top: 1px; }
.bank-table td { padding: 1px 0; font-size: 11px; vertical-align: top; }
.bank-table td.lbl { width: 68px; }
.bank-table td.sep { width: 14px; }
.sig-col { width: 23%; text-align: center; }`,
    html_content: `<div class="top-row">
  <div class="company-block">
    <div class="company-name">{{company_name}}</div>
    <div class="company-addr">{{company_address}}</div>
  </div>
  <div class="customer-block">
    <div>Kepada Yth,</div>
    <div>{{partner_nama}}</div>
    <div class="cust-addr">{{partner_alamat}}</div>
  </div>
</div>

<div class="doc-title">FAKTUR PENJUALAN</div>

<div class="meta-grid">
  <div class="meta-left">
    <table class="meta-table">
      <tr><td class="lbl-left">NO SJ</td><td class="sep">:</td><td>{{delivery_note_no}}</td></tr>
      <tr><td class="lbl-left">NO. Faktur</td><td class="sep">:</td><td>{{no}}</td></tr>
    </table>
  </div>
  <div class="meta-right">
    <table class="meta-table">
      <tr><td class="lbl-right">NO. SO</td><td class="sep">:</td><td>{{order_no}}</td></tr>
      <tr><td class="lbl-right">Tanggal Invoice</td><td class="sep">:</td><td>{{tgl_long}}</td></tr>
    </table>
  </div>
</div>

<table class="items">
  <thead>
    <tr>
      <th style="width: 56px;">NO</th>
      <th>Nama Barang Kena Pajak / Jasa Kena Pajak</th>
      <th style="width: 84px;">Jumlah</th>
      <th style="width: 126px;">Harga Satuan<br/>( RP )</th>
      <th style="width: 145px;">Total ( RP )</th>
    </tr>
  </thead>
  <tbody>
    {{items_rows_dot}}
    <tr class="spacer-row"><td></td><td></td><td></td><td></td><td></td></tr>
  </tbody>
</table>

<div class="totals-wrap">
  <table class="totals-table">
    <tr><td>Dasar Pengenaan Pajak</td><td class="text-right">{{dpp_net}}</td></tr>
    <tr><td>Pembulatan</td><td class="text-right">{{pembulatan}}</td></tr>
    <tr><td>Grand Total</td><td class="text-right">{{grand_total_plain}}</td></tr>
  </table>
</div>

<div class="terbilang-line">Jumlah Yang Harus Dibayar : # {{terbilang}} #</div>

<div class="bottom-row">
  <div class="bank-col">
    <div>Pembayaran Ditransfer ke :</div>
    <table class="bank-table">
      <tr><td class="lbl">AN</td><td class="sep">:</td><td>{{company_name}}</td></tr>
      <tr><td class="lbl">Norek</td><td class="sep">:</td><td>{{bank_account_spaced}}</td></tr>
      <tr><td class="lbl">Bank</td><td class="sep">:</td><td>{{bank_name}}</td></tr>
    </table>
  </div>
  <div class="sig-col">Penerima,</div>
  <div class="sig-col">Hormat kami,</div>
</div>`
  }
];
