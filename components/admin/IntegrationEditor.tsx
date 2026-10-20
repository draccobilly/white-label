"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatMoney } from "@/lib/utils";

type LinkValue = {
  donationOptionId: string;
  amount: number;
  url: string;
  stripeCheckoutUrl: string;
};

type Props = {
  affiliatePageId: string;
  currency: string;
  initialPixels: {
    googlePixelId: string;
    tiktokPixelId: string;
  };
  links: LinkValue[];
  hasUtmifyToken: boolean;
};

export function IntegrationEditor({
  affiliatePageId,
  currency,
  initialPixels,
  links: initialLinks,
  hasUtmifyToken,
}: Props) {
  const router = useRouter();
  const [pixels, setPixels] = useState(initialPixels);
  const [links, setLinks] = useState(initialLinks);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [okMessage, setOkMessage] = useState(false);
  const [selectedId, setSelectedId] = useState(
    initialLinks[0]?.donationOptionId ?? "",
  );

  async function save(selectedOnly: boolean) {
    setLoading(true);
    setMessage(null);
    setOkMessage(false);
    const linksToSave = selectedOnly
      ? links.filter((link) => link.donationOptionId === selectedId)
      : links;
    const paymentLinks = linksToSave
      .filter((link) => link.url.trim() && link.stripeCheckoutUrl.trim())
      .map((link) => ({
        donationOptionId: link.donationOptionId,
        url: link.url.trim(),
        stripeCheckoutUrl: link.stripeCheckoutUrl.trim(),
      }));
    if (!paymentLinks.length) {
      setLoading(false);
      setMessage(
        selectedOnly
          ? "Paste the new Stripe link in both fields for the selected amount."
          : "Configure at least one complete Stripe Payment Link.",
      );
      return;
    }
    const response = await fetch(`/api/admin/pages/${affiliatePageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        affiliatePageId,
        googlePixelId: pixels.googlePixelId,
        tiktokPixelId: pixels.tiktokPixelId,
        paymentLinks,
        deactivateOtherLinks: selectedOnly,
      }),
    });
    const result = await response.json();
    setLoading(false);
    if (!response.ok) {
      setMessage(result.error ?? "Unable to save integrations");
      return;
    }
    if (selectedOnly) {
      setLinks((current) =>
        current.map((link) =>
          link.donationOptionId === selectedId
            ? link
            : { ...link, url: "", stripeCheckoutUrl: "" },
        ),
      );
    }
    setMessage(
      selectedOnly
        ? "Test mode saved. Only the selected amount is active for this affiliate."
        : "Saved. This page is isolated from every other affiliate.",
    );
    setOkMessage(true);
    router.refresh();
  }

  async function testUtmify() {
    setTesting(true);
    setMessage(null);
    setOkMessage(false);
    const response = await fetch(`/api/admin/pages/${affiliatePageId}/test`, {
      method: "POST",
    });
    const result = await response.json();
    setTesting(false);
    setOkMessage(response.ok);
    setMessage(
      response.ok
        ? result.preview
          ? `Utmify accepted the test payload. ${result.preview}`
          : "Utmify accepted the isolated test payload."
        : result.error ?? "Utmify test failed",
    );
  }

  return (
    <form
      className="admin-form"
      onSubmit={(event) => {
        event.preventDefault();
        void save(false);
      }}
    >
      <div className="admin-grid">
        <label>
          Google tag ID
          <input
            className="admin-input"
            value={pixels.googlePixelId}
            placeholder="G-XXXXXXXX"
            onChange={(event) =>
              setPixels((current) => ({
                ...current,
                googlePixelId: event.target.value,
              }))
            }
          />
        </label>
      </div>
      <div className="admin-grid">
        <label>
          TikTok Pixel ID
          <input
            className="admin-input"
            value={pixels.tiktokPixelId}
            onChange={(event) =>
              setPixels((current) => ({
                ...current,
                tiktokPixelId: event.target.value,
              }))
            }
          />
        </label>
      </div>
      <p className="admin-help">
        Facebook Pixel is not loaded on campaign pages. Purchase events for Ads
        Manager come only from Utmify (API credential + pixel script on the
        affiliate profile). Google and TikTok tags below are optional.
        Utmify API credential, webhook and pixel script are saved on the affiliate
        profile for the desk you have selected. México Direct Team does not reuse
        the United States pixel.
        {hasUtmifyToken ? " Credential is already saved for this desk." : " Add the credential on the affiliate profile while this desk is selected."}
      </p>

      <h3 style={{ marginBottom: 0 }}>Stripe Payment Links by amount</h3>
      <p className="admin-help">
        Ads go to the product or checkout URL. Left: t.co that wraps Stripe
        after our checkout. Right: original buy.stripe.com / plink_. UTMs stay
        on the page; t.co only protects the Stripe hop.
      </p>
      <div className="amount-chip-field">
        {links.map((link) => (
          <button
            type="button"
            key={link.donationOptionId}
            className={`amount-chip ${
              selectedId === link.donationOptionId ? "is-suggested" : ""
            } ${link.url && link.stripeCheckoutUrl ? "has-link" : ""}`}
            onClick={() => setSelectedId(link.donationOptionId)}
          >
            {formatMoney(link.amount, currency)}
          </button>
        ))}
      </div>
      {links
        .filter((link) => link.donationOptionId === selectedId)
        .map((link) => (
        <div className="admin-card" style={{ padding: 16 }} key={link.donationOptionId}>
          <strong>Configure {formatMoney(link.amount, currency)}</strong>
          <div className="admin-grid" style={{ marginTop: 10 }}>
            <label>
              Stripe wrap (t.co)
              <input
                className="admin-input"
                type="text"
                inputMode="url"
                placeholder="https://t.co/7nPwhgJBAF"
                value={link.url}
                onChange={(event) =>
                  setLinks((current) =>
                    current.map((item) =>
                      item.donationOptionId === link.donationOptionId
                        ? { ...item, url: event.target.value }
                        : item,
                    ),
                  )
                }
              />
            </label>
            <label>
              Original Stripe Payment Link
              <input
                className="admin-input"
                type="text"
                inputMode="url"
                placeholder="https://buy.stripe.com/... or plink_..."
                value={link.stripeCheckoutUrl}
                onChange={(event) =>
                  setLinks((current) =>
                    current.map((item) =>
                      item.donationOptionId === link.donationOptionId
                        ? { ...item, stripeCheckoutUrl: event.target.value }
                        : item,
                    ),
                  )
                }
              />
            </label>
          </div>
        </div>
      ))}

      <div style={{ display: "flex", gap: 10 }}>
        <button
          className="secondary-button"
          type="button"
          disabled={loading || !selectedId}
          onClick={() => void save(true)}
        >
          {loading ? "Saving…" : "Save selected amount only"}
        </button>
        <button className="primary-button" type="submit" disabled={loading}>
          {loading ? "Validating and saving…" : "Save isolated integrations"}
        </button>
        <button
          className="secondary-button"
          type="button"
          disabled={testing || !hasUtmifyToken}
          onClick={testUtmify}
        >
          {testing ? "Testing…" : "Test Utmify"}
        </button>
      </div>
      {message && (
        <p className={okMessage ? "form-message" : "form-error"}>
          {message}
        </p>
      )}
    </form>
  );
}
