"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { messagesFor } from "@/lib/i18n";
import { formatMoney, progressPercent } from "@/lib/utils";

export type SearchCampaign = {
  href: string;
  title: string;
  category: string | null;
  coverImageUrl: string | null;
  organizer: string;
  currentAmount: number;
  goalAmount: number;
  currency: string;
  excerpt?: string | null;
};

export type SearchOrg = {
  id: string;
  name: string;
  logoUrl: string | null;
  description: string | null;
  href: string;
};

const ALL = "__all__";
const FUNDRAISER_PREVIEW = 3;

export function ImpactSearchPanel({
  locale = "en",
  campaigns,
  orgs = [],
  startHref,
  onSelect,
}: {
  locale?: string;
  campaigns: SearchCampaign[];
  orgs?: SearchOrg[];
  startHref: string;
  onSelect?: () => void;
}) {
  const messages = messagesFor(locale);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(ALL);
  const [showAllFundraisers, setShowAllFundraisers] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const headingId = useId();
  const orgsHeadingId = useId();

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const categories = useMemo(() => {
    const values = new Set<string>();
    for (const campaign of campaigns) {
      const value = campaign.category?.trim();
      if (value) values.add(value);
    }
    return [...values];
  }, [campaigns]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return campaigns.filter((campaign) => {
      if (category !== ALL && campaign.category?.trim() !== category) return false;
      if (!needle) return true;
      return (
        campaign.title.toLowerCase().includes(needle) ||
        campaign.organizer.toLowerCase().includes(needle) ||
        (campaign.category?.toLowerCase().includes(needle) ?? false)
      );
    });
  }, [campaigns, category, query]);

  const filteredOrgs = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return orgs;
    return orgs.filter((org) => {
      return (
        org.name.toLowerCase().includes(needle) ||
        (org.description?.toLowerCase().includes(needle) ?? false)
      );
    });
  }, [orgs, query]);

  useEffect(() => {
    setShowAllFundraisers(false);
  }, [query, category]);

  const heading =
    category === ALL ? messages.nav.searchFundraisers : category;
  const visibleCampaigns =
    showAllFundraisers || filtered.length <= FUNDRAISER_PREVIEW
      ? filtered
      : filtered.slice(0, FUNDRAISER_PREVIEW);
  const canSeeAllFundraisers =
    filtered.length > FUNDRAISER_PREVIEW && !showAllFundraisers;

  return (
    <div className="impact-search-body">
      <label className="impact-search-field">
        <Search size={16} strokeWidth={1.5} aria-hidden />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={messages.nav.searchPlaceholder}
          autoComplete="off"
          enterKeyHint="search"
        />
      </label>

      <div className="impact-search-pills" role="tablist" aria-label={messages.nav.search}>
        <button
          type="button"
          role="tab"
          aria-selected={category === ALL}
          className={
            category === ALL
              ? "impact-search-pill impact-search-pill-active"
              : "impact-search-pill"
          }
          onClick={() => setCategory(ALL)}
        >
          {messages.nav.searchFundraisers}
        </button>
        {categories.map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={category === value}
            className={
              category === value
                ? "impact-search-pill impact-search-pill-active"
                : "impact-search-pill"
            }
            onClick={() => setCategory(value)}
          >
            {value}
          </button>
        ))}
      </div>

      <div className="impact-search-list">
        <div aria-labelledby={headingId}>
          <h2 id={headingId}>{heading}</h2>
          {filtered.length ? (
            <ul>
              {visibleCampaigns.map((campaign) => {
                const percent = progressPercent(
                  campaign.currentAmount,
                  campaign.goalAmount,
                );
                return (
                  <li key={campaign.href}>
                    <Link href={campaign.href} className="impact-search-result">
                      {campaign.coverImageUrl ? (
                        <span
                          className="impact-search-thumb"
                          style={{ backgroundImage: `url(${campaign.coverImageUrl})` }}
                        />
                      ) : (
                        <span className="impact-search-thumb impact-search-thumb-empty" />
                      )}
                      <span className="impact-search-result-copy">
                        <strong>{campaign.title}</strong>
                        <span className="impact-search-by">
                          {messages.nav.searchBy.replace("{name}", campaign.organizer)}
                        </span>
                        <span
                          className="impact-search-progress"
                          role="progressbar"
                          aria-valuenow={percent}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        >
                          <span style={{ width: `${percent}%` }} />
                        </span>
                        <span className="impact-search-raised">
                          {formatMoney(campaign.currentAmount, campaign.currency, locale)}{" "}
                          {messages.campaign.raisedSuffix}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="impact-search-empty">
              <p>{messages.nav.searchEmpty}</p>
              <Link href={startHref} onClick={onSelect}>
                {messages.nav.start}
              </Link>
            </div>
          )}
        </div>

        {canSeeAllFundraisers ? (
          <button
            type="button"
            className="impact-search-see-all"
            onClick={() => setShowAllFundraisers(true)}
          >
            {messages.nav.searchSeeAllFundraisers}
          </button>
        ) : null}

        {filteredOrgs.length ? (
          <div className="impact-search-orgs" aria-labelledby={orgsHeadingId}>
            <h2 id={orgsHeadingId}>{messages.nav.searchNonprofits}</h2>
            <ul>
              {filteredOrgs.map((org) => {
                const letter = org.name.trim().charAt(0).toUpperCase() || "A";
                return (
                  <li key={org.id}>
                    <Link
                      href={org.href}
                      className="impact-search-org"
                      onClick={onSelect}
                    >
                      <span className="impact-search-org-logo">
                        {org.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={org.logoUrl} alt="" />
                        ) : (
                          <span className="impact-search-org-avatar" aria-hidden>
                            {letter}
                          </span>
                        )}
                      </span>
                      <span className="impact-search-org-copy">
                        <strong>{org.name}</strong>
                        {org.description ? <p>{org.description}</p> : null}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
