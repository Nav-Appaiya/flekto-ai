import { json } from "../../lib/http.js";

export const prerender = false;

// Buienradar JSON feed (open data, free to use with attribution)
const API = "https://data.buienradar.nl/2.0/feed/json";

export async function GET() {
  try {
    const res = await fetch(API);
    if (!res.ok) throw new Error(`Buienradar ${res.status}`);
    const data = await res.json();
    const stations = (data.actual?.stationmeasurements || []).map((s) => ({
      station: s.stationname, regio: s.regio,
      temp: s.temperature, gevoelstemp: s.feeltemperature,
      luchtvochtigheid: s.humidity, wind: s.windspeedBft,
      windrichting: s.winddirection, zicht: s.visibility,
      neerslag: s.precipitation, icoon: s.iconurl,
      beschrijving: s.weatherdescription, timestamp: s.timestamp,
    }));
    return json({
      stations,
      verwachting: data.forecast?.shortterm?.forecast || "",
      bijgewerkt: data.actual?.sunrise,
    }, 200, { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=300" });
  } catch (err) {
    console.error("Weer fetch failed:", err);
    return json({ error: "Weerdata tijdelijk niet beschikbaar" }, 502);
  }
}
