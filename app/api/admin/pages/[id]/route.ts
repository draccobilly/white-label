import { NextResponse } from "next/server";
import { requireOwner, isAuthError, authHttpStatus } from "@/lib/auth";
import { getAdminCompany } from "@/lib/company";
import { prisma } from "@/lib/prisma";
import { saveResolvedPaymentLinks } from "@/lib/payment-link-ownership";
import {
  resolveStripePaymentLink,
  restoreStripeHostedConfirmation,
  type StripePaymentLinkCache,
} from "@/lib/stripe-payment-links";
import {
  integrationSchema,
  sanitizeMetaPixelId,
  sanitizePixelId,
} from "@/lib/validators";
import { assertTrackingExclusiveToCompany } from "@/lib/assert-pixel-isolation";
import { PixelConflictError } from "@/lib/pixel-isolation";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireOwner();
    const { id } = await params;
    const parsed = integrationSchema.safeParse(await request.json());
    if (!parsed.success || parsed.data.affiliatePageId !== id) {
      return NextResponse.json(
        { error: parsed.success ? "Page mismatch" : parsed.error.issues[0]?.message },
        { status: 400 },
      );
    }
    const company = await getAdminCompany();
    const data = parsed.data;
    const page = await prisma.affiliatePage.findFirst({
      where: { id, campaign: { companyId: company.id } },
      include: {
        affiliate: true,
        campaign: { include: { options: true } },
      },
    });
    if (!page) return NextResponse.json({ error: "Page not found" }, { status: 404 });

    const rawFb = data.fbPixelId?.trim() || "";
    if (rawFb && !sanitizeMetaPixelId(rawFb)) {
      return NextResponse.json(
        {
          error:
            "Meta Pixel ID must be the number from Events Manager, not the Utmify pixel ID.",
        },
        { status: 400 },
      );
    }
    const fbPixelId = sanitizeMetaPixelId(rawFb);
    const googlePixelId = sanitizePixelId(data.googlePixelId);
    const tiktokPixelId = sanitizePixelId(data.tiktokPixelId);
    try {
      await assertTrackingExclusiveToCompany({
        companyId: company.id,
        excludePageId: id,
        tracking: { fbPixelId, googlePixelId, tiktokPixelId, pagnovoDesk: company.paymentGateway === "PAGNOVO" },
      });
    } catch (error) {
      if (error instanceof PixelConflictError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }

    const optionIds = new Set(page.campaign.options.map((option) => option.id));
    if (data.paymentLinks.some((link) => !optionIds.has(link.donationOptionId))) {
      return NextResponse.json({ error: "Payment option does not belong to page" }, { status: 400 });
    }

    const resolved: Array<{
      donationOptionId: string;
      url: string;
      stripeCheckoutUrl: string | null;
      stripePaymentLinkId: string | null;
    }> = [];
    const stripeCache: StripePaymentLinkCache = {};
    for (const link of data.paymentLinks) {
      const expectedAmount = page.campaign.options.find(
        (option) => option.id === link.donationOptionId,
      )?.amount;
      if (!expectedAmount) {
        return NextResponse.json({ error: "Unknown donation amount" }, { status: 400 });
      }
      try {
        const matched = await resolveStripePaymentLink({
          publicUrl: link.url,
          stripeDestination: link.stripeCheckoutUrl,
          expectedAmount,
          currency: page.campaign.currency,
          cache: stripeCache,
        });
        if (!matched.stripePaymentLinkId) {
          return NextResponse.json(
            { error: "Paste the original buy.stripe.com or plink_ so this amount can be marked" },
            { status: 400 },
          );
        }
        resolved.push({
          donationOptionId: link.donationOptionId,
          url: matched.url,
          stripeCheckoutUrl: matched.stripeCheckoutUrl,
          stripePaymentLinkId: matched.stripePaymentLinkId,
        });
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : "Invalid payment links" },
          { status: 400 },
        );
      }
    }

    await prisma.$transaction(
      async (tx) => {
        await tx.affiliatePage.update({
          where: { id },
          data: {
            googlePixelId,
            tiktokPixelId,
          },
        });
        if (data.deactivateOtherLinks) {
          await tx.paymentLink.updateMany({
            where: {
              affiliatePageId: id,
              donationOptionId: {
                notIn: resolved.map((link) => link.donationOptionId),
              },
            },
            data: { active: false },
          });
        }
        await saveResolvedPaymentLinks(tx, id, resolved);
      },
      { timeout: 30_000, maxWait: 10_000 },
    );
    for (const link of resolved) {
      if (!link.stripePaymentLinkId) continue;
      try {
        await restoreStripeHostedConfirmation(link.stripePaymentLinkId);
      } catch (error) {
        console.error("Could not restore Stripe hosted confirmation", {
          stripePaymentLinkId: link.stripePaymentLinkId,
          error,
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("page integration update failed", error);
    const message =
      error instanceof PixelConflictError
        ? error.message
        : error instanceof Error && error.message.includes("already belongs")
          ? error.message
          : isAuthError(error)
            ? "Unauthorized"
            : "Unable to save integrations";
    return NextResponse.json(
      { error: message },
      {
        status: isAuthError(error)
          ? authHttpStatus(error)
          : error instanceof PixelConflictError || message.includes("already belongs")
            ? 400
            : 500,
      },
    );
  }
}
