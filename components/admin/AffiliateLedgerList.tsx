"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, ChevronRight, Link2, Settings } from "lucide-react";
import { AdminChip } from "@/components/admin/AdminChip";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { CopyLinkButton } from "@/components/admin/CopyLinkButton";
import { formatMoney } from "@/lib/utils";

export type AffiliateLedger = {
  id: string;
  name: string;
  slug: string;
  pages: Array<{
    id: string;
    campaignTitle: string;
    campaignTag: string;
    campaignSlug: string;
    isNew: boolean;
    publicPath: string;
    paymentLinks: number;
    optionCount: number;
    pageClicks: number;
    checkoutClicks: number;
    paidGiftCount: number;
    totalSold: number;
    currency: string;
    utmifyConfigured: boolean;
    lastDelivery: string | null;
  }>;
};

function formatCount(value: number) {
  return value.toLocaleString();
}

export function AffiliateLedgerList({
  ledgers,
  pathPrefix,
  copyOnly = false,
}: {
  ledgers: AffiliateLedger[];
  pathPrefix?: string | null;
  copyOnly?: boolean;
}) {
  const [openIds, setOpenIds] = useState(() => ledgers.map((ledger) => ledger.id));

  function toggle(id: string) {
    setOpenIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  if (!ledgers.length || (copyOnly && ledgers.every((ledger) => !ledger.pages.length))) {
    return (
      <section className="affiliate-ledger">
        <AdminEmptyState
          compact
          icon={<Link2 size={20} />}
          title={copyOnly ? "No links yet" : "No affiliate pages yet"}
          body={
            copyOnly
              ? "Campaigns you create will show a copy button for the public link here."
              : "Create an affiliate first, then their page ledger will appear here."
          }
        />
      </section>
    );
  }

  if (copyOnly) {
    const pages = ledgers.flatMap((ledger) => ledger.pages);
    return (
      <section className="affiliate-ledger is-open">
        <ul className="ledger-pages">
          {pages.map((page) => (
            <li key={page.id} className="ledger-page is-simple">
              <div className="ledger-page-copy">
                <strong className="ledger-campaign-title">{page.campaignTitle}</strong>
              </div>
              <CopyLinkButton path={page.publicPath} prefix={pathPrefix} />
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <div className="ledger-stack">
      {ledgers.map((affiliate) => {
        const expanded = openIds.includes(affiliate.id);
        const pageClicks = affiliate.pages.reduce(
          (sum, page) => sum + page.pageClicks,
          0,
        );
        const checkoutClicks = affiliate.pages.reduce(
          (sum, page) => sum + page.checkoutClicks,
          0,
        );
        const paidGifts = affiliate.pages.reduce(
          (sum, page) => sum + page.paidGiftCount,
          0,
        );
        const newCount = affiliate.pages.filter((page) => page.isNew).length;
        return (
          <section
            className={`affiliate-ledger ${expanded ? "is-open" : "is-collapsed"}`}
            key={affiliate.id}
          >
            <header className="affiliate-ledger-head">
              <button
                type="button"
                className="affiliate-ledger-toggle"
                aria-expanded={expanded}
                onClick={() => toggle(affiliate.id)}
              >
                <span className="affiliate-ledger-chevron" aria-hidden>
                  {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </span>
                <span className="affiliate-ledger-title">
                  <h2>{affiliate.name}</h2>
                  <p>
                    {affiliate.pages.length} {affiliate.pages.length === 1 ? "page" : "pages"},{" "}
                    {formatCount(pageClicks)} page clicks, {formatCount(checkoutClicks)} checkout
                    clicks, {formatCount(paidGifts)} paid gifts
                    {newCount ? `, ${newCount} new` : ""}
                  </p>
                </span>
              </button>
              <Link className="secondary-button" href={`/admin/affiliates/${affiliate.id}`}>
                View affiliate
              </Link>
            </header>
            {expanded ? (
              <ul className="ledger-pages">
                {affiliate.pages.map((page) => (
                  <li key={page.id} className={`ledger-page${page.isNew ? " is-new" : ""}`}>
                    <div className="ledger-page-copy">
                      <p className="ledger-page-tags">
                        <span className="campaign-name-tag">{page.campaignTag}</span>
                        {page.isNew ? <span className="campaign-new-flag">New</span> : null}
                        <AdminChip tone={page.utmifyConfigured ? "success" : "warning"}>
                          {page.utmifyConfigured ? "Utmify configured" : "Utmify missing"}
                        </AdminChip>
                      </p>
                      <strong
                        className="ledger-campaign-title"
                        title={`${page.campaignSlug} / ${affiliate.slug}`}
                      >
                        {page.campaignTitle}
                      </strong>
                      <CopyLinkButton path={page.publicPath} prefix={pathPrefix} />
                    </div>
                    <dl className="ledger-stats">
                      <div>
                        <dt>Page clicks</dt>
                        <dd>{formatCount(page.pageClicks)}</dd>
                      </div>
                      <div>
                        <dt>Checkout</dt>
                        <dd>{formatCount(page.checkoutClicks)}</dd>
                      </div>
                      <div>
                        <dt>Paid gifts</dt>
                        <dd>{formatCount(page.paidGiftCount)}</dd>
                      </div>
                      <div>
                        <dt>Total sold</dt>
                        <dd>{formatMoney(page.totalSold, page.currency)}</dd>
                      </div>
                    </dl>
                    <div className="ledger-page-foot">
                      <p>
                        <span>
                          Stripe links {page.paymentLinks}/{page.optionCount}
                        </span>
                        <span>Last delivery {page.lastDelivery ?? "none yet"}</span>
                      </p>
                      <Link className="secondary-button" href={`/admin/integrations/${page.id}`}>
                        <Settings size={15} aria-hidden />
                        Configure
                      </Link>
                    </div>
                  </li>
                ))}
                {!affiliate.pages.length ? (
                  <li className="ledger-page is-simple">
                    <p className="dash-empty">No campaign pages in this ledger yet.</p>
                  </li>
                ) : null}
              </ul>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
