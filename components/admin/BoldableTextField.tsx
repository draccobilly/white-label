"use client";

import { useRef } from "react";
import { EmphasizedText } from "@/components/campaign/EmphasizedText";
import {
  addBoldPhrase,
  parseBoldPhrases,
  removeBoldPhrase,
} from "@/lib/emphasized-text";

type Props = {
  label: string;
  value: string;
  boldText: string;
  onChange: (value: string) => void;
  onBoldChange: (value: string) => void;
  help?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  variant?: "default" | "title" | "inline";
  placeholder?: string;
};

export function BoldableTextField({
  label,
  value,
  boldText,
  onChange,
  onBoldChange,
  help,
  required,
  minLength,
  maxLength,
  variant = "default",
  placeholder,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const phrases = parseBoldPhrases(boldText);

  function boldSelection() {
    const input = inputRef.current;
    if (!input) return;
    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? 0;
    const selected = value.slice(start, end).trim();
    if (selected) onBoldChange(addBoldPhrase(boldText, selected));
  }

  return (
    <label className={`boldable-field is-${variant}`}>
      <span className="boldable-field-label">
        {label}
        {maxLength ? (
          <small>
            {value.trim().length}/{maxLength}
          </small>
        ) : null}
      </span>
      <span className="boldable-field-control">
        <input
          ref={inputRef}
          className={variant === "title" ? "studio-title-input" : "admin-input"}
          value={value}
          placeholder={placeholder}
          required={required}
          minLength={minLength}
          maxLength={maxLength}
          onChange={(event) => onChange(event.target.value)}
        />
        <button type="button" className="admin-ghost-btn" onClick={boldSelection}>
          Bold
        </button>
      </span>
      {phrases.length > 0 ? (
        <span className="boldable-field-chips">
          {phrases.map((phrase) => (
            <button
              key={phrase}
              type="button"
              className="boldable-field-chip"
              onClick={() => onBoldChange(removeBoldPhrase(boldText, phrase))}
            >
              {phrase}
              <span aria-hidden>×</span>
            </button>
          ))}
          <button type="button" className="admin-text-link" onClick={() => onBoldChange("")}>
            Clear
          </button>
        </span>
      ) : null}
      {help && variant === "default" ? <small className="admin-help">{help}</small> : null}
      {phrases.length > 0 ? (
        <span className="admin-help boldable-field-preview">
          <EmphasizedText text={value || "…"} bold={boldText} />
        </span>
      ) : null}
    </label>
  );
}
