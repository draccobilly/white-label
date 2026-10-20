"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  src: string;
  alt?: string;
  sizes?: string;
  priority?: boolean;
  focusX?: number;
  focusY?: number;
  className?: string;
};

export function CoverMedia({
  src,
  alt = "",
  sizes = "100vw",
  priority = false,
  focusX = 50,
  focusY = 50,
  className,
}: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<"cover" | "contain">("cover");

  const measure = useCallback((width: number, height: number) => {
    const frame = frameRef.current;
    if (!frame || width <= 0 || height <= 0) return;
    const frameRatio = frame.clientWidth / Math.max(1, frame.clientHeight);
    const imageRatio = width / height;
    setFit(imageRatio + 0.02 < frameRatio ? "contain" : "cover");
  }, []);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const observer = new ResizeObserver(() => {
      const image = frame.querySelector("img");
      if (image && image.naturalWidth) {
        measure(image.naturalWidth, image.naturalHeight);
      }
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, [measure, src]);

  return (
    <div
      ref={frameRef}
      className={`cover-media ${fit === "contain" ? "is-contain" : "is-cover"} ${className ?? ""}`.trim()}
    >
      {fit === "contain" ? (
        <Image
          src={src}
          alt=""
          fill
          sizes={sizes}
          priority={priority}
          aria-hidden
          className="cover-media-blur"
        />
      ) : null}
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        className={fit === "contain" ? "cover-media-fit" : "cover-media-crop"}
        style={
          fit === "cover"
            ? { objectPosition: `${focusX}% ${focusY}%` }
            : undefined
        }
        onLoad={(event) => {
          const image = event.currentTarget;
          measure(image.naturalWidth, image.naturalHeight);
        }}
      />
    </div>
  );
}
