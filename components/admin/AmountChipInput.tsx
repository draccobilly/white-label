"use client";

import { useState } from "react";
import { formatMajorAmount, parseMajorAmount } from "@/lib/money-input";

function placeholderFor(currency: string, hasAmounts: boolean) {
  if (hasAmounts) {
    return currency === "ARS" ? "5.000 then Enter" : "50.00 then Enter";
  }
  if (currency === "ARS") return "2.000  ·  5.000  ·  10.000";
  if (currency === "MXN") return "100.00, 200.00, 500.00";
  return "10.00, 25.00, 50.00";
}

function moveAmount(amounts: number[], from: number, to: number) {
  if (from === to || from < 0 || to < 0 || from >= amounts.length || to >= amounts.length) {
    return amounts;
  }
  const next = [...amounts];
  const [item] = next.splice(from, 1);
  if (item == null) return amounts;
  next.splice(to, 0, item);
  return next;
}

export function AmountChipInput({
  amounts,
  suggested,
  currency = "USD",
  showMissionTip,
  missionTipBold,
  onChange,
  onSuggested,
  onShowMissionTip,
  onMissionTipBold,
}: {
  amounts: number[];
  suggested: number;
  currency?: string;
  showMissionTip: boolean;
  missionTipBold: boolean;
  onChange: (amounts: number[]) => void;
  onSuggested: (amount: number) => void;
  onShowMissionTip: (show: boolean) => void;
  onMissionTipBold: (bold: boolean) => void;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  function addAmount(value: number) {
    if (amounts.includes(value)) return;
    const next = [...amounts, value];
    onChange(next);
    if (!suggested) onSuggested(value);
  }

  function removeAmount(amount: number) {
    const next = amounts.filter((item) => item !== amount);
    onChange(next);
    if (suggested === amount) onSuggested(next[0] ?? 0);
  }

  function commitParts(raw: string) {
    const delimiter = currency === "ARS" ? /[;\n]+/ : /[,;\n]+/;
    const parts = raw.split(delimiter);
    const remainder = parts.pop() ?? "";
    const next = [...amounts];
    for (const part of parts) {
      const value = parseMajorAmount(part, currency);
      if (value && !next.includes(value)) next.push(value);
    }
    if (next.length !== amounts.length) {
      onChange(next);
      if (!suggested && next[0]) onSuggested(next[0]);
    }
    return remainder;
  }

  function dropOn(index: number) {
    if (dragIndex == null) return;
    onChange(moveAmount(amounts, dragIndex, index));
    setDragIndex(null);
    setOverIndex(null);
  }

  return (
    <fieldset className="amount-editor">
      <legend>Donation tickets</legend>
      <p className="admin-help">
        Drag a block to change where it sits on this campaign. The grid matches
        the donation form: left to right, then the next row. Click a block to
        mark it as suggested.
      </p>
      <div className="amount-position-grid" role="list">
        {amounts.map((amount, index) => {
          const label = formatMajorAmount(amount, currency);
          const isSuggested = suggested === amount;
          return (
            <div
              key={amount}
              role="listitem"
              className={`amount-position-card${isSuggested ? " is-suggested" : ""}${
                dragIndex === index ? " is-dragging" : ""
              }${overIndex === index && dragIndex !== index ? " is-over" : ""}`}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragEnd={() => {
                setDragIndex(null);
                setOverIndex(null);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setOverIndex(index);
              }}
              onDrop={(event) => {
                event.preventDefault();
                dropOn(index);
              }}
            >
              <button
                type="button"
                className="amount-position-main"
                aria-pressed={isSuggested}
                onClick={() => onSuggested(amount)}
                onKeyDown={(event) => {
                  const step =
                    event.key === "ArrowLeft"
                      ? -1
                      : event.key === "ArrowRight"
                        ? 1
                        : event.key === "ArrowUp"
                          ? -3
                          : event.key === "ArrowDown"
                            ? 3
                            : 0;
                  if (!step) return;
                  event.preventDefault();
                  onChange(moveAmount(amounts, index, index + step));
                }}
              >
                <span>{label}</span>
                {isSuggested ? (
                  <span className="amount-position-suggested">Suggested</span>
                ) : null}
              </button>
              <button
                type="button"
                className="amount-position-remove"
                aria-label={`Remove ${label}`}
                onClick={() => removeAmount(amount)}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
      <input
        className="admin-input"
        inputMode="decimal"
        placeholder={placeholderFor(currency, amounts.length > 0)}
        aria-label="Add donation ticket"
        onChange={(event) => {
          const value = event.target.value;
          const shouldSplit =
            currency === "ARS" ? /[;\n]/.test(value) : /[,;\n]/.test(value);
          if (shouldSplit) {
            event.target.value = commitParts(value);
          }
        }}
        onBlur={(event) => {
          const value = parseMajorAmount(event.target.value, currency);
          if (value) addAmount(value);
          event.target.value = "";
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          const input = event.currentTarget;
          const value = parseMajorAmount(input.value, currency);
          if (value) addAmount(value);
          input.value = "";
        }}
      />
      <p className="admin-help">
        Suggested ticket:{" "}
        <strong>
          {suggested ? formatMajorAmount(suggested, currency) : "none"}
        </strong>
      </p>
      <div className="amount-tip-options">
        <label className="studio-check amount-tip-toggle">
          <input
            type="checkbox"
            checked={showMissionTip}
            onChange={(event) => onShowMissionTip(event.target.checked)}
          />
          Show “Add a $5 tip to help keep this work going.”
        </label>
        <label className="studio-check amount-tip-bold">
          <input
            type="checkbox"
            checked={missionTipBold}
            disabled={!showMissionTip}
            onChange={(event) => onMissionTipBold(event.target.checked)}
          />
          Bold
        </label>
      </div>
    </fieldset>
  );
}
