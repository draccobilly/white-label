import type { AdminChipTone } from "@/components/admin/AdminChip";

/** Stripe dispute statuses as they arrive by webhook, in plain words. */
export function disputeStatusLabel(status: string) {
  switch (status) {
    case "warning_needs_response":
      return "Alerta: responder";
    case "warning_under_review":
      return "Alerta em análise";
    case "warning_closed":
      return "Alerta encerrado";
    case "needs_response":
      return "Precisa de resposta";
    case "under_review":
      return "Em análise";
    case "won":
      return "Ganha";
    case "lost":
      return "Perdida";
    case "charge_refunded":
      return "Estornada";
    default:
      return status.replace(/_/g, " ");
  }
}

export function disputeStatusTone(status: string): AdminChipTone {
  if (status === "won") return "success";
  if (status === "lost") return "danger";
  if (status === "needs_response" || status === "warning_needs_response") return "danger";
  if (status === "under_review" || status === "warning_under_review") return "warning";
  return "neutral";
}

export function disputeReasonLabel(reason: string | null) {
  switch (reason) {
    case "fraudulent":
      return "Fraude alegada";
    case "duplicate":
      return "Cobrança duplicada";
    case "product_not_received":
      return "Não recebido";
    case "product_unacceptable":
      return "Insatisfação";
    case "subscription_canceled":
      return "Assinatura cancelada";
    case "unrecognized":
      return "Não reconhecida";
    case "credit_not_processed":
      return "Crédito não processado";
    case "general":
      return "Geral";
    case null:
      return "Sem motivo informado";
    default:
      return reason.replace(/_/g, " ");
  }
}

export function needsResponse(status: string) {
  return status === "needs_response" || status === "warning_needs_response";
}

export function stripeDisputeUrl(stripeDisputeId: string, livemode = true) {
  return `https://dashboard.stripe.com/${livemode ? "" : "test/"}disputes/${stripeDisputeId}`;
}
