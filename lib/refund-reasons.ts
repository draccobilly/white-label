export const REFUND_REASON_VALUES = [
  "accidental",
  "duplicate",
  "wrong_amount",
  "changed_mind",
  "other",
] as const;

export type RefundReason = (typeof REFUND_REASON_VALUES)[number];

export const REFUND_REASONS: ReadonlyArray<{
  value: RefundReason;
  label: string;
}> = [
  { value: "accidental", label: "I donated by accident" },
  { value: "duplicate", label: "I was charged more than once" },
  { value: "wrong_amount", label: "I selected the wrong amount" },
  { value: "changed_mind", label: "I no longer wish to donate" },
  { value: "other", label: "Another reason" },
];

export function refundReasonLabel(reason: RefundReason) {
  return REFUND_REASONS.find((item) => item.value === reason)?.label ?? reason;
}
