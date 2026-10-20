import { afterEach, describe, expect, it } from "vitest";
import { createInviteToken, hashInviteToken, inviteExpiresAt, INVITE_TTL_MS } from "@/lib/admin-invite";
import { isOwnerAdmin } from "@/lib/admin-role";
import { authErrorMessage, authHttpStatus, isAuthError } from "@/lib/auth-errors";
import { affiliatePagesForAdmin } from "@/lib/page-links-access";
import { cookiesShouldBeSecure } from "@/lib/supabase/cookie-options";

describe("admin operator access", () => {
  const previousEmail = process.env.ADMIN_EMAIL;

  afterEach(() => {
    process.env.ADMIN_EMAIL = previousEmail;
  });

  it("hashes invite tokens deterministically and not in plaintext", () => {
    const { token, tokenHash } = createInviteToken();
    expect(tokenHash).toBe(hashInviteToken(token));
    expect(tokenHash).not.toBe(token);
    expect(tokenHash).toHaveLength(64);
  });

  it("expires invites after seven days", () => {
    const from = new Date("2026-01-01T00:00:00.000Z");
    expect(inviteExpiresAt(from).getTime() - from.getTime()).toBe(INVITE_TTL_MS);
  });

  it("marks auth cookies Secure only on HTTPS", () => {
    expect(cookiesShouldBeSecure("https")).toBe(true);
    expect(cookiesShouldBeSecure("https:")).toBe(true);
    expect(cookiesShouldBeSecure("http")).toBe(false);
    expect(cookiesShouldBeSecure(null)).toBe(false);
  });

  it("treats ADMIN_EMAIL as owner even if the stored role is operator", () => {
    process.env.ADMIN_EMAIL = "owner@example.com";
    expect(
      isOwnerAdmin({ email: "owner@example.com", role: "OPERATOR" }),
    ).toBe(true);
    expect(
      isOwnerAdmin({ email: "direct-team@example.com", role: "OPERATOR" }),
    ).toBe(false);
    expect(isOwnerAdmin({ email: "other@example.com", role: "OWNER" })).toBe(true);
  });

  it("limits an operator page-link list to pages attached to that affiliate", () => {
    expect(
      affiliatePagesForAdmin({
        isOwner: false,
        companyId: "company-1",
        adminId: "operator-1",
        affiliateId: "affiliate-1",
        directTeamSlug: "direct-team",
      }),
    ).toEqual({
      affiliateId: "affiliate-1",
      campaign: { companyId: "company-1" },
    });
    expect(
      affiliatePagesForAdmin({
        isOwner: true,
        companyId: "company-1",
        adminId: "owner-1",
        directTeamSlug: "direct-team",
      }),
    ).toEqual({ campaign: { companyId: "company-1" } });
  });

  it("returns 403 for forbidden operator access", () => {
    const error = new Error("FORBIDDEN");
    expect(isAuthError(error)).toBe(true);
    expect(authHttpStatus(error)).toBe(403);
    expect(authErrorMessage(error)).toBe("Forbidden");
  });
});
