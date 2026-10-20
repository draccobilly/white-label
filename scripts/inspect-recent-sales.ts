import "dotenv/config";
import { prisma } from "../lib/prisma";
import { excludeSocialSeedSales } from "../lib/sale-filters";

/**
 * Shows the last paid donations with the ad labels they carried and what
 * Utmify received for each one. Read-only. Social-proof seed rows are left
 * out, the same way the admin leaves them out of paid sales.
 *
 *   npx tsx scripts/inspect-recent-sales.ts [count] [days]
 *
 * Default: last 15 live sales from the last 7 days.
 */

type Tracking = {
  src?: string | null;
  sck?: string | null;
  utm_source?: string | null;
  utm_campaign?: string | null;
  utm_medium?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
};

function trackingFromPayload(payload: unknown): Tracking | null {
  if (!payload || typeof payload !== "object") return null;
  const tracking = (payload as { trackingParameters?: unknown }).trackingParameters;
  return tracking && typeof tracking === "object" ? (tracking as Tracking) : null;
}

function trim(value: string | null | undefined, max = 90) {
  if (!value) return "—";
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function losAngeles(date: Date | null) {
  if (!date) return "—";
  return date.toLocaleString("en-US", { timeZone: "America/Los_Angeles", hour12: false });
}

function hasMetaId(value: string | null | undefined) {
  return /\|\s*\d{6,}\s*$/.test(value ?? "");
}

function verdict(input: {
  delivery: { status: string; lastError: string | null } | null;
  sent: Tracking | null;
  intent: { sck: string | null; src: string | null; utmCampaign: string | null; referrer: string | null; fbc: string | null };
}) {
  if (!input.delivery) {
    return "NOT SENT: no Utmify delivery exists for this sale. It was recorded outside the checkout flow (import, script, or Stripe fallback), or the page had no Utmify token when it was paid.";
  }
  if (input.delivery.status === "FAILED") return `NOT DELIVERED: ${input.delivery.lastError ?? "unknown error"}`;
  if (input.delivery.status !== "SUCCEEDED") return `STILL ${input.delivery.status}: Utmify has not confirmed it yet.`;
  const sent = input.sent;
  if (sent?.utm_source === "site" && sent.utm_medium === "direct") {
    const from = input.intent.referrer ? `referrer ${trim(input.intent.referrer, 60)}` : "no referrer";
    return `NO AD CLICK: the donor opened the page without the ad link (${from}). Utmify lists it as untracked.`;
  }
  if (/\{\{/.test(sent?.utm_campaign ?? "")) {
    return "UNRESOLVED META MACROS: the click arrived with {{campaign.name}} written literally. Meta did not fill the parameters (ad preview, shared ad, Instagram ad activity, or parameters typed into the site URL). Utmify flags it as invalid UTMs.";
  }
  if (!sent?.utm_source && !sent?.utm_campaign && (input.intent.sck || input.intent.fbc)) {
    return "FBCLID ONLY: the click came from Facebook/Instagram without the ad's URL parameters (shared ad post, or an ad with an empty URL-parameters field). Meta still attributes it through fbc; Utmify shows empty UTMs.";
  }
  if (!hasMetaId(sent?.utm_campaign)) {
    return "UTM WITHOUT META ID: utm_campaign has no \"name|id\". Utmify cannot match it to a Meta campaign. Check the ad's URL parameters.";
  }
  return "AD CLICK: utm_campaign carries the Meta id. Utmify should attribute this sale.";
}

async function main() {
  const take = Math.min(200, Math.max(1, Number(process.argv[2] ?? 15) || 15));
  const days = Math.max(1, Number(process.argv[3] ?? 7) || 7);
  const since = new Date(Date.now() - days * 24 * 3600_000);

  const sales = await prisma.sale.findMany({
    where: { status: "PAID", livemode: true, paidAt: { gte: since }, ...excludeSocialSeedSales },
    orderBy: { paidAt: "desc" },
    take,
    select: {
      id: true,
      paidAt: true,
      amount: true,
      currency: true,
      gateway: true,
      paymentMethod: true,
      gatewayLabel: true,
      trackingCode: true,
      createdAt: true,
      stripePaymentIntentId: true,
      stripeCheckoutSessionId: true,
      stripePaymentLinkId: true,
      paypalCaptureId: true,
      pagnovoTransactionId: true,
      campaign: { select: { title: true, slug: true, company: { select: { name: true } } } },
      checkoutIntent: {
        select: {
          createdAt: true,
          userAgent: true,
          paymentLinkId: true,
          src: true,
          sck: true,
          utmSource: true,
          utmMedium: true,
          utmCampaign: true,
          utmContent: true,
          utmTerm: true,
          fbc: true,
          fbp: true,
          landingUrl: true,
          referrer: true,
          soldLabel: true,
        },
      },
      deliveries: {
        where: { idempotencyKey: { endsWith: ":paid" } },
        select: { status: true, lastError: true, payload: true, succeededAt: true },
        take: 1,
      },
    },
  });

  if (!sales.length) {
    console.log(`No paid live sales in the last ${days} days.`);
    return;
  }

  let adClicks = 0;
  for (const sale of sales) {
    const intent = sale.checkoutIntent;
    const delivery = sale.deliveries[0] ?? null;
    const sent = delivery ? trackingFromPayload(delivery.payload) : null;
    const result = verdict({ delivery, sent, intent });
    if (result.startsWith("AD CLICK")) adClicks += 1;

    console.log("─".repeat(100));
    console.log(
      `${losAngeles(sale.paidAt)} LA  ${(sale.amount / 100).toFixed(2)} ${sale.currency}  ${sale.gateway}/${sale.paymentMethod}`,
    );
    console.log(`campaign:   ${sale.campaign.title} (${sale.campaign.slug})${sale.campaign.company ? `  [${sale.campaign.company.name}]` : ""}`);
    console.log(
      `ids:        pi=${sale.stripePaymentIntentId ?? "—"}  cs=${trim(sale.stripeCheckoutSessionId, 30)}  plink=${sale.stripePaymentLinkId ?? "—"}  paypal=${sale.paypalCaptureId ?? "—"}  pagnovo=${sale.pagnovoTransactionId ?? "—"}  code=${sale.trackingCode ?? "—"}`,
    );
    console.log(
      `intent:     opened ${losAngeles(intent.createdAt)} LA  sale row ${losAngeles(sale.createdAt)} LA  browser=${intent.userAgent ? "yes" : "no"}  payment link=${intent.paymentLinkId ? "yes" : "no"}`,
    );
    console.log(`sold as:    ${intent.soldLabel ?? "—"}`);
    console.log(`gateway:    ${sale.gatewayLabel ?? "—"}`);
    console.log(`landing:    ${trim(intent.landingUrl, 140)}`);
    console.log(`referrer:   ${trim(intent.referrer, 140)}`);
    console.log(
      `labels:     utm_source=${intent.utmSource ?? "—"}  utm_campaign=${trim(intent.utmCampaign, 60)}  utm_medium=${trim(intent.utmMedium, 40)}  utm_content=${trim(intent.utmContent, 40)}`,
    );
    console.log(`clicks:     src=${intent.src ?? "—"}  sck=${intent.sck ? "yes" : "no"}  fbc=${intent.fbc ? "yes" : "no"}  fbp=${intent.fbp ? "yes" : "no"}`);
    console.log(
      `utmify got: ${delivery ? delivery.status : "nothing"}${sent ? `  utm_source=${sent.utm_source ?? "—"}  utm_campaign=${trim(sent.utm_campaign, 60)}  sck=${sent.sck ? "yes" : "no"}` : ""}`,
    );
    console.log(`verdict:    ${result}`);
  }
  console.log("─".repeat(100));
  console.log(`${sales.length} paid sales in the last ${days} days, ${adClicks} with a Meta ad click, ${sales.length - adClicks} that Utmify shows as untracked or never received.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
