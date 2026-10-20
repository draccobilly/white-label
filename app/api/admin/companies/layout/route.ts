import { NextResponse } from "next/server";
import { requireOwner, isAuthError, authHttpStatus } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { companyLayoutSchema } from "@/lib/validators";

export async function PATCH(request: Request) {
  try {
    await requireOwner();
    const parsed = companyLayoutSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid campaign layout" },
        { status: 400 },
      );
    }
    const company = await prisma.company.update({
      where: { id: parsed.data.companyId },
      data: { campaignLayout: parsed.data.campaignLayout },
    });
    return NextResponse.json({
      company: {
        id: company.id,
        campaignLayout: company.campaignLayout,
      },
    });
  } catch (error) {
    const missing =
      typeof error === "object" && error && "code" in error && error.code === "P2025";
    return NextResponse.json(
      {
        error: isAuthError(error)
          ? "Unauthorized"
          : missing
            ? "Company not found"
            : "Unable to update campaign layout",
      },
      { status: isAuthError(error) ? authHttpStatus(error) : missing ? 404 : 500 },
    );
  }
}
