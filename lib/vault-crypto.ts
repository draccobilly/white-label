import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

/**
 * Vault encryption: AES-256-GCM with a key that comes ONLY from
 * VAULT_ENCRYPTION_KEY (32 bytes, base64 or hex). The key is never derived
 * from another secret and never leaves the server process.
 *
 * Stored format: `v1.<iv>.<tag>.<ciphertext>` (base64url parts).
 */

const FORMAT_VERSION = "v1";
const KEY_BYTES = 32;

export class VaultLockedError extends Error {
  constructor() {
    super("VAULT_LOCKED");
    this.name = "VaultLockedError";
  }
}

export function isVaultLockedError(error: unknown) {
  return error instanceof VaultLockedError;
}

function parseKey(raw: string): Buffer | null {
  const value = raw.trim();
  if (!value) return null;
  if (/^[0-9a-f]{64}$/i.test(value)) return Buffer.from(value, "hex");
  if (/^[A-Za-z0-9+/]{43}=?$/.test(value) || /^[A-Za-z0-9_-]{43}$/.test(value)) {
    const decoded = Buffer.from(value, value.includes("-") || value.includes("_") ? "base64url" : "base64");
    if (decoded.length === KEY_BYTES) return decoded;
  }
  return null;
}

/** The configured key, or null when the vault is locked. Never logged. */
export function vaultKey(): Buffer | null {
  const raw = process.env.VAULT_ENCRYPTION_KEY;
  if (!raw) return null;
  return parseKey(raw);
}

/** True when VAULT_ENCRYPTION_KEY is present and well formed. */
export function isVaultUnlocked() {
  return vaultKey() !== null;
}

/** Explains why the vault is locked without echoing the variable. */
export function vaultLockReason(): "missing" | "invalid" | null {
  const raw = process.env.VAULT_ENCRYPTION_KEY;
  if (!raw || !raw.trim()) return "missing";
  return parseKey(raw) ? null : "invalid";
}

export function encryptVaultValue(plain: string) {
  const key = vaultKey();
  if (!key) throw new VaultLockedError();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    FORMAT_VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptVaultValue(stored: string) {
  const key = vaultKey();
  if (!key) throw new VaultLockedError();
  const [version, ivRaw, tagRaw, encryptedRaw] = stored.split(".");
  if (version !== FORMAT_VERSION || !ivRaw || !tagRaw || !encryptedRaw) {
    throw new Error("Invalid vault value");
  }
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

/**
 * Masked hint stored next to the ciphertext so lists never decrypt.
 * Shows at most the first 2 and last 3 characters.
 */
export function vaultPreview(value: string) {
  const trimmed = value.trim();
  if (trimmed.length <= 10) return "••••••••";
  return `${trimmed.slice(0, 2)}••••${trimmed.slice(-3)} · ${trimmed.length} chars`;
}
