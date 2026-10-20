"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { SearchCampaign } from "@/components/public/ImpactSearch";
import { formatMoney, progressPercent } from "@/lib/utils";

const ALL = "__all__";

export function ImpactCampaignGrid({
  campaigns,
  locale,
  emptyLabel,
  allLabel,
  searchPlaceholder,
  searchCta,
  raisedSuffix: _raisedSuffix,
  ofGoalLabel,
}: {
  campaigns: SearchCampaign[];
  locale: string;
  emptyLabel: string;
  allLabel: string;
  searchPlaceholder: string;
  searchCta: string;
  raisedSuffix: string;
  ofGoalLabel: string;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(ALL);

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

  return (
    <div className="inst-grid-wrap">
      <form
        className="inst-search"
        onSubmit={(event) => event.preventDefault()}
        role="search"
      >
        <label className="sr-only" htmlFor="inst-campaign-search">
          {searchPlaceholder}
        </label>
        <input
          id="inst-campaign-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={searchPlaceholder}
        />
        <span className="inst-search-submit">{searchCta}</span>
      </form>

      {categories.length ? (
        <div className="inst-pills" role="tablist" aria-label={allLabel}>
          <button
            type="button"
            role="tab"
            aria-selected={category === ALL}
            className={category === ALL ? "is-active" : undefined}
            onClick={() => setCategory(ALL)}
          >
            {allLabel}
          </button>
          {categories.map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={category === value}
              className={category === value ? "is-active" : undefined}
              onClick={() => setCategory(value)}
            >
              {value}
            </button>
          ))}
        </div>
      ) : null}

      {filtered.length ? (
        <ul className="inst-campaign-grid">
          {filtered.map((campaign) => {
            const percent = progressPercent(
              campaign.currentAmount,
              campaign.goalAmount,
            );
            return (
              <li key={campaign.href}>
                <Link href={campaign.href} className="inst-campaign-card">
                  <span
                    className={`inst-campaign-cover${
                      campaign.coverImageUrl ? "" : " is-empty"
                    }`}
                    style={
                      campaign.coverImageUrl
                        ? { backgroundImage: `url(${campaign.coverImageUrl})` }
                        : undefined
                    }
                  />
                  <span className="inst-campaign-body">
                    {campaign.category ? (
                      <span className="inst-campaign-cat">{campaign.category}</span>
                    ) : null}
                    <strong>{campaign.title}</strong>
                    {campaign.excerpt ? (
                      <span className="inst-campaign-excerpt">{campaign.excerpt}</span>
                    ) : null}
                    <span
                      className="inst-campaign-progress"
                      role="progressbar"
                      aria-valuenow={percent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <span style={{ width: `${percent}%` }} />
                    </span>
                    <span className="inst-campaign-raised">
                      {formatMoney(campaign.currentAmount, campaign.currency, locale)}{" "}
                      {ofGoalLabel}{" "}
                      {formatMoney(campaign.goalAmount, campaign.currency, locale)}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="inst-empty">{emptyLabel}</p>
      )}
    </div>
  );
}
