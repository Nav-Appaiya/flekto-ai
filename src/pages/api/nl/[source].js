import { json } from "../../../lib/http.js";
import { SOURCES, UserError } from "../../../lib/opendata.js";

export const prerender = false;

/** /api/nl/<source>?q=<input> for the open-data tools; each source sets how long the CDN may keep its answer. */
export async function GET({ params, url }) {
  const source = SOURCES[params.source];
  if (!source) return json({ error: "Onbekende bron" }, 404);
  try {
    const data = await source.load(url.searchParams.get("q") ?? "");
    return json(data, 200, { "Cache-Control": `public, s-maxage=${source.cacheSeconds}, stale-while-revalidate=60` });
  } catch (err) {
    if (err instanceof UserError) return json({ error: err.message }, err.status);
    console.error(params.source, err);
    return json({ error: "De bron is even niet bereikbaar. Probeer het zo nog eens." }, 502);
  }
}
