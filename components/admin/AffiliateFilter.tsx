"use client";

import { useMemo, useState } from "react";
import { AdminSheet } from "@/components/admin/AdminSheet";

export type AffiliateFilterOption = {
  id: string;
  name: string;
};

export function AffiliateFilter({
  affiliates,
  selectedIds,
  onChange,
}: {
  affiliates: AffiliateFilterOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allSelected = selectedIds.length === 0;
  const visible = affiliates.filter((affiliate) =>
    affiliate.name.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const label = allSelected
    ? "All partners"
    : selectedIds.length === 1
      ? (affiliates.find((affiliate) => affiliate.id === selectedIds[0])?.name ?? "1 partner")
      : `${selectedIds.length} partners`;

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  }

  return (
    <>
      <button type="button" className="dash-filter-btn" onClick={() => setOpen(true)}>
        {label}
      </button>
      <AdminSheet open={open} title="Affiliates" onClose={() => setOpen(false)}>
        <label className="dash-search">
          <span className="sr-only">Search</span>
          <input
            value={query}
            placeholder="Search"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <button type="button" className="dash-check-row" onClick={() => onChange([])}>
          <span className={allSelected ? "is-on" : undefined} />
          All affiliates
        </button>
        {visible.map((affiliate) => (
          <button
            type="button"
            className="dash-check-row"
            key={affiliate.id}
            onClick={() => toggle(affiliate.id)}
          >
            <span className={selected.has(affiliate.id) ? "is-on" : undefined} />
            {affiliate.name}
          </button>
        ))}
        {!visible.length ? <p className="dash-empty">No affiliates match.</p> : null}
      </AdminSheet>
    </>
  );
}
