import { CopyLinkButton } from "@/components/admin/CopyLinkButton";

export function CampaignPublicLinks({
  campaignSlug,
  affiliateSlug,
  pathPrefix,
  short = false,
}: {
  campaignSlug: string;
  affiliateSlug: string;
  pathPrefix?: string | null;
  short?: boolean;
}) {
  const base = short
    ? `/c/${campaignSlug}`
    : `/c/${campaignSlug}/${affiliateSlug}`;
  return (
    <div className="admin-inline-actions" style={{ flexWrap: "wrap", gap: 12 }}>
      <CopyLinkButton
        path={base}
        prefix={pathPrefix}
        label="Copy product"
      />
      <CopyLinkButton
        path={`${base}/checkout`}
        prefix={pathPrefix}
        label="Copy checkout"
      />
    </div>
  );
}
