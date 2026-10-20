import { createHash } from "crypto";

function digitsFromDigest(email: string, count: number) {
  const digest = createHash("sha256")
    .update(email.trim().toLowerCase())
    .digest("hex");
  let digits = "";
  for (const ch of digest) {
    if (ch >= "0" && ch <= "9") digits += ch;
    if (digits.length >= count) break;
  }
  while (digits.length < count) digits += "0";
  return digits.slice(0, count);
}

function isRepeatingDigits(value: string) {
  return /^(\d)\1+$/.test(value);
}

function cpfCheckDigit(base: string, factorStart: number) {
  const nums = base.split("").map(Number);
  const sum = nums.reduce(
    (total, digit, index) => total + digit * (factorStart - index),
    0,
  );
  const remainder = (sum * 10) % 11;
  return remainder === 10 ? 0 : remainder;
}

export function isChecksumValidCpf(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 11 || isRepeatingDigits(digits)) return false;
  const d1 = cpfCheckDigit(digits.slice(0, 9), 10);
  const d2 = cpfCheckDigit(digits.slice(0, 10), 11);
  return digits[9] === String(d1) && digits[10] === String(d2);
}

/** Checksum-valid CPF derived from email. Never all-same digits. */
export function cpfFromEmail(email: string) {
  let base = digitsFromDigest(email, 9);
  if (isRepeatingDigits(base) || base === "000000000") {
    base = "123456789";
  }
  const d1 = cpfCheckDigit(base, 10);
  const withD1 = `${base}${d1}`;
  const d2 = cpfCheckDigit(withD1, 11);
  return `${withD1}${d2}`;
}

/** 10-digit phone: 55 + 8 digest digits, matching the working acquirer store. */
export function phoneFromEmail(email: string) {
  return `55${digitsFromDigest(email, 8)}`;
}

export function resolvePayerCpf(email: string, provided?: string | null) {
  const fromUser = provided?.replace(/\D/g, "") ?? "";
  if (isChecksumValidCpf(fromUser)) return fromUser;
  const fromEnv = process.env.PAGNOVO_PAYER_CPF?.replace(/\D/g, "") ?? "";
  if (isChecksumValidCpf(fromEnv)) return fromEnv;
  return cpfFromEmail(email);
}

export function resolvePayerPhone(email: string, provided?: string | null) {
  const fromUser = provided?.replace(/\D/g, "") ?? "";
  if (fromUser.length >= 8 && fromUser.length <= 12) return fromUser;
  const fromEnv = process.env.PAGNOVO_PAYER_PHONE?.replace(/\D/g, "") ?? "";
  if (fromEnv.length >= 8 && fromEnv.length <= 12) return fromEnv;
  return phoneFromEmail(email);
}
