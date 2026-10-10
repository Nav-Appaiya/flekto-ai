import { rpc } from "../../../lib/db.js";
import { json } from "../../../lib/http.js";

export const prerender = false;

/** Mails in an inbox, newest first; `?after=<id>` returns only newer ones (for polling). */
export async function GET({ params, url }) {
  const after = Number(url.searchParams.get("after")) || 0;
  return json(await rpc("list_emails", { p_inbox: params.id, p_after: after }), 200, { "Cache-Control": "no-store" });
}
