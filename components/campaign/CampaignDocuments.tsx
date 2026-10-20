"use client";

import Image from "next/image";
import { CircleCheck, ChevronLeft, ChevronRight, FileText, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { isPdfUrl } from "@/lib/media-file";

type Props = {
  heading: string;
  images: string[] | null | undefined;
  note?: string | null;
  campaignTitle: string;
  closeLabel: string;
  previousLabel: string;
  nextLabel: string;
};

export function CampaignDocuments({
  heading,
  images,
  note,
  campaignTitle,
  closeLabel,
  previousLabel,
  nextLabel,
}: Props) {
  const urls = (images ?? []).map((url) => url.trim()).filter(Boolean);
  const banner = note?.trim() || "";
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

  if (!urls.length && !banner) return null;

  return (
    <section className="campaign-documents" aria-labelledby="campaign-documents-heading">
      <hr className="impact-organizers-rule" />
      <h2 id="campaign-documents-heading" className="campaign-documents-heading">
        {heading}
        {urls.length ? (
          <span className="campaign-documents-count">{urls.length}</span>
        ) : null}
      </h2>
      {urls.length ? (
        <ul className="campaign-documents-grid">
          {urls.map((url, index) => (
            <li key={`${url}-${index}`}>
              <button
                type="button"
                className="campaign-documents-thumb"
                onClick={() => setActive(index)}
                aria-label={`${heading} ${index + 1} of ${urls.length}`}
              >
                {isPdfUrl(url) ? (
                  <span className="campaign-documents-pdf">
                    <FileText size={28} />
                    PDF
                  </span>
                ) : (
                  <Image
                    src={url}
                    alt=""
                    fill
                    sizes="160px"
                    className="campaign-documents-image"
                  />
                )}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {banner ? (
        <p className="campaign-documents-banner">
          <CircleCheck size={20} aria-hidden />
          <span>{banner}</span>
        </p>
      ) : null}

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
          {isPdfUrl(urls[active]) ? (
            <iframe
              src={urls[active]}
              title={`${campaignTitle} ${heading} ${active + 1} of ${urls.length}`}
              className="campaign-gallery-full campaign-documents-pdf-frame"
              onClick={(event) => event.stopPropagation()}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={urls[active]}
              alt={`${campaignTitle} ${heading} ${active + 1} of ${urls.length}`}
              className="campaign-gallery-full"
              onClick={(event) => event.stopPropagation()}
            />
          )}
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
