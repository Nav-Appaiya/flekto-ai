import { json } from "../../lib/http.js";
import { fetchViral } from "../../lib/trends.js";

export const prerender = false;

// Trends refresh roughly every 10 minutes upstream; the CDN keeps us at one upstream fetch per 10 min.
export async function GET() {
  try {
    return json(await fetchViral(), 200, { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=300" });
  } catch (err) {
    console.error(err);
    return json({ error: "Trends tijdelijk niet beschikbaar" }, 502);
  }
}
