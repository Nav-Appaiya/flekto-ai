import { fetchListings, geocode, isPostcode, newNearby, normalizePostcode } from "../../lib/gratis.js";

export const prerender = false;

const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...extra } });

// One upstream request per postcode+radius per 5 min at most: the CDN serves repeats.
const CACHE = { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" };

export async function GET({ url }) {
  const postcode = normalizePostcode(url.searchParams.get("postcode"));
  const radiusKm = Math.min(Math.max(Number(url.searchParams.get("radius")) || 2, 0.5), 10);
  if (!isPostcode(postcode)) return json({ error: "Ongeldige postcode" }, 400);

  try {
    const home = await geocode(postcode);
    if (!home) return json({ error: "Postcode niet gevonden" }, 404);
    const items = newNearby(await fetchListings(postcode, radiusKm), new Set(), { home, radiusKm });
    return json({ postcode, radiusKm, items }, 200, CACHE);
  } catch (err) {
    console.error(err);
    return json({ error: "Bron tijdelijk niet bereikbaar" }, 502);
  }
}
