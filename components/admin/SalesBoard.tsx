"use client";

import { useRouter } from "next/navigation";
import { AffiliateFilter, type AffiliateFilterOption } from "@/components/admin/AffiliateFilter";
import { PeriodPicker, type PeriodSelection } from "@/components/admin/PeriodPicker";
import type { DateRange } from "@/lib/date-range";
import { comparisonQuery, resolveComparison, type Comparison } from "@/lib/periods";
import { gatewayLabel } from "@/lib/gateways";

export function SalesBoard({
  from,
  to,
  comparison,
  affiliates,
  selectedAffiliateIds,
  campaignId,
  view,
  gateway,
  gateways = [],
}: {
  from: string;
  to: string;
  comparison: Comparison;
  affiliates: AffiliateFilterOption[];
  selectedAffiliateIds: string[];
  campaignId?: string;
  view?: "donations" | "tips";
  /** Gateway the feed is filtered by; empty means all. */
  gateway?: string;
  /** Gateways seen in the period, shown as a filter when there is more than one. */
  gateways?: string[];
}) {
  const router = useRouter();

  function push(next: {
    range?: DateRange;
    comparison?: Comparison;
    ids?: string[];
    gateway?: string;
  }) {
    const range = next.range ?? { from, to };
    const compare = next.comparison ?? comparison;
    const ids = next.ids ?? selectedAffiliateIds;
    const gw = next.gateway ?? gateway ?? "";
    const params = new URLSearchParams();
    params.set("from", range.from);
    params.set("to", range.to);
    for (const [key, value] of Object.entries(comparisonQuery(compare))) params.set(key, value);
    if (ids.length) params.set("affiliates", ids.join(","));
    if (campaignId) params.set("campaign", campaignId);
    if (view === "tips") params.set("view", "tips");
    if (gw) params.set("gw", gw);
    router.replace(`/admin/sales?${params.toString()}`);
  }

  function applyPeriod(selection: PeriodSelection) {
    push({
      range: selection.range,
      comparison: resolveComparison(
        selection.range,
        selection.compare,
        selection.compareRange?.from,
        selection.compareRange?.to,
      ),
    });
  }

  return (
    <div className="dash-toolbar">
      <PeriodPicker value={{ from, to }} comparison={comparison} onApply={applyPeriod} />
      <div className="dash-toolbar-side">
        {gateways.length > 1 ? (
          <div className="dash-seg" role="group" aria-label="Gateway">
            <button
              type="button"
              className={!gateway ? "is-active" : undefined}
              onClick={() => push({ gateway: "" })}
            >
              All
            </button>
            {gateways.map((item) => (
              <button
                key={item}
                type="button"
                className={gateway === item ? "is-active" : undefined}
                onClick={() => push({ gateway: item })}
              >
                {gatewayLabel(item)}
              </button>
            ))}
          </div>
        ) : null}
        <AffiliateFilter
          affiliates={affiliates}
          selectedIds={selectedAffiliateIds}
          onChange={(ids) => push({ ids })}
        />
      </div>
    </div>
  );
}
