const IMAGE_EXT = /\.(jpe?g|png|gif|webp|avif|bmp|heic|heif)$/i;
const VIDEO_EXT = /\.(mp4|webm|mov|m4v|ogg|ogv|avi|mkv)($|\?)/i;
const PDF_EXT = /\.pdf($|\?)/i;

export function isPdfUrl(url: string) {
  return PDF_EXT.test(url.trim());
}

export function isVideoUrl(url: string) {
  const value = url.trim();
  if (!value) return false;
  return VIDEO_EXT.test(value) || /^data:video\//i.test(value);
}

export function isImageUrl(url: string) {
  const value = url.trim();
  if (!value || isPdfUrl(value) || isVideoUrl(value)) return false;
  return IMAGE_EXT.test(value) || /\/storage\/v1\/object\/public\//i.test(value);
}

export function isAllowedUploadFile(file: { name?: string; type?: string }) {
  const type = (file.type || "").toLowerCase();
  const name = file.name || "";
  if (
    type.startsWith("image/") ||
    type.startsWith("video/") ||
    type === "application/pdf"
  ) {
    return true;
  }
  return IMAGE_EXT.test(name) || VIDEO_EXT.test(name) || /\.pdf$/i.test(name);
}

export const DOCUMENT_UPLOAD_ACCEPT =
  "image/*,.heic,.heif,.pdf,image/heic,image/heif,application/pdf";

export function uploadFailureMessage(status: number, body: string) {
  if (status === 413 || /413|too large|entity too large/i.test(body)) {
    return "Photo is too large. Use a JPG, PNG, or PDF under 20MB.";
  }
  if (status === 401 || status === 403) {
    return "Session expired. Refresh the page and sign in again.";
  }
  if (status === 502 || status === 503 || status === 504) {
    return "The giving panel is restarting. Wait a few seconds and try the photo again.";
  }
  if (/giving panel is restarting/i.test(body)) {
    return "The giving panel is restarting. Wait a few seconds and try the photo again.";
  }
  return "Upload failed. Try a smaller JPG, PNG, screenshot, or PDF.";
}
