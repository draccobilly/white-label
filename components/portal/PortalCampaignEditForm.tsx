"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ImageIcon, Upload, X } from "lucide-react";
import type { PortalStrings } from "@/lib/portal-copy";
import { uploadFailureMessage } from "@/lib/media-file";

type Copy = Pick<
  PortalStrings,
  | "title"
  | "summary"
  | "summaryHint"
  | "story"
  | "coverImage"
  | "organizerImage"
  | "gallery"
  | "galleryHint"
  | "video"
  | "videoHint"
  | "upload"
  | "uploading"
  | "remove"
  | "moveUp"
  | "moveDown"
  | "save"
  | "saving"
  | "saved"
  | "genericError"
>;

export type PortalCampaignEditValue = {
  title: string;
  summary: string;
  story: string;
  coverImageUrl: string;
  organizerImageUrl: string;
  videoUrl: string;
  galleryImageUrls: string[];
};

const IMAGE_ACCEPT = "image/*,.heic,.heif";
const GALLERY_MAX = 12;

async function uploadImage(file: File, folder: string) {
  const body = new FormData();
  body.set("file", file);
  body.set("folder", folder);
  const response = await fetch("/api/portal/media", { method: "POST", body });
  const text = await response.text();
  if (!response.ok) {
    let message = "";
    try {
      message = (JSON.parse(text) as { error?: string }).error ?? "";
    } catch {
      message = "";
    }
    throw new Error(message || uploadFailureMessage(response.status, text));
  }
  return (JSON.parse(text) as { url: string }).url;
}

