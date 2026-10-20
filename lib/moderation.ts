const HIDDEN_PATTERNS = [
  /scam/i,
  /sc4m/i,
  /sc@m/i,
  /s+c+a+m/i,
  /fraud/i,
  /fake/i,
  /\bnazi\b/i,
  /\bkill\b/i,
  /\bhate\b/i,
  /racist/i,
  /n[i1]gg/i,
  /\bslur\b/i,
];

export function shouldHideComment(text: string) {
  const normalized = text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9@\s]/gi, " ");
  return HIDDEN_PATTERNS.some((pattern) => pattern.test(normalized) || pattern.test(text));
}
