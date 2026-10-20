"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { AmountChipInput } from "@/components/admin/AmountChipInput";
import { BoldableTextField } from "@/components/admin/BoldableTextField";
import { CoverFocusPicker } from "@/components/admin/CoverFocusPicker";
import { VerifiedTick } from "@/components/campaign/VerifiedTick";
import {
  CampaignPaymentLinks,
  type AffiliateOption,
  type AffiliatePageLinks,
  type PaymentOption,
} from "@/components/admin/CampaignPaymentLinks";
import { MediaUpload } from "@/components/admin/MediaUpload";
import { StoryTextarea } from "@/components/admin/StoryTextarea";
import { CampaignPublicLinks } from "@/components/admin/CampaignPublicLinks";
import { WizardStepper } from "@/components/admin/WizardStepper";
import { AdminFormMessage, looksLikeError } from "@/components/admin/AdminFormMessage";
import { formatMajorAmount, parseMajorAmount } from "@/lib/money-input";
import { goalStagesLadder, goalStagesProblem, stageCompletedLabel } from "@/lib/campaign-stages";
import {
  gatewayNameLineProblems,
  renderGatewayName,
  splitGatewayNameLines,
} from "@/lib/gateway-name-rules";
import { publicHostname } from "@/lib/public-site-url";
import { formatMoney, slugify } from "@/lib/utils";
import { DOCUMENT_UPLOAD_ACCEPT, isPdfUrl } from "@/lib/media-file";
import {
  MEXICO_EDITOR_COPY,
  defaultDonationSetup,
  mexicoLocalizedCampaignCopy,
  mexicoLocalizedText,
  normalizeMexicoGoalAmount,
} from "@/lib/campaign-defaults";

export type CampaignEditorValue = {
  title: string;
  slug: string;
  organizerName: string;
  organizerImageUrl: string;
  organizerVerified: boolean;
  organizerBoldText: string;
  titleBoldText: string;
  summary: string;
  story: string;
  category: string;
  coverImageUrl: string;
  coverFocusX: number;
  coverFocusY: number;
  galleryImageUrls: string[];
  verificationDocumentUrls: string[];
  verificationNote: string;
  videoUrl: string;
  checkoutSubtitle: string;
  socialProofText: string;
  storyHeading: string;
  recentDonationsDescription: string;
  commentsDescription: string;
  thankYouTitle: string;
  thankYouMessage: string;
  goalAmount: number;
  currentAmount: number;
  supporterCount: number;
  /** Percent of paid gifts added to the baseline on the public page. 1 = 1%. */
  displayPaidPercent: number;
  currency: "USD" | "EUR" | "GBP" | "BRL" | "CAD" | "MXN" | "ARS";
  amounts: number[];
  suggestedAmount: number;
  showMissionTip: boolean;
  missionTipBold: boolean;
  unlisted: boolean;
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED";
  updates: Array<{
    id?: string;
    title?: string;
    body: string;
    createdAt?: string;
  }>;
  /** Product names sent to Stripe/PayPal, each with {amount}. */
  gatewayNames: string[];
  /** Goals after the first, in cents, ascending. Empty for a single goal. */
  nextGoals: number[];
};

/** How the stored product names came to be, for the notice under the list. */
export type GatewayNamesInfo = {
  source: string | null;
  at: string | null;
  /** Title, summary or story changed after the names were written. */
  stale: boolean;
  /** An AI key is set on this server. */
  aiConfigured: boolean;
};

const DEFAULT_COMMENTS =
  "Comments unlock only after a successful donation — one note per gift.";
const DEFAULT_CATEGORY = "Urgent cause";
const DEFAULT_STORY_HEADING = "Why this campaign matters";

/**
 * "150000, 350000" or one amount per line, typed in the currency's own format,
 * as cents. A comma followed by exactly three digits is a thousands separator.
 */
function parseStageAmounts(text: string, currency: string): number[] {
  return text
    .split(/[\n;]+|,(?!\d{3}(?!\d))/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => Math.round((parseMajorAmount(part, currency) ?? 0) * 100));
}

const STEPS = [
  { id: 1, label: "Product page", hint: "Capa, história e valores" },
  { id: 2, label: "Checkout", hint: "Textos do checkout" },
  { id: 3, label: "Thank you", hint: "Depois da doação" },
  { id: 4, label: "Payment links", hint: "Stripe por afiliado" },
];

const emptyCampaign: CampaignEditorValue = {
  title: "",
  slug: "",
  organizerName: "Giving Site",
  organizerImageUrl: "",
  organizerVerified: true,
  organizerBoldText: "",
  titleBoldText: "",
  summary: "",
  story: "",
  category: DEFAULT_CATEGORY,
  coverImageUrl: "",
  coverFocusX: 50,
  coverFocusY: 50,
  galleryImageUrls: [],
  verificationDocumentUrls: [],
  verificationNote: "",
  videoUrl: "",
  checkoutSubtitle: "Your support can change a life today.",
  socialProofText: "A supporter donated recently",
  storyHeading: DEFAULT_STORY_HEADING,
  recentDonationsDescription:
    "Every gift appears here so supporters can confirm their help was counted.",
  commentsDescription: DEFAULT_COMMENTS,
  thankYouTitle: "Thank you!",
  thankYouMessage:
    "Here’s your confirmation — and the official record of your gift.",
  ...defaultDonationSetup(false),
  showMissionTip: true,
  missionTipBold: false,
  unlisted: true,
  currentAmount: 0,
  supporterCount: 0,
  displayPaidPercent: 1,
  status: "ACTIVE",
  updates: [],
  gatewayNames: [],
  nextGoals: [],
};

