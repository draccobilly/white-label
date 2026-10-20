"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";

type DonateModalContextValue = {
  open: () => void;
  close: () => void;
  isOpen: boolean;
};

const DonateModalContext = createContext<DonateModalContextValue | null>(null);

export function DonateModalProvider({
  children,
  scrollTarget,
}: {
  children: ReactNode;
  scrollTarget?: string;
}) {
  const [isOpen, setOpen] = useState(false);
  const open = useCallback(() => {
    if (scrollTarget) {
      document.getElementById(scrollTarget)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      return;
    }
    setOpen(true);
  }, [scrollTarget]);
  const close = useCallback(() => setOpen(false), []);
  const value = useMemo(() => ({ open, close, isOpen }), [open, close, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  return (
    <DonateModalContext.Provider value={value}>{children}</DonateModalContext.Provider>
  );
}

export function useDonateModal() {
  return useContext(DonateModalContext);
}

export function DonateTrigger({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const modal = useDonateModal();
  if (modal) {
    return (
      <button type="button" className={className} onClick={modal.open}>
        {children}
      </button>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
