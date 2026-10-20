"use client";

import { FormEvent, useState } from "react";
import { HumanCheckFields, useHumanCheck } from "@/components/public/HumanCheck";
import { REFUND_REASONS, type RefundReason } from "@/lib/refund-reasons";
import type { Messages } from "@/lib/i18n/types";

export function RefundRequestForm({
  initialCode = "",
  copy,
}: {
  initialCode?: string;
  copy: Messages["refund"];
}) {
  const [trackingCode, setTrackingCode] = useState(initialCode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [amountNote, setAmountNote] = useState("");
  const [reason, setReason] = useState<RefundReason>("changed_mind");
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const human = useHumanCheck();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const formToken = await human.takeToken();
      if (!formToken) throw new Error(human.reloadError);
      const response = await fetch("/api/refund-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackingCode,
          name,
          email,
          amountNote,
          reason,
          details,
          formToken,
          companyUrl: human.companyUrl,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? copy.error);
      }
      setSubmitted(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : copy.error);
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <section className="refund-success" aria-live="polite">
        <h2>{copy.thanksTitle}</h2>
        <p>{copy.thanksBody}</p>
      </section>
    );
  }

  return (
    <form className="refund-form" onSubmit={submit}>
      <HumanCheckFields companyUrl={human.companyUrl} onCompanyUrl={human.setCompanyUrl} />
      <label htmlFor="refund-name">
        {copy.nameLabel}
        <input
          id="refund-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="name"
          maxLength={80}
        />
      </label>

      <label htmlFor="refund-email">
        {copy.emailLabel}
        <input
          id="refund-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          maxLength={320}
          required
        />
      </label>

      <label htmlFor="refund-tracking-code">
        {copy.codeLabel}
        <input
          id="refund-tracking-code"
          value={trackingCode}
          onChange={(event) => setTrackingCode(event.target.value.toUpperCase())}
          placeholder="DN39182357"
          maxLength={32}
        />
        <span className="refund-hint">{copy.codeHint}</span>
      </label>

      <label htmlFor="refund-amount">
        {copy.amountLabel}
        <input
          id="refund-amount"
          value={amountNote}
          onChange={(event) => setAmountNote(event.target.value)}
          placeholder="$50"
          maxLength={80}
        />
      </label>

      <label htmlFor="refund-reason">
        {copy.reasonLabel}
        <select
          id="refund-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value as RefundReason)}
          required
        >
          {REFUND_REASONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label htmlFor="refund-details">
        {copy.detailsLabel}
        <textarea
          id="refund-details"
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          minLength={3}
          maxLength={1000}
          rows={5}
          required
        />
      </label>

      <p className="refund-note">{copy.note}</p>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <button className="primary-button" type="submit" disabled={loading}>
        {loading ? copy.sending : copy.submit}
      </button>
    </form>
  );
}
