import type { Metadata } from "next";
import Link from "next/link";
import { PublicInfoPage } from "@/components/public/PublicInfoPage";
import { PublicSiteShell } from "@/components/public/PublicSiteShell";
import { ShareStoryForm } from "@/components/public/ShareStoryForm";
import { fundraiserCurrency } from "@/lib/fundraiser-prior";
import { portalCopy } from "@/lib/portal-copy";
import { getPublicPageChrome } from "@/lib/public-campaigns";
import { withPublicPrefix } from "@/lib/public-site-url";

export async function generateMetadata(): Promise<Metadata> {
  const { messages } = await getPublicPageChrome();
  return {
    title: messages.start.title,
    description: messages.start.description,
  };
}

export default async function StartAFundraiserPage() {
  const chrome = await getPublicPageChrome();
  const { messages, paymentGateway } = chrome;
  const termsHref = withPublicPrefix(chrome.pathPrefix, "/fundraiser-terms");
  const portal = portalCopy(chrome.locale);
  const portalHref = withPublicPrefix(chrome.pathPrefix, "/portal");
  const intro = (
    <>
      <p>{paymentGateway === "PAGNOVO" ? messages.start.p1Pagnovo : messages.start.p1}</p>
      <p>{messages.start.p2}</p>
      <p>{messages.start.p3}</p>
      <p className="inst-terms-links">
        <Link className="inst-terms-link" href={termsHref}>
          {messages.start.termsLink}
        </Link>
        <Link className="inst-terms-link" href={withPublicPrefix(chrome.pathPrefix, "/portal/login")}>
          {portal.startSignInLink}
        </Link>
      </p>
    </>
  );

  if (!chrome.institutional) {
    return (
      <PublicInfoPage chrome={chrome} title={messages.start.title} lead={messages.start.lead}>
        {intro}
      </PublicInfoPage>
    );
  }

  const site = messages.site;
  return (
    <PublicSiteShell chrome={chrome}>
      <main className="inst-apply">
        <div className="shell inst-apply-inner">
          <p className="inst-kicker">{site.charityLine}</p>
          <h1>{messages.start.title}</h1>
          <p className="inst-lead">{messages.start.lead}</p>
          <div className="inst-apply-copy">{intro}</div>
          <h2>{messages.start.formHeading}</h2>
          <ShareStoryForm
            termsHref={termsHref}
            portalHref={portalHref}
            currency={fundraiserCurrency(chrome.locale)}
            labels={{
              consentTerms: messages.start.consentTerms,
              termsLink: messages.start.termsLink,
              termsError: messages.start.termsError,
              thanks: messages.start.thanks,
              raisedHeading: messages.start.raisedHeading,
              raised: messages.start.raised,
              raisedHint: messages.start.raisedHint,
              raisedPreview: messages.start.raisedPreview,
              raisedInvalid: messages.start.raisedInvalid,
              donations: messages.start.donations,
              donationsHint: messages.start.donationsHint,
              donationsPreview: messages.start.donationsPreview,
              donationsInvalid: messages.start.donationsInvalid,
              accountHeading: portal.startAccountHeading,
              accountHint: portal.startAccountHint,
              password: portal.password,
              confirmPassword: portal.confirmPassword,
              passwordHint: portal.passwordHint,
              passwordMismatch: portal.passwordMismatch,
              existingHint: portal.startExistingHint,
              openDashboard: portal.startOpenDashboard,
            }}
          />
        </div>
      </main>
    </PublicSiteShell>
  );
}
