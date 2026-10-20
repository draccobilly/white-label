import { Copy } from "lucide-react";
import Link from "next/link";

export function CampaignDuplicateButton({
  campaignId,
}: {
  campaignId: string;
}) {
  return (
    <Link
      className="secondary-button"
      href={`/admin/campaigns/new?from=${campaignId}`}
    >
      <Copy size={15} aria-hidden />
      Duplicate
    </Link>
  );
}
