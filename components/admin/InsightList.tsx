"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { CircleAlert, CircleCheck, Info, TrendingUp, X } from "lucide-react";
import type { Insight } from "@/lib/insights";

const ICONS = {
  success: TrendingUp,
  warning: CircleAlert,
  danger: CircleAlert,
  info: Info,
} as const;

function campaignLink(insight: Insight) {
  if (insight.campaignHref) return insight.campaignHref;
  if (insight.href?.startsWith("/admin/campaigns")) return insight.href;
  return null;
}

export function InsightList({
  insights,
  emptyText = "Nada fora do normal neste período.",
  limit,
}: {
  insights: Insight[];
  emptyText?: string;
  limit?: number;
}) {
  const visible = limit ? insights.slice(0, limit) : insights;
  const [openId, setOpenId] = useState<string | null>(null);
  const open = visible.find((insight) => insight.id === openId) ?? null;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  if (!visible.length) {
    return (
      <p className="dash-allclear">
        <CircleCheck size={18} aria-hidden />
        {emptyText}
      </p>
    );
  }

  const steps = open ? (open.guide?.length ? open.guide : [open.action]) : [];
  const campaign = open ? campaignLink(open) : null;

  return (
    <>
      <ul className="insight-list">
        {visible.map((insight) => {
          const Icon = ICONS[insight.tone];
          return (
            <li key={insight.id} className={`insight is-${insight.tone}`}>
              <button type="button" onClick={() => setOpenId(insight.id)}>
                <span className={`insight-icon is-${insight.tone}`} aria-hidden>
                  <Icon size={18} />
                </span>
                <span className="insight-copy">
                  <strong>{insight.title}</strong>
                  <span className="insight-detail">{insight.detail}</span>
                  <span className="insight-action">{insight.action}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <dialog
        ref={dialogRef}
        className="insight-dialog"
        aria-labelledby={titleId}
        onClose={() => setOpenId(null)}
        onClick={(event) => {
          if (event.target === dialogRef.current) setOpenId(null);
        }}
      >
        {open ? (
          <div className="insight-dialog-body">
            <header>
              <p>O que fazer</p>
              <button type="button" onClick={() => setOpenId(null)} aria-label="Fechar">
                <X size={18} />
              </button>
            </header>
            <h2 id={titleId}>{open.title}</h2>
            <p className="insight-dialog-detail">{open.detail}</p>
            <ol className="insight-guide">
              {steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            {campaign ? (
              <Link className="primary-button" href={campaign}>
                Abrir a campanha
              </Link>
            ) : null}
          </div>
        ) : null}
      </dialog>
    </>
  );
}
