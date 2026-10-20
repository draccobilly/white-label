import Link from "next/link";
import { impactFooterColumns, impactLegalLinks } from "@/lib/public-nav";
import type { Messages } from "@/lib/i18n/types";
import { withPublicPrefix } from "@/lib/public-site-url";
import { BrandLogo } from "@/components/BrandLogo";

export function ImpactSiteFooter({
  siteName,
  footerText,
  messages,
  pathPrefix,
  donateHref,
  institutional = false,
  contactEmail,
  contactPhone,
  contactAddress,
  nonprofitEin,
  nonprofitName,
  logoUrl,
}: {
  siteName: string;
  footerText?: string | null;
  messages: Messages;
  pathPrefix?: string | null;
  donateHref: string;
  institutional?: boolean;
  contactEmail?: string | null;
  contactPhone?: string | null;
  contactAddress?: string | null;
  nonprofitEin?: string | null;
  nonprofitName?: string | null;
  logoUrl?: string | null;
}) {
  const prefix = pathPrefix;
  const site = messages.site;
  const columns = impactFooterColumns(messages, pathPrefix, donateHref, {
    institutional: true,
  });
  const give = columns[0] ?? [];
  const organize = columns[1] ?? [];
  const org = [...(columns[2] ?? []), ...(columns[3] ?? [])];

  return (
    <footer className="public-footer impact-footer wh-footer">
      <div className="shell wh-footer-top">
        <div className="wh-footer-brand">
          <BrandLogo
            siteName={siteName}
            logoUrl={logoUrl}
            compact
            href={withPublicPrefix(prefix, "/")}
          />
          <p className="wh-footer-status">
            {site.charityStatus}
            {nonprofitEin ? ` · ${site.contactEin} ${nonprofitEin}` : ""}
          </p>
          {nonprofitName && nonprofitName !== siteName ? <p>{nonprofitName}</p> : null}
          {contactAddress ? <p>{contactAddress}</p> : null}
          <div className="wh-footer-contact">
            {contactEmail ? (
              <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
            ) : null}
            {contactPhone ? (
              <a href={`tel:${contactPhone.replace(/[^\d+]/g, "")}`}>{contactPhone}</a>
            ) : null}
          </div>
        </div>

        <nav className="wh-footer-cols" aria-label={siteName}>
          <div className="wh-footer-col">
            <p className="wh-footer-label">{site.footerGive}</p>
            {[...give, ...organize].map((link) => (
              <Link href={link.href} key={`${link.href}-${link.label}`}>
                {link.label}
              </Link>
            ))}
          </div>
          <div className="wh-footer-col">
            <p className="wh-footer-label">{site.footerOrg}</p>
            {org.map((link) => (
              <Link href={link.href} key={`${link.href}-${link.label}`}>
                {link.label}
              </Link>
            ))}
            {institutional ? null : (
              <Link href={withPublicPrefix(prefix, "/help")}>{messages.nav.help}</Link>
            )}
          </div>
        </nav>
      </div>

      <div className="shell wh-footer-legal">
        {impactLegalLinks(messages, pathPrefix).map((link) => (
          <Link href={link.href} key={link.href}>
            {link.label}
          </Link>
        ))}
      </div>
      {footerText ? (
        <div className="shell">
          <p className="wh-footer-note">{footerText}</p>
        </div>
      ) : null}
    </footer>
  );
}
