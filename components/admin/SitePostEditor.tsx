"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MediaUpload } from "@/components/admin/MediaUpload";
import { slugify } from "@/lib/utils";

export type SitePostEditorValue = {
  kind: "NEWS" | "FIELD_UPDATE" | "PROGRAM";
  status: "DRAFT" | "PUBLISHED";
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  coverImageUrl: string;
};

const blank: SitePostEditorValue = {
  kind: "PROGRAM",
  status: "DRAFT",
  slug: "",
  title: "",
  excerpt: "",
  body: "",
  coverImageUrl: "",
};

export function SitePostEditor({
  postId,
  initial,
}: {
  postId?: string;
  initial?: SitePostEditorValue;
}) {
  const router = useRouter();
  const [form, setForm] = useState<SitePostEditorValue>(initial ?? blank);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const isProgram = form.kind === "PROGRAM";

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    const payload = {
      ...form,
      slug: form.slug.trim() || slugify(form.title),
      coverImageUrl: form.coverImageUrl || null,
      body: form.body.trim() || form.excerpt,
    };
    const response = await fetch(
      postId ? `/api/admin/posts/${postId}` : "/api/admin/posts",
      {
        method: postId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const result = await response.json();
    setSaving(false);
    if (!response.ok) {
      setMessage(result.error ?? "Unable to save post");
      return;
    }
    if (!postId && result.post?.id) {
      router.push(`/admin/posts/${result.post.id}`);
      return;
    }
    setMessage("Post saved.");
    router.refresh();
  }

  return (
    <form className="admin-form" onSubmit={(event) => void save(event)}>
      <div className="admin-grid">
        <label>
          Type
          <select
            className="admin-input"
            value={form.kind}
            onChange={(event) =>
              setForm({
                ...form,
                kind: event.target.value as SitePostEditorValue["kind"],
              })
            }
          >
            <option value="PROGRAM">Program in action</option>
            <option value="NEWS">News</option>
            <option value="FIELD_UPDATE">Field update</option>
          </select>
        </label>
        <label>
          Status
          <select
            className="admin-input"
            value={form.status}
            onChange={(event) =>
              setForm({
                ...form,
                status: event.target.value as SitePostEditorValue["status"],
              })
            }
          >
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
          </select>
        </label>
      </div>
      {isProgram ? (
        <p className="admin-help">
          Published program cards appear on the home section “Where your help goes.”
          Title is the label under the card. Excerpt is the caption on the video or photo.
        </p>
      ) : null}
      <label>
        {isProgram ? "Card label" : "Title"}
        <input
          className="admin-input"
          required
          placeholder={isProgram ? "Care & support" : ""}
          value={form.title}
          onChange={(event) => {
            const title = event.target.value;
            setForm({
              ...form,
              title,
              slug: form.slug || slugify(title),
            });
          }}
        />
      </label>
      <label>
        Public slug
        <input
          className="admin-input"
          required
          value={form.slug}
          onChange={(event) => setForm({ ...form, slug: event.target.value })}
        />
      </label>
      <label>
        {isProgram ? "Caption on the video" : "Excerpt"}
        <textarea
          className="admin-textarea"
          required
          rows={3}
          placeholder={isProgram ? "Many are growing up without..." : ""}
          value={form.excerpt}
          onChange={(event) => setForm({ ...form, excerpt: event.target.value })}
        />
      </label>
      {isProgram ? null : (
        <label>
          Body
          <textarea
            className="admin-textarea"
            required
            rows={12}
            value={form.body}
            onChange={(event) => setForm({ ...form, body: event.target.value })}
          />
        </label>
      )}
      <label>
        {isProgram ? "Photo or video" : "Cover image"}
        <input
          className="admin-input"
          type="url"
          value={form.coverImageUrl}
          onChange={(event) =>
            setForm({ ...form, coverImageUrl: event.target.value })
          }
        />
        <MediaUpload
          folder="posts"
          accept="image/*,video/*,.mp4,.mov,.webm,.m4v"
          label={isProgram ? "Upload photo or video" : "Upload cover"}
          onUploaded={(coverImageUrl) =>
            setForm((current) => ({ ...current, coverImageUrl }))
          }
        />
        {isProgram ? (
          <span className="admin-field-hint">
            Short clips work best, under 20 MB. MP4 or WebM, or a still photo.
          </span>
        ) : null}
      </label>
      <button className="primary-button" type="submit" disabled={saving}>
        {saving ? "Saving…" : postId ? "Save post" : "Create post"}
      </button>
      {message ? <p className="form-message">{message}</p> : null}
    </form>
  );
}
