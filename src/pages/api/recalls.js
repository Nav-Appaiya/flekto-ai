import { json } from "../../lib/http.js";

export const prerender = false;

// NVWA product recalls via the Rijksoverheid open data feed
const API = "https://opendata.rijksoverheid.nl/v1/infotypes/recalls?output=json&rows=20&offset=0";

export async function GET() {
  try {
    const res = await fetch(API);
    if (!res.ok) throw new Error(`Recalls ${res.status}`);
    const data = await res.json();
    return json(data, 200, { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600" });
  } catch (err) {
    console.error("Recalls fetch failed:", err);
    return json({ error: "Terugroepdata tijdelijk niet beschikbaar" }, 502);
  }
}
