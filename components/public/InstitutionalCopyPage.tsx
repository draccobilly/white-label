import { PublicInfoPage } from "@/components/public/PublicInfoPage";
import type { getPublicPageChrome } from "@/lib/public-campaigns";

type Chrome = Awaited<ReturnType<typeof getPublicPageChrome>>;

export function InstitutionalCopyPage({
  chrome,
  title,
  lead,
  paragraphs,
}: {
  chrome: Chrome;
  title: string;
  lead: string;
  paragraphs: string[];
}) {
  return (
    <PublicInfoPage chrome={chrome} title={title} lead={lead}>
      {paragraphs.map((paragraph) => (
        <p key={paragraph.slice(0, 48)}>{paragraph}</p>
      ))}
    </PublicInfoPage>
  );
}