function SingleImageField({
  label,
  value,
  folder,
  copy,
  onChange,
  onError,
  round,
}: {
  label: string;
  value: string;
  folder: string;
  copy: Pick<Copy, "upload" | "uploading" | "remove">;
  onChange: (url: string) => void;
  onError: (message: string | null) => void;
  round?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="portal-image-field">
      <span className="portal-field-label">{label}</span>
      <div className={`portal-image-row${round ? " is-round" : ""}`}>
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" />
        ) : (
          <span className="portal-image-empty">
            <ImageIcon size={20} aria-hidden />
          </span>
        )}
        <div className="portal-image-actions">
          <input
            ref={input}
            type="file"
            accept={IMAGE_ACCEPT}
            hidden
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              setBusy(true);
              onError(null);
              try {
                onChange(await uploadImage(file, folder));
              } catch (error) {
                onError(error instanceof Error ? error.message : "Upload failed");
              } finally {
                setBusy(false);
              }
            }}
          />
          <button type="button" className="secondary-button" disabled={busy} onClick={() => input.current?.click()}>
            <Upload size={14} aria-hidden /> {busy ? copy.uploading : copy.upload}
          </button>
          {value ? (
            <button type="button" className="portal-link-button" onClick={() => onChange("")}>
              {copy.remove}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function PortalCampaignEditForm({
  campaignId,
  initial,
  copy,
}: {
  campaignId: string;
  initial: PortalCampaignEditValue;
  copy: Copy;
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [galleryBusy, setGalleryBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const galleryInput = useRef<HTMLInputElement>(null);

  function patch(next: Partial<PortalCampaignEditValue>) {
    setForm((current) => ({ ...current, ...next }));
  }

  function moveGallery(index: number, delta: number) {
    setForm((current) => {
      const list = [...current.galleryImageUrls];
      const target = index + delta;
      if (target < 0 || target >= list.length) return current;
      [list[index], list[target]] = [list[target], list[index]];
      return { ...current, galleryImageUrls: list };
    });
  }

  async function addGallery(files: FileList | null) {
    if (!files?.length) return;
    setGalleryBusy(true);
    setMessage(null);
    try {
      const room = GALLERY_MAX - form.galleryImageUrls.length;
      const picked = Array.from(files).slice(0, Math.max(0, room));
      const urls: string[] = [];
      for (const file of picked) urls.push(await uploadImage(file, `campaigns/${campaignId}`));
      setForm((current) => ({
        ...current,
        galleryImageUrls: [...current.galleryImageUrls, ...urls].slice(0, GALLERY_MAX),
      }));
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : copy.genericError });
    } finally {
      setGalleryBusy(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const response = await fetch(`/api/portal/campaigns/${campaignId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!response.ok) {
      setMessage({ tone: "error", text: data.error ?? copy.genericError });
      return;
    }
    setMessage({ tone: "success", text: copy.saved });
    router.refresh();
  }

  return (
    <form className="inst-form inst-form-wide portal-form" onSubmit={(event) => void submit(event)}>
      <label>
        {copy.title}
        <input
          className="admin-input"
          required
          minLength={5}
          maxLength={255}
          value={form.title}
          onChange={(event) => patch({ title: event.target.value })}
        />
      </label>
      <label>
        {copy.summary}
        <textarea
          className="admin-textarea"
          required
          minLength={10}
          maxLength={500}
          rows={3}
          value={form.summary}
          onChange={(event) => patch({ summary: event.target.value })}
        />
        <span className="admin-field-hint">{copy.summaryHint}</span>
      </label>
      <label>
        {copy.story}
        <textarea
          className="admin-textarea start-story"
          required
          minLength={20}
          rows={14}
          value={form.story}
          onChange={(event) => patch({ story: event.target.value })}
        />
      </label>

      <SingleImageField
        label={copy.coverImage}
        value={form.coverImageUrl}
        folder={`campaigns/${campaignId}`}
        copy={copy}
        onChange={(coverImageUrl) => patch({ coverImageUrl })}
        onError={(text) => setMessage(text ? { tone: "error", text } : null)}
      />
      <SingleImageField
        label={copy.organizerImage}
        value={form.organizerImageUrl}
        folder={`campaigns/${campaignId}/organizer`}
        copy={copy}
        round
        onChange={(organizerImageUrl) => patch({ organizerImageUrl })}
        onError={(text) => setMessage(text ? { tone: "error", text } : null)}
      />

      <div className="portal-image-field">
        <span className="portal-field-label">{copy.gallery}</span>
        <span className="admin-field-hint">{copy.galleryHint}</span>
        {form.galleryImageUrls.length ? (
          <ul className="portal-gallery">
            {form.galleryImageUrls.map((url, index) => (
              <li key={`${url}-${index}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" />
                <div className="portal-gallery-actions">
                  <button type="button" aria-label={copy.moveUp} disabled={index === 0} onClick={() => moveGallery(index, -1)}>
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={copy.moveDown}
                    disabled={index === form.galleryImageUrls.length - 1}
                    onClick={() => moveGallery(index, 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    aria-label={copy.remove}
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        galleryImageUrls: current.galleryImageUrls.filter((_, i) => i !== index),
                      }))
                    }
                  >
                    <X size={14} aria-hidden />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        <input
          ref={galleryInput}
          type="file"
          accept={IMAGE_ACCEPT}
          multiple
          hidden
          onChange={(event) => {
            void addGallery(event.target.files);
            event.target.value = "";
          }}
        />
        <div>
          <button
            type="button"
            className="secondary-button"
            disabled={galleryBusy || form.galleryImageUrls.length >= GALLERY_MAX}
            onClick={() => galleryInput.current?.click()}
          >
            <Upload size={14} aria-hidden /> {galleryBusy ? copy.uploading : copy.upload}
          </button>
        </div>
      </div>

      <label>
        {copy.video}
        <input
          className="admin-input"
          type="url"
          placeholder="https://"
          value={form.videoUrl}
          onChange={(event) => patch({ videoUrl: event.target.value })}
        />
        <span className="admin-field-hint">{copy.videoHint}</span>
      </label>

      {message ? <p className={message.tone === "success" ? "inst-form-thanks" : "form-message"}>{message.text}</p> : null}
      <div className="start-actions">
        <span />
        <button className="primary-button" type="submit" disabled={busy || galleryBusy}>
          {busy ? copy.saving : copy.save}
        </button>
      </div>
    </form>
  );
}
