import { NextResponse } from "next/server";
import { z } from "zod";
import { authErrorMessage, authHttpStatus, isAuthError, requireOwner } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializeVaultItem, vaultSummarySelect, vaultUpdateSchema } from "@/lib/vault";
import { encryptVaultValue, isVaultLockedError, vaultPreview } from "@/lib/vault-crypto";

const NO_STORE = { "Cache-Control": "no-store" } as const;
const idSchema = z.string().uuid();

function failure(error: unknown, fallback: string) {
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
  console.error("vault item request failed", error instanceof Error ? error.message : error);
  return NextResponse.json({ error: fallback }, { status: 500, headers: NO_STORE });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireOwner();
    const { id } = await params;
    if (!idSchema.safeParse(id).success) {
      return NextResponse.json({ error: "Item not found" }, { status: 404, headers: NO_STORE });
    }
    const parsed = vaultUpdateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid vault item" },
        { status: 400, headers: NO_STORE },
      );
    }
    const existing = await prisma.adminVaultItem.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Item not found" }, { status: 404, headers: NO_STORE });
    }
    const { value, notes, ...rest } = parsed.data;
    const item = await prisma.adminVaultItem.update({
      where: { id },
      data: {
        ...(rest.category !== undefined ? { category: rest.category } : {}),
        ...(rest.label !== undefined ? { label: rest.label } : {}),
        ...(notes !== undefined ? { notes: notes?.trim() || null } : {}),
        ...(value !== undefined
          ? { valueEnc: encryptVaultValue(value), preview: vaultPreview(value) }
          : {}),
      },
      select: vaultSummarySelect,
    });
    return NextResponse.json({ item: serializeVaultItem(item) }, { headers: NO_STORE });
  } catch (error) {
    return failure(error, "Unable to update the item");
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireOwner();
    const { id } = await params;
    if (!idSchema.safeParse(id).success) {
      return NextResponse.json({ error: "Item not found" }, { status: 404, headers: NO_STORE });
    }
    const deleted = await prisma.adminVaultItem.deleteMany({ where: { id } });
    if (!deleted.count) {
      return NextResponse.json({ error: "Item not found" }, { status: 404, headers: NO_STORE });
    }
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  } catch (error) {
    return failure(error, "Unable to delete the item");
  }
}
