"use client";

import { ChevronLeft, ChevronRight, Heart } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { CoverMedia } from "@/components/campaign/CoverMedia";

export type CoverSummary = {
  excerpt: string;
  donorCountLabel: string;
  percent: number;
  readStoryLabel: string;
  initials: [string, string];
};

type Props = {
  alt: string;
  coverImageUrl: string | null;
  galleryImageUrls?: string[] | null;
  focusX: number;
  focusY: number;
  coverPhotosLabel: string;
  photoOfLabel: string;
  previousLabel: string;
  nextLabel: string;
  summary: CoverSummary;
  children?: ReactNode;
};

const SUMMARY_INDEX = 1;

function uniqueCoverUrls(
  coverImageUrl: string | null,
  galleryImageUrls?: string[] | null,
) {
  const urls: string[] = [];
  const seen = new Set<string>();
  for (const value of [coverImageUrl, ...(galleryImageUrls ?? [])]) {
    const url = value?.trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
  }
  return urls;
}

function photoOf(template: string, current: number, total: number) {
  return template
    .replace("{current}", String(current))
    .replace("{total}", String(total));
}

export function ImpactCoverCarousel({
  alt,
  coverImageUrl,
  galleryImageUrls,
  focusX,
  focusY,
  coverPhotosLabel,
  photoOfLabel,
  previousLabel,
  nextLabel,
  summary,
  children,
}: Props) {
  const urls = uniqueCoverUrls(coverImageUrl, galleryImageUrls);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const slides = [
    { key: "photo-0", type: "photo" as const, src: urls[0] ?? null, photoIndex: 0 },
    { key: "summary", type: "summary" as const },
    ...urls.slice(1).map((src, offset) => ({
      key: `photo-${offset + 1}`,
      type: "photo" as const,
      src,
      photoIndex: offset + 1,
    })),
  ];
  const count = slides.length;
  const canSwipe = count > 1;
  const onSummary = index === SUMMARY_INDEX;
  const fill = Math.min(100, Math.max(0, Math.round(summary.percent)));

  const goTo = useCallback((next: number) => {
    const node = scrollerRef.current;
    if (!node || count < 2) return;
    const clamped = Math.max(0, Math.min(count - 1, next));
    node.scrollTo({ left: clamped * node.clientWidth, behavior: "smooth" });
  }, [count]);

  useEffect(() => {
    const node = scrollerRef.current;
    if (!node || !canSwipe) return;

    const syncIndex = () => {
      const width = node.clientWidth || 1;
      setIndex(Math.round(node.scrollLeft / width));
    };

    node.addEventListener("scroll", syncIndex, { passive: true });
    window.addEventListener("resize", syncIndex);
    return () => {
      node.removeEventListener("scroll", syncIndex);
      window.removeEventListener("resize", syncIndex);
    };
  }, [canSwipe]);

  useEffect(() => {
    const node = scrollerRef.current;
    if (!node || !canSwipe) return;

    let pointerId = 0;
    let startX = 0;
    let startY = 0;
    let startScroll = 0;
    let dragging = false;
    let axis: "x" | "y" | null = null;
    const scroller = node;

    const onDown = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || event.button !== 0) return;
      if ((event.target as Element | null)?.closest("a, button")) return;
      dragging = true;
      axis = null;
      pointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      startScroll = scroller.scrollLeft;
      scroller.setPointerCapture(pointerId);
      scroller.style.scrollBehavior = "auto";
      scroller.style.cursor = "grabbing";
    };

    const onMove = (event: PointerEvent) => {
      if (!dragging || event.pointerId !== pointerId) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (!axis && Math.abs(dx) + Math.abs(dy) > 6) {
        axis = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
      }
      if (axis !== "x") return;
      event.preventDefault();
      scroller.scrollLeft = startScroll - dx;
    };

    const onUp = (event: PointerEvent) => {
      if (!dragging || event.pointerId !== pointerId) return;
      dragging = false;
      scroller.style.scrollBehavior = "";
      scroller.style.cursor = "";
      if (axis === "x") {
        const width = scroller.clientWidth || 1;
        goTo(Math.round(scroller.scrollLeft / width));
      }
      axis = null;
    };

    node.addEventListener("pointerdown", onDown);
    node.addEventListener("pointermove", onMove, { passive: false });
    node.addEventListener("pointerup", onUp);
    node.addEventListener("pointercancel", onUp);
    return () => {
      node.removeEventListener("pointerdown", onDown);
      node.removeEventListener("pointermove", onMove);
      node.removeEventListener("pointerup", onUp);
      node.removeEventListener("pointercancel", onUp);
    };
  }, [canSwipe, goTo]);

  return (
    <>
      <div
        className={`impact-cover-frame${canSwipe ? " is-carousel" : ""}${onSummary ? " is-summary" : ""}`}
      >
        <div
          ref={scrollerRef}
          className="impact-cover-scroller"
          tabIndex={canSwipe ? 0 : undefined}
          role={canSwipe ? "region" : undefined}
          aria-roledescription={canSwipe ? "carousel" : undefined}
          aria-label={canSwipe ? photoOf(photoOfLabel, index + 1, count) : undefined}
          onKeyDown={
            canSwipe
              ? (event) => {
                  if (event.key === "ArrowLeft") {
                    event.preventDefault();
                    goTo(index - 1);
                  }
                  if (event.key === "ArrowRight") {
                    event.preventDefault();
                    goTo(index + 1);
                  }
                }
              : undefined
          }
        >
          {slides.map((slide, slideIndex) =>
            slide.type === "summary" ? (
              <div
                className={`impact-cover-slide is-summary${slideIndex === index ? " is-active" : ""}`}
                key={slide.key}
              >
                <div className="impact-cover-summary">
                  <div className="impact-cover-summary-card">
                    <p className="impact-cover-summary-copy">{summary.excerpt}</p>
                    <div className="impact-cover-summary-row">
                      <div className="impact-cover-summary-donors">
                        <span className="impact-cover-summary-avatars" aria-hidden>
                          <span className="impact-cover-summary-avatar is-lime">
                            {summary.initials[0]}
                          </span>
                          <span className="impact-cover-summary-avatar is-teal">
                            <Heart size={14} fill="currentColor" />
                          </span>
                          <span className="impact-cover-summary-avatar is-lilac">
                            {summary.initials[1]}
                          </span>
                        </span>
                        <span>{summary.donorCountLabel}</span>
                      </div>
                      <a className="impact-cover-summary-read" href="#story">
                        {summary.readStoryLabel}
                      </a>
                    </div>
                    <div className="impact-cover-summary-meter">
                      <div className="impact-cover-summary-track">
                        <span
                          className="impact-cover-summary-fill"
                          style={
                            {
                              "--impact-summary-fill": `${fill}%`,
                            } as CSSProperties
                          }
                        >
                          <span className="living-progress-sheen" aria-hidden />
                        </span>
                      </div>
                      <strong>{fill}%</strong>
                    </div>
                  </div>
                </div>
              </div>
            ) : slide.src ? (
              <div className="impact-cover-slide" key={slide.key}>
                <CoverMedia
                  src={slide.src}
                  alt={slideIndex === index ? alt : ""}
                  priority={slide.photoIndex === 0}
                  sizes="(max-width: 960px) 100vw, 720px"
                  focusX={slide.photoIndex === 0 ? focusX : 50}
                  focusY={slide.photoIndex === 0 ? focusY : 50}
                />
              </div>
            ) : (
              <div className="impact-cover-slide" key={slide.key}>
                <div className="impact-cover-fallback" aria-hidden />
              </div>
            ),
          )}
        </div>
        {children}
      </div>
      {canSwipe ? (
        <div className={`impact-cover-chrome${onSummary ? " is-summary" : ""}`}>
          <div className="impact-cover-dots" role="tablist" aria-label={coverPhotosLabel}>
            {slides.map((slide, slideIndex) => (
              <button
                type="button"
                key={`${slide.key}-dot`}
                className={`impact-cover-dot${slideIndex === index ? " is-active" : ""}`}
                aria-label={photoOf(photoOfLabel, slideIndex + 1, count)}
                aria-current={slideIndex === index ? "true" : undefined}
                onClick={() => goTo(slideIndex)}
              />
            ))}
          </div>
          {onSummary ? (
            <div className="impact-cover-arrows">
              <button
                type="button"
                className="impact-cover-arrow"
                aria-label={previousLabel}
                onClick={() => goTo(index - 1)}
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                className="impact-cover-arrow"
                aria-label={nextLabel}
                onClick={() => goTo(index + 1)}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
