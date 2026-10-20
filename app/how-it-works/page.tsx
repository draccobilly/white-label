import type { Metadata } from "next";
import { StoryCta } from "@/components/public/StoryBlocks";
import { PublicInfoPage } from "@/components/public/PublicInfoPage";
import { requireInstitutionalSite } from "@/lib/public-campaigns";
import { withPublicPrefix } from "@/lib/public-site-url";

export async function generateMetadata(): Promise<Metadata> {
  const chrome = await requireInstitutionalSite();
  return {
    title: chrome.messages.site.howPageTitle,
    description: chrome.messages.site.howPageDescription,
  };
}

export default async function HowItWorksPage() {
  const chrome = await requireInstitutionalSite();
  const site = chrome.messages.site;
  const prefix = chrome.pathPrefix;
  const steps = [
    {
      title: site.howStep1Title,
      body: site.howStep1Body,
      href: withPublicPrefix(prefix, "/campaigns"),
      cta: site.howStep1Cta,
    },
    {
      title: site.howStep2Title,
      body: site.howStep2Body,
      href: withPublicPrefix(prefix, "/contact"),
      cta: site.howStep2Cta,
    },
    {
      title: site.howStep3Title,
      body: site.howStep3Body,
      href: withPublicPrefix(prefix, "/help"),
      cta: site.howStep3Cta,
    },
    {
      title: site.howStep4Title,
      body: site.howStep4Body,
      href: withPublicPrefix(prefix, "/help"),
      cta: site.howStep4Cta,
    },
  ];

  return (
    <PublicInfoPage
      chrome={chrome}
      kicker={site.howGuideKicker}
      title={site.howPageTitle}
      lead={site.howPageLead}
    >
      <ol className="inst-story-steps">
        {steps.map((step, index) => (
          <li key={step.title}>
            <span>Step {index + 1}</span>
            <h2>{step.title}</h2>
            <p>{step.body}</p>
            <StoryCta href={step.href}>{step.cta}</StoryCta>
          </li>
        ))}
      </ol>
      <section className="inst-story-block">
        <h2>{site.howHeading}</h2>
        <p>{site.howPageP1}</p>
        <p>{site.howPageP2}</p>
        <p>{site.howPageP3}</p>
      </section>
    </PublicInfoPage>
  );
}
