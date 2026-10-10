/** Scale (width, height) down so the longest side is at most maxSide; never upscales. */
export function fitWithin(width, height, maxSide) {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** "vakantie.HEIC" + "image/webp" -> "vakantie.webp" */
export const renamed = (name, mime) => `${name.replace(/\.[^.]+$/, "")}.${mime === "image/jpeg" ? "jpg" : mime.split("/")[1]}`;
