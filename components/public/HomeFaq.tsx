"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";

type FaqItem = {
  question: string;
  answer: string;
};

export function HomeFaq({
  heading,
  items,
  helpHref,
  helpLabel,
}: {
  heading: string;
  items: FaqItem[];
  helpHref: string;
  helpLabel: string;
}) {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section className="wh-faq" aria-labelledby="wh-faq-heading">
      <div className="shell">
        <h2 id="wh-faq-heading">{heading}</h2>
        <div className="wh-faq-list">
          {items.map((item, index) => {
            const expanded = open === index;
            return (
              <div className={`wh-faq-item${expanded ? " is-open" : ""}`} key={item.question}>
                <button
                  type="button"
                  className="wh-faq-q"
                  aria-expanded={expanded}
                  onClick={() => setOpen(expanded ? null : index)}
                >
                  <span>{item.question}</span>
                  <ChevronDown size={20} strokeWidth={2} aria-hidden />
                </button>
                {expanded ? <p className="wh-faq-a">{item.answer}</p> : null}
              </div>
            );
          })}
        </div>
        <Link className="wh-text-link" href={helpHref}>
          {helpLabel}
        </Link>
      </div>
    </section>
  );
}
