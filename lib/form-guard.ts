import { createHmac, timingSafeEqual } from "node:crypto";
import { normalizeTrackingCode } from "@/lib/donation-tracking";
import {
  FORM_CODE_ERROR,
  FORM_EMAIL_ERROR,
  FORM_MAX_AGE_MS,
  FORM_MIN_AGE_MS,
  FORM_RELOAD_ERROR,
  FORM_SENTENCE_ERROR,
} from "@/lib/form-guard-shared";

function guardSecret() {
  const key = process.env.ENCRYPTION_KEY?.trim();
  if (key) return key;
  if (process.env.NODE_ENV === "production") return "";
  return "dev-form-guard";
}

export function issueFormToken(now = Date.now()) {
  const secret = guardSecret();
  if (!secret) return "";
  const payload = String(now);
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function formTokenAgeOk(token: string, now = Date.now()) {
  const secret = guardSecret();
  if (!secret) return false;
  const match = /^(\d{10,16})\.([A-Za-z0-9_-]{20,200})$/.exec(token);
  if (!match) return false;
  const payload = match[1];
  const sig = match[2];
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return false;
  const age = now - Number(payload);
  return age >= FORM_MIN_AGE_MS && age <= FORM_MAX_AGE_MS;
}

function caseSwitches(letters: string) {
  let switches = 0;
  let prev = "";
  for (const ch of letters) {
    const kind = ch >= "A" && ch <= "Z" ? "U" : ch >= "a" && ch <= "z" ? "L" : "";
    if (!kind) continue;
    if (prev && kind !== prev) switches += 1;
    prev = kind;
  }
  return switches;
}

/** Random tokens like eYytnAslTSfCuzZvBm or WRHIYYPUBMSIMJHQGR. Sentences pass. */
export function looksLikeBotFill(value: unknown) {
  if (typeof value !== "string") return false;
  const text = value.trim();
  if (!text || /\s/.test(text) || text.length < 12) return false;
  if (!/^[A-Za-z0-9]+$/.test(text)) return false;
  const letters = text.replace(/[^A-Za-z]/g, "");
  if (letters.length < 8) return false;
  const upper = letters.replace(/[^A-Z]/g, "").length;
  const lower = letters.length - upper;
  if (upper > 0 && lower > 0) {
    const switches = caseSwitches(letters);
    return switches >= 4 && switches / letters.length >= 0.28;
  }
  return letters.length >= 16;
}

/** A long field with no space is not a sentence, a name, or an address. */
export function looksUnreadable(value: unknown, minLength: number) {
  if (typeof value !== "string") return false;
  const text = value.trim();
  return text.length >= minLength && !/\s/.test(text);
}

/** Gmail-style dot stuffing: katheri.new.rig.ht.u.0.l.r.t.8.m.d@gmail.com */
export function looksLikeBotEmail(value: unknown) {
  if (typeof value !== "string") return false;
  const local = value.trim().toLowerCase().split("@")[0] ?? "";
  if (!local) return false;
  return local.split(".").length - 1 >= 4;
}

export function trackingCodeShapeOk(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return true;
  return /^DN\d{8}$/.test(normalizeTrackingCode(value));
}

export type FormVerdict =
  | { ok: true }
  | { ok: false; silent: boolean; message: string };

function textOf(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function inspectPublicForm(input: {
  formToken: unknown;
  companyUrl: unknown;
  email?: unknown;
  texts?: unknown[];
  prose?: unknown[];
  trackingCode?: unknown;
}): FormVerdict {
  const tokenOk = formTokenAgeOk(textOf(input.formToken));
  const honeypotFilled = textOf(input.companyUrl).trim().length > 0;
  const emailBad = looksLikeBotEmail(input.email);
  const textBad = (input.texts ?? []).some((item) => looksLikeBotFill(item));
  const proseBad = (input.prose ?? []).some(
    (item) => looksUnreadable(item, 16) || looksLikeBotFill(item),
  );
  const codeBad = !trackingCodeShapeOk(input.trackingCode);
  const contentBad = emailBad || textBad || proseBad || codeBad;

  if (honeypotFilled && (contentBad || !tokenOk)) {
    return { ok: false, silent: true, message: "" };
  }
  if (!tokenOk) {
    return { ok: false, silent: false, message: FORM_RELOAD_ERROR };
  }
  if (emailBad) return { ok: false, silent: false, message: FORM_EMAIL_ERROR };
  if (codeBad) return { ok: false, silent: false, message: FORM_CODE_ERROR };
  if (textBad || proseBad) return { ok: false, silent: false, message: FORM_SENTENCE_ERROR };
  return { ok: true };
}
