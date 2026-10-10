import { json } from "../../lib/http.js";
import { analyzeSite } from "../../lib/sitecheck.js";

export const prerender = false;

/** /api/site?url=<site>: SEO, security, speed, CMS and link preview of one public page. */
export async function GET({ url }) {
  const target = url.searchParams.get("url") ?? "";
  if (!target.trim()) return json({ error: "Vul een websiteadres in" }, 400);
  try {
    return json(await analyzeSite(target), 200, { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" });
  } catch (err) {
    const timeout = err.name === "TimeoutError";
    if (!timeout && !(err instanceof TypeError && err.message === "fetch failed")) return json({ error: err.message }, 400);
    return json({ error: timeout ? "De site reageerde niet binnen 8 seconden" : "Kon de site niet bereiken" }, 502);
  }
}
