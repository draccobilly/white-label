import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isAuthError, requireAdmin } from "@/lib/auth";
import { isAllowedUploadFile } from "@/lib/media-file";
import "@/lib/supabase/polyfill-websocket";

const BUCKET = "campaign-media";
const MAX_BYTES = 20 * 1024 * 1024;

export const maxDuration = 60;

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error("STORAGE_NOT_CONFIGURED");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function safeFileName(name: string) {
  const cleaned = name.toLowerCase().replace(/[^a-z0-9.]+/g, "-");
  return cleaned.replace(/^-+|-+$/g, "") || "file";
}

function contentTypeFor(file: File) {
  if (file.type) return file.type;
  if (/\.pdf$/i.test(file.name)) return "application/pdf";
  if (/\.png$/i.test(file.name)) return "image/png";
  if (/\.webp$/i.test(file.name)) return "image/webp";
  if (/\.mp4$/i.test(file.name)) return "video/mp4";
  if (/\.webm$/i.test(file.name)) return "video/webm";
  if (/\.mov$/i.test(file.name)) return "video/quicktime";
  if (/\.m4v$/i.test(file.name)) return "video/mp4";
  return "image/jpeg";
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const form = await request.formData();
    const file = form.get("file");
    const folderRaw = String(form.get("folder") ?? "campaigns");
    const folder = folderRaw.replace(/[^a-z0-9/_-]+/gi, "") || "campaigns";

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Choose a photo, screenshot, or PDF" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File must be 20MB or smaller" }, { status: 400 });
    }
    if (!isAllowedUploadFile(file)) {
      return NextResponse.json(
        { error: "Use a JPG, PNG, WEBP, MP4, or PDF" },
        { status: 400 },
      );
    }

    const supabase = serviceClient();
    const path = `${folder}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
    const options = {
      upsert: false,
      contentType: contentTypeFor(file),
    };
    let { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, options);
    if (uploadError && /bucket|not found/i.test(uploadError.message)) {
      const { error: createError } = await supabase.storage.createBucket(BUCKET, {
        public: true,
        fileSizeLimit: MAX_BYTES,
      });
      if (createError && !/already exists/i.test(createError.message)) {
        throw createError;
      }
      ({ error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, options));
    }
    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({ url: data.publicUrl });
  } catch (error) {
    const message =
      error instanceof Error && error.message === "STORAGE_NOT_CONFIGURED"
        ? "Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to upload media"
        : isAuthError(error)
          ? "Unauthorized"
          : error instanceof Error
            ? error.message
            : "Upload failed";
    return NextResponse.json(
      { error: message },
      { status: isAuthError(error) ? 401 : 500 },
    );
  }
}
