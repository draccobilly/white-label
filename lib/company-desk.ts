import {
  isArgentinaCompany,
  isMexicoCompany,
  type CompanyDeskFields,
} from "@/lib/campaign-defaults";

export type CompanyDeskInput = CompanyDeskFields;

export function companyDesk(company: CompanyDeskInput) {
  if (isMexicoCompany(company)) {
    return { region: "México", gateway: "PagNovo", currency: "MXN" as const };
  }
  if (isArgentinaCompany(company)) {
    return { region: "Argentina", gateway: "PagNovo", currency: "ARS" as const };
  }
  return { region: "United States", gateway: "Stripe", currency: "USD" as const };
}

export function companyDeskLabel(company: CompanyDeskInput) {
  const desk = companyDesk(company);
  return `${desk.region} · ${desk.gateway}${
    desk.currency === "ARS" ? " · ARS" : ""
  }`;
}
