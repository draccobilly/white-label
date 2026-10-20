import { createClient } from "@supabase/supabase-js";
import { isAllowedUploadFile } from "@/lib/media-file";
import { portalError, portalJson, requirePortalOrganizer } from "@/lib/organizer-route";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import "@/lib/supabase/polyfill-websocket";

const BUCKET = "campaign-media";
const MAX_BYTES = 20 * 1024 * 1024;

export const maxDuration = 60;

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function safeFileName(name: string) {
  const cleaned = name.toLowerCase().replace(/[^a-z0-9.]+/g, "-");
  return cleaned.replace(/^-+|-+$/g, "") || "file";
}

/** Image upload for the organizer portal. Same bucket as the panel, under the organizer's folder. */
export async function POST(request: Request) {
  const { organizer, response: denied } = await requirePortalOrganizer();
  if (!organizer) return denied;
  if (!rateLimit(`portal-media:${organizer.id}:${clientIp(request)}`, 60, 60 * 60_000)) {
    return portalError("Too many uploads. Try again in a while.", 429);
  }
  try {
    const form = await request.formData();
    const file = form.get("file");
    const folderRaw = String(form.get("folder") ?? "campaigns");
    const folder = folderRaw.replace(/[^a-z0-9/_-]+/gi, "").replace(/^\/+|\/+$/g, "") || "campaigns";
    if (!(file instanceof File) || file.size === 0) return portalError("Choose a photo.", 400);
    if (file.size > MAX_BYTES) return portalError("Photo must be 20MB or smaller.", 400);
    const isImage = file.type.startsWith("image/") || /\.(jpe?g|png|gif|webp|avif|heic|heif)$/i.test(file.name);
    if (!isImage || !isAllowedUploadFile(file)) return portalError("Use a JPG, PNG, or WEBP photo.", 400);

    const supabase = serviceClient();
    if (!supabase) return portalError("Uploads are not configured on this site yet.", 503);
    const path = `organizers/${organizer.id}/${folder}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
    const options = { upsert: false, contentType: file.type || "image/jpeg" };
    let { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, options);
    if (uploadError && /bucket|not found/i.test(uploadError.message)) {
      const { error: createError } = await supabase.storage.createBucket(BUCKET, {
        public: true,
        fileSizeLimit: MAX_BYTES,
      });
      if (createError && !/already exists/i.test(createError.message)) throw createError;
      ({ error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, options));
    }
    if (uploadError) throw uploadError;
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return portalJson({ url: data.publicUrl });
  } catch (error) {
    console.error("portal upload failed", error instanceof Error ? error.message : error);
    return portalError("Upload failed. Try a smaller JPG or PNG.", 500);
  }
}
