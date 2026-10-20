"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CopyLinkButton } from "@/components/admin/CopyLinkButton";
import { publicHostname } from "@/lib/public-site-url";
import { formatMoney } from "@/lib/utils";

export type PaymentOption = {
  id: string;
  amount: number;
};

export type AffiliateOption = {
  id: string;
  name: string;
  slug: string;
};

export type AffiliatePageLinks = {
  id: string;
  affiliateId: string;
  affiliateName: string;
  affiliateSlug: string;
  campaignSlug: string;
  links: Array<{
    donationOptionId: string;
    amount: number;
    url: string;
    stripeCheckoutUrl: string;
  }>;
};

export function CampaignPaymentLinks({
  campaignId,
  currency,
  options,
  affiliates,
  pages,
  pathPrefix,
  short = false,
}: {
  campaignId: string;
  currency: string;
  options: PaymentOption[];
  affiliates: AffiliateOption[];
  pages: AffiliatePageLinks[];
  pathPrefix?: string | null;
  short?: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(pages);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [picker, setPicker] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [activeAffiliateId, setActiveAffiliateId] = useState(
    pages[0]?.affiliateId ?? "",
  );

  useEffect(() => {
    setRows(pages);
    setActiveAffiliateId((current) =>
      pages.some((page) => page.affiliateId === current)
        ? current
        : (pages[0]?.affiliateId ?? ""),
    );
  }, [pages]);

  const available = useMemo(
    () => affiliates.filter((affiliate) => !rows.some((row) => row.affiliateId === affiliate.id)),
    [affiliates, rows],
  );

  async function addAffiliate() {
    if (!picker) return;
    setAdding(true);
    setMessage(null);
    const response = await fetch(`/api/admin/campaigns/${campaignId}/affiliates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ affiliateId: picker }),
    });
    const result = await response.json();
    setAdding(false);
    if (!response.ok) {
      setMessage(result.error ?? "Unable to add affiliate");
      return;
    }
    const affiliate = affiliates.find((item) => item.id === picker);
    setRows((current) => [
      ...current,
      {
        id: result.page.id,
        affiliateId: picker,
        affiliateName: affiliate?.name ?? "Affiliate",
        affiliateSlug: affiliate?.slug ?? "",
        campaignSlug: result.page.campaignSlug ?? current[0]?.campaignSlug ?? "",
        links: options.map((option) => ({
          donationOptionId: option.id,
          amount: option.amount,
          url: "",
          stripeCheckoutUrl: "",
        })),
      },
    ]);
    setActiveAffiliateId(picker);
    setPicker("");
    router.refresh();
  }

  async function saveRow(row: AffiliatePageLinks, selectedOnly = false) {
    setSavingId(row.id);
    setMessage(null);
    const selectedId = selected[row.id] ?? row.links[0]?.donationOptionId;
    const linksToSave = selectedOnly
      ? row.links.filter((link) => link.donationOptionId === selectedId)
      : row.links;
    const paymentLinks = linksToSave
      .filter((link) => link.url.trim() && link.stripeCheckoutUrl.trim())
      .map((link) => ({
        donationOptionId: link.donationOptionId,
        url: link.url.trim(),
        stripeCheckoutUrl: link.stripeCheckoutUrl.trim(),
      }));
    if (!paymentLinks.length) {
      setSavingId(null);
      setMessage(
        selectedOnly
          ? "Paste the new Stripe link in both fields for the selected amount."
          : "Paste the checkout link in both fields for at least one amount.",
      );
      return;
    }
    const response = await fetch(`/api/admin/pages/${row.id}/payment-links`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentLinks,
        deactivateOtherLinks: selectedOnly,
      }),
    });
    const result = await response.json();
    setSavingId(null);
    if (!response.ok) {
      setMessage(result.error ?? "Unable to save payment links");
      return;
    }
    if (selectedOnly) {
      setRows((current) =>
        current.map((item) =>
          item.id === row.id
            ? {
                ...item,
                links: item.links.map((link) =>
                  link.donationOptionId === selectedId
                    ? link
                    : { ...link, url: "", stripeCheckoutUrl: "" },
                ),
              }
            : item,
        ),
      );
      setMessage(
        `Test mode enabled for ${row.affiliateName}: only the selected amount is active.`,
      );
    } else {
      setMessage(`Saved Payment Links for ${row.affiliateName}.`);
    }
    router.refresh();
  }

  function setLinkField(
    pageId: string,
    donationOptionId: string,
    field: "url" | "stripeCheckoutUrl",
    value: string,
  ) {
    setRows((current) =>
      current.map((row) =>
        row.id === pageId
          ? {
              ...row,
              links: row.links.map((link) =>
                link.donationOptionId === donationOptionId
                  ? { ...link, [field]: value }
                  : link,
              ),
            }
          : row,
      ),
    );
  }

  return (
    <div className="payment-link-board">
      <div className="payment-link-intro">
        <div>
          <h2>Affiliate Payment Links</h2>
          <p>
            Ads go to https://{publicHostname()}{pathPrefix || ""}/c/... — never to t.co.
            Saving here writes to the shared database, so the VPS shows the
            page immediately. Paste the t.co on the left and the original
            buy.stripe.com / plink_ on the right.
          </p>
        </div>
        <div className="payment-link-add">
          <label>
            Affiliate to configure
            <select
              className="admin-select"
              value={activeAffiliateId}
              onChange={(event) => setActiveAffiliateId(event.target.value)}
              disabled={rows.length <= 1}
            >
              {rows.map((row) => (
                <option key={row.affiliateId} value={row.affiliateId}>
                  {row.affiliateName}
                </option>
              ))}
            </select>
          </label>
          {available.length ? (
            <>
          <select
            className="admin-select"
            value={picker}
            onChange={(event) => setPicker(event.target.value)}
          >
            <option value="">Add another affiliate</option>
            {available.map((affiliate) => (
              <option key={affiliate.id} value={affiliate.id}>
                {affiliate.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="primary-button"
            disabled={!picker || adding}
            onClick={() => void addAffiliate()}
          >
            {adding ? "Adding…" : "Add affiliate"}
          </button>
            </>
          ) : (
            <small>Every existing affiliate is already connected.</small>
          )}
        </div>
      </div>

      {rows
        .filter((row) => row.affiliateId === activeAffiliateId)
        .map((row) => {
        const activeAmount = selected[row.id] ?? row.links[0]?.donationOptionId;
        const activeLink = row.links.find((link) => link.donationOptionId === activeAmount);
        const filled = row.links.filter((link) => link.url && link.stripeCheckoutUrl).length;
        return (
          <section className="affiliate-ledger" key={row.id}>
            <header className="affiliate-ledger-head">
              <div>
                <p className="admin-kicker">Affiliate</p>
                <h3>{row.affiliateName}</h3>
                <p>Page links · {filled}/{options.length} Payment Links</p>
              </div>
              <div className="admin-inline-actions">
                <CopyLinkButton
                  path={
                    short
                      ? `/c/${row.campaignSlug}`
                      : `/c/${row.campaignSlug}/${row.affiliateSlug}`
                  }
                  prefix={pathPrefix}
                  label="Copy product"
                />
                <CopyLinkButton
                  path={
                    short
                      ? `/c/${row.campaignSlug}/checkout`
                      : `/c/${row.campaignSlug}/${row.affiliateSlug}/checkout`
                  }
                  prefix={pathPrefix}
                  label="Copy checkout"
                />
              </div>
            </header>
            <div className="amount-chip-field">
              {row.links.map((link) => (
                <button
                  type="button"
                  key={link.donationOptionId}
                  className={`amount-chip ${activeLink?.donationOptionId === link.donationOptionId ? "is-suggested" : ""} ${link.url && link.stripeCheckoutUrl ? "has-link" : ""}`}
                  onClick={() =>
                    setSelected((current) => ({ ...current, [row.id]: link.donationOptionId }))
                  }
                >
                  {formatMoney(link.amount, currency)}
                </button>
              ))}
            </div>
            {activeLink ? (
              <>
                <div className="admin-grid">
                  <label>
                    Campaign handoff (t.co) for {formatMoney(activeLink.amount, currency)}
                    <input
                      className="admin-input"
                      type="text"
                      inputMode="url"
                      placeholder="https://t.co/7nPwhgJBAF"
                      value={activeLink.url}
                      onChange={(event) =>
                        setLinkField(row.id, activeLink.donationOptionId, "url", event.target.value)
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
                      value={activeLink.stripeCheckoutUrl}
                      onChange={(event) =>
                        setLinkField(
                          row.id,
                          activeLink.donationOptionId,
                          "stripeCheckoutUrl",
                          event.target.value,
                        )
                      }
                    />
                  </label>
                </div>
              </>
            ) : null}
            <div className="wizard-actions">
              <button
                type="button"
                className="secondary-button"
                disabled={savingId === row.id || !activeLink}
                onClick={() => void saveRow(row, true)}
              >
                {savingId === row.id
                  ? "Saving…"
                  : `Test only ${activeLink ? formatMoney(activeLink.amount, currency) : "selected amount"}`}
              </button>
              <button
                type="button"
                className="primary-button"
                disabled={savingId === row.id}
                onClick={() => void saveRow(row)}
              >
                {savingId === row.id ? "Saving…" : `Save ${row.affiliateName} links`}
              </button>
            </div>
          </section>
        );
      })}

      {!rows.length ? (
        <p className="admin-copy">
          Add an affiliate to paste the Stripe Payment Links that power each amount
          button.
        </p>
      ) : null}
      {message ? (
        <p
          className={
            message.startsWith("Saved") ||
            message.startsWith("Add") ||
            message.startsWith("Test mode")
              ? "form-message"
              : "form-error"
          }
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
