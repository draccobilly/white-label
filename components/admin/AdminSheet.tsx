"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function AdminSheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="dash-sheet-root">
      <button type="button" className="dash-sheet-backdrop" aria-label="Close" onClick={onClose} />
      <div className="dash-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="dash-sheet-handle" />
        <header className="dash-sheet-head">
          <h2>{title}</h2>
          <button type="button" className="dash-sheet-done" onClick={onClose}>
            Done
          </button>
        </header>
        <div className="dash-sheet-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
