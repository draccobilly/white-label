"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { TRACKING_STORAGE_KEY } from "@/lib/tracking-storage";

type Step = {
  id: number;
  title: string;
  detail: string;
  state: "done" | "current" | "upcoming";
};

type Result = {
  trackingCode: string;
  campaignTitle: string;
  amountLabel: string;
  paidAt: string | null;
  steps: Step[];
};

export function TrackDonationLookup({
  initialCode = "",
  pathPrefix = null,
  labels,
}: {
  initialCode?: string;
  pathPrefix?: string | null;
  labels: {
    codeLabel: string;
    track: string;
    lookingUp: string;
    saved: string;
    notFound: string;
    paidOn: string;
    toward: string;
    receiptBlurb: string;
    refundBlurb: string;
    helpBlurb: string;
    receiptCta: string;
    refundCta: string;
    helpCta: string;
  };
}) {
  const [code, setCode] = useState(initialCode);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const storedCodes = useMemo(() => readStoredCodes(), []);
  const prefix = pathPrefix ?? "";

  useEffect(() => {
    if (initialCode) {
      void lookup(initialCode);
    }
  }, [initialCode]);

  async function lookup(value: string) {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/track?code=${encodeURIComponent(value)}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? labels.notFound);
      setResult(payload);
      saveStoredCode(payload.trackingCode);
    } catch (cause) {
      setResult(null);
      setError(cause instanceof Error ? cause.message : labels.notFound);
    } finally {
      setLoading(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void lookup(code);
  }

  return (
    <div className="track-panel">
      <form className="track-form" onSubmit={submit}>
        <label htmlFor="tracking-code">{labels.codeLabel}</label>
        <div className="track-form-row">
          <input
            id="tracking-code"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder="DN39182357"
            required
          />
          <button className="primary-button" type="submit" disabled={loading}>
            {loading ? labels.lookingUp : labels.track}
          </button>
        </div>
      </form>
      {storedCodes.length ? (
        <p className="track-saved">
          {labels.saved}{" "}
          {storedCodes.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                setCode(item);
                void lookup(item);
              }}
            >
              {item}
            </button>
          ))}
        </p>
      ) : null}
      {error ? <p className="form-error">{error}</p> : null}
      {result ? (
        <section className="track-result">
          <p className="track-result-hero">
            <strong>{result.amountLabel}</strong> {labels.toward} {result.campaignTitle}
          </p>
          {result.paidAt ? (
            <p className="track-result-meta">
              {labels.paidOn}{" "}
              {new Date(result.paidAt).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
          ) : null}
          <p className="track-code-chip">{result.trackingCode}</p>
          <ol className="track-steps">
            {result.steps.map((step) => (
              <li key={step.id} className={`is-${step.state}`}>
                <span>{step.id}</span>
                <div>
                  <strong>{step.title}</strong>
                  <p>{step.detail}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="track-followups">
            <p>{labels.receiptBlurb}</p>
            <p>{labels.refundBlurb}</p>
            <p>{labels.helpBlurb}</p>
            <div className="inst-hero-actions">
              <Link className="secondary-button" href={`${prefix}/help`}>
                {labels.receiptCta}
              </Link>
              <Link
                className="secondary-button"
                href={`${prefix}/refund?code=${encodeURIComponent(result.trackingCode)}`}
              >
                {labels.refundCta}
              </Link>
              <Link className="primary-button" href={`${prefix}/help`}>
                {labels.helpCta}
              </Link>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function readStoredCodes() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(TRACKING_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveStoredCode(code: string) {
  const next = Array.from(new Set([code, ...readStoredCodes()])).slice(0, 8);
  window.localStorage.setItem(TRACKING_STORAGE_KEY, JSON.stringify(next));
}
