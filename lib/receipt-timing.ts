export const RECEIPT_WAIT_MS = 24 * 60 * 60 * 1000;

export function receiptAvailableAt(confirmedAt: Date) {
  return new Date(confirmedAt.getTime() + RECEIPT_WAIT_MS);
}

export function isReceiptAvailable(availableAt: Date, now = Date.now()) {
  return now >= availableAt.getTime();
}
