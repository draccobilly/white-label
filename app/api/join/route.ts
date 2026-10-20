import { NextResponse } from "next/server";
import { z } from "zod";
import { hashInviteToken } from "@/lib/admin-invite";
import { ownerEmail } from "@/lib/admin-role";
import { ensureOperatorAffiliate } from "@/lib/operator-affiliate";
import { prisma } from "@/lib/prisma";
import { createServiceClient } from "@/lib/supabase/admin";

const joinSchema = z.object({
  token: z.string().trim().min(16).max(200),
  email: z.string().trim().email().max(200),
  password: z.string().min(8).max(200),
  name: z.string().trim().max(120).optional(),
});

function inviteWhere(tokenHash: string) {
  return {
    tokenHash,
    usedAt: null,
    expiresAt: { gt: new Date() },
  };
}

async function findValidInvite(token: string) {
  const tokenHash = hashInviteToken(token);
  return prisma.adminInvite.findFirst({
    where: inviteWhere(tokenHash),
    select: { id: true },
  });
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!token) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const invite = await findValidInvite(token);
  if (!invite) {
    return NextResponse.json({ ok: false, error: "This invite is invalid or expired." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  const parsed = joinSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Enter email, password and invite" },
      { status: 400 },
    );
  }

  const email = parsed.data.email.toLowerCase();
  if (ownerEmail() && email === ownerEmail()) {
    return NextResponse.json(
      { error: "This email already has access. Sign in instead." },
      { status: 409 },
    );
  }
  const invite = await findValidInvite(parsed.data.token);
  if (!invite) {
    return NextResponse.json(
      { error: "This invite is invalid or expired." },
      { status: 400 },
    );
  }

  const existingAdmin = await prisma.admin.findUnique({ where: { email } });
  if (existingAdmin) {
    return NextResponse.json(
      { error: "This email already has access. Sign in instead." },
      { status: 409 },
    );
  }

  let userId: string | null = null;
  try {
    const supabase = createServiceClient();
    const created = await supabase.auth.admin.createUser({
      email,
      password: parsed.data.password,
      email_confirm: true,
      user_metadata: parsed.data.name ? { full_name: parsed.data.name } : undefined,
    });
    if (created.error || !created.data.user) {
      const already =
        created.error && /already|registered|exists/i.test(created.error.message);
      if (!already) {
        return NextResponse.json(
          { error: created.error?.message ?? "Unable to create account" },
          { status: 400 },
        );
      }
      const listed = await supabase.auth.admin.listUsers({ perPage: 200 });
      const existing = listed.data.users.find(
        (user) => user.email?.toLowerCase() === email,
      );
      if (!existing) {
        return NextResponse.json({ error: "Unable to create account" }, { status: 400 });
      }
      const updated = await supabase.auth.admin.updateUserById(existing.id, {
        password: parsed.data.password,
        email_confirm: true,
      });
      if (updated.error) {
        return NextResponse.json({ error: updated.error.message }, { status: 400 });
      }
      userId = existing.id;
    } else {
      userId = created.data.user.id;
    }

    const claimed = await prisma.adminInvite.updateMany({
      where: { id: invite.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date(), email },
    });
    if (claimed.count !== 1) {
      throw new Error("INVITE_USED");
    }

    const account = await prisma.admin.create({
      data: {
        id: userId,
        email,
        name: parsed.data.name?.trim() || null,
        role: "OPERATOR",
      },
    });
    await ensureOperatorAffiliate(account);

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (userId) {
      try {
        const supabase = createServiceClient();
        const leftover = await prisma.admin.findUnique({ where: { id: userId } });
        if (!leftover) {
          await supabase.auth.admin.deleteUser(userId);
        }
      } catch (cleanupError) {
        console.error("join cleanup failed", cleanupError);
      }
    }
    const used = error instanceof Error && error.message === "INVITE_USED";
    return NextResponse.json(
      { error: used ? "This invite is invalid or expired." : "Unable to create account" },
      { status: used ? 400 : 500 },
    );
  }
}
