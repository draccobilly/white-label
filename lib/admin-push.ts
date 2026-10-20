import webpush from "web-push";
import { isOwnerAdmin } from "@/lib/admin-role";
import { prisma } from "@/lib/prisma";
import { salePushNotification, type SalePushInput } from "@/lib/sale-push";

export type SalePushDelivery = SalePushInput & {
  affiliateId?: string | null;
  onlyAdminId?: string | null;
};

function vapidPublicKey() {
  return (
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ||
    process.env.VAPID_PUBLIC_KEY?.trim() ||
    ""
  );
}

export function isWebPushConfigured() {
  return Boolean(vapidPublicKey() && process.env.VAPID_PRIVATE_KEY?.trim());
}

export function webPushPublicKey() {
  return vapidPublicKey();
}

function applyVapid() {
  if (!isWebPushConfigured()) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT?.trim() || "mailto:admin@example.com",
    vapidPublicKey(),
    process.env.VAPID_PRIVATE_KEY!.trim(),
  );
  return true;
}

export async function notifyAdminDevices(input: {
  adminIds: string[];
  title: string;
  body: string;
  url: string;
}) {
  if (!input.adminIds.length || !applyVapid()) return;
  const subscriptions = await prisma.adminPushSubscription.findMany({
    where: { adminId: { in: input.adminIds } },
  });
  const payload = JSON.stringify({ title: input.title, body: input.body, url: input.url });
  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          payload,
          { urgency: "high", TTL: 3600 },
        );
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await prisma.adminPushSubscription.delete({ where: { id: subscription.id } }).catch(() => undefined);
        }
      }
    }),
  );
}

export async function notifyAdminSalePush(input: SalePushDelivery | null | undefined) {
  if (!input || !applyVapid()) return;
  const payload = JSON.stringify(salePushNotification(input));
  const subscriptions = await prisma.adminPushSubscription.findMany({
    include: {
      admin: {
        select: {
          email: true,
          role: true,
          affiliate: { select: { id: true } },
        },
      },
    },
  });
  await Promise.all(
    subscriptions.map(async (subscription) => {
      if (input.onlyAdminId && subscription.adminId !== input.onlyAdminId) return;
      const admin = subscription.admin;
      if (!input.onlyAdminId && admin && !isOwnerAdmin(admin)) {
        const ownAffiliateId = admin.affiliate?.id;
        if (!input.affiliateId || ownAffiliateId !== input.affiliateId) return;
      }
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          payload,
          { urgency: "high", TTL: 120 },
        );
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await prisma.adminPushSubscription
            .delete({ where: { id: subscription.id } })
            .catch(() => undefined);
          return;
        }
        console.error("Could not send admin sale push", error);
      }
    }),
  );
}
