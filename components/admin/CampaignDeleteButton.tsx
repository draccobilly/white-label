"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function CampaignDeleteButton({
  campaignId,
  campaignTitle,
  blockedReason,
}: {
  campaignId: string;
  campaignTitle: string;
  blockedReason?: string | null;
}) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setError(null);
    if (!armed) {
      setArmed(true);
      return;
    }
    if (
      !window.confirm(
        `Excluir definitivamente "${campaignTitle}"?\n\nEssa ação não pode ser desfeita.`,
      )
    ) {
      setArmed(false);
      return;
    }

    setDeleting(true);
    const response = await fetch(`/api/admin/campaigns/${campaignId}`, {
      method: "DELETE",
    });
    const result = await response.json();
    setDeleting(false);
    if (!response.ok) {
      setArmed(false);
      setError(result.error ?? "Unable to delete campaign");
      return;
    }
    router.refresh();
  }

  return (
    <div className="campaign-delete">
      <button
        type="button"
        className={`danger-button${armed ? " is-armed" : ""}`}
        disabled={deleting || Boolean(blockedReason)}
        onClick={() => void remove()}
        aria-label={
          armed
            ? `Confirm deletion of ${campaignTitle}`
            : `Delete ${campaignTitle}`
        }
      >
        <Trash2 size={15} aria-hidden />
        {deleting ? "Excluindo…" : armed ? "Confirmar exclusão" : "Lixeira"}
      </button>
      {blockedReason ? (
        <small className="campaign-delete-error">{blockedReason}</small>
      ) : null}
      {error ? <small className="campaign-delete-error">{error}</small> : null}
    </div>
  );
}
