import { NextResponse } from "next/server";
import { SitePostStatus } from "@/generated/prisma/enums";
import { requireOwner, isAuthError, authHttpStatus } from "@/lib/auth";
import { getAdminCompany } from "@/lib/company";
import { prisma } from "@/lib/prisma";
import { prismaSitePostKind } from "@/lib/site-posts";
import { sitePostSchema } from "@/lib/validators";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    await requireOwner();
    const company = await getAdminCompany();
    const { id } = await context.params;
    const parsed = sitePostSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid post" },
        { status: 400 },
      );
    }
    const existing = await prisma.sitePost.findFirst({
      where: { id, companyId: company.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }
    const published =
      parsed.data.status === "PUBLISHED"
        ? parsed.data.publishedAt
          ? new Date(parsed.data.publishedAt)
          : existing.publishedAt ?? new Date()
        : null;
    const post = await prisma.sitePost.update({
      where: { id },
      data: {
        kind: prismaSitePostKind(parsed.data.kind),
        status:
          parsed.data.status === "PUBLISHED"
            ? SitePostStatus.PUBLISHED
            : SitePostStatus.DRAFT,
        slug: parsed.data.slug,
        title: parsed.data.title,
        excerpt: parsed.data.excerpt,
        body: parsed.data.body.trim() || parsed.data.excerpt,
        coverImageUrl: parsed.data.coverImageUrl,
        publishedAt: published,
      },
    });
    return NextResponse.json({ post });
  } catch (error) {
    const duplicate =
      typeof error === "object" && error && "code" in error && error.code === "P2002";
    return NextResponse.json(
      {
        error: isAuthError(error)
          ? "Unauthorized"
          : duplicate
            ? "That slug is already used"
            : "Unable to save post",
      },
      { status: isAuthError(error) ? authHttpStatus(error) : duplicate ? 400 : 500 },
    );
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    await requireOwner();
    const company = await getAdminCompany();
    const { id } = await context.params;
    const existing = await prisma.sitePost.findFirst({
      where: { id, companyId: company.id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }
    await prisma.sitePost.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: isAuthError(error) ? "Unauthorized" : "Unable to delete post" },
      { status: isAuthError(error) ? authHttpStatus(error) : 500 },
    );
  }
}
