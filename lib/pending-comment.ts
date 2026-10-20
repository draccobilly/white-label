export const PENDING_COMMENT_MAX = 280;

export type PendingCampaignComment = {
  affiliatePageId: string;
  body: string;
  authorName: string;
  savedAt: number;
};

function storageKey(affiliatePageId: string) {
  return `arc-pending-comment:${affiliatePageId}`;
}

export function readPendingComment(
  affiliatePageId: string,
): PendingCampaignComment | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(affiliatePageId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingCampaignComment>;
    const body = parsed.body?.trim() ?? "";
    if (!body || parsed.affiliatePageId !== affiliatePageId) return null;
    return {
      affiliatePageId,
      body: body.slice(0, PENDING_COMMENT_MAX),
      authorName: (parsed.authorName ?? "").trim().slice(0, 80),
      savedAt: typeof parsed.savedAt === "number" ? parsed.savedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

export function savePendingComment(
  affiliatePageId: string,
  body: string,
  authorName = "",
) {
  if (typeof window === "undefined") return;
  const draft: PendingCampaignComment = {
    affiliatePageId,
    body: body.trim().slice(0, PENDING_COMMENT_MAX),
    authorName: authorName.trim().slice(0, 80),
    savedAt: Date.now(),
  };
  window.localStorage.setItem(storageKey(affiliatePageId), JSON.stringify(draft));
}

export function clearPendingComment(affiliatePageId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(storageKey(affiliatePageId));
}
