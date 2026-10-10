import { json } from "../../lib/http.js";

export const prerender = false;

// CBS OData: population by municipality (most-used dataset)
const BASE = "https://opendata.cbs.nl/ODataApi/odata/03759ned";

export async function GET({ url }) {
  const table = url.searchParams.get("table") || "TypedDataSet";
  const filter = url.searchParams.get("$filter") || "";
  const top = Math.min(+(url.searchParams.get("$top") || 20), 100);

  const query = new URLSearchParams({ $format: "json", $top: String(top) });
  if (filter) query.set("$filter", filter);

  try {
    const res = await fetch(`${BASE}/${table}?${query}`);
    if (!res.ok) throw new Error(`CBS ${res.status}`);
    const data = await res.json();
    return json(data.value || data, 200, { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600" });
  } catch (err) {
    console.error("CBS fetch failed:", err);
    return json({ error: "CBS-data tijdelijk niet beschikbaar" }, 502);
  }
}
