"use client";

import { useRef, type KeyboardEvent } from "react";
import { StoryText } from "@/components/campaign/StoryText";
import { hasStoryBold, toggleStoryBold } from "@/lib/story-text";

type Props = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  required?: boolean;
  placeholder?: string;
};

/**
 * The campaign story field. Select words and press Bold (or Ctrl/Cmd+B) to wrap
 * them in `**`; the public page shows that span in bold.
 */
export function StoryTextarea({
  id,
  label,
  value,
  onChange,
  rows = 10,
  required,
  placeholder,
}: Props) {
  const areaRef = useRef<HTMLTextAreaElement>(null);

  function boldSelection() {
    const area = areaRef.current;
    if (!area) return;
    const next = toggleStoryBold(value, area.selectionStart ?? 0, area.selectionEnd ?? 0);
    area.focus();
    if (!next) return;
    onChange(next.text);
    window.requestAnimationFrame(() => {
      area.focus();
      area.setSelectionRange(next.start, next.end);
    });
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "b") {
      event.preventDefault();
      boldSelection();
    }
  }

  return (
    <div className="studio-field story-field">
      <label htmlFor={id}>{label}</label>
      <span className="boldable-field-control story-field-control">
        <textarea
          ref={areaRef}
          id={id}
          className="admin-textarea"
          rows={rows}
          value={value}
          required={required}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
        />
        <button
          type="button"
          className="admin-ghost-btn"
          title="Bold selected text (Ctrl+B)"
          onMouseDown={(event) => event.preventDefault()}
          onClick={boldSelection}
        >
          Bold
        </button>
      </span>
      <small className="admin-help">
        Select words and press Bold. They show here as **words** and in bold on the page.
      </small>
      {hasStoryBold(value) ? (
        <span className="admin-help boldable-field-preview story-field-preview">
          <StoryText text={value} />
        </span>
      ) : null}
    </div>
  );
}
