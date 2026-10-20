import { sanitizePixelId } from "@/lib/validators";

export type PixelConversionEvent = "ViewContent" | "InitiateCheckout" | "Purchase";

type PixelWindow = Window & {
  gtag?: (...args: unknown[]) => void;
  ttq?: {
    instance?: (id: string) => { track?: (name: string, params?: object) => void };
  };
};

export function googleEventForPixel(eventName: PixelConversionEvent) {
  if (eventName === "ViewContent") return "view_item";
  if (eventName === "Purchase") return "purchase";
  return "begin_checkout";
}

export function trackAffiliatePixelEvent(
  eventName: PixelConversionEvent,
  input: {
    googlePixelId?: string | null;
    tiktokPixelId?: string | null;
    valueCents?: number;
    currency?: string;
  },
) {
  if (typeof window === "undefined") return;
  const google = sanitizePixelId(input.googlePixelId);
  const tiktok = sanitizePixelId(input.tiktokPixelId);
  const value =
    input.valueCents != null && Number.isFinite(input.valueCents)
      ? input.valueCents / 100
      : undefined;
  const params =
    value != null && input.currency
      ? { value, currency: input.currency, content_type: "product" }
      : undefined;
  const pixelWindow = window as PixelWindow;

  if (google && typeof pixelWindow.gtag === "function") {
    pixelWindow.gtag("event", googleEventForPixel(eventName), {
      send_to: google,
      ...params,
    });
  }
  if (tiktok && typeof pixelWindow.ttq?.instance === "function") {
    pixelWindow.ttq.instance(tiktok)?.track?.(eventName, params);
  }
}
