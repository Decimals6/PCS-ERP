import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';

type DialogVariant = 'info' | 'success' | 'warning' | 'danger';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: DialogVariant;
}

interface AlertOptions {
  title?: string;
  message: string;
  okText?: string;
  variant?: DialogVariant;
}

type ActiveDialog =
  | {
      kind: 'confirm';
      title: string;
      message: string;
      confirmText: string;
      cancelText: string;
      variant: DialogVariant;
      resolve: (value: boolean) => void;
    }
  | {
      kind: 'alert';
      title: string;
      message: string;
      okText: string;
      variant: DialogVariant;
      resolve: () => void;
    };

interface AppDialogContextValue {
  showConfirm: (options: ConfirmOptions | string) => Promise<boolean>;
  showAlert: (options: AlertOptions | string) => Promise<void>;
}

const AppDialogContext = createContext<AppDialogContextValue | null>(null);

function inferAlertVariant(message: string): DialogVariant {
  const lower = message.toLowerCase();
  if (lower.includes('gagal') || lower.includes('error') || lower.includes('tidak valid')) {
    return 'danger';
  }
  if (
    lower.includes('berhasil') ||
    lower.includes('selesai') ||
    lower.includes('disimpan')
  ) {
    return 'success';
  }
  if (
    lower.includes('minimal') ||
    lower.includes('pilih') ||
    lower.includes('belum memiliki') ||
    lower.includes('tidak ada baris')
  ) {
    return 'warning';
  }
  return 'info';
}

export const AppDialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dialog, setDialog] = useState<ActiveDialog | null>(null);
  const primaryBtnRef = useRef<HTMLButtonElement | null>(null);

  const showConfirm = useCallback((options: ConfirmOptions | string): Promise<boolean> => {
    const opts: ConfirmOptions = typeof options === 'string' ? { message: options } : options;
    return new Promise<boolean>((resolve) => {
      setDialog({
        kind: 'confirm',
        title: opts.title || 'Konfirmasi Tindakan',
        message: opts.message,
        confirmText: opts.confirmText || 'Ya, Lanjutkan',
        cancelText: opts.cancelText || 'Batal',
        variant: opts.variant || 'danger',
        resolve,
      });
    });
  }, []);

  const showAlert = useCallback((options: AlertOptions | string): Promise<void> => {
    const opts: AlertOptions = typeof options === 'string' ? { message: options } : options;
    const variant = opts.variant || inferAlertVariant(opts.message);
    const defaultTitle =
      variant === 'danger'
        ? 'Terjadi Kesalahan'
        : variant === 'success'
        ? 'Berhasil'
        : variant === 'warning'
        ? 'Perhatian'
        : 'Informasi';

    return new Promise<void>((resolve) => {
      setDialog({
        kind: 'alert',
        title: opts.title || defaultTitle,
        message: opts.message,
        okText: opts.okText || 'OK',
        variant,
        resolve,
      });
    });
  }, []);

  const handleClose = useCallback(
    (result: boolean) => {
      if (!dialog) return;
      const current = dialog;
      setDialog(null);
      if (current.kind === 'confirm') {
        current.resolve(result);
      } else {
        current.resolve();
      }
    },
    [dialog]
  );

  useEffect(() => {
    if (!dialog) return;
    const timer = window.setTimeout(() => {
      primaryBtnRef.current?.focus();
    }, 10);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [dialog, handleClose]);

  const renderIcon = (variant: DialogVariant) => {
    switch (variant) {
      case 'danger':
        return (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
            <XCircle className="h-5 w-5" />
          </div>
        );
      case 'warning':
        return (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
          </div>
        );
      case 'success':
        return (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        );
      default:
        return (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
            <Info className="h-5 w-5" />
          </div>
        );
    }
  };

  const primaryBtnStyle = (variant: DialogVariant) => {
    switch (variant) {
      case 'danger':
        return 'bg-rose-600 hover:bg-rose-700 focus:ring-rose-500 text-white';
      case 'warning':
        return 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500 text-white';
      case 'success':
        return 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500 text-white';
      default:
        return 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 text-white';
    }
  };

  return (
    <AppDialogContext.Provider value={{ showConfirm, showAlert }}>
      {children}
      {dialog && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) handleClose(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl"
          >
            <div className="flex items-start gap-3.5">
              {renderIcon(dialog.variant)}
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold text-slate-900">{dialog.title}</h3>
                <p className="mt-1.5 whitespace-pre-line break-words text-sm leading-relaxed text-slate-600">
                  {dialog.message}
                </p>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-3.5">
              {dialog.kind === 'confirm' && (
                <button
                  type="button"
                  onClick={() => handleClose(false)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300"
                >
                  {dialog.cancelText}
                </button>
              )}
              <button
                ref={primaryBtnRef}
                type="button"
                onClick={() => handleClose(true)}
                className={`rounded-lg px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-1 ${primaryBtnStyle(
                  dialog.variant
                )}`}
              >
                {dialog.kind === 'confirm' ? dialog.confirmText : dialog.okText}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppDialogContext.Provider>
  );
};

export function useAppDialog(): AppDialogContextValue {
  const ctx = useContext(AppDialogContext);
  if (!ctx) {
    throw new Error('useAppDialog harus digunakan di dalam AppDialogProvider');
  }
  return ctx;
}
