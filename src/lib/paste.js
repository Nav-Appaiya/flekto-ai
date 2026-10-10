// Shared between the paste API, the share page and the create UI.

export const TTL_OPTIONS = [
  { minutes: 10, label: "10 minuten" },
  { minutes: 60, label: "1 uur" },
  { minutes: 1440, label: "1 dag" },
  { minutes: 10080, label: "7 dagen" },
  { minutes: 43200, label: "30 dagen" },
];
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // Vercel functions accept at most 4.5 MB request bodies
export const MAX_TEXT_CHARS = 500_000;

const SIGNATURES = [
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/gif", bytes: [0x47, 0x49, 0x46, 0x38] },
];

/** Detect the image type from its first bytes, so a renamed HTML/SVG file can't pose as an image. */
export function sniffImage(bytes) {
  const match = SIGNATURES.find((s) => s.bytes.every((b, i) => bytes[i] === b));
  if (match) return match.mime;
  const ascii = (from, to) => String.fromCharCode(...bytes.slice(from, to));
  return ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP" ? "image/webp" : null;
}

export const isValidTtl = (minutes) => TTL_OPTIONS.some((o) => o.minutes === minutes);
