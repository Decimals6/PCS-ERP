import React, { useEffect, useState } from 'react';
import { AppMode, AppSettings, PaymentPrefillDraft } from '../shared/types';
import { NavPage, Sidebar } from './components/Sidebar';
import { DashboardPage } from './pages/DashboardPage';
import { MasterDataPage } from './pages/MasterDataPage';
import { OrdersPage } from './pages/OrdersPage';
import { DeliveryNotesPage } from './pages/DeliveryNotesPage';
import { MutasiBarangPage } from './pages/MutasiBarangPage';
import { InvoicesPage } from './pages/InvoicesPage';
import { PaymentsPage } from './pages/PaymentsPage';
import { BackupExportPage } from './pages/BackupExportPage';
import { SettingsTemplatesPage } from './pages/SettingsTemplatesPage';
import { DocsVersionPage } from './pages/DocsVersionPage';

export default function App() {
  const [activePage, setActivePage] = useState<NavPage>('dashboard');
  const [dataRevision, setDataRevision] = useState(0);
  const [paymentPrefill, setPaymentPrefill] = useState<PaymentPrefillDraft | null>(null);
  const [settings, setSettings] = useState<AppSettings>({
    app_mode: 'all',
    company_name: 'PT PILAR CERAH SEJAHTERA',
    company_address: 'Jl. Jemursari I no. 35 Surabaya, Jawa Timur',
    company_city: 'Surabaya',
    company_phone: '081175500095',
    company_email: 'marketing.pcs01@gmail.com',
    company_logo: '',
    po_signer_name: 'Tri Tjahyono Eprijarto',
    po_signer_title: 'Direktur',
    default_ppn: '11',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.api
      .getAppSettings()
      .then((cfg) => {
        setSettings(cfg);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleQuickSwitchMode = async (mode: AppMode) => {
    const updated = await window.api.updateAppSettings({ app_mode: mode });
    setSettings(updated);
    if (mode === 'mode_1_gudang' && (activePage === 'invoices' || activePage === 'payments')) {
      setActivePage('dashboard');
    } else if (
      mode === 'mode_2_finance' &&
      (activePage === 'orders' || activePage === 'delivery_notes' || activePage === 'mutasi')
    ) {
      setActivePage('dashboard');
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
        Memuat database lokal SQLite...
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-900">
      <Sidebar
        activePage={activePage}
        onNavigate={setActivePage}
        appMode={settings.app_mode}
        companyName={settings.company_name}
        onQuickSwitchMode={handleQuickSwitchMode}
      />

      <main className="flex-1 overflow-y-auto p-6 lg:p-8">
        <div className="mx-auto max-w-7xl">
          {activePage === 'dashboard' && (
            <DashboardPage key={`dash-${dataRevision}`} appMode={settings.app_mode} onNavigate={setActivePage} />
          )}
          {activePage === 'master' && <MasterDataPage key={`master-${dataRevision}`} />}
          {activePage === 'orders' && <OrdersPage key={`orders-${dataRevision}`} />}
          {activePage === 'delivery_notes' && <DeliveryNotesPage key={`dn-${dataRevision}`} />}
          {activePage === 'mutasi' && <MutasiBarangPage key={`mutasi-${dataRevision}`} />}
          {activePage === 'invoices' && (
            <InvoicesPage
              key={`inv-${dataRevision}`}
              onDataChanged={() => setDataRevision((r) => r + 1)}
              onPayInvoices={(draft) => {
                setPaymentPrefill(draft);
                setActivePage('payments');
              }}
            />
          )}
          {activePage === 'payments' && (
            <PaymentsPage
              key={`pay-${dataRevision}`}
              prefillDraft={paymentPrefill}
              onPrefillConsumed={() => setPaymentPrefill(null)}
              onDataChanged={() => setDataRevision((r) => r + 1)}
            />
          )}
          {activePage === 'backup' && <BackupExportPage key={`backup-${dataRevision}`} appMode={settings.app_mode} />}
          {activePage === 'settings' && (
            <SettingsTemplatesPage
              key={`set-${dataRevision}`}
              settings={settings}
              onSettingsSaved={(updated) => {
                setSettings(updated);
                setDataRevision((r) => r + 1);
              }}
            />
          )}
          {activePage === 'docs' && <DocsVersionPage key={`docs-${dataRevision}`} />}
        </div>
      </main>
    </div>
  );
}
