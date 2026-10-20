import { NextResponse } from "next/server";
import { requireOwner, isAuthError, authHttpStatus } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { companyImpactLogoSchema } from "@/lib/validators";

export async function PATCH(request: Request) {
  try {
    await requireOwner();
    const parsed = companyImpactLogoSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid Impact logo" },
        { status: 400 },
      );
    }
    const impactLogoUrl = parsed.data.impactLogoUrl || null;
    const company = await prisma.company.update({
      where: { id: parsed.data.companyId },
      data: { impactLogoUrl },
      select: { id: true, impactLogoUrl: true },
    });
    return NextResponse.json({ company });
  } catch (error) {
    const missing =
      typeof error === "object" && error && "code" in error && error.code === "P2025";
    return NextResponse.json(
      {
        error: isAuthError(error)
          ? "Unauthorized"
          : missing
            ? "Company not found"
            : "Unable to update Impact logo",
      },
      { status: isAuthError(error) ? authHttpStatus(error) : missing ? 404 : 500 },
    );
  }
}
