import React, { useEffect, useRef, useState } from 'react';
import { X, Download, Printer, FileText } from 'lucide-react';
import { DocType } from '../../shared/types';
import { useAppDialog } from './AppDialogProvider';

interface PdfPreviewModalProps {
  docType: DocType;
  docId: number;
  onClose: () => void;
}

export const PdfPreviewModal: React.FC<PdfPreviewModalProps> = ({ docType, docId, onClose }) => {
  const { showAlert } = useAppDialog();
  const isInvoiceMode = docType === 'INVOICE' || docType === 'INVOICE_DOT';
  const isSjMode = docType === 'SJ' || docType === 'SJ_DOT';
  const hasFormatSwitch = isInvoiceMode || isSjMode;
  const pdfDocType: DocType = isInvoiceMode ? 'INVOICE' : 'SJ';
  const dotDocType: DocType = isInvoiceMode ? 'INVOICE_DOT' : 'SJ_DOT';
  const [activeDocType, setActiveDocType] = useState<DocType>(docType);
  const [html, setHtml] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    setActiveDocType(docType);
  }, [docType, docId]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    window.api
      .buildDocumentHtml(activeDocType, docId)
      .then((res) => {
        if (active) {
          setHtml(res.html);
          setLoading(false);
        }
      })
      .catch(async (err) => {
        await showAlert('Gagal memuat pratinjau dokumen: ' + err.message);
        onClose();
      });
    return () => {
      active = false;
    };
  }, [activeDocType, docId, onClose, showAlert]);

  const handleSavePdf = async () => {
    setSaving(true);
    try {
      const res = await window.api.exportDocumentToPdf(activeDocType, docId);
      if (res.saved) {
        await showAlert('PDF berhasil disimpan ke: ' + res.filePath);
      }
    } catch (err: any) {
      await showAlert('Gagal menyimpan PDF: ' + (err?.message || err));
    } finally {
      setSaving(false);
    }
  };

  const [printing, setPrinting] = useState<boolean>(false);

  const handleDirectPrint = async () => {
    setPrinting(true);
    try {
      await window.api.printDocumentDirect(activeDocType, docId);
    } catch (err: any) {
      await showAlert('Gagal mencetak dokumen: ' + (err?.message || err));
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Printer className="h-5 w-5 text-slate-700" />
            <h2 className="font-semibold text-slate-800">
              {isInvoiceMode
                ? 'Pratinjau Cetak Faktur Penjualan'
                : isSjMode
                  ? 'Pratinjau Cetak Surat Jalan'
                  : `Pratinjau Cetak Dokumen (${activeDocType})`}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {hasFormatSwitch && (
              <div className="mr-1 inline-flex rounded-lg border border-slate-300 bg-white p-0.5">
                <button
                  type="button"
                  onClick={() => setActiveDocType(pdfDocType)}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                    activeDocType === pdfDocType
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <FileText className="h-3.5 w-3.5" />
                  Format PDF (A4)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDocType(dotDocType)}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                    activeDocType === dotDocType
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Printer className="h-3.5 w-3.5" />
                  Format Dot Matrix
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handleDirectPrint}
              disabled={loading || printing}
              className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              <Printer className="h-4 w-4" />
              {printing ? 'Membuka Browser...' : 'Cetak via Browser'}
            </button>

            <button
              type="button"
              onClick={handleSavePdf}
              disabled={loading || saving}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              {saving ? 'Menyimpan...' : 'Print as PDF'}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="flex-1 bg-slate-200 p-4">
          {loading ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-600">
              Menyiapkan pratinjau dokumen...
            </div>
          ) : (
            <iframe
              ref={iframeRef}
              title="PDF Preview"
              srcDoc={html}
              className="h-full w-full rounded-lg border border-slate-300 bg-white shadow-sm"
            />
          )}
        </div>
      </div>
    </div>
  );
};
