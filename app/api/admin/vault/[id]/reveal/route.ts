import { NextResponse } from "next/server";
import { z } from "zod";
import { authErrorMessage, authHttpStatus, isAuthError, requireOwner } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decryptVaultValue, isVaultLockedError } from "@/lib/vault-crypto";

const NO_STORE = { "Cache-Control": "no-store" } as const;
const idSchema = z.string().uuid();

/**
 * Explicit reveal: the only place a vault value is decrypted. Owner-only,
 * one item per call, never cached, never logged.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireOwner();
    const { id } = await params;
    if (!idSchema.safeParse(id).success) {
      return NextResponse.json({ error: "Item not found" }, { status: 404, headers: NO_STORE });
    }
    const item = await prisma.adminVaultItem.findUnique({
      where: { id },
      select: { id: true, valueEnc: true },
    });
    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404, headers: NO_STORE });
    }
    const value = decryptVaultValue(item.valueEnc);
    const revealedAt = new Date();
    await prisma.adminVaultItem.update({
      where: { id },
      data: { lastRevealedAt: revealedAt },
      select: { id: true },
    });
    return NextResponse.json(
      { value, revealedAt: revealedAt.toISOString() },
      { headers: NO_STORE },
    );
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(
        { error: authErrorMessage(error) },
        { status: authHttpStatus(error), headers: NO_STORE },
      );
    }
    if (isVaultLockedError(error)) {
      return NextResponse.json(
        { error: "Vault is locked. Set VAULT_ENCRYPTION_KEY on the server first." },
        { status: 423, headers: NO_STORE },
      );
    }
    console.error("vault reveal failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Unable to reveal the item" }, { status: 500, headers: NO_STORE });
  }
}
