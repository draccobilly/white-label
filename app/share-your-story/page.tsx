import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireInstitutionalSite } from "@/lib/public-campaigns";
import { withPublicPrefix } from "@/lib/public-site-url";

export async function generateMetadata(): Promise<Metadata> {
  const chrome = await requireInstitutionalSite();
  return {
    title: chrome.messages.site.shareTitle,
    description: chrome.messages.site.shareDescription,
  };
}

export default async function ShareYourStoryPage() {
  const chrome = await requireInstitutionalSite();
  redirect(withPublicPrefix(chrome.pathPrefix, "/start-a-fundraiser"));
}
