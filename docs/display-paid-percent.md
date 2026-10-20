# Displayed paid percent

The public campaign page does not show `Campaign.currentAmount`.

Everyone sees `baselineAmount + round(paidAmount * displayPaidPercent / 100)`.

This browser also adds the last live gift stored in the donor cookie on that affiliate page.

`displayPaidPercent` is an integer 0–100 on the campaign, edited in the admin beside Raised / Doado. A missing value uses `DISPLAYED_PAID_PERCENT` in `lib/campaign-accounting.ts` (`1`).
