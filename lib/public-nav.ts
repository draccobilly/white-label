import type { Messages } from "@/lib/i18n/types";
import { portalCopy } from "@/lib/portal-copy";
import { withPublicPrefix } from "@/lib/public-site-url";

export type PublicNavLink = {
  href: string;
  label: string;
};

export type ImpactMenuItem = {
  href: string;
  title: string;
  description: string;
};

export type ImpactNavOptions = {
  campaignHref?: string | null;
  donateHref?: string | null;
  institutional?: boolean;
};

export function publicNav(messages: Messages, pathPrefix?: string | null) {
  return [
    { href: withPublicPrefix(pathPrefix, "/start-a-fundraiser"), label: messages.nav.start },
    { href: withPublicPrefix(pathPrefix, "/track-your-donation"), label: messages.nav.track },
    { href: withPublicPrefix(pathPrefix, "/about-us"), label: messages.nav.about },
  ] as const;
}

export function institutionalHeaderLinks(
  messages: Messages,
  pathPrefix?: string | null,
): PublicNavLink[] {
  return [
    { href: withPublicPrefix(pathPrefix, "/campaigns"), label: messages.site.navCampaigns },
    { href: withPublicPrefix(pathPrefix, "/news"), label: messages.site.navNews },
    { href: withPublicPrefix(pathPrefix, "/updates"), label: messages.site.navUpdates },
    { href: withPublicPrefix(pathPrefix, "/how-it-works"), label: messages.site.navHow },
    { href: withPublicPrefix(pathPrefix, "/about-us"), label: messages.nav.about },
    { href: withPublicPrefix(pathPrefix, "/accountability"), label: messages.site.navAccountability },
    { href: withPublicPrefix(pathPrefix, "/transparency"), label: messages.site.navTransparency },
  ];
}

/** Four-column Impact footer: only real public routes, GFM-like grouping. */
export function impactFooterColumns(
  messages: Messages,
  pathPrefix: string | null | undefined,
  donateHref: string,
  options?: ImpactNavOptions,
): PublicNavLink[][] {
  const prefix = pathPrefix;
  if (options?.institutional) {
    return [
      [
        { href: donateHref, label: messages.nav.donate },
        {
          href: withPublicPrefix(prefix, "/campaigns"),
          label: messages.site.navCampaigns,
        },
        {
          href: withPublicPrefix(prefix, "/start-a-fundraiser"),
          label: messages.nav.start,
        },
        {
          href: withPublicPrefix(prefix, "/portal/login"),
          label: portalCopy(messages.htmlLang).portalName,
        },
      ],
      [
        {
          href: withPublicPrefix(prefix, "/track-your-donation"),
          label: messages.nav.track,
        },
        { href: withPublicPrefix(prefix, "/refund"), label: messages.refund.title },
        { href: withPublicPrefix(prefix, "/help"), label: messages.nav.help },
      ],
      [
        { href: withPublicPrefix(prefix, "/about-us"), label: messages.nav.about },
        {
          href: withPublicPrefix(prefix, "/how-it-works"),
          label: messages.site.navHow,
        },
        {
          href: withPublicPrefix(prefix, "/accountability"),
          label: messages.site.navAccountability,
        },
        {
          href: withPublicPrefix(prefix, "/transparency"),
          label: messages.site.navTransparency,
        },
      ],
      [
        { href: withPublicPrefix(prefix, "/news"), label: messages.site.navNews },
        {
          href: withPublicPrefix(prefix, "/updates"),
          label: messages.site.navUpdates,
        },
        {
          href: withPublicPrefix(prefix, "/contact"),
          label: messages.site.navContact,
        },
      ],
    ];
  }

  return [
    [{ href: donateHref, label: messages.nav.donate }],
    [
      {
        href: withPublicPrefix(prefix, "/start-a-fundraiser"),
        label: messages.nav.start,
      },
      {
        href: withPublicPrefix(prefix, "/track-your-donation"),
        label: messages.nav.track,
      },
    ],
    [{ href: withPublicPrefix(prefix, "/about-us"), label: messages.nav.about }],
    [{ href: withPublicPrefix(prefix, "/refund"), label: messages.refund.title }],
  ];
}

export function impactLegalLinks(
  messages: Messages,
  pathPrefix?: string | null,
): PublicNavLink[] {
  return [
    { href: withPublicPrefix(pathPrefix, "/terms"), label: messages.site.navTerms },
    { href: withPublicPrefix(pathPrefix, "/privacy"), label: messages.site.navPrivacy },
    {
      href: withPublicPrefix(pathPrefix, "/donor-privacy"),
      label: messages.site.navDonorPrivacy,
    },
  ];
}

/** Impact hamburger rows: real public routes only, no donor auth. */
export function impactMenu(
  messages: Messages,
  pathPrefix: string | null | undefined,
  campaignHref?: string | null,
  options?: ImpactNavOptions,
): ImpactMenuItem[] {
  const donateHref =
    options?.donateHref?.trim() ||
    campaignHref?.trim() ||
    withPublicPrefix(pathPrefix, options?.institutional ? "/campaigns" : "/");
  const items: ImpactMenuItem[] = [
    {
      href: withPublicPrefix(pathPrefix, "/track-your-donation"),
      title: messages.nav.manageActivity,
      description: messages.nav.manageActivityDesc,
    },
    {
      href: donateHref,
      title: messages.nav.donate,
      description: messages.nav.donateDesc,
    },
    {
      href: withPublicPrefix(pathPrefix, "/start-a-fundraiser"),
      title: messages.nav.fundraising,
      description: messages.nav.fundraisingDesc,
    },
    {
      href: withPublicPrefix(pathPrefix, "/about-us"),
      title: messages.nav.about,
      description: messages.nav.aboutDesc,
    },
    {
      href: withPublicPrefix(pathPrefix, "/refund"),
      title: messages.refund.title,
      description: messages.nav.helpDesc,
    },
  ];

  if (options?.institutional) {
    items.splice(2, 0, {
      href: withPublicPrefix(pathPrefix, "/campaigns"),
      title: messages.site.navCampaigns,
      description: messages.site.navCampaignsDesc,
    });
    items.push(
      {
        href: withPublicPrefix(pathPrefix, "/help"),
        title: messages.nav.help,
        description: messages.nav.helpDesc,
      },
      {
        href: withPublicPrefix(pathPrefix, "/news"),
        title: messages.site.navNews,
        description: messages.site.navNewsDesc,
      },
      {
        href: withPublicPrefix(pathPrefix, "/updates"),
        title: messages.site.navUpdates,
        description: messages.site.navUpdatesDesc,
      },
      {
        href: withPublicPrefix(pathPrefix, "/how-it-works"),
        title: messages.site.navHow,
        description: messages.site.navHowDesc,
      },
      {
        href: withPublicPrefix(pathPrefix, "/accountability"),
        title: messages.site.navAccountability,
        description: messages.site.accountabilityLead,
      },
      {
        href: withPublicPrefix(pathPrefix, "/transparency"),
        title: messages.site.navTransparency,
        description: messages.site.transparencyLead,
      },
      {
        href: withPublicPrefix(pathPrefix, "/contact"),
        title: messages.site.navContact,
        description: messages.site.contactLead,
      },
    );
  }

  return items;
}
