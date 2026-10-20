/** Auth cookies cannot be Secure on http://IP before TLS exists. */
export function cookiesShouldBeSecure(proto?: string | null) {
  const normalized = proto?.replace(/:$/, "").toLowerCase();
  if (normalized === "https") return true;
  if (normalized === "http") return false;
  if (typeof window !== "undefined") {
    return window.location.protocol === "https:";
  }
  return false;
}

export function supabaseAuthCookieOptions(proto?: string | null) {
  return {
    path: "/",
    sameSite: "lax" as const,
    secure: cookiesShouldBeSecure(proto),
  };
}
