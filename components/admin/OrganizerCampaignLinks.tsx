"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type CampaignOption = { id: string; title: string; organizerId: string | null };

/** Owner control: which campaigns an organizer account may manage from the portal. */
export function OrganizerCampaignLinks({
  organizerId,
  linked,
  options,
}: {
  organizerId: string;
  linked: { id: string; title: string }[];
  options: CampaignOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [choice, setChoice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(campaignId: string, link: boolean) {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/admin/organizers/${organizerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId, link }),
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!response.ok) {
      setError(data.error ?? "Não foi possível salvar.");
      return;
    }
    setChoice("");
    startTransition(() => router.refresh());
  }

  const free = options.filter((option) => !option.organizerId || option.organizerId === organizerId);
  const available = free.filter((option) => !linked.some((item) => item.id === option.id));

  return (
    <div className="admin-organizer-links">
      {linked.length ? (
        <ul className="admin-detail-links">
          {linked.map((campaign) => (
            <li key={campaign.id}>
              <span>{campaign.title}</span>
              <button
                type="button"
                className="portal-link-button is-danger"
                disabled={busy || pending}
                onClick={() => void send(campaign.id, false)}
              >
                Desvincular
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="admin-help">Nenhuma campanha vinculada. Vincule uma para liberar o portal.</p>
      )}
      <div className="admin-inline-actions">
        <select className="admin-select" value={choice} onChange={(event) => setChoice(event.target.value)} disabled={busy}>
          <option value="">Vincular campanha…</option>
          {available.map((option) => (
            <option key={option.id} value={option.id}>
              {option.title}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="secondary-button"
          disabled={!choice || busy || pending}
          onClick={() => void send(choice, true)}
        >
          {busy ? "Salvando…" : "Vincular"}
        </button>
      </div>
      {error ? <p className="form-message">{error}</p> : null}
    </div>
  );
}
