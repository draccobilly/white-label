import { afterEach, describe, expect, it } from "vitest";
import {
  formTokenAgeOk,
  inspectPublicForm,
  issueFormToken,
  looksLikeBotEmail,
  looksLikeBotFill,
} from "@/lib/form-guard";
import { FORM_CODE_ERROR, FORM_EMAIL_ERROR, FORM_MAX_AGE_MS, FORM_SENTENCE_ERROR } from "@/lib/form-guard-shared";

const previousKey = process.env.ENCRYPTION_KEY;

afterEach(() => {
  if (previousKey === undefined) delete process.env.ENCRYPTION_KEY;
  else process.env.ENCRYPTION_KEY = previousKey;
});

function agedToken(ageMs = 5000) {
  process.env.ENCRYPTION_KEY = "test-form-guard";
  const now = Date.now();
  return { token: issueFormToken(now - ageMs), now };
}

describe("form token", () => {
  it("rejects a token that was just issued", () => {
    process.env.ENCRYPTION_KEY = "test-form-guard";
    const now = 1_700_000_000_000;
    const token = issueFormToken(now);
    expect(formTokenAgeOk(token, now + 500)).toBe(false);
    expect(formTokenAgeOk(token, now + 2000)).toBe(true);
    expect(formTokenAgeOk(token, now + FORM_MAX_AGE_MS + 1)).toBe(false);
  });

  it("rejects a token signed with another secret", () => {
    process.env.ENCRYPTION_KEY = "one";
    const token = issueFormToken(1_700_000_000_000);
    process.env.ENCRYPTION_KEY = "two";
    expect(formTokenAgeOk(token, 1_700_000_005_000)).toBe(false);
  });
});

describe("bot text", () => {
  it("flags the refund spam and lets a real note through", () => {
    expect(looksLikeBotFill("eYytnAslTSfCuzZvBm")).toBe(true);
    expect(looksLikeBotFill("LljyvjuRbGJJtGMEHTqsXIA")).toBe(true);
    expect(looksLikeBotFill("FijglTKmRpfpiMVgZz")).toBe(true);
    expect(looksLikeBotFill("WRHIYYPUBMSIMJHQGR")).toBe(true);
    expect(looksLikeBotFill("Maria Lopez")).toBe(false);
    expect(looksLikeBotFill("I donated twice by mistake.")).toBe(false);
    expect(looksLikeBotFill("$50")).toBe(false);
    expect(looksLikeBotFill("Constantinos")).toBe(false);
    expect(looksLikeBotEmail("katheri.new.rig.ht.u.0.l.r.t.8.m.d@gmail.com")).toBe(true);
    expect(looksLikeBotEmail("maria.lopez@gmail.com")).toBe(false);
  });
});

describe("public form inspection", () => {
  it("drops refund spam before it is saved", () => {
    const { token, now } = agedToken();
    const verdict = inspectPublicForm({
      formToken: token,
      companyUrl: "",
      email: "katheri.new.rig.ht.u.0.l.r.t.8.m.d@gmail.com",
      texts: ["eYytnAslTSfCuzZvBm"],
      prose: ["LljyvjuRbGJJtGMEHTqsXIA", "FijglTKmRpfpiMVgZz"],
      trackingCode: "WRHIYYPUBMSIMJHQGR",
    });
    expect(formTokenAgeOk(token, now)).toBe(true);
    expect(verdict).toEqual({ ok: false, silent: false, message: FORM_EMAIL_ERROR });
  });

  it("rejects a tracking code that is not DN plus 8 digits", () => {
    const { token } = agedToken();
    const verdict = inspectPublicForm({
      formToken: token,
      companyUrl: "",
      email: "maria.lopez@gmail.com",
      texts: ["Maria Lopez"],
      prose: ["$50", "I donated twice by mistake and need the second gift returned."],
      trackingCode: "WRHIYYPUBMSIMJHQGR",
    });
    expect(verdict).toEqual({ ok: false, silent: false, message: FORM_CODE_ERROR });
  });

  it("accepts a real refund note", () => {
    const { token } = agedToken();
    expect(
      inspectPublicForm({
        formToken: token,
        companyUrl: "",
        email: "maria.lopez@gmail.com",
        texts: ["Maria Lopez"],
        prose: ["$50", "I donated twice by mistake and need the second gift returned."],
        trackingCode: "dn 39182357",
      }),
    ).toEqual({ ok: true });
  });

  it("accepts a fundraiser story and rejects a story with no spaces", () => {
    const { token } = agedToken();
    expect(
      inspectPublicForm({
        formToken: token,
        companyUrl: "",
        email: "ana.souza@gmail.com",
        texts: ["Ana Souza"],
        prose: [
          "the published address, the published city, CA 90201",
          "Our neighbor lost work and the family needs help with groceries this month.",
        ],
      }),
    ).toEqual({ ok: true });

    const blocked = inspectPublicForm({
      formToken: token,
      companyUrl: "",
      email: "ana.souza@gmail.com",
      texts: ["Ana Souza"],
      prose: ["the published address", "FijglTKmRpfpiMVgZzFijglTKmRpfpiMVgZz"],
    });
    expect(blocked).toEqual({ ok: false, silent: false, message: FORM_SENTENCE_ERROR });
  });

  it("pretends a honeypot submission succeeded and stores nothing", () => {
    const verdict = inspectPublicForm({
      formToken: "not-a-token",
      companyUrl: "https://spam.example",
      email: "katheri.new.rig.ht.u.0.l.r.t.8.m.d@gmail.com",
      texts: ["eYytnAslTSfCuzZvBm"],
      prose: ["FijglTKmRpfpiMVgZz"],
      trackingCode: "WRHIYYPUBMSIMJHQGR",
    });
    expect(verdict).toEqual({ ok: false, silent: true, message: "" });
  });
});
