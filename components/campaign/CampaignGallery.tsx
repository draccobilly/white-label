"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type Props = {
  heading: string;
  images: string[] | null | undefined;
  campaignTitle: string;
  closeLabel: string;
  previousLabel: string;
  nextLabel: string;
  className?: string;
};

export function CampaignGallery({
  heading,
  images,
  campaignTitle,
  closeLabel,
  previousLabel,
  nextLabel,
  className,
}: Props) {
  const urls = (images ?? []).map((url) => url.trim()).filter(Boolean);
  const [active, setActive] = useState<number | null>(null);
  const count = urls.length;

  const close = useCallback(() => setActive(null), []);
  const showPrevious = useCallback(() => {
    setActive((current) =>
      current === null ? current : (current + count - 1) % count,
    );
  }, [count]);
  const showNext = useCallback(() => {
    setActive((current) =>
      current === null ? current : (current + 1) % count,
    );
  }, [count]);

  useEffect(() => {
    if (active === null) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") close();
      if (event.key === "ArrowLeft") showPrevious();
      if (event.key === "ArrowRight") showNext();
    }
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [active, close, showNext, showPrevious]);

  if (!urls.length) return null;

  return (
    <section
      className={["campaign-gallery", className].filter(Boolean).join(" ")}
      aria-labelledby="campaign-gallery-heading"
    >
      <hr className="impact-organizers-rule" />
      <h2 id="campaign-gallery-heading" className="impact-organizers-heading">
        {heading}
      </h2>
      <ul className="campaign-gallery-grid">
        {urls.map((url, index) => (
          <li key={`${url}-${index}`}>
            <button
              type="button"
              className="campaign-gallery-thumb"
              onClick={() => setActive(index)}
              aria-label={`${campaignTitle} ${index + 1} of ${urls.length}`}
            >
              <Image
                src={url}
                alt=""
                fill
                sizes="(max-width: 720px) 50vw, 320px"
                className="campaign-gallery-image"
              />
            </button>
          </li>
        ))}
      </ul>

      {active !== null ? (
        <div
          className="campaign-gallery-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={heading}
          onClick={close}
        >
          <button
            type="button"
            className="campaign-gallery-close"
            onClick={close}
            aria-label={closeLabel}
          >
            <X size={22} />
          </button>
          {urls.length > 1 ? (
            <button
              type="button"
              className="campaign-gallery-nav is-prev"
              onClick={(event) => {
                event.stopPropagation();
                showPrevious();
              }}
              aria-label={previousLabel}
            >
              <ChevronLeft size={28} />
            </button>
          ) : null}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={urls[active]}
            alt={`${campaignTitle} ${active + 1} of ${urls.length}`}
            className="campaign-gallery-full"
            onClick={(event) => event.stopPropagation()}
          />
          {urls.length > 1 ? (
            <button
              type="button"
              className="campaign-gallery-nav is-next"
              onClick={(event) => {
                event.stopPropagation();
                showNext();
              }}
              aria-label={nextLabel}
            >
              <ChevronRight size={28} />
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
