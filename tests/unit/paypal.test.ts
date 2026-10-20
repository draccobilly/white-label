import { describe, expect, it } from "vitest";
import {
  centsToPaypalAmount,
  paypalAmountToCents,
  paypalCaptureFromOrder,
  paypalReturnUrl,
  paypalCaptureFromResource,
  paypalDisputeFromResource,
  paypalRefundFromResource,
} from "@/lib/paypal";

describe("PayPal amounts", () => {
  it("converts cents to PayPal decimal strings", () => {
    expect(centsToPaypalAmount(500)).toBe("5.00");
    expect(centsToPaypalAmount(1050)).toBe("10.50");
    expect(centsToPaypalAmount(0)).toBe("0.00");
  });

  it("converts PayPal decimals back to cents", () => {
    expect(paypalAmountToCents("10.50")).toBe(1050);
    expect(paypalAmountToCents(5)).toBe(500);
    expect(paypalAmountToCents("")).toBeNull();
    expect(paypalAmountToCents("nope")).toBeNull();
  });
});

describe("PayPal return URL", () => {
  const origins = ["https://giving.example.org"];

  it("keeps the campaign page exactly and drops only the hash", () => {
    expect(
      paypalReturnUrl("https://giving.example.org/c/campanha?utm=1#doar", origins),
    ).toBe("https://giving.example.org/c/campanha?utm=1");
  });

  it("keeps the page address unchanged so PayPal can open the app", () => {
    expect(
      paypalReturnUrl("https://giving.example.org/c/campanha?utm=1", origins),
    ).toBe("https://giving.example.org/c/campanha?utm=1");
  });

  it("rejects a return URL on another site", () => {
    expect(paypalReturnUrl("https://example.com/c/campanha", origins)).toBeNull();
    expect(paypalReturnUrl("not a url", origins)).toBeNull();
  });
});

describe("PayPal payloads", () => {
  it("reads a captured order", () => {
    const details = paypalCaptureFromOrder({
      id: "ORDER1",
      payer: {
        email_address: "ada@example.com",
        name: { given_name: "Ada", surname: "Lovelace" },
      },
      purchase_units: [
        {
          custom_id: "intent-1",
          payments: {
            captures: [
              {
                id: "CAP1",
                status: "COMPLETED",
                amount: { currency_code: "usd", value: "25.00" },
                seller_receivable_breakdown: {
                  paypal_fee: { value: "1.03" },
                },
                create_time: "2026-10-01T00:00:00Z",
              },
            ],
          },
        },
      ],
    });
    expect(details).toMatchObject({
      orderId: "ORDER1",
      captureId: "CAP1",
      status: "COMPLETED",
      amountCents: 2500,
      currency: "USD",
      feeCents: 103,
      customId: "intent-1",
      payerName: "Ada Lovelace",
      payerEmail: "ada@example.com",
    });
  });

  it("reads a capture webhook resource", () => {
    const details = paypalCaptureFromResource({
      id: "CAP1",
      status: "COMPLETED",
      custom_id: "intent-1",
      amount: { currency_code: "USD", value: "25.00" },
      supplementary_data: { related_ids: { order_id: "ORDER1" } },
    });
    expect(details?.orderId).toBe("ORDER1");
    expect(details?.captureId).toBe("CAP1");
    expect(details?.customId).toBe("intent-1");
  });

  it("reads a refund from the capture link", () => {
    expect(
      paypalRefundFromResource({
        amount: { value: "10.00" },
        links: [
          {
            rel: "up",
            href: "https://api.paypal.com/v2/payments/captures/CAP123",
          },
        ],
      }),
    ).toEqual({ captureId: "CAP123", amountCents: 1000 });
  });

  it("reads a dispute", () => {
    const dispute = paypalDisputeFromResource({
      dispute_id: "PP-1",
      status: "RESOLVED",
      reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
      dispute_amount: { currency_code: "usd", value: "25.00" },
      disputed_transactions: [{ seller_transaction_id: "CAP1" }],
      create_time: "2026-10-01T00:00:00Z",
    });
    expect(dispute.disputeId).toBe("PP-1");
    expect(dispute.captureId).toBe("CAP1");
    expect(dispute.amountCents).toBe(2500);
    expect(dispute.currency).toBe("USD");
    expect(dispute.closed).toBe(true);
  });
});
