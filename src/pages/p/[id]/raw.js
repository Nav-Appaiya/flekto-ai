import { rpc } from "../../../lib/db.js";

export const prerender = false;

/** The paste itself, locked down so uploaded content can never run as a page on our origin. */
export async function GET({ params }) {
  const [paste] = await rpc("get_paste", { p_id: params.id });
  if (!paste) return new Response("Niet gevonden of verlopen.", { status: 404 });
  const body = paste.kind === "image" ? Buffer.from(paste.content, "base64") : paste.content;
  return new Response(body, {
    headers: {
      "Content-Type": paste.kind === "image" ? paste.mime : "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      "Cache-Control": "private, max-age=60",
      "X-Robots-Tag": "noindex",
    },
  });
}
