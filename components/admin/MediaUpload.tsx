"use client";

import { useState } from "react";
import { prepareUploadFile } from "@/components/admin/prepareUploadFile";
import { uploadFailureMessage } from "@/lib/media-file";

export function MediaUpload({
  folder,
  onUploaded,
  accept = "image/*,video/*",
  label = "Upload media",
  multiple = false,
  variant = "button",
}: {
  folder: string;
  onUploaded: (url: string) => void;
  accept?: string;
  label?: string;
  multiple?: boolean;
  variant?: "button" | "cover" | "avatar";
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    const prepared = await prepareUploadFile(file);
    const body = new FormData();
    body.append("file", prepared);
    body.append("folder", folder);
    const response = await fetch("/api/admin/media", {
      method: "POST",
      body,
      credentials: "include",
    });
    const text = await response.text();
    let result: { url?: string; error?: string } = {};
    try {
      result = text ? (JSON.parse(text) as { url?: string; error?: string }) : {};
    } catch {
      throw new Error(uploadFailureMessage(response.status, text));
    }
    if (!response.ok || !result.url) {
      throw new Error(result.error ?? uploadFailureMessage(response.status, text));
    }
    onUploaded(result.url);
  }

  async function uploadFiles(files: File[]) {
    if (!files.length) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of files) {
        await upload(file);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const className =
    variant === "cover"
      ? "studio-cover-upload"
      : variant === "avatar"
        ? "studio-avatar-upload"
        : "admin-upload-btn";

  return (
    <div className={variant === "button" ? undefined : "studio-upload-wrap"}>
      <label className={className}>
        {uploading ? "Uploading…" : label}
        <input
          type="file"
          accept={accept}
          hidden
          multiple={multiple}
          disabled={uploading}
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            if (files.length) void uploadFiles(files);
          }}
        />
      </label>
      {error && <small className="form-error">{error}</small>}
    </div>
  );
}
