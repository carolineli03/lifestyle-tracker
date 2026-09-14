"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

type ToastInput = { message: string; action?: { label: string; onAction: () => void | Promise<void> } };
type ToastItem = ToastInput & { id: number };

const ToastContext = createContext<(t: ToastInput) => void>(() => undefined);

/** Brief confirmations that don't take up layout. Errors stay inline next to what failed. */
export function useToast(): (t: ToastInput) => void {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastItem | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);

  const show = useCallback((t: ToastInput) => {
    seq.current += 1;
    setToast({ ...t, id: seq.current });
  }, []);

  useEffect(() => {
    if (!toast) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), toast.action ? 6000 : 3500);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [toast]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toast-region" aria-live="polite" role="status">
        {toast && (
          <div key={toast.id} className="toast">
            <span className="min-w-0 flex-1">{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                className="toast-action"
                onClick={() => {
                  const action = toast.action;
                  setToast(null);
                  void action?.onAction();
                }}
              >
                {toast.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}
