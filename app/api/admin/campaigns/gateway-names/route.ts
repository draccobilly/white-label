import { NextResponse } from "next/server";
import { isAuthError, requireAdmin } from "@/lib/auth";
import {
  GatewayNamesError,
  generateGatewayNames,
  isGatewayNamesAiConfigured,
} from "@/lib/gateway-ai-names";
import { GATEWAY_AI_VOICE } from "@/lib/gateway-product-names";
import { gatewayNamesRequestSchema } from "@/lib/validators";

export const maxDuration = 60;

/**
 * Writes product names for Stripe/PayPal from the text the admin is looking
 * at in the editor. Nothing is saved here; the editor puts the names in the
 * list and they are stored with the campaign on Save.
 */
export async function POST(request: Request) {
  try {
    await requireAdmin();
    if (!isGatewayNamesAiConfigured()) {
      return NextResponse.json(
        {
          error:
            "AI is off on this server. Add OPENAI_API_KEY or ANTHROPIC_API_KEY to the VPS .env and restart the app.",
          configured: false,
        },
        { status: 503 },
      );
    }
    const parsed = gatewayNamesRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Write the title, summary and story first." },
        { status: 400 },
      );
    }
    const generated = await generateGatewayNames(parsed.data, GATEWAY_AI_VOICE);
    return NextResponse.json({
      names: generated.names,
      model: generated.model,
      provider: generated.provider,
      configured: true,
    });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message =
      error instanceof GatewayNamesError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Unable to write product names";
    console.error("gateway names generation failed", error);
    return NextResponse.json({ error: message, configured: true }, { status: 502 });
  }
}
