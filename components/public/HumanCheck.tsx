"use client";

import { useEffect, useId, useRef, useState } from "react";
import { FORM_MIN_AGE_MS, FORM_RELOAD_ERROR } from "@/lib/form-guard-shared";

export function useHumanCheck() {
  const [companyUrl, setCompanyUrl] = useState("");
  const pending = useRef<Promise<string> | null>(null);

  useEffect(() => {
    let cancelled = false;
    pending.current = fetch("/api/form-guard")
      .then((response) => response.json())
      .then((payload: { token?: string }) => (cancelled ? "" : payload.token ?? ""))
      .catch(() => "");
    return () => {
      cancelled = true;
    };
  }, []);

  async function takeToken() {
    for (let attempt = 0; attempt < 20 && !pending.current; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    const token = (await pending.current) ?? "";
    if (!token) return "";
    const issuedAt = Number(token.split(".")[0]);
    if (!Number.isFinite(issuedAt)) return "";
    const remain = FORM_MIN_AGE_MS - (Date.now() - issuedAt);
    if (remain > 0) await new Promise((resolve) => setTimeout(resolve, remain));
    return token;
  }

  return { companyUrl, setCompanyUrl, takeToken, reloadError: FORM_RELOAD_ERROR };
}

export function HumanCheckFields({
  companyUrl,
  onCompanyUrl,
}: {
  companyUrl: string;
  onCompanyUrl: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="human-check" aria-hidden="true">
      <label htmlFor={id}>
        Website
        <input
          id={id}
          name="companyUrl"
          type="text"
          value={companyUrl}
          onChange={(event) => onCompanyUrl(event.target.value)}
          tabIndex={-1}
          autoComplete="off"
          autoCapitalize="off"
        />
      </label>
    </div>
  );
}
