"use client";

import { useRouter } from "next/navigation";
import { PeriodPicker, type PeriodSelection } from "@/components/admin/PeriodPicker";
import { comparisonQuery, resolveComparison, type Comparison } from "@/lib/periods";

/** Period control for the analytics and health screens. */
export function AnalyticsBoard({
  path,
  from,
  to,
  comparison,
}: {
  path: string;
  from: string;
  to: string;
  comparison: Comparison;
}) {
  const router = useRouter();

  function apply(selection: PeriodSelection) {
    const next = resolveComparison(
      selection.range,
      selection.compare,
      selection.compareRange?.from,
      selection.compareRange?.to,
    );
    const params = new URLSearchParams();
    params.set("from", selection.range.from);
    params.set("to", selection.range.to);
    for (const [key, value] of Object.entries(comparisonQuery(next))) params.set(key, value);
    router.replace(`${path}?${params.toString()}`);
  }

  return (
    <div className="dash-toolbar">
      <PeriodPicker value={{ from, to }} comparison={comparison} onApply={apply} />
    </div>
  );
}
