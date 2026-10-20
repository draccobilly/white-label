"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, ChevronDown } from "lucide-react";
import { companyDesk } from "@/lib/company-desk";

type CompanyOption = {
  id: string;
  name: string;
  isDefault: boolean;
  slug?: string | null;
  locale?: string | null;
  paymentGateway?: string | null;
};

export function CompanySwitcher({
  companies,
  currentId,
}: {
  companies: CompanyOption[];
  currentId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const current = companies.find((company) => company.id === currentId) ?? companies[0];
  const currentDesk = current ? companyDesk(current) : null;

  useEffect(() => {
    function onPointer(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, []);

  async function select(companyId: string) {
    setOpen(false);
    if (companyId === currentId) return;
    await fetch("/api/admin/companies/select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId }),
    });
    const parts = window.location.pathname.split("/");
    const section = parts[2];
    const entityId = parts[3];
    const onOtherDeskEntity =
      Boolean(entityId) &&
      entityId !== "new" &&
      (section === "campaigns" ||
        section === "affiliates" ||
        section === "integrations");
    router.refresh();
    window.location.assign(
      onOtherDeskEntity
        ? `/admin/${section}?notice=desk-switch`
        : window.location.pathname + window.location.search,
    );
  }

  return (
    <div className="desk-switcher" ref={wrapRef}>
      <button
        type="button"
        className="desk-switcher-trigger"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Building2 size={14} aria-hidden />
        <span>{currentDesk?.region ?? "Desk"}</span>
        <ChevronDown size={14} aria-hidden />
      </button>
      {open ? (
        <div className="desk-switcher-menu" role="listbox">
          {companies.map((company) => {
            const desk = companyDesk(company);
            const active = company.id === currentId;
            return (
              <button
                key={company.id}
                type="button"
                role="option"
                aria-selected={active}
                className={active ? "is-active" : undefined}
                onClick={() => void select(company.id)}
              >
                <span>{desk.region}</span>
                {active ? <Check size={14} aria-hidden /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
