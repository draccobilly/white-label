import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOwner, isAuthError, authHttpStatus } from "@/lib/auth";
import { sendDonationThankYouEmail } from "@/lib/mail";

const testEmailSchema = z.object({
  to: z.string().trim().email(),
});

export async function POST(request: Request) {
  try {
    await requireOwner();
    const parsed = testEmailSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Enter a valid email" }, { status: 400 });
    }
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: "RESEND_API_KEY is missing in .env" },
        { status: 400 },
      );
    }
    await sendDonationThankYouEmail({
      to: parsed.data.to,
      trackingCode: "TESTCODE",
      campaignSlug: "test",
      affiliateSlug: "direct-team",
      saleId: "00000000-0000-4000-8000-000000000099",
      customerName: "Supporter",
      campaignTitle: "Help My Father Walk Again",
      amountLabel: "$25",
      paidAt: new Date(),
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: isAuthError(error)
          ? "Unauthorized"
          : error instanceof Error
            ? error.message
            : "Unable to send test email",
      },
      { status: isAuthError(error) ? authHttpStatus(error) : 500 },
    );
  }
}
