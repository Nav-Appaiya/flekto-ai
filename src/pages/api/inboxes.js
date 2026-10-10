import { rpc } from "../../lib/db.js";
import { json } from "../../lib/http.js";

export const prerender = false;

/** New temporary inbox; `?ttl=<minutes>` (10, 60 or 1440). */
export async function POST({ url }) {
  try {
    const [inbox] = await rpc("create_inbox", { p_ttl_minutes: Number(url.searchParams.get("ttl")) || 60 });
    return json({ id: inbox.id, expiresAt: inbox.expires_at }, 201);
  } catch (err) {
    return json({ error: err.message === "invalid_ttl" ? "Ongeldige geldigheidsduur." : "Inbox maken mislukt." }, 400);
  }
}
