"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PortalStrings } from "@/lib/portal-copy";

type Copy = Pick<
  PortalStrings,
  | "requestPayout"
  | "payoutAmount"
  | "payoutFull"
  | "holderSection"
  | "holderName"
  | "holderAddress"
  | "holderAddressHint"
  | "holderCountry"
  | "bankSection"
  | "bankName"
  | "bankCountry"
  | "bankAddress"
  | "accountNumber"
  | "accountType"
  | "accountChecking"
  | "accountSavings"
  | "routingNumber"
  | "routingHint"
  | "swiftBic"
  | "swiftHint"
  | "intermediaryBank"
  | "intermediaryHint"
  | "notes"
  | "sendRequest"
  | "sending"
  | "payoutSent"
  | "payoutNothing"
  | "genericError"
>;

const blank = {
  accountHolderName: "",
  holderAddress: "",
  holderCountry: "",
  bankName: "",
  bankCountry: "",
  bankAddress: "",
  accountNumber: "",
  accountType: "" as "" | "checking" | "savings",
  routingNumber: "",
  swiftBic: "",
  intermediaryBank: "",
  notes: "",
};

export function PortalPayoutForm({
  campaignId,
  availableCents,
  availableLabel,
  amountHint,
  currency,
  defaults,
  copy,
}: {
  campaignId: string;
  availableCents: number;
  availableLabel: string;
  amountHint: string;
  currency: string;
  defaults: Partial<typeof blank>;
  copy: Copy;
}) {
  const router = useRouter();
  const [form, setForm] = useState({ ...blank, ...defaults });
  const [full, setFull] = useState(true);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  function field<K extends keyof typeof blank>(key: K) {
    return {
      value: form[key],
      onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
        setForm((current) => ({ ...current, [key]: event.target.value })),
    };
  }

  if (availableCents <= 0) {
    return <p className="admin-help">{copy.payoutNothing}</p>;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const cents = full ? null : Math.round(Number(amount.replace(",", ".")) * 100);
    const response = await fetch(`/api/portal/campaigns/${campaignId}/payouts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, amount: cents }),
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!response.ok) {
      setMessage({ tone: "error", text: data.error ?? copy.genericError });
      return;
    }
    setMessage({ tone: "success", text: copy.payoutSent });
    router.refresh();
  }

  if (message?.tone === "success") {
    return <p className="inst-form-thanks">{message.text}</p>;
  }

  return (
    <form className="inst-form inst-form-wide portal-form" onSubmit={(event) => void submit(event)}>
      <h3>{copy.requestPayout}</h3>
      <label className="inst-consent">
        <input type="checkbox" checked={full} onChange={(event) => setFull(event.target.checked)} />
        <span>
          {copy.payoutFull} ({availableLabel})
        </span>
      </label>
      {!full ? (
        <label>
          {copy.payoutAmount} ({currency})
          <input
            className="admin-input"
            type="number"
            inputMode="decimal"
            min={1}
            step="0.01"
            max={availableCents / 100}
            required
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
          <span className="admin-field-hint">{amountHint}</span>
        </label>
      ) : null}

      <h3>{copy.holderSection}</h3>
      <label>
        {copy.holderName}
        <input className="admin-input" required minLength={3} maxLength={160} autoComplete="name" {...field("accountHolderName")} />
      </label>
      <label>
        {copy.holderAddress}
        <textarea className="admin-textarea" required minLength={8} maxLength={600} rows={3} autoComplete="street-address" {...field("holderAddress")} />
        <span className="admin-field-hint">{copy.holderAddressHint}</span>
      </label>
      <label>
        {copy.holderCountry}
        <input className="admin-input" required minLength={2} maxLength={80} autoComplete="country-name" {...field("holderCountry")} />
      </label>

      <h3>{copy.bankSection}</h3>
      <label>
        {copy.bankName}
        <input className="admin-input" required minLength={2} maxLength={160} {...field("bankName")} />
      </label>
      <label>
        {copy.bankCountry}
        <input className="admin-input" required minLength={2} maxLength={80} {...field("bankCountry")} />
      </label>
      <label>
        {copy.bankAddress}
        <textarea className="admin-textarea" maxLength={600} rows={2} {...field("bankAddress")} />
      </label>
      <label>
        {copy.accountNumber}
        <input className="admin-input" required minLength={4} maxLength={64} autoComplete="off" {...field("accountNumber")} />
      </label>
      <label>
        {copy.accountType}
        <select className="admin-select" {...field("accountType")}>
          <option value="">—</option>
          <option value="checking">{copy.accountChecking}</option>
          <option value="savings">{copy.accountSavings}</option>
        </select>
      </label>
      <label>
        {copy.routingNumber}
        <input className="admin-input" maxLength={40} autoComplete="off" {...field("routingNumber")} />
        <span className="admin-field-hint">{copy.routingHint}</span>
      </label>
      <label>
        {copy.swiftBic}
        <input className="admin-input" maxLength={11} autoComplete="off" style={{ textTransform: "uppercase" }} {...field("swiftBic")} />
        <span className="admin-field-hint">{copy.swiftHint}</span>
      </label>
      <label>
        {copy.intermediaryBank}
        <textarea className="admin-textarea" maxLength={600} rows={2} {...field("intermediaryBank")} />
        <span className="admin-field-hint">{copy.intermediaryHint}</span>
      </label>
      <label>
        {copy.notes}
        <textarea className="admin-textarea" maxLength={2000} rows={3} {...field("notes")} />
      </label>

      {message ? <p className="form-message">{message.text}</p> : null}
      <div className="start-actions">
        <span />
        <button className="primary-button" type="submit" disabled={busy}>
          {busy ? copy.sending : copy.sendRequest}
        </button>
      </div>
    </form>
  );
}
