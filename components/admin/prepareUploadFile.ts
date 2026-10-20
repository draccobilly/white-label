const MAX_EDGE = 1800;
const MAX_BYTES_BEFORE_COMPRESS = 350_000;

function isCompressibleImage(file: File) {
  const type = (file.type || "").toLowerCase();
  const name = file.name || "";
  if (type === "image/heic" || type === "image/heif" || /\.hei[cf]$/i.test(name)) {
    return false;
  }
  return type.startsWith("image/") || /\.(jpe?g|png|gif|webp|bmp|avif)$/i.test(name);
}

export async function prepareUploadFile(file: File): Promise<File> {
  if (!isCompressibleImage(file) || file.size <= MAX_BYTES_BEFORE_COMPRESS) {
    return file;
  }
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.82);
    });
    if (!blob || blob.size >= file.size) return file;
    const base = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
}
