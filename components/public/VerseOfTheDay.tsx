"use client";

import { useState } from "react";
import { BookOpen } from "lucide-react";
import {
  randomGivingVerse,
  verseForDay,
  type GivingVerse,
} from "@/lib/giving-verses";

export function VerseOfTheDay({
  buttonLabel,
  anotherLabel,
}: {
  buttonLabel: string;
  anotherLabel: string;
}) {
  const [verse, setVerse] = useState<GivingVerse | null>(null);
  const [fresh, setFresh] = useState(false);

  function reveal(kind: "day" | "next") {
    const next =
      kind === "day" && !verse
        ? verseForDay()
        : randomGivingVerse(verse?.reference);
    setVerse(next);
    setFresh(true);
    window.setTimeout(() => setFresh(false), 480);
  }

  return (
    <div className="wh-verse">
      <div className="wh-verse-actions">
        <button
          type="button"
          className="wh-verse-btn"
          onClick={() => reveal(verse ? "next" : "day")}
        >
          <BookOpen size={18} strokeWidth={2} aria-hidden />
          {verse ? anotherLabel : buttonLabel}
        </button>
      </div>
      {verse ? (
        <blockquote className={`wh-verse-card${fresh ? " is-fresh" : ""}`}>
          <p>
            “{verse.text}”
          </p>
          <cite>{verse.reference}</cite>
        </blockquote>
      ) : null}
    </div>
  );
}
