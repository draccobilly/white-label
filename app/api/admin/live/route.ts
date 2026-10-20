import { NextResponse } from "next/server";
import { authErrorMessage, authHttpStatus, isAuthError, requireOwner } from "@/lib/auth";
import { getAdminCompany } from "@/lib/company";
import { loadLiveSnapshot } from "@/lib/live";

const NO_STORE = { "Cache-Control": "no-store" } as const;

/**
 * Live numbers for the panel, polled every few seconds while the tab is
 * visible. Owner-only and read-only.
 */
export async function GET() {
  try {
    await requireOwner();
    const company = await getAdminCompany();
    const snapshot = await loadLiveSnapshot(company.id);
    return NextResponse.json(snapshot, { headers: NO_STORE });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(
        { error: authErrorMessage(error) },
        { status: authHttpStatus(error), headers: NO_STORE },
      );
    }
    console.error("live snapshot failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Unable to load live data" }, { status: 500, headers: NO_STORE });
  }
}
