import { createHash } from "node:crypto";
import { rpc } from "../../lib/db.js";
import { json } from "../../lib/http.js";
import { MAX_IMAGE_BYTES, MAX_TEXT_CHARS, isValidTtl, sniffImage } from "../../lib/paste.js";

export const prerender = false;

const ERRORS = {
  rate_limited: [429, "Te veel pastes vanaf dit adres. Probeer het over een uur opnieuw."],
  invalid_size: [413, "Te groot of leeg."],
  invalid_type: [415, "Alleen tekst of PNG, JPEG, GIF en WebP."],
  invalid_ttl: [400, "Ongeldige bewaartermijn."],
};

async function readImage(request) {
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.length > MAX_IMAGE_BYTES) throw new Error("invalid_size");
  const mime = sniffImage(bytes);
  if (!mime) throw new Error("invalid_type");
  return { kind: "image", mime, content: Buffer.from(bytes).toString("base64") };
}

async function readText(request) {
  const text = await request.text();
  if (!text.trim() || text.length > MAX_TEXT_CHARS) throw new Error("invalid_size");
  return { kind: "text", mime: "text/plain", content: text };
}

const readPaste = (request) =>
  (request.headers.get("content-type") ?? "").startsWith("image/") ? readImage(request) : readText(request);

// Rate limiting only needs to recognise an address, not store it.
const ipHash = (address) => createHash("sha256").update(`flekto:${address}`).digest("hex");

/** Body is the raw text or image; `?ttl=<minutes>` sets how long the link lives. */
export async function POST({ request, url, clientAddress }) {
  const ttl = Number(url.searchParams.get("ttl"));
  try {
    if (!isValidTtl(ttl)) throw new Error("invalid_ttl");
    const { kind, mime, content } = await readPaste(request);
    const id = await rpc("create_paste", {
      p_kind: kind, p_mime: mime, p_content: content, p_ttl_minutes: ttl, p_ip_hash: ipHash(clientAddress),
    });
    return json({ id, url: `${url.origin}/p/${id}` }, 201);
  } catch (err) {
    const [status, message] = ERRORS[err.message] ?? [502, "Opslaan mislukt, probeer het opnieuw."];
    return json({ error: message }, status);
  }
}
