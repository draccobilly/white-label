import { NextResponse } from "next/server";
import { authErrorMessage, authHttpStatus, isAuthError, requireOwner } from "@/lib/auth";
import { getAdminCompany } from "@/lib/company";
import { runSiteCheck } from "@/lib/site-health";

const NO_STORE = { "Cache-Control": "no-store" } as const;

/**
 * Probes the public site from the server and records the result. Triggered
 * by the health screen (on open and every minute while it stays open) and by
 * its "check now" button. Owner-only; nothing but SiteCheck rows change.
 */
export async function POST() {
  try {
    await requireOwner();
    const company = await getAdminCompany();
    const results = await runSiteCheck(company);
    return NextResponse.json({ results, at: new Date().toISOString() }, { headers: NO_STORE });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(
        { error: authErrorMessage(error) },
        { status: authHttpStatus(error), headers: NO_STORE },
      );
    }
    console.error("site check failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Unable to run the check" }, { status: 500, headers: NO_STORE });
  }
}
