export function einDigits(ein?: string | null) {
  return (ein ?? "").replace(/\D/g, "");
}

export function irsSearchUrl(ein?: string | null) {
  const digits = einDigits(ein);
  if (!digits) return "https://apps.irs.gov/app/eos/";
  return `https://apps.irs.gov/app/eos/details/?ein=${digits}`;
}

export function propublicaNonprofitUrl(ein?: string | null) {
  const digits = einDigits(ein);
  if (!digits) return "https://projects.propublica.org/nonprofits/";
  return `https://projects.propublica.org/nonprofits/organizations/${digits}`;
}

export function candidSearchUrl(ein?: string | null) {
  const value = (ein ?? "").trim() || einDigits(ein);
  if (!value) return "https://www.guidestar.org/";
  return `https://www.guidestar.org/search?q=${encodeURIComponent(value)}`;
}

export function documentRequestMailto(
  email: string | null | undefined,
  siteName: string,
) {
  const to = email?.trim();
  if (!to) return "/contact";
  const subject = encodeURIComponent(`Document request - ${siteName}`);
  const body = encodeURIComponent(
    "Please send the document and tax year I need. If this is about a campaign, I will include the campaign name or link.",
  );
  return `mailto:${to}?subject=${subject}&body=${body}`;
}
