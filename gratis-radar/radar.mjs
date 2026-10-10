// Gratis-radar cron: push new free Marktplaats items near POSTCODE to ntfy.sh. Run by .github/workflows/gratis-radar.yml.
// Env: POSTCODE, RADIUS_KM (default 2), NTFY_TOPIC (required to push), KEYWORDS (optional, comma-separated).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fetchListings, geocode, newNearby, normalizePostcode } from "../src/lib/gratis.js";

const SEEN_FILE = new URL("./seen.json", import.meta.url);

async function push(topic, hit) {
  // JSON publishing keeps UTF-8 titles intact (HTTP headers can't carry them).
  await fetch("https://ntfy.sh/", {
    method: "POST",
    body: JSON.stringify({
      topic, title: `Gratis (${hit.km} km): ${hit.title}`, message: hit.description || hit.title,
      click: hit.url, tags: ["gift"], ...(hit.image && { attach: hit.image }),
    }),
  });
}

const postcode = normalizePostcode(process.env.POSTCODE);
const radiusKm = Number(process.env.RADIUS_KM || 2);
const keywords = (process.env.KEYWORDS ?? "").split(",").map((k) => k.trim().toLowerCase()).filter(Boolean);
const topic = process.env.NTFY_TOPIC;

const home = await geocode(postcode);
if (!home) throw new Error(`Unknown postcode: ${postcode}`);
const seen = new Set(existsSync(SEEN_FILE) ? JSON.parse(readFileSync(SEEN_FILE, "utf8")) : []);
const listings = await fetchListings(postcode, radiusKm);
const firstRun = seen.size === 0; // first run only seeds seen.json, so you don't get 50 pushes at once

for (const hit of newNearby(listings, seen, { home, radiusKm, keywords })) {
  console.log(`${hit.km.toFixed(1).padStart(4)} km  ${hit.title}`);
  if (topic && !firstRun) await push(topic, hit);
}
// ponytail: seen set grows forever; trim to the latest N ids if the file ever gets big
writeFileSync(SEEN_FILE, JSON.stringify([...new Set([...seen, ...listings.map((i) => i.itemId)])].sort()));
