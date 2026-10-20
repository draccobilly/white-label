"use client";

import { useRef, useState } from "react";

export function CoverFocusPicker({
  url,
  focusX,
  focusY,
  onChange,
}: {
  url: string;
  focusX: number;
  focusY: number;
  onChange: (focus: { x: number; y: number }) => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [portrait, setPortrait] = useState(false);
  const dragging = useRef(false);

  function setFromPointer(event: React.PointerEvent<HTMLDivElement>) {
    const frame = frameRef.current;
    if (!frame) return;
    const rect = frame.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(100, Math.max(0, ((event.clientY - rect.top) / rect.height) * 100));
    onChange({ x: Math.round(x), y: Math.round(y) });
  }

  if (!url) return null;

  return (
    <div className="cover-picker">
      <p className="admin-help">
        Click or drag the most important part of the photo. Vertical images are
        shown in full, with blurred sides — they will not be cropped.
      </p>
      <div
        ref={frameRef}
        className={`cover-picker-frame ${portrait ? "is-portrait" : ""}`}
        onPointerDown={(event) => {
          if (portrait) return;
          dragging.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          setFromPointer(event);
        }}
        onPointerMove={(event) => {
          if (!dragging.current || portrait) return;
          setFromPointer(event);
        }}
        onPointerUp={() => {
          dragging.current = false;
        }}
      >
        {portrait ? (
          <img src={url} alt="" className="cover-picker-blur" aria-hidden />
        ) : null}
        <img
          src={url}
          alt="Cover preview"
          className={portrait ? "cover-picker-fit" : "cover-picker-crop"}
          style={portrait ? undefined : { objectPosition: `${focusX}% ${focusY}%` }}
          onLoad={(event) => {
            const image = event.currentTarget;
            setPortrait(image.naturalHeight > image.naturalWidth);
          }}
        />
        {!portrait ? (
          <span
            className="cover-picker-pin"
            style={{ left: `${focusX}%`, top: `${focusY}%` }}
          />
        ) : null}
      </div>
      {portrait ? (
        <p className="admin-help">Vertical photo detected. The donation page will show the whole image.</p>
      ) : (
        <p className="admin-help">
          Focus {focusX}% from the left, {focusY}% from the top.
        </p>
      )}
    </div>
  );
}
