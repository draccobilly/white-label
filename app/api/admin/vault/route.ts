import { NextResponse } from "next/server";
import { authErrorMessage, authHttpStatus, isAuthError, requireOwner } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializeVaultItem, vaultCreateSchema, vaultSummarySelect } from "@/lib/vault";
import {
  encryptVaultValue,
  isVaultLockedError,
  isVaultUnlocked,
  vaultLockReason,
  vaultPreview,
} from "@/lib/vault-crypto";

// Vault responses must never be cached by a browser or a proxy.
const NO_STORE = { "Cache-Control": "no-store" } as const;

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
  console.error("vault request failed", error instanceof Error ? error.message : error);
  return NextResponse.json({ error: fallback }, { status: 500, headers: NO_STORE });
}

export async function GET() {
  try {
    await requireOwner();
    const items = await prisma.adminVaultItem.findMany({
      select: vaultSummarySelect,
      orderBy: [{ category: "asc" }, { label: "asc" }],
    });
    return NextResponse.json(
      {
        unlocked: isVaultUnlocked(),
        lockReason: vaultLockReason(),
        items: items.map(serializeVaultItem),
      },
      { headers: NO_STORE },
    );
  } catch (error) {
    return failure(error, "Unable to load the vault");
  }
}

export async function POST(request: Request) {
  try {
    const owner = await requireOwner();
    const parsed = vaultCreateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid vault item" },
        { status: 400, headers: NO_STORE },
      );
    }
    // Encrypt before anything touches the database. A locked vault throws
    // here, so plain text is never written.
    const valueEnc = encryptVaultValue(parsed.data.value);
    const item = await prisma.adminVaultItem.create({
      data: {
        category: parsed.data.category,
        label: parsed.data.label,
        valueEnc,
        preview: vaultPreview(parsed.data.value),
        notes: parsed.data.notes?.trim() || null,
        createdByEmail: owner.email,
      },
      select: vaultSummarySelect,
    });
    return NextResponse.json({ item: serializeVaultItem(item) }, { status: 201, headers: NO_STORE });
  } catch (error) {
    return failure(error, "Unable to store the item");
  }
}
