import { json } from "../../lib/http.js";

export const prerender = false;

const RDW_BASE = "https://opendata.rdw.nl/resource/m9d7-ebf2.json";

export async function GET({ url }) {
  const kenteken = (url.searchParams.get("kenteken") || "").replace(/[\s-]/g, "").toUpperCase();
  if (!/^[A-Z0-9]{1,8}$/.test(kenteken)) return json({ error: "Voer een geldig kenteken in" }, 400);

  try {
    const res = await fetch(`${RDW_BASE}?kenteken=${kenteken}`);
    if (!res.ok) throw new Error(`RDW ${res.status}`);
    const data = await res.json();
    if (!data.length) return json({ error: "Kenteken niet gevonden" }, 404);
    return json(data[0], 200, { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600" });
  } catch (err) {
    console.error("RDW fetch failed:", err);
    return json({ error: "RDW-data tijdelijk niet beschikbaar" }, 502);
  }
}
