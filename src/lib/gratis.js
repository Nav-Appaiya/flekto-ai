// Free Marktplaats items near a Dutch postcode. Shared by the /api/gratis endpoint and the cron radar.

const UA = { "User-Agent": "Mozilla/5.0 (gratis-radar; flekto.nl)" };

async function getJson(url) {
  const res = await fetch(url, { headers: UA });
  if (res.status === 204) return {};
  if (!res.ok) throw new Error(`${new URL(url).host} ${res.status}`);
  return res.json();
}

/** Postcode -> { lat, lon } via PDOK Locatieserver, or null if unknown. */
export async function geocode(postcode) {
  const q = new URLSearchParams({ q: postcode, fq: "type:postcode", rows: "1", fl: "centroide_ll" });
  const { response } = await getJson(`https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?${q}`);
  const point = response.docs[0]?.centroide_ll; // "POINT(lon lat)"
  if (!point) return null;
  const [lon, lat] = point.slice(6, -1).split(" ").map(Number);
  return { lat, lon };
}

export function haversineKm(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2
    + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/** Newest listings mentioning "gratis"; the endpoint has no reliable free-only filter, so newNearby filters on priceType. */
export async function fetchListings(postcode, radiusKm) {
  const q = new URLSearchParams({
    query: "gratis", postcode, distanceMeters: String(Math.round(radiusKm * 1000) + 1000),
    limit: "100", offset: "0", sortBy: "SORT_INDEX", sortOrder: "DECREASING",
  });
  return (await getJson(`https://www.marktplaats.nl/lrp/api/search?${q}`)).listings ?? [];
}

function kmAway(item, home) {
  const loc = item.location ?? {};
  return loc.latitude == null ? Infinity : haversineKm(home, { lat: loc.latitude, lon: loc.longitude });
}

/** Not a "gezocht" (wanted) post, which is often marked free too, and matching any keyword. */
function isWanted(item, keywords) {
  const text = `${item.title} ${item.description ?? ""}`.toLowerCase();
  return !item.title.toLowerCase().includes("gezocht") && (!keywords.length || keywords.some((k) => text.includes(k)));
}

const isUnseenFree = (item, seen) => item.priceInfo?.priceType === "FREE" && !seen.has(item.itemId);

/** Plain display object for the UI and push messages. */
function toHit(item, km) {
  return {
    id: item.itemId,
    title: item.title,
    description: (item.description ?? "").slice(0, 200),
    km: Math.round(km * 10) / 10,
    city: item.location?.cityName ?? "",
    date: item.date ?? "",
    image: item.pictures?.[0]?.mediumUrl ?? null,
    url: `https://www.marktplaats.nl${item.vipUrl}`,
  };
}

/** Unseen free listings within radius (by exact item coords), nearest first. */
export function newNearby(listings, seen, { home, radiusKm, keywords = [] }) {
  return listings
    .filter((item) => isUnseenFree(item, seen) && isWanted(item, keywords))
    .map((item) => toHit(item, kmAway(item, home)))
    .filter((hit) => hit.km <= radiusKm)
    .sort((a, b) => a.km - b.km);
}

export const normalizePostcode = (s) => String(s ?? "").replace(/\s/g, "").toUpperCase();
export { isPostcode } from "./nl.js";
