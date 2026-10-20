import { NextResponse } from "next/server";
import { SitePostStatus } from "@/generated/prisma/enums";
import { requireOwner, isAuthError, authHttpStatus } from "@/lib/auth";
import { getAdminCompany } from "@/lib/company";
import { prisma } from "@/lib/prisma";
import { prismaSitePostKind } from "@/lib/site-posts";
import { slugify } from "@/lib/utils";
import { sitePostSchema } from "@/lib/validators";

export async function GET() {
  try {
    await requireOwner();
    const company = await getAdminCompany();
    const posts = await prisma.sitePost.findMany({
      where: { companyId: company.id },
      orderBy: [{ updatedAt: "desc" }],
    });
    return NextResponse.json({ posts });
  } catch (error) {
    return NextResponse.json(
      { error: isAuthError(error) ? "Unauthorized" : "Unable to list posts" },
      { status: isAuthError(error) ? authHttpStatus(error) : 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    await requireOwner();
    const company = await getAdminCompany();
    const parsed = sitePostSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid post" },
        { status: 400 },
      );
    }
    const slug = parsed.data.slug || slugify(parsed.data.title);
    const published =
      parsed.data.status === "PUBLISHED"
        ? parsed.data.publishedAt
          ? new Date(parsed.data.publishedAt)
          : new Date()
        : null;
    const post = await prisma.sitePost.create({
      data: {
        companyId: company.id,
        kind: prismaSitePostKind(parsed.data.kind),
        status:
          parsed.data.status === "PUBLISHED"
            ? SitePostStatus.PUBLISHED
            : SitePostStatus.DRAFT,
        slug,
        title: parsed.data.title,
        excerpt: parsed.data.excerpt,
        body: parsed.data.body.trim() || parsed.data.excerpt,
        coverImageUrl: parsed.data.coverImageUrl,
        publishedAt: published,
      },
    });
    return NextResponse.json({ post }, { status: 201 });
  } catch (error) {
    const duplicate =
      typeof error === "object" && error && "code" in error && error.code === "P2002";
    return NextResponse.json(
      {
        error: isAuthError(error)
          ? "Unauthorized"
          : duplicate
            ? "That slug is already used"
            : "Unable to create post",
      },
      { status: isAuthError(error) ? authHttpStatus(error) : duplicate ? 400 : 500 },
    );
  }
}
