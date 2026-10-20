/** Display name for the `Sale.gateway` value written by each checkout flow. */
export function gatewayLabel(gateway: string | null | undefined) {
  switch ((gateway ?? "").toLowerCase()) {
    case "stripe":
      return "Stripe";
    case "paypal":
      return "PayPal";
    case "pagnovo":
      return "PagNovo";
    case "":
      return "Sem gateway";
    default:
      return gateway as string;
  }
}

export function normalizeGateway(gateway: string | null | undefined) {
  const value = (gateway ?? "").toLowerCase().trim();
  return value || "stripe";
}

/** Fixed order so Stripe and PayPal always line up the same way. */
export function sortGateways(gateways: Iterable<string>) {
  const order = ["stripe", "paypal", "pagnovo"];
  return [...new Set(gateways)].sort((a, b) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
  });
}
