import { randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";

export function generateTrackingCode() {
  return `DN${String(randomInt(10_000_000, 100_000_000))}`;
}

export async function uniqueTrackingCode() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const trackingCode = generateTrackingCode();
    const existing = await prisma.sale.findFirst({ where: { trackingCode } });
    if (!existing) return trackingCode;
  }
  return `DN${Date.now().toString().slice(-8)}`;
}

export const TRACKING_STEPS = [
  {
    id: 1,
    title: "We are processing your donation",
    detail: "Awaiting bank clearance.",
    afterDays: 0,
  },
  {
    id: 2,
    title: "Donation processed",
    detail: "Bank clearance succeeded. Compliance review completed.",
    afterDays: 3,
  },
  {
    id: 3,
    title: "Wiring money to the cause",
    detail: "Funds are being sent to the donation destination.",
    afterDays: 5,
  },
  {
    id: 4,
    title: "Money arrived for the receiver",
    detail: "The destination has received the transferred funds.",
    afterDays: 8,
  },
  {
    id: 5,
    title: "Funds applied to the cause",
    detail: "The receiver is using the gift for goods, care or the stated need.",
    afterDays: 11,
  },
] as const;

export function trackingProgress(paidAt: Date | null) {
  const start = paidAt?.getTime() ?? Date.now();
  const days = Math.max(0, (Date.now() - start) / (24 * 60 * 60 * 1000));
  const currentIndex = TRACKING_STEPS.reduce((current, step, index) => {
    return days >= step.afterDays ? index : current;
  }, 0);
  return TRACKING_STEPS.map((step, index) => ({
    ...step,
    state:
      index < currentIndex ? "done" : index === currentIndex ? "current" : "upcoming",
  }));
}

export function normalizeTrackingCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}
