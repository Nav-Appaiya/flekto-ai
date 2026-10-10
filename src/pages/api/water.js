import { json } from "../../lib/http.js";

export const prerender = false;

// Rijkswaterstaat waterinfo (DDL Aquo API)
const STATIONS_URL = "https://waterwebservices.rijkswaterstaat.nl/METADATASERVICES_DBO/OphalenCatalogus";
const LIVE_URL = "https://waterwebservices.rijkswaterstaat.nl/ONLINEWAARNEMINGENSERVICES_DBO/OphalenLaatsteWaarnemingen";

export async function GET({ url }) {
  const action = url.searchParams.get("action") || "stations";

  try {
    if (action === "stations") {
      const res = await fetch(STATIONS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          CatalogusFilter: {
            Eenheden: true, Grootheden: true, Hoedanigheden: true,
            Compartimenten: true, Parameters: true,
          },
        }),
      });
      if (!res.ok) throw new Error(`RWS stations ${res.status}`);
      const data = await res.json();
      // Extract station list from the catalog
      const stations = (data.LocatieLijst || []).map((s) => ({
        code: s.Code, naam: s.Naam, x: s.X, y: s.Y,
      }));
      return json(stations.slice(0, 50), 200, { "Cache-Control": "public, s-maxage=86400" });
    }

    // Latest observations
    const res = await fetch(LIVE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        AquoPlusWaarwordenFilter: {
          AquoMetadata: { Grootheid: { Code: "WATHTE" }, Eenheid: { Code: "cm" } },
        },
        LocatieLijst: [{ X: 0, Y: 0, Code: url.searchParams.get("station") || "HOEKVHLD" }],
      }),
    });
    if (!res.ok) throw new Error(`RWS live ${res.status}`);
    const data = await res.json();
    return json(data, 200, { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=300" });
  } catch (err) {
    console.error("Water fetch failed:", err);
    return json({ error: "Waterstanden tijdelijk niet beschikbaar" }, 502);
  }
}
