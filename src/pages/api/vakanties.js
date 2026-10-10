import { json } from "../../lib/http.js";

export const prerender = false;

const API = "https://opendata.rijksoverheid.nl/v1/infotypes/schoolholidays?output=json";

export async function GET() {
  try {
    const res = await fetch(API);
    if (!res.ok) throw new Error(`Rijksoverheid ${res.status}`);
    const data = await res.json();
    // Return the full list; the frontend filters by region and date
    return json(data, 200, { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600" });
  } catch (err) {
    console.error("Vakanties fetch failed:", err);
    return json({ error: "Vakantiedata tijdelijk niet beschikbaar" }, 502);
  }
}
