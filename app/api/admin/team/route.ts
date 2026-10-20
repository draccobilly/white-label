import { NextResponse } from "next/server";
import { z } from "zod";
import { createInviteToken, inviteExpiresAt } from "@/lib/admin-invite";
import { isOwnerAdmin } from "@/lib/admin-role";
import { authErrorMessage, authHttpStatus, isAuthError, requireOwner } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createServiceClient } from "@/lib/supabase/admin";

const deleteSchema = z
  .object({
    inviteId: z.string().uuid().optional(),
    adminId: z.string().uuid().optional(),
  })
  .refine((value) => Boolean(value.inviteId) !== Boolean(value.adminId), {
    message: "Select an invite or a teammate",
  });

export async function GET() {
  try {
    const owner = await requireOwner();
    const [operators, invites] = await Promise.all([
      prisma.admin.findMany({
        where: { role: "OPERATOR" },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
        },
      }),
      prisma.adminInvite.findMany({
        where: { createdById: owner.id, usedAt: null },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          email: true,
          expiresAt: true,
          createdAt: true,
        },
      }),
    ]);
    return NextResponse.json({ operators, invites });
  } catch (error) {
    return NextResponse.json(
      { error: isAuthError(error) ? authErrorMessage(error) : "Unable to load team" },
      { status: isAuthError(error) ? authHttpStatus(error) : 500 },
    );
  }
}

export async function POST() {
  try {
    const owner = await requireOwner();
    const { token, tokenHash } = createInviteToken();
    const invite = await prisma.adminInvite.create({
      data: {
        tokenHash,
        expiresAt: inviteExpiresAt(),
        createdById: owner.id,
      },
      select: { id: true, expiresAt: true },
    });
    return NextResponse.json({
      inviteId: invite.id,
      token,
      expiresAt: invite.expiresAt.toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: isAuthError(error) ? authErrorMessage(error) : "Unable to create invite" },
      { status: isAuthError(error) ? authHttpStatus(error) : 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    await requireOwner();
    const parsed = deleteSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Select an invite or a teammate" },
        { status: 400 },
      );
    }

    if (parsed.data.inviteId) {
      await prisma.adminInvite.deleteMany({
        where: { id: parsed.data.inviteId, usedAt: null },
      });
      return NextResponse.json({ ok: true });
    }

    const operator = await prisma.admin.findUnique({
      where: { id: parsed.data.adminId },
    });
    if (!operator || isOwnerAdmin(operator)) {
      return NextResponse.json({ error: "Operator not found" }, { status: 404 });
    }
    await prisma.admin.delete({ where: { id: operator.id } });
    try {
      const supabase = createServiceClient();
      await supabase.auth.admin.deleteUser(operator.id);
    } catch (error) {
      console.error("operator supabase delete failed", error);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: isAuthError(error) ? authErrorMessage(error) : "Unable to update team" },
      { status: isAuthError(error) ? authHttpStatus(error) : 500 },
    );
  }
}
