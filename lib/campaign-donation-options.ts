type DonationOptionCleanupWriter = {
  donationOption: {
    findMany: (args: {
      where: { campaignId: string; amount: { notIn: number[] } };
      select: { id: true };
    }) => Promise<Array<{ id: string }>>;
    deleteMany: (args: { where: { id: { in: string[] } } }) => Promise<unknown>;
  };
  paymentLink: {
    findMany: (args: {
      where: { donationOptionId: { in: string[] } };
      select: { id: true };
    }) => Promise<Array<{ id: string }>>;
  };
  checkoutIntent: {
    updateMany: (args: {
      where: {
        OR: Array<
          | { donationOptionId: { in: string[] } }
          | { paymentLinkId: { in: string[] } }
        >;
      };
      data: { donationOptionId: null; paymentLinkId: null };
    }) => Promise<unknown>;
  };
};

type DonationOptionWriter = DonationOptionCleanupWriter & {
  donationOption: DonationOptionCleanupWriter["donationOption"] & {
    upsert: (args: {
      where: { campaignId_amount: { campaignId: string; amount: number } };
      update: { suggested: boolean; sortOrder: number };
      create: {
        campaignId: string;
        amount: number;
        suggested: boolean;
        sortOrder: number;
      };
    }) => Promise<unknown>;
  };
};

/** CheckoutIntent FKs are Restrict, so unused tickets cannot be deleted until intents let go. */
export async function deleteUnlistedDonationOptions(
  tx: DonationOptionCleanupWriter,
  campaignId: string,
  keepAmounts: number[],
) {
  const stale = await tx.donationOption.findMany({
    where: { campaignId, amount: { notIn: keepAmounts } },
    select: { id: true },
  });
  const optionIds = stale.map((row) => row.id);
  if (!optionIds.length) return;

  const paymentLinks = await tx.paymentLink.findMany({
    where: { donationOptionId: { in: optionIds } },
    select: { id: true },
  });
  const paymentLinkIds = paymentLinks.map((row) => row.id);

  await tx.checkoutIntent.updateMany({
    where: {
      OR: [
        { donationOptionId: { in: optionIds } },
        ...(paymentLinkIds.length
          ? [{ paymentLinkId: { in: paymentLinkIds } }]
          : []),
      ],
    },
    data: {
      donationOptionId: null,
      paymentLinkId: null,
    },
  });

  await tx.donationOption.deleteMany({
    where: { id: { in: optionIds } },
  });
}

export async function syncCampaignDonationAmounts(
  tx: DonationOptionWriter,
  campaignId: string,
  amounts: number[],
  suggestedAmount: number,
) {
  await deleteUnlistedDonationOptions(tx, campaignId, amounts);
  for (const [index, amount] of amounts.entries()) {
    await tx.donationOption.upsert({
      where: { campaignId_amount: { campaignId, amount } },
      update: {
        suggested: amount === suggestedAmount,
        sortOrder: index,
      },
      create: {
        campaignId,
        amount,
        suggested: amount === suggestedAmount,
        sortOrder: index,
      },
    });
  }
}