export function CampaignEditor({
  campaignId,
  initial,
  initialStep = 1,
  duplicateFromId,
  defaultOrganizerName = "Giving Site",
  affiliates = [],
  pages = [],
  options = [],
  pathPrefix,
  isMexico = false,
  isArgentina = false,
  hidePaymentLinks,
  operatorMode = false,
  publicPage,
  shortDonationPath = false,
  gatewayNamesInfo,
}: {
  campaignId?: string;
  initial?: CampaignEditorValue;
  initialStep?: number;
  duplicateFromId?: string;
  defaultOrganizerName?: string;
  affiliates?: AffiliateOption[];
  pages?: AffiliatePageLinks[];
  options?: PaymentOption[];
  hidePaymentLinks?: boolean;
  operatorMode?: boolean;
  publicPage?: { campaignSlug: string; affiliateSlug: string } | null;
  pathPrefix?: string | null;
  isMexico?: boolean;
  isArgentina?: boolean;
  shortDonationPath?: boolean;
  gatewayNamesInfo?: GatewayNamesInfo | null;
}) {
  const router = useRouter();
  const hideLinks = operatorMode || (hidePaymentLinks ?? (isMexico || isArgentina));
  const spanishDesk = isMexico || isArgentina;
  const mexicoDefaults = defaultDonationSetup(
    isArgentina ? "argentina" : isMexico,
  );
  const blankCampaign: CampaignEditorValue = {
    ...emptyCampaign,
    organizerName: defaultOrganizerName,
    currency: mexicoDefaults.currency,
    goalAmount: mexicoDefaults.goalAmount,
    amounts: mexicoDefaults.amounts,
    suggestedAmount: mexicoDefaults.suggestedAmount,
    ...(spanishDesk ? MEXICO_EDITOR_COPY : {}),
  };
  const [step, setStep] = useState(initialStep);
  const [form, setForm] = useState(() => {
    const loaded = !initial
      ? blankCampaign
      : {
          ...initial,
          organizerName: initial.organizerName?.trim() || defaultOrganizerName,
          organizerImageUrl: initial.organizerImageUrl ?? "",
          organizerVerified: initial.organizerVerified ?? true,
          organizerBoldText: initial.organizerBoldText ?? "",
          titleBoldText: initial.titleBoldText ?? "",
          galleryImageUrls: initial.galleryImageUrls ?? [],
          verificationDocumentUrls: initial.verificationDocumentUrls ?? [],
          verificationNote: initial.verificationNote ?? "",
          showMissionTip: initial.showMissionTip !== false,
          missionTipBold: initial.missionTipBold === true,
          unlisted: initial.unlisted !== false,
          gatewayNames: initial.gatewayNames ?? [],
          nextGoals: initial.nextGoals ?? [],
        };
    return spanishDesk ? mexicoLocalizedCampaignCopy(loaded) : loaded;
  });
  const [stagesText, setStagesText] = useState(() =>
    (initial?.nextGoals ?? []).map((cents) => String(cents / 100)).join(", "),
  );
  const [gatewayNamesText, setGatewayNamesText] = useState(() =>
    (initial?.gatewayNames ?? []).join("\n"),
  );
  const [gatewayNamesNote, setGatewayNamesNote] = useState<GatewayNamesInfo | null>(
    gatewayNamesInfo ?? null,
  );
  const [writingNames, setWritingNames] = useState(false);
  const [namesMessage, setNamesMessage] = useState<{
    tone: "error" | "success" | "info";
    text: string;
  } | null>(null);
  const [amounts, setAmounts] = useState(
    (initial ?? blankCampaign).amounts.map((amount) => amount / 100),
  );
  const [suggested, setSuggested] = useState(
    (initial ?? blankCampaign).suggestedAmount / 100,
  );
  const [goal, setGoal] = useState(
    String((initial ?? blankCampaign).goalAmount / 100),
  );
  const [raised, setRaised] = useState(
    String(((initial ?? blankCampaign).currentAmount ?? 0) / 100),
  );
  const [donations, setDonations] = useState(
    String((initial ?? blankCampaign).supporterCount ?? 0),
  );
  const [paidPercent, setPaidPercent] = useState(
    String((initial ?? blankCampaign).displayPaidPercent ?? 1),
  );
  const [updates, setUpdates] = useState(
    () => (initial ?? blankCampaign).updates ?? [],
  );
  const [updateDraft, setUpdateDraft] = useState("");
  const [updateTitleDraft, setUpdateTitleDraft] = useState("");
  const [galleryUrlDraft, setGalleryUrlDraft] = useState("");
  const [documentUrlDraft, setDocumentUrlDraft] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [assignAffiliateId, setAssignAffiliateId] = useState("");
  const [affiliateMissing, setAffiliateMissing] = useState(false);
  const [affiliateFlash, setAffiliateFlash] = useState(0);
  const savingRef = useRef(false);

  const lastStep = hideLinks ? 3 : 4;
  const unlockedUntil = campaignId ? lastStep : 3;
  const selectedAffiliate = affiliates.find((item) => item.id === assignAffiliateId) ?? null;
  const selectedAffiliateLink =
    selectedAffiliate && (publicPage?.campaignSlug || form.slug)
      ? {
          campaignSlug: publicPage?.campaignSlug || form.slug,
          affiliateSlug: selectedAffiliate.slug,
        }
      : null;

  function collectedUpdates(
    list = updates,
    draftTitle = updateTitleDraft,
    draftBody = updateDraft,
  ) {
    const fromList = list
      .map((update) => ({
        ...(update.id ? { id: update.id } : {}),
        title: update.title?.trim() || undefined,
        body: update.body.trim(),
      }))
      .filter((update) => update.body.length > 0);
    const body = draftBody.trim();
    if (!body) return fromList;
    return [{ title: draftTitle.trim() || undefined, body }, ...fromList];
  }

  function applyGatewayNamesText(text: string) {
    setGatewayNamesText(text);
    setForm((current) => ({ ...current, gatewayNames: splitGatewayNameLines(text) }));
  }

  /** Asks the model for names from the text on screen; they are saved with the campaign. */
  async function writeNamesWithAi() {
    if (writingNames) return;
    if (form.title.trim().length < 5 || form.story.trim().length < 20) {
      setNamesMessage({
        tone: "info",
        text: "Write the title and the story first, then come back here.",
      });
      return;
    }
    setWritingNames(true);
    setNamesMessage(null);
    try {
      const response = await fetch("/api/admin/campaigns/gateway-names", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          category: form.category,
          summary: form.summary,
          story: form.story,
        }),
        signal: AbortSignal.timeout(45_000),
      });
      const result = (await response.json().catch(() => ({}))) as {
        names?: string[];
        model?: string;
        error?: string;
        configured?: boolean;
      };
      if (!response.ok || !Array.isArray(result.names)) {
        if (result.configured === false) {
          setGatewayNamesNote((current) => ({
            source: current?.source ?? null,
            at: current?.at ?? null,
            stale: current?.stale ?? false,
            aiConfigured: false,
          }));
        }
        setNamesMessage({
          tone: "error",
          text: result.error ?? "Unable to write product names right now.",
        });
        return;
      }
      applyGatewayNamesText(result.names.join("\n"));
      setGatewayNamesNote({
        source: result.model ?? "ai",
        at: new Date().toISOString(),
        stale: false,
        aiConfigured: true,
      });
      setNamesMessage({
        tone: "success",
        text: `${result.names.length} names written from the story. Edit any line you like, then Save campaign.`,
      });
    } catch (cause) {
      setNamesMessage({
        tone: "error",
        text:
          cause instanceof DOMException && cause.name === "TimeoutError"
            ? "The model took too long. Try again in a moment."
            : cause instanceof Error
              ? cause.message
              : "Unable to write product names right now.",
      });
    } finally {
      setWritingNames(false);
    }
  }

  async function save(
    andContinue = false,
    statusOverride?: CampaignEditorValue["status"],
    updatesOverride?: CampaignEditorValue["updates"],
  ) {
    if (!campaignId && !operatorMode && !assignAffiliateId) {
      setStep(1);
      setAffiliateMissing(true);
      setAffiliateFlash((current) => current + 1);
      setMessage("Escolha para quem vai esta campanha.");
      return false;
    }
    if (savingRef.current) return false;
    savingRef.current = true;
    setLoading(true);
    setMessage(null);
    const moneyCurrency = isArgentina ? "ARS" : isMexico ? "MXN" : form.currency;
    const amountValues = amounts
      .map((value) => Math.round(Number(value) * 100))
      .filter((value) => Number.isFinite(value) && value > 0);
    const nextStatus = statusOverride ?? form.status;
    const goalMajor = parseMajorAmount(goal, moneyCurrency) ?? Number(goal);
    const nextGoals = parseStageAmounts(stagesText, moneyCurrency);
    const raisedMajor = parseMajorAmount(raised, moneyCurrency) ?? Number(raised);
    const raisedCents = Math.max(0, Math.round(raisedMajor * 100) || 0);
    const donationCount = Math.max(0, Math.round(Number(donations)) || 0);
    const paidPercentValue = Math.min(
      100,
      Math.max(0, Math.round(Number(paidPercent)) || 0),
    );
    const nextUpdates = collectedUpdates(
      updatesOverride ?? updates,
      updatesOverride ? "" : updateTitleDraft,
      updatesOverride ? "" : updateDraft,
    );
    const { currentAmount: _ignoredRaised, supporterCount: _ignoredDonations, updates: _formUpdates, ...formRest } =
      form;
    const payload = {
      ...formRest,
      status: nextStatus,
      category: spanishDesk ? "Causa urgente" : DEFAULT_CATEGORY,
      storyHeading: spanishDesk
        ? mexicoLocalizedText(
            form.storyHeading,
            MEXICO_EDITOR_COPY.storyHeading,
          )
        : DEFAULT_STORY_HEADING,
      commentsDescription: spanishDesk
        ? mexicoLocalizedText(
            form.commentsDescription,
            MEXICO_EDITOR_COPY.commentsDescription,
          )
        : DEFAULT_COMMENTS,
      goalAmount: isMexico || isArgentina
        ? normalizeMexicoGoalAmount(Math.round(Number(goalMajor) * 100) || 0)
        : Math.round(Number(goalMajor) * 100) || 0,
      nextGoals,
      amounts: amountValues,
      suggestedAmount: Math.round(Number(suggested) * 100),
      updates: nextUpdates,
      gatewayNames: splitGatewayNameLines(gatewayNamesText),
      ...(isMexico ? { currency: "MXN" as const } : {}),
      ...(isArgentina ? { currency: "ARS" as const } : {}),
      ...(campaignId || raisedCents > 0 ? { currentAmount: raisedCents } : {}),
      ...(campaignId || donationCount > 0 ? { supporterCount: donationCount } : {}),
      displayPaidPercent: paidPercentValue,
    };
    let stayLocked = false;
    try {
    const response = await fetch("/api/admin/campaigns", {
      method: campaignId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        campaignId
          ? { campaignId, campaign: payload }
          : { ...payload, duplicateFromId, assignAffiliateId },
      ),
      signal: AbortSignal.timeout(45_000),
    });
    const raw = await response.text();
    let result: {
      campaign?: { id: string; updates?: unknown; gatewayNames?: unknown };
      gatewayNames?: { status: string; names: string[]; model?: string; error?: string };
      error?: string;
      existing?: boolean;
    } = {};
    try {
      result = raw ? (JSON.parse(raw) as typeof result) : {};
    } catch {
      setMessage(
        response.status >= 500
          ? "Save is still running. Wait a few seconds, then open the campaign from the list if it appears."
          : "Unable to save campaign",
      );
      return false;
    }
    if (result.campaign?.id && !campaignId) {
      stayLocked = true;
      router.push(
        hideLinks
          ? `/admin/campaigns/${result.campaign.id}`
          : `/admin/campaigns/${result.campaign.id}?step=4`,
      );
      return true;
    }
    if (!response.ok) {
      const error = String(result.error ?? "Unable to save campaign");
      setMessage(error);
      if (/product name on stripe/i.test(error)) {
        setStep(2);
      } else if (/campaign title|public slug|organizer|summary|story|cover|gallery/i.test(error)) {
        setStep(1);
      } else if (/checkout|donation amount|goal/i.test(error)) {
        setStep(2);
      }
      return false;
    }
    setForm((current) => ({ ...current, status: nextStatus }));
    const settled = result.gatewayNames;
    if (settled && Array.isArray(settled.names)) {
      setGatewayNamesText(settled.names.join("\n"));
      setForm((current) => ({ ...current, gatewayNames: settled.names }));
      setGatewayNamesNote((current) => ({
        aiConfigured: current?.aiConfigured ?? settled.status !== "unconfigured",
        source:
          settled.status === "generated"
            ? settled.model ?? "ai"
            : settled.status === "manual"
              ? "manual"
              : current?.source ?? null,
        at:
          settled.status === "generated" || settled.status === "manual"
            ? new Date().toISOString()
            : current?.at ?? null,
        // "current"/"generated"/"manual" match the saved text; anything else kept an older list.
        stale:
          settled.names.length > 0 &&
          !["current", "generated", "manual"].includes(settled.status),
      }));
      setNamesMessage(
        settled.status === "generated"
          ? {
              tone: "success",
              text: `${settled.names.length} product names written from the story. Review them on the Checkout step.`,
            }
          : settled.status === "failed"
            ? {
                tone: "error",
                text: `Product names were not written: ${settled.error ?? "unknown error"}. The automatic word rule names the gifts until then.`,
              }
            : null,
      );
    }
    if (Array.isArray(result.campaign?.updates)) {
      setUpdates(
        result.campaign.updates.map(
          (update: {
            id: string;
            title: string | null;
            body: string;
            createdAt: string | Date;
          }) => ({
            id: update.id,
            title: update.title ?? "",
            body: update.body,
            createdAt:
              typeof update.createdAt === "string"
                ? update.createdAt
                : new Date(update.createdAt).toISOString(),
          }),
        ),
      );
      setUpdateDraft("");
      setUpdateTitleDraft("");
    }
    setMessage(
      statusOverride === "ACTIVE"
        ? hideLinks
          ? "Published. The public domain shows it now."
          : "Published. The VPS shows it now — copy the affiliate link from Payment Links."
        : nextUpdates.length
          ? "Campaign and updates saved. They appear on the public page now."
          : "Campaign updated across every affiliate page.",
    );
    if (andContinue && !hideLinks) setStep(4);
    router.refresh();
    return true;
    } catch (cause) {
      const timedOut =
        cause instanceof DOMException && cause.name === "TimeoutError";
      setMessage(
        timedOut
          ? "Save timed out. Wait a few seconds, then open the campaign from the list if it appears."
          : cause instanceof Error
            ? cause.message
            : "Unable to save campaign",
      );
      return false;
    } finally {
      if (!stayLocked) {
        savingRef.current = false;
        setLoading(false);
      }
    }
  }

  return (
    <form
      className="admin-form campaign-wizard"
      onSubmit={(event) => {
        event.preventDefault();
        if (step < 3) {
          if (!campaignId && !operatorMode && !assignAffiliateId) {
            setStep(1);
            setAffiliateMissing(true);
            setAffiliateFlash((current) => current + 1);
            setMessage("Escolha para quem vai esta campanha.");
            return;
          }
          if (campaignId) {
            void save(false).then((ok) => {
              if (ok) setStep((current) => current + 1);
            });
            return;
          }
          setStep((current) => current + 1);
          return;
        }
        if (step === 3) {
          void save(true);
          return;
        }
      }}
    >
      <WizardStepper
        steps={hideLinks ? STEPS.filter((stepItem) => stepItem.id < 4) : STEPS}
        current={step}
        unlockedUntil={unlockedUntil}
        onSelect={setStep}
      />
      {message && looksLikeError(message) ? (
        <div className="wizard-feedback">
          <AdminFormMessage tone="error">{message}</AdminFormMessage>
        </div>
      ) : null}
      {campaignId && (operatorMode ? publicPage : selectedAffiliateLink) ? (
        <CampaignPublicLinks
          campaignSlug={(operatorMode ? publicPage : selectedAffiliateLink)!.campaignSlug}
          affiliateSlug={(operatorMode ? publicPage : selectedAffiliateLink)!.affiliateSlug}
          pathPrefix={pathPrefix}
          short={shortDonationPath}
        />
      ) : null}

      {step === 1 ? (
        <section className="studio-page">
          <p className="studio-hint">
            {duplicateFromId
              ? operatorMode
                ? "Title, story and cover stay empty. Checkout, thank you and amounts copy from the original when you save."
                : isMexico
                ? "Title, story and cover stay empty. Checkout, thank you and amounts copy from the original when you save."
                : "Title, story and cover stay empty. The standard $25–$200 ticket is already filled so Payment Links copy from the source campaign when you save."
              : operatorMode
                ? "Fill in the campaign page, checkout and thank you. After you save, copy the public product and checkout links."
                : isMexico
                ? "This page is reused for every affiliate. Amounts go live without Stripe Payment Links."
                : "Escolha o afiliado. O link público leva o slug dele, e a campanha fica só com essa pessoa."}
          </p>
          {!operatorMode && !campaignId ? (
            <label>
              Afiliado
              <select
                key={affiliateFlash}
                className={`admin-input${
                  affiliateMissing && !assignAffiliateId ? " is-invalid is-flash" : ""
                }`}
                value={assignAffiliateId}
                onChange={(event) => {
                  setAssignAffiliateId(event.target.value);
                  if (event.target.value) setAffiliateMissing(false);
                }}
              >
                <option value="">Escolha o afiliado</option>
                <option value="all">Todos</option>
                {affiliates.map((affiliate) => (
                  <option key={affiliate.id} value={affiliate.id}>
                    {affiliate.name}
                  </option>
                ))}
              </select>
              <span className="admin-field-hint">
                {assignAffiliateId === "all"
                  ? "A página é criada para cada afiliado, cada um com o próprio slug."
                  : `O endereço público fica /c/campanha/${selectedAffiliate?.slug || "slug-do-afiliado"}.`}
              </span>
            </label>
          ) : null}
          <div className={`studio-cover ${form.coverImageUrl ? "has-media" : ""}`}>
            {form.coverImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={form.coverImageUrl}
                alt=""
                style={{
                  objectPosition: `${form.coverFocusX}% ${form.coverFocusY}%`,
                }}
              />
            ) : (
              <div className="studio-cover-empty">
                <strong>Add a cover photo</strong>
                <span>This is the first thing donors see</span>
              </div>
            )}
            <div className="studio-cover-actions">
              <MediaUpload
                variant="cover"
                folder="campaigns"
                accept="image/*"
                label={form.coverImageUrl ? "Change cover" : "Upload cover"}
                onUploaded={(coverImageUrl) =>
                  setForm((current) => ({ ...current, coverImageUrl }))
                }
              />
              {form.coverImageUrl ? (
                <button
                  type="button"
                  className="studio-cover-remove"
                  onClick={() =>
                    setForm((current) => ({ ...current, coverImageUrl: "" }))
                  }
                >
                  Remove
                </button>
              ) : null}
            </div>
          </div>
          {form.coverImageUrl ? (
            <CoverFocusPicker
              url={form.coverImageUrl}
              focusX={form.coverFocusX}
              focusY={form.coverFocusY}
              onChange={({ x, y }) =>
                setForm((current) => ({ ...current, coverFocusX: x, coverFocusY: y }))
              }
            />
          ) : (
            <label className="studio-url-fallback">
              Or paste a cover URL
              <input
                className="admin-input"
                type="url"
                value={form.coverImageUrl}
                placeholder="https://"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    coverImageUrl: event.target.value,
                  }))
                }
              />
            </label>
          )}

          <div className="studio-section">
            <div className="studio-section-head">
              <h3>Organizer & title</h3>
              <p>Quem assina a campanha, o título e o endereço público. Bold marks the words that stand out on the page.</p>
            </div>
          <div className="studio-identity">
            <div className="studio-avatar">
              {form.organizerImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.organizerImageUrl} alt="" />
              ) : (
                <span>
                  {(form.organizerName.trim()[0] || "A").toUpperCase()}
                </span>
              )}
              <MediaUpload
                variant="avatar"
                folder="organizers"
                accept="image/*"
                label={form.organizerImageUrl ? "Change" : "Photo"}
                onUploaded={(organizerImageUrl) =>
                  setForm((current) => ({ ...current, organizerImageUrl }))
                }
              />
            </div>
            <div className="studio-identity-copy">
              <BoldableTextField
                variant="inline"
                label="Organizer"
                value={form.organizerName}
                boldText={form.organizerBoldText}
                required
                minLength={2}
                maxLength={120}
                onChange={(organizerName) =>
                  setForm((current) => ({ ...current, organizerName }))
                }
                onBoldChange={(organizerBoldText) =>
                  setForm((current) => ({ ...current, organizerBoldText }))
                }
              />
              <label className="studio-check">
                <input
                  type="checkbox"
                  checked={form.organizerVerified}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      organizerVerified: event.target.checked,
                    }))
                  }
                />
                <span className="verified-check-label">
                  Verified
                  <VerifiedTick />
                </span>
              </label>
            </div>
          </div>

          <BoldableTextField
            variant="title"
            label="Campaign title"
            value={form.title}
            boldText={form.titleBoldText}
            required
            maxLength={255}
            placeholder="Name this campaign"
            onChange={(title) =>
              setForm((current) => ({
                ...current,
                title,
                slug: current.slug ? current.slug : slugify(title),
              }))
            }
            onBoldChange={(titleBoldText) =>
              setForm((current) => ({ ...current, titleBoldText }))
            }
          />
          <label className="studio-slug">
            <span>
              {publicHostname()}{pathPrefix || ""}/c/
            </span>
            <input
              value={form.slug}
              required
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  slug: slugify(event.target.value),
                }))
              }
            />
          </label>
          </div>

          <div className="studio-section">
            <div className="studio-section-head">
              <h3>Campaign text</h3>
              <p>The short summary opens the page; the full story carries the case. Updates have their own section below.</p>
            </div>
          <label className="studio-field">
            Short summary
            <textarea
              className="admin-textarea"
              rows={3}
              value={form.summary}
              required
              onChange={(event) =>
                setForm((current) => ({ ...current, summary: event.target.value }))
              }
            />
          </label>
          <StoryTextarea
            id="campaign-story"
            label="Full story"
            rows={10}
            value={form.story}
            required
            onChange={(story) => setForm((current) => ({ ...current, story }))}
          />
          </div>

          <div className="studio-section">
            <h3>Gallery</h3>
            <p className="admin-help">
              Extra photos of the case. They appear between Donate/Share and
              Organizers on the public page.
            </p>
            {form.galleryImageUrls.length ? (
              <ul className="admin-gallery-list">
                {form.galleryImageUrls.map((url, index) => (
                  <li key={`${url}-${index}`} className="admin-gallery-item">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" />
                    <div className="admin-gallery-item-actions">
                      <button
                        type="button"
                        className="admin-text-link"
                        disabled={index === 0}
                        onClick={() =>
                          setForm((current) => {
                            if (index === 0) return current;
                            const next = [...current.galleryImageUrls];
                            [next[index - 1], next[index]] = [
                              next[index],
                              next[index - 1],
                            ];
                            return { ...current, galleryImageUrls: next };
                          })
                        }
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        className="admin-text-link"
                        disabled={index === form.galleryImageUrls.length - 1}
                        onClick={() =>
                          setForm((current) => {
                            if (index >= current.galleryImageUrls.length - 1) {
                              return current;
                            }
                            const next = [...current.galleryImageUrls];
                            [next[index], next[index + 1]] = [
                              next[index + 1],
                              next[index],
                            ];
                            return { ...current, galleryImageUrls: next };
                          })
                        }
                      >
                        Down
                      </button>
                      <button
                        type="button"
                        className="admin-text-link"
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            galleryImageUrls: current.galleryImageUrls.filter(
                              (_, itemIndex) => itemIndex !== index,
                            ),
                          }))
                        }
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <small className="admin-help">No gallery photos yet.</small>
            )}
            <MediaUpload
              folder="gallery"
              accept="image/*"
              multiple
              label="Upload gallery photos"
              onUploaded={(url) =>
                setForm((current) =>
                  current.galleryImageUrls.includes(url)
                    ? current
                    : {
                        ...current,
                        galleryImageUrls: [...current.galleryImageUrls, url].slice(
                          0,
                          24,
                        ),
                      },
                )
              }
            />
            <div className="admin-gallery-url">
              <input
                className="admin-input"
                type="url"
                value={galleryUrlDraft}
                placeholder="https://… paste a photo URL"
                onChange={(event) => setGalleryUrlDraft(event.target.value)}
              />
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  const url = galleryUrlDraft.trim();
                  if (!url) return;
                  setForm((current) =>
                    current.galleryImageUrls.includes(url)
                      ? current
                      : {
                          ...current,
                          galleryImageUrls: [
                            ...current.galleryImageUrls,
                            url,
                          ].slice(0, 24),
                        },
                  );
                  setGalleryUrlDraft("");
                }}
              >
                Add URL
              </button>
            </div>
          </div>
          <div className="studio-section">
            <h3>Verification documents</h3>
            <p className="admin-help">
              Photos, screenshots or scans of hospital letters, IDs or case
              papers (JPG, PNG, WEBP, HEIC or PDF). They appear above Organizers
              only after you save.
            </p>
            {form.verificationDocumentUrls.length ? (
              <ul className="admin-gallery-list">
                {form.verificationDocumentUrls.map((url, index) => (
                  <li key={`${url}-${index}`} className="admin-gallery-item">
                    {isPdfUrl(url) ? (
                      <span className="admin-document-file">PDF</span>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={url} alt="" />
                    )}
                    <div className="admin-gallery-item-actions">
                      <button
                        type="button"
                        className="admin-text-link"
                        disabled={index === 0}
                        onClick={() =>
                          setForm((current) => {
                            if (index === 0) return current;
                            const next = [...current.verificationDocumentUrls];
                            [next[index - 1], next[index]] = [
                              next[index],
                              next[index - 1],
                            ];
                            return { ...current, verificationDocumentUrls: next };
                          })
                        }
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        className="admin-text-link"
                        disabled={index === form.verificationDocumentUrls.length - 1}
                        onClick={() =>
                          setForm((current) => {
                            if (index >= current.verificationDocumentUrls.length - 1) {
                              return current;
                            }
                            const next = [...current.verificationDocumentUrls];
                            [next[index], next[index + 1]] = [
                              next[index + 1],
                              next[index],
                            ];
                            return { ...current, verificationDocumentUrls: next };
                          })
                        }
                      >
                        Down
                      </button>
                      <button
                        type="button"
                        className="admin-text-link"
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            verificationDocumentUrls:
                              current.verificationDocumentUrls.filter(
                                (_, itemIndex) => itemIndex !== index,
                              ),
                          }))
                        }
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <small className="admin-help">No verification documents yet.</small>
            )}
            <MediaUpload
              folder="documents"
              accept={DOCUMENT_UPLOAD_ACCEPT}
              multiple
              label="Upload photos or documents"
              onUploaded={(url) =>
                setForm((current) =>
                  current.verificationDocumentUrls.includes(url)
                    ? current
                    : {
                        ...current,
                        verificationDocumentUrls: [
                          ...current.verificationDocumentUrls,
                          url,
                        ].slice(0, 12),
                      },
                )
              }
            />
            <div className="admin-gallery-url">
              <input
                className="admin-input"
                type="url"
                value={documentUrlDraft}
                placeholder="https://… paste a photo or document URL"
                onChange={(event) => setDocumentUrlDraft(event.target.value)}
              />
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  const url = documentUrlDraft.trim();
                  if (!url) return;
                  setForm((current) =>
                    current.verificationDocumentUrls.includes(url)
                      ? current
                      : {
                          ...current,
                          verificationDocumentUrls: [
                            ...current.verificationDocumentUrls,
                            url,
                          ].slice(0, 12),
                        },
                  );
                  setDocumentUrlDraft("");
                }}
              >
                Add URL
              </button>
            </div>
            <label>
              Verification banner
              <input
                className="admin-input"
                value={form.verificationNote}
                maxLength={180}
                placeholder="Verified by our team at the hospital"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    verificationNote: event.target.value,
                  }))
                }
              />
              <small className="admin-help">
                Shown under the document thumbnails. Leave empty to hide the banner.
              </small>
            </label>
          </div>
          <div className="studio-section">
            <div className="studio-section-head">
              <h3>Goal & tickets</h3>
              <p>Public goal, the amounts donors can pick and the currency. Live paid gifts always add on top of what you type here.</p>
            </div>
          <div className="admin-grid admin-grid-3">
            <label>
              Goal amount
              <input
                className="admin-input"
                inputMode="decimal"
                value={goal}
                placeholder={form.currency === "ARS" ? "1.500.000" : "15000.00"}
                onChange={(event) => setGoal(event.target.value)}
                onBlur={() => {
                  const parsed = parseMajorAmount(goal, form.currency);
                  if (parsed) setGoal(String(parsed));
                }}
              />
              <small className="admin-help">
                {formatMajorAmount(Number(goal) || 0, form.currency) ||
                  "Type the public goal with decimals."}
              </small>
            </label>
            <label>
              Raised / Doado
              <input
                className="admin-input"
                inputMode="decimal"
                value={raised}
                onChange={(event) => setRaised(event.target.value)}
                onBlur={() => {
                  const parsed = parseMajorAmount(raised, form.currency);
                  setRaised(parsed ? String(parsed) : "0");
                }}
              />
              <small className="admin-help">
                Shown as{" "}
                {formatMajorAmount(Number(raised) || 0, form.currency) || "0"} donated.
                Live paid gifts still add on top.
              </small>
            </label>
            <label>
              Paid on the page (%)
              <input
                className="admin-input"
                type="number"
                min={0}
                max={100}
                step={1}
                value={paidPercent}
                onChange={(event) => setPaidPercent(event.target.value)}
                onBlur={() => {
                  const parsed = Math.round(Number(paidPercent));
                  setPaidPercent(
                    String(Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : 1),
                  );
                }}
              />
              <small className="admin-help">
                Percent of paid gifts added to the baseline on the public page. 1 is 1%. 0 shows only the baseline. 100 shows the full paid total.
              </small>
            </label>
            <label>
              Donations
              <input
                className="admin-input"
                type="number"
                min={0}
                step={1}
                value={donations}
                onChange={(event) => setDonations(event.target.value)}
              />
              <small className="admin-help">
                Shown as “31 donations”. Live paid gifts still add on top.
              </small>
            </label>
            <label>
              Currency
              <select
                className="admin-select"
                value={form.currency}
                disabled={isMexico || isArgentina}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    currency: event.target.value as CampaignEditorValue["currency"],
                  }))
                }
              >
                {["USD", "EUR", "GBP", "BRL", "CAD", "MXN", "ARS"].map((currency) => (
                  <option key={currency}>{currency}</option>
                ))}
              </select>
            </label>
          </div>
          {(() => {
            const moneyCurrency = isArgentina ? "ARS" : isMexico ? "MXN" : form.currency;
            const goalCents = Math.round((parseMajorAmount(goal, moneyCurrency) ?? 0) * 100);
            const nextGoals = parseStageAmounts(stagesText, moneyCurrency);
            const problem = goalStagesProblem(goalCents, nextGoals);
            const ladder = goalStagesLadder(goalCents, nextGoals);
            return (
              <label className="studio-field">
                Goal stages
                <input
                  className="admin-input"
                  inputMode="decimal"
                  value={stagesText}
                  placeholder={form.currency === "ARS" ? "15.000.000, 35.000.000" : "150000, 350000"}
                  onChange={(event) => setStagesText(event.target.value)}
                />
                <small className="admin-help">
                  Optional. The goal above is stage 1; list the goals that follow it, in order,
                  separated by commas. The page shows one goal at a time: when the raised amount
                  reaches it, the next stage opens on its own and “{stageCompletedLabel(1)}”
                  appears beside the new goal. Leave empty to keep a single goal.
                </small>
                {problem ? (
                  <AdminFormMessage tone="error">{problem}</AdminFormMessage>
                ) : ladder.length > 1 ? (
                  <small className="admin-help">
                    {ladder
                      .map(
                        (cents, index) =>
                          `Stage ${index + 1}: ${formatMajorAmount(cents / 100, moneyCurrency)}`,
                      )
                      .join(" → ")}
                  </small>
                ) : null}
              </label>
            );
          })()}
          <AmountChipInput
            amounts={amounts}
            suggested={suggested}
            currency={form.currency}
            showMissionTip={form.showMissionTip}
            missionTipBold={form.missionTipBold}
            onChange={setAmounts}
            onSuggested={setSuggested}
            onShowMissionTip={(showMissionTip) =>
              setForm((current) => ({ ...current, showMissionTip }))
            }
            onMissionTipBold={(missionTipBold) =>
              setForm((current) => ({ ...current, missionTipBold }))
            }
          />
          </div>

          <div className="studio-section">
          <div className="admin-updates">
            <h3>Updates</h3>
            <p className="admin-help">
              These posts appear on the public campaign page after you click
              Save campaign. Newest shows first.
            </p>
            {updates.length ? (
              <ul className="admin-updates-list">
                {updates.map((update, index) => (
                  <li key={update.id ?? `draft-${index}`} className="admin-update-item">
                    <label>
                      Title (optional)
                      <input
                        className="admin-input"
                        value={update.title ?? ""}
                        onChange={(event) =>
                          setUpdates((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, title: event.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                    </label>
                    <label>
                      Update
                      <textarea
                        className="admin-textarea"
                        style={{ minHeight: 90 }}
                        required
                        value={update.body}
                        onChange={(event) =>
                          setUpdates((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, body: event.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() =>
                        setUpdates((current) =>
                          current.filter((_, itemIndex) => itemIndex !== index),
                        )
                      }
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <label>
              Title (optional)
              <input
                className="admin-input"
                value={updateTitleDraft}
                onChange={(event) => setUpdateTitleDraft(event.target.value)}
              />
            </label>
            <label>
              New update
              <textarea
                className="admin-textarea"
                style={{ minHeight: 90 }}
                value={updateDraft}
                onChange={(event) => setUpdateDraft(event.target.value)}
              />
            </label>
            <div className="admin-update-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  const body = updateDraft.trim();
                  if (!body) return;
                  setUpdates((current) => [
                    {
                      title: updateTitleDraft.trim(),
                      body,
                    },
                    ...current,
                  ]);
                  setUpdateDraft("");
                  setUpdateTitleDraft("");
                }}
              >
                Add to list
              </button>
              {campaignId ? (
                <button
                  type="button"
                  className="primary-button"
                  disabled={loading}
                  onClick={() => void save(false)}
                >
                  {loading ? "Saving…" : "Save campaign"}
                </button>
              ) : (
                <p className="admin-help">
                  Create the campaign on step 3 first, then updates will publish.
                </p>
              )}
            </div>
          </div>
          </div>

          <div className="studio-section">
            <div className="studio-section-head">
              <h3>Visibility & status</h3>
              <p>Hidden causes open only from their direct link. Status decides whether the page is live.</p>
            </div>
          <label className="admin-checkline">
            <input
              type="checkbox"
              checked={form.unlisted}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  unlisted: event.target.checked,
                }))
              }
            />
            <span>Hidden cause</span>
            <small className="admin-help">
              New causes start hidden. A hidden cause stays off the public site and opens only from its direct link, including a Facebook ad. Turn this off to list it with the public causes.
            </small>
          </label>
          <label>
            Status
            <select
              className="admin-select"
              value={form.status}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  status: event.target.value as CampaignEditorValue["status"],
                }))
              }
            >
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Active</option>
              <option value="PAUSED">Paused</option>
              <option value="COMPLETED">Completed</option>
            </select>
            <small className="admin-help">
              Active is live on {publicHostname()}{pathPrefix || ""} as soon as you save. Draft stays off the public site.
            </small>
          </label>
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="studio-page studio-page-compact">
          <div className="editor-section-head">
            <h2>Checkout</h2>
            <p className="admin-help">
              Copy shown next to the donation form. Keep it short and specific to this case.
            </p>
          </div>
          <div className="editor-block">
          <label>
            Checkout subtitle
            <input
              className="admin-input"
              value={form.checkoutSubtitle}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  checkoutSubtitle: event.target.value,
                }))
              }
            />
          </label>
          <label>
            Social proof line
            <input
              className="admin-input"
              value={form.socialProofText}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  socialProofText: event.target.value,
                }))
              }
            />
          </label>
          <label>
            Recent donations description
            <textarea
              className="admin-textarea"
              style={{ minHeight: 76 }}
              value={form.recentDonationsDescription}
              required
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  recentDonationsDescription: event.target.value,
                }))
              }
            />
          </label>
          </div>
          <div className="editor-block">
            <div className="editor-section-head">
              <h3>Product name on Stripe / PayPal</h3>
              <p className="admin-help">
                Each gift goes to the processor under one of these names, in rotation, and the
                donor reads it on the receipt. They are written from the story: what happened,
                what the family lacks, what the money buys. One per line, each with{" "}
                <code>{"{amount}"}</code> where the donation amount goes. No person&apos;s name.
              </p>
            </div>
            <label>
              Names
              <textarea
                className="admin-textarea"
                style={{ minHeight: 230, fontFamily: "inherit" }}
                value={gatewayNamesText}
                placeholder={"{amount} to help a family move out of a home flooded with street water\nHelp a family of five leave a flooded house with {amount} toward a deposit"}
                onChange={(event) => applyGatewayNamesText(event.target.value)}
              />
            </label>
            {(() => {
              const lines = splitGatewayNameLines(gatewayNamesText);
              const problems = gatewayNameLineProblems(gatewayNamesText, { title: form.title });
              const example = lines.find(
                (line) => !problems.some((problem) => problem.text === line),
              );
              const note = gatewayNamesNote;
              return (
                <>
                  {problems.length ? (
                    <AdminFormMessage tone="error">
                      {problems
                        .slice(0, 3)
                        .map((problem) => `Line ${problem.line}: ${problem.problem}`)
                        .join(" · ")}
                      {problems.length > 3 ? ` · and ${problems.length - 3} more` : ""}
                    </AdminFormMessage>
                  ) : null}
                  {example ? (
                    <small className="admin-help">
                      On the receipt for{" "}
                      {formatMoney(Math.round(Number(suggested) * 100) || 2500, form.currency)}:{" "}
                      “{renderGatewayName(
                        example,
                        formatMoney(Math.round(Number(suggested) * 100) || 2500, form.currency),
                      )}”
                    </small>
                  ) : null}
                  <div className="admin-update-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={writingNames || note?.aiConfigured === false}
                      onClick={() => void writeNamesWithAi()}
                    >
                      {writingNames ? "Writing…" : lines.length ? "Write again from the story" : "Write from the story"}
                    </button>
                    <small className="admin-help">
                      {note?.aiConfigured === false
                        ? "AI is off on this server. Add OPENAI_API_KEY or ANTHROPIC_API_KEY to the VPS .env and restart the app. Until then the automatic word rule names the gifts."
                        : lines.length === 0
                          ? "Empty: the names are written from the story when you save, or type your own."
                          : note?.stale
                            ? "The title, summary or story changed after these names were written. Write them again or edit them."
                            : note?.source === "manual"
                              ? "Edited by hand. Saved with the campaign."
                              : note?.source
                                ? `Written by ${note.source}${note.at ? ` on ${new Date(note.at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}` : ""}. Saved with the campaign.`
                                : "Saved with the campaign."}
                    </small>
                  </div>
                  {namesMessage ? (
                    <AdminFormMessage tone={namesMessage.tone}>{namesMessage.text}</AdminFormMessage>
                  ) : null}
                </>
              );
            })()}
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="studio-page studio-page-compact">
          <div className="editor-section-head">
            <h2>Thank you</h2>
            <p className="admin-help">
              Shown after a successful donation. Keep it warm and specific.
            </p>
          </div>
          <div className="editor-block">
          <label>
            Thank you title
            <input
              className="admin-input"
              value={form.thankYouTitle}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  thankYouTitle: event.target.value,
                }))
              }
            />
          </label>
          <label>
            Thank you message
            <textarea
              className="admin-textarea"
              style={{ minHeight: 120 }}
              value={form.thankYouMessage}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  thankYouMessage: event.target.value,
                }))
              }
            />
          </label>
          </div>
        </section>
      ) : null}

      {step === 4 && !hideLinks ? (
        <section className="wizard-panel">
          {campaignId ? (
            <CampaignPaymentLinks
              campaignId={campaignId}
              currency={form.currency}
              options={options}
              affiliates={affiliates}
              pages={pages}
              pathPrefix={pathPrefix}
              short={shortDonationPath}
            />
          ) : (
            <p className="admin-copy">
              Save the campaign first. The same page will be created for every
              affiliate, then you can paste each person’s Stripe Payment Links.
            </p>
          )}
        </section>
      ) : null}

      {step < lastStep ? (
        <div className="wizard-actions">
          {step > 1 ? (
            <button
              type="button"
              className="secondary-button"
              onClick={() => setStep((current) => current - 1)}
            >
              Back
            </button>
          ) : null}
          {campaignId && step < 3 ? (
            <button
              type="button"
              className="secondary-button"
              disabled={loading}
              onClick={() => void save(false)}
            >
              {loading ? "Saving…" : "Save campaign"}
            </button>
          ) : null}
          <button className="primary-button" type="submit" disabled={loading}>
            {step < 3
              ? campaignId
                ? loading
                  ? "Saving…"
                  : "Save and continue"
                : "Continue"
              : loading
                ? "Saving…"
                : campaignId
                  ? hideLinks
                    ? "Save campaign"
                    : "Save and add Payment Links"
                  : "Create campaign"}
          </button>
          {message ? (
            <AdminFormMessage tone={looksLikeError(message) ? "error" : "success"}>
              {message}
            </AdminFormMessage>
          ) : null}
        </div>
      ) : (
        <div className="wizard-actions">
          <button type="button" className="secondary-button" onClick={() => setStep(3)}>
            Back
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => void save(false)}
          >
            {loading ? "Saving…" : "Save campaign"}
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => router.push("/admin/campaigns")}
          >
            Done
          </button>
          {message ? (
            <AdminFormMessage tone={looksLikeError(message) ? "error" : "success"}>
              {message}
            </AdminFormMessage>
          ) : null}
          <button
            type="button"
            className="primary-button wizard-publish"
            disabled={loading || !campaignId || form.status === "ACTIVE"}
            onClick={() => void save(false, "ACTIVE")}
          >
            {loading
              ? "Publishing…"
              : form.status === "ACTIVE"
                ? "Publicada"
                : "Publicar"}
          </button>
        </div>
      )}
    </form>
  );
}
