/**
 * Clocks at the base of the admin shell.
 *
 * ADMIN_OPERATION_CLOCK is this operation's own city. Sales, letters, and the
 * globe keep using it. This desk uses Los Angeles, so the shell shows that
 * clock once, under the Meta and Utmify name.
 */
export type AdminDashboardClock = {
  label: string;
  timeZone: string;
  /** Caption shown above the city name. */
  tag?: string;
  /** Short line directly under the city name. */
  detail?: string;
};

/** Soft fee chip shown above the dashboard clocks. */
export const ADMIN_CLOCK_FEE = {
  label: "Taxas",
  value: "6.00% + $0.35/sale",
} as const;

export const ADMIN_OPERATION_CLOCK = {
  label: "Los Angeles",
  timeZone: "America/Los_Angeles",
} as const;

export type AdminOperationClock = {
  label: string;
  timeZone: string;
};

export const ADMIN_DASHBOARD_CLOCKS: readonly AdminDashboardClock[] = [
  {
    label: "Los Angeles (Meta & Utmify)",
    timeZone: "America/Los_Angeles",
  },
  {
    label: "Greenwich",
    detail: "Saque da Stripe",
    timeZone: "UTC",
  },
  {
    label: "Brasília, Brazil",
    timeZone: "America/Sao_Paulo",
  },
];
