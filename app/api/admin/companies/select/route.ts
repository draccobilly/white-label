import { NextResponse } from "next/server";
import { requireOwner, isAuthError } from "@/lib/auth";
import { COMPANY_COOKIE } from "@/lib/app-role";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    await requireOwner();
    const body = await request.json();
    const companyId = body.companyId as string | undefined;
    if (!companyId) {
      return NextResponse.json({ error: "Company is required" }, { status: 400 });
    }
    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }
    const response = NextResponse.json({ ok: true, companyId: company.id });
    response.cookies.set(COMPANY_COOKIE, company.id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: isAuthError(error) ? "Unauthorized" : "Unable to switch company" },
      { status: isAuthError(error) ? 401 : 500 },
    );
  }
}
