import { json } from "../../lib/http.js";
import { fetchSignals, KINDS } from "../../lib/ideas.js";

export const prerender = false;

// Weekly tops barely move within an hour; the CDN keeps upstream (and GitHub's rate limit) at one fetch per hour.
export async function GET({ url }) {
  const kind = url.searchParams.get("kind");
  if (!KINDS.includes(kind)) return json({ error: `kind moet ${KINDS.join(" of ")} zijn` }, 400);
  const data = await fetchSignals(kind);
  if (!data.signals.length && kind === "dev") return json({ error: "De bronnen zijn even niet bereikbaar" }, 502);
  return json(data, 200, { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600" });
}
