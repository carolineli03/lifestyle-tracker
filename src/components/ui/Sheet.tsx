"use client";

import { useEffect, useId, useRef } from "react";
import { Icon } from "./icons";

/**
 * Bottom sheet on a native <dialog>. showModal() gives a real focus trap, Esc
 * to close, an inert page behind, and focus returned to whatever opened it,
 * so there's no hand-rolled focus management to get wrong.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  headerExtra,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  /** Sticky at the bottom: the sheet's one primary action. */
  footer?: React.ReactNode;
  headerExtra?: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<Element | null>(null);
  const titleId = useId();

  // Unlock scrolling now rather than when the async "close" event lands.
  function dismiss(): void {
    document.documentElement.style.overflow = "";
    ref.current?.close();
  }

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      opener.current = document.activeElement;
      dialog.showModal();
      document.documentElement.style.overflow = "hidden";
    } else if (!open && dialog.open) {
      document.documentElement.style.overflow = "";
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const handleClose = () => {
      document.documentElement.style.overflow = "";
      if (opener.current instanceof HTMLElement) opener.current.focus();
      onClose();
    };
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onClose]);

  useEffect(() => () => {
    document.documentElement.style.overflow = "";
  }, []);

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby={titleId}
      // Tapping the dimmed backdrop (the dialog element itself, outside the panel) closes.
      onClick={(e) => {
        if (e.target === ref.current) dismiss();
      }}
      // Chrome can swallow a native Esc (no recent user activation), so close explicitly.
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          dismiss();
        }
      }}
    >
      {open && (
        <div className="sheet-panel">
          <div className="sheet-handle" aria-hidden="true" />
          <header className="sheet-header">
            <h2 id={titleId} className="t-section min-w-0 flex-1 truncate">
              {title}
            </h2>
            {headerExtra}
            <button type="button" className="icon-btn" onClick={dismiss} aria-label="Close">
              <Icon name="close" />
            </button>
          </header>
          <div className="sheet-body">{children}</div>
          {footer && <div className="sheet-footer">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}
