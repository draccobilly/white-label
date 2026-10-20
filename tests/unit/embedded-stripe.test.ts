import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  embeddedCheckoutMatchesIntent,
  embeddedCheckoutReturnUrl,
  usesEmbeddedStripeCheckout,
  walletPaymentMatchesIntent,
} from "@/lib/embedded-stripe";

describe("embedded stripe checkout", () => {
  it("turns on only for the institutional Stripe desk", () => {
    expect(
      usesEmbeddedStripeCheckout({
        paymentGateway: "STRIPE",
        siteMode: "INSTITUTIONAL",
      }),
    ).toBe(true);
    expect(
      usesEmbeddedStripeCheckout({
        paymentGateway: "STRIPE",
        siteMode: "CAMPAIGN",
      }),
    ).toBe(false);
    expect(
      usesEmbeddedStripeCheckout({
        paymentGateway: "PAGNOVO",
        siteMode: "INSTITUTIONAL",
      }),
    ).toBe(false);
  });

  it("keeps the Stripe session placeholder unencoded in the return url", () => {
    expect(
      embeddedCheckoutReturnUrl("https://giving.example.org", "page-1"),
    ).toBe(
      "https://giving.example.org/api/campaign-return?affiliate_page_id=page-1&session_id={CHECKOUT_SESSION_ID}",
    );
  });

  it("matches an embedded session to its checkout intent", () => {
    expect(
      embeddedCheckoutMatchesIntent({
        intentAmount: 2500,
        intentCurrency: "usd",
        sessionAmount: 2500,
        sessionCurrency: "USD",
        sessionPaymentLinkId: null,
        checkoutKind: "embedded",
        pageActive: true,
        affiliateActive: true,
      }),
    ).toBe(true);
    expect(
      embeddedCheckoutMatchesIntent({
        intentAmount: 2500,
        intentCurrency: "USD",
        sessionAmount: 5000,
        sessionCurrency: "USD",
        sessionPaymentLinkId: null,
        checkoutKind: "embedded",
        pageActive: true,
        affiliateActive: true,
      }),
    ).toBe(false);
    expect(
      embeddedCheckoutMatchesIntent({
        intentAmount: 2500,
        intentCurrency: "USD",
        sessionAmount: 2500,
        sessionCurrency: "USD",
        sessionPaymentLinkId: "plink_123",
        checkoutKind: "embedded",
        pageActive: true,
        affiliateActive: true,
      }),
    ).toBe(false);
  });

  it("sends one of this operation's own product names, tied to the cause, not the campaign title", async () => {
    const { formatMoney } = await import("@/lib/utils");
    const {
      CHECKOUT_ITEM_NAME,
      GATEWAY_GENERAL_GROUP_KEY,
      GATEWAY_PRODUCT_TEMPLATES,
      stripePaymentLabel,
      gatewayProductGroup,
      gatewayProductLabel,
    } = await import("@/lib/embedded-checkout");
    const { GATEWAY_GENERAL_TEMPLATES, GATEWAY_PRODUCT_GROUPS } =
      await import("@/lib/gateway-product-names");
    const amount = formatMoney(2500, "USD");
    expect(GATEWAY_PRODUCT_TEMPLATES.length).toBeGreaterThanOrEqual(8);
    const normalized = GATEWAY_PRODUCT_TEMPLATES.map((template) => template.trim().toLowerCase());
    expect(new Set(normalized).size).toBe(GATEWAY_PRODUCT_TEMPLATES.length);
    // The five names every operation once shared. No gateway account may send them again.
    const legacyShared = [
      "Pack of {amount} of food & home supplements",
      "Help the organization with {amount} to keep its international program",
      "Supply {amount} of direct help for affected families",
      "Help these humble families with {amount} to overcome their hardships",
      "Give {amount} of food and home supplies to families in need",
    ].map((template) => template.toLowerCase());
    for (const name of normalized) expect(legacyShared).not.toContain(name);
    expect(CHECKOUT_ITEM_NAME).not.toBe("Your help makes the difference");
    expect(normalized).not.toContain(CHECKOUT_ITEM_NAME.toLowerCase());
    const bigAmount = formatMoney(100_000, "USD");
    for (const template of GATEWAY_PRODUCT_TEMPLATES) {
      expect(template.split("{amount}")).toHaveLength(2);
      // PayPal cuts the purchase unit description at 127 characters, PagNovo at 120.
      expect(template.replaceAll("{amount}", bigAmount).length).toBeLessThanOrEqual(120);
    }
    expect(stripePaymentLabel("   ")).toBe(CHECKOUT_ITEM_NAME);

    // Every cause has its own list, and a donation to that cause draws only from it.
    expect(new Set(GATEWAY_PRODUCT_GROUPS.map((group) => group.key)).size).toBe(
      GATEWAY_PRODUCT_GROUPS.length,
    );
    expect(GATEWAY_GENERAL_TEMPLATES.length).toBeGreaterThanOrEqual(8);
    const rendered5000 = (template: string) =>
      template.replaceAll("{amount}", formatMoney(5000, "USD"));
    for (const group of GATEWAY_PRODUCT_GROUPS) {
      expect(group.key).not.toBe(GATEWAY_GENERAL_GROUP_KEY);
      expect(group.templates.length).toBeGreaterThanOrEqual(8);
      for (const slug of group.slugs) {
        expect(gatewayProductGroup({ causeSlug: slug }).key).toBe(group.key);
        expect(gatewayProductGroup({ campaignSlug: slug, campaignTitle: "Anything" }).key).toBe(
          group.key,
        );
      }
      if (!group.slugs[0]) continue;
      const context = { causeSlug: group.slugs[0] };
      for (let index = 0; index < group.templates.length; index += 1) {
        const label = gatewayProductLabel(2500, "USD", { ...context, index });
        expect(label).toBe(group.templates[index].replaceAll("{amount}", amount));
        expect(label).toContain(amount);
        expect(stripePaymentLabel(label)).toBe(label);
      }
      // Deck rotation inside the cause: two decks of draws cover every name, none more
      // than three times, never the same name back to back, nothing from another cause.
      const size = group.templates.length;
      const own = new Set(group.templates.map(rendered5000));
      const draws = Array.from({ length: size * 2 }, () =>
        gatewayProductLabel(5000, "USD", context),
      );
      const counts = new Map<string, number>();
      for (const label of draws) {
        expect(own.has(label), `${label} is not a ${group.key} name`).toBe(true);
        counts.set(label, (counts.get(label) ?? 0) + 1);
      }
      expect(counts.size).toBe(size);
      for (const count of counts.values()) expect(count).toBeLessThanOrEqual(3);
      for (let i = 1; i < draws.length; i += 1) expect(draws[i]).not.toBe(draws[i - 1]);
    }
    // With no campaign at all, the general list.
    expect(gatewayProductGroup().key).toBe(GATEWAY_GENERAL_GROUP_KEY);
    expect(gatewayProductGroup().templates).toBe(GATEWAY_GENERAL_TEMPLATES);
    expect(
      new Set(GATEWAY_GENERAL_TEMPLATES.map(rendered5000)).has(gatewayProductLabel(5000, "USD")),
    ).toBe(true);

    for (const file of [
      "app/api/stripe/embedded-session/route.ts",
      "app/api/stripe/wallet-intent/route.ts",
      "app/api/paypal/order/route.ts",
    ]) {
      const source = readFileSync(file, "utf8");
      expect(source).toContain("intent.gatewayLabel");
      expect(source).not.toContain("stripePaymentLabel(started.page.campaign.title)");
    }
    // The checkout hands the cause and the campaign text to the catalog.
    for (const file of ["lib/embedded-checkout.ts", "app/api/pagnovo/purchase/route.ts"]) {
      const source = readFileSync(file, "utf8");
      expect(source).toContain("campaignTitle: page.campaign.title");
      expect(source).toContain("campaignSummary: page.campaign.summary");
      expect(source).toContain("campaignStory: page.campaign.story");
    }
    expect(readFileSync("lib/embedded-checkout.ts", "utf8")).toContain("causeSlug: parsed.causeSlug");
  });

  it("rewrites a campaign made in the admin into product names about its own cause", async () => {
    const { formatMoney } = await import("@/lib/utils");
    const { gatewayProductGroup, gatewayProductLabel } = await import("@/lib/embedded-checkout");
    const { GATEWAY_CAMPAIGN_VOICE, GATEWAY_PRODUCT_GROUPS } =
      await import("@/lib/gateway-product-names");
    const {
      campaignProductTemplates,
      detectCampaignLead,
      detectCampaignPeople,
      detectCampaignTheme,
    } = await import("@/lib/gateway-campaign-names");

    expect(GATEWAY_CAMPAIGN_VOICE.frames.length).toBeGreaterThanOrEqual(8);
    expect(GATEWAY_CAMPAIGN_VOICE.leads.length).toBeGreaterThanOrEqual(2);
    for (const frame of GATEWAY_CAMPAIGN_VOICE.frames) {
      expect(frame.split("{amount}")).toHaveLength(2);
      expect(frame).toMatch(/\{(one|many|families)\}/);
    }

    // "Let's bless this humble father": keep the verb, generalize the person, name the hardship.
    const father = {
      title: "Let's bless this humble father",
      summary: "He works two jobs and still cannot cover the bills.",
      story: "",
    };
    expect(detectCampaignLead(father.title)).toEqual({ lead: "Let's bless", verb: "bless" });
    expect(detectCampaignTheme(father).key).toBe("poverty");
    expect(detectCampaignPeople(father.title)).toEqual({
      one: "a humble father",
      many: "humble fathers",
      families: "humble families",
    });
    const templates = campaignProductTemplates(father, GATEWAY_CAMPAIGN_VOICE);
    expect(templates).toHaveLength(GATEWAY_CAMPAIGN_VOICE.frames.length);
    expect(new Set(templates.map((template) => template.toLowerCase())).size).toBe(templates.length);
    const big = formatMoney(100_000, "USD");
    for (const template of templates) {
      expect(template.split("{amount}")).toHaveLength(2);
      expect(template.replaceAll("{amount}", big).length).toBeLessThanOrEqual(120);
      expect(template).toContain("humble");
      expect(template).toContain("affected by poverty");
      expect(template).not.toMatch(/\bthis humble\b/);
    }
    expect(templates.some((template) => template.startsWith("Let's bless humble families affected by poverty with {amount}"))).toBe(true);

    // Names never reach the gateway; the hardship comes from the campaign's own words.
    const surgery = { title: "Help Maria pay for her surgery", summary: null, story: null };
    const surgeryTemplates = campaignProductTemplates(surgery, GATEWAY_CAMPAIGN_VOICE);
    for (const template of surgeryTemplates) {
      expect(template).not.toContain("Maria");
      expect(template).toContain("facing medical bills");
    }
    expect(
      surgeryTemplates.some((template) => template.startsWith("Help families facing medical bills with {amount}")),
    ).toBe(true);

    // Spanish titles are read too; the name goes out in English.
    const spanish = { title: "Ayudemos a Doña Rosa con la renta de este mes", summary: null, story: null };
    expect(detectCampaignLead(spanish.title)).toEqual({ lead: "Let's help", verb: "help" });
    expect(detectCampaignTheme(spanish).key).toBe("housing");
    for (const template of campaignProductTemplates(spanish, GATEWAY_CAMPAIGN_VOICE)) {
      expect(template).not.toContain("Rosa");
      expect(template).toMatch(/neighbor|families/);
      expect(template).toContain("at risk of losing their home");
    }

    // The summary and story fill in when the title says little, and leads rotate.
    const quiet = { title: "For the Lopez family", summary: "Their house burned down last Tuesday.", story: "" };
    expect(detectCampaignLead(quiet.title)).toBeNull();
    expect(detectCampaignTheme(quiet).key).toBe("disaster");
    const quietTemplates = campaignProductTemplates(quiet, GATEWAY_CAMPAIGN_VOICE);
    for (const template of quietTemplates) {
      expect(template).not.toContain("Lopez");
      expect(template).toContain("rebuilding after a disaster");
    }
    const leadsUsed = new Set(
      quietTemplates
        .map((template) => GATEWAY_CAMPAIGN_VOICE.leads.find((lead) => template.startsWith(`${lead} `)))
        .filter(Boolean),
    );
    expect(leadsUsed.size).toBeGreaterThanOrEqual(2);

    // The checkout uses the rewritten names, keyed to the campaign, and rotates through them.
    const context = {
      campaignSlug: "bless-this-sample-campaign",
      campaignTitle: father.title,
      campaignSummary: father.summary,
    };
    const group = gatewayProductGroup(context);
    expect(group.key).toBe("campaign:bless-this-sample-campaign");
    expect(group.templates).toEqual(templates);
    const amount = formatMoney(7500, "USD");
    expect(gatewayProductLabel(7500, "USD", { ...context, index: 0 })).toBe(
      templates[0].replaceAll("{amount}", amount),
    );
    const own = new Set(templates.map((template) => template.replaceAll("{amount}", amount)));
    const draws = Array.from({ length: templates.length * 2 }, () =>
      gatewayProductLabel(7500, "USD", context),
    );
    const counts = new Map<string, number>();
    for (const label of draws) {
      expect(own.has(label), `${label} is not a name of this campaign`).toBe(true);
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    expect(counts.size).toBe(templates.length);
    for (let i = 1; i < draws.length; i += 1) expect(draws[i]).not.toBe(draws[i - 1]);

    // A cause slug still wins over the campaign text.
    const cause = GATEWAY_PRODUCT_GROUPS.find((entry) => entry.slugs.length > 0);
    if (cause) {
      expect(gatewayProductGroup({ causeSlug: cause.slugs[0], campaignTitle: father.title }).key).toBe(
        cause.key,
      );
    }
  });

  it("reads the $5 mission tip from Stripe checkout line items and Link order references", async () => {
    const {
      missionTipCentsFromStripeLineItems,
      checkoutSessionIdFromPaymentIntent,
    } = await import("@/lib/embedded-checkout");
    expect(
      missionTipCentsFromStripeLineItems([
        { description: "Sample campaign", amount_total: 2500 },
        { description: "Mission tip", amount_total: 500 },
      ]),
    ).toBe(500);
    expect(
      missionTipCentsFromStripeLineItems([
        { description: "Sample campaign", amount_total: 2500 },
      ]),
    ).toBe(0);
    expect(
      checkoutSessionIdFromPaymentIntent({
        payment_details: {
          order_reference: "cs_live_b1rX8mXU1sDXVJufJ1tur8WY31dGEmNZu2BnrQCbwKeLTAoDWa3AwLL5Wb",
        },
        metadata: {},
      }),
    ).toBe("cs_live_b1rX8mXU1sDXVJufJ1tur8WY31dGEmNZu2BnrQCbwKeLTAoDWa3AwLL5Wb");
  });

  it("matches a wallet PaymentIntent to its checkout intent", () => {
    expect(
      walletPaymentMatchesIntent({
        intentAmount: 10500,
        intentCurrency: "USD",
        paymentAmount: 10500,
        paymentCurrency: "usd",
        checkoutKind: "wallet",
        pageActive: true,
        affiliateActive: true,
      }),
    ).toBe(true);
    expect(
      walletPaymentMatchesIntent({
        intentAmount: 10500,
        intentCurrency: "USD",
        paymentAmount: 10500,
        paymentCurrency: "usd",
        checkoutKind: "embedded",
        pageActive: true,
        affiliateActive: true,
      }),
    ).toBe(false);
  });
});
