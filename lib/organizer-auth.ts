import "server-only";
import {
  createHash,
  createHmac,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getRequestCompany } from "@/lib/company";
import { prisma } from "@/lib/prisma";
import { withPublicPrefix } from "@/lib/public-site-url";

/**
 * Organizer accounts live in our own table, apart from the Supabase admin
 * session. Passwords are scrypt hashes; the session is an HMAC-signed cookie
 * that also carries a fingerprint of the password hash, so changing the
 * password signs every other browser out.
 */

export const ORGANIZER_COOKIE = "organizer_session";
const SESSION_DAYS = 30;
const RESET_MINUTES = 60;
const SCRYPT_N = 16384;
const SCRYPT_KEYLEN = 64;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

function secret() {
  const explicit = process.env.ORGANIZER_SESSION_SECRET?.trim();
  if (explicit) return explicit;
  const encryption = process.env.ENCRYPTION_KEY?.trim();
  if (encryption) return encryption;
  const database = process.env.DATABASE_URL?.trim();
  if (database) return createHash("sha256").update(`organizer:${database}`).digest("hex");
  return "dev-organizer-session";
}

function scrypt(password: string, salt: Buffer, keylen: number) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCallback(password, salt, keylen, { N: SCRYPT_N }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, SCRYPT_KEYLEN);
  return ["scrypt", String(SCRYPT_N), salt.toString("base64url"), key.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, , saltRaw, keyRaw] = stored.split("$");
  if (scheme !== "scrypt" || !saltRaw || !keyRaw) return false;
  const expected = Buffer.from(keyRaw, "base64url");
  const actual = await scrypt(password, Buffer.from(saltRaw, "base64url"), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function normalizeOrganizerEmail(value: string) {
  return value.trim().toLowerCase();
}

function fingerprint(passwordHash: string) {
  return createHash("sha256").update(passwordHash).digest("base64url").slice(0, 16);
}

function sign(parts: string[]) {
  return createHmac("sha256", secret()).update(parts.join(".")).digest("base64url");
}

function verifySignature(parts: string[], signature: string) {
  const expected = Buffer.from(sign(parts));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

type TokenKind = "session" | "reset";

function issueToken(kind: TokenKind, organizerId: string, passwordHash: string, ttlMs: number) {
  const exp = String(Date.now() + ttlMs);
  const fp = fingerprint(passwordHash);
  const parts = [kind, organizerId, exp, fp];
  return `${organizerId}.${exp}.${fp}.${sign(parts)}`;
}

function readToken(kind: TokenKind, token: string | undefined | null) {
  if (!token) return null;
  const match = /^([0-9a-f-]{36})\.(\d{10,16})\.([A-Za-z0-9_-]{16})\.([A-Za-z0-9_-]{20,100})$/.exec(token);
  if (!match) return null;
  const [, organizerId, exp, fp, signature] = match;
  if (!verifySignature([kind, organizerId, exp, fp], signature)) return null;
  if (Number(exp) < Date.now()) return null;
  return { organizerId, fingerprint: fp };
}

export function sessionCookieFor(organizer: { id: string; passwordHash: string }) {
  return {
    name: ORGANIZER_COOKIE,
    value: issueToken("session", organizer.id, organizer.passwordHash, SESSION_DAYS * 86_400_000),
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_DAYS * 86_400,
    },
  };
}

export function clearedSessionCookie() {
  return {
    name: ORGANIZER_COOKIE,
    value: "",
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    },
  };
}

export function issueResetToken(organizer: { id: string; passwordHash: string }) {
  return issueToken("reset", organizer.id, organizer.passwordHash, RESET_MINUTES * 60_000);
}

/** Organizer named by a reset link, only while the password it was issued for is unchanged. */
export async function organizerFromResetToken(token: string) {
  const parsed = readToken("reset", token);
  if (!parsed) return null;
  const organizer = await prisma.organizer.findUnique({ where: { id: parsed.organizerId } });
  if (!organizer || fingerprint(organizer.passwordHash) !== parsed.fingerprint) return null;
  return organizer;
}

export type SessionOrganizer = NonNullable<Awaited<ReturnType<typeof getOrganizerSession>>>;

/** Signed-in organizer for the current request, scoped to the site being served. */
export const getOrganizerSession = cache(async function getOrganizerSession() {
  const store = await cookies();
  const parsed = readToken("session", store.get(ORGANIZER_COOKIE)?.value);
  if (!parsed) return null;
  const organizer = await prisma.organizer.findUnique({
    where: { id: parsed.organizerId },
    select: {
      id: true,
      companyId: true,
      email: true,
      name: true,
      whatsapp: true,
      passwordHash: true,
      createdAt: true,
    },
  });
  if (!organizer || fingerprint(organizer.passwordHash) !== parsed.fingerprint) return null;
  const company = await getRequestCompany();
  if (organizer.companyId !== company.id) return null;
  return {
    id: organizer.id,
    companyId: organizer.companyId,
    email: organizer.email,
    name: organizer.name,
    whatsapp: organizer.whatsapp,
    createdAt: organizer.createdAt,
  };
});

export function portalPath(pathPrefix: string | null | undefined, path = "/portal") {
  return withPublicPrefix(pathPrefix ?? "", path);
}

/** Page guard: sends anonymous visitors to the portal login and remembers where they were going. */
export async function requireOrganizer(pathPrefix: string | null | undefined, nextPath?: string) {
  const organizer = await getOrganizerSession();
  if (!organizer) {
    const target = portalPath(pathPrefix, "/portal/login");
    redirect(nextPath ? `${target}?next=${encodeURIComponent(nextPath)}` : target);
  }
  return organizer;
}

/** Route-handler guard: 401 instead of a redirect. */
export async function organizerFromRequest() {
  return getOrganizerSession();
}

export function passwordProblem(password: string) {
  if (password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (password.length > PASSWORD_MAX) return `Use at most ${PASSWORD_MAX} characters.`;
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return "Use letters and at least one number.";
  }
  return null;
}
