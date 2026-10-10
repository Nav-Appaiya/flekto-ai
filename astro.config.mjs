import { defineConfig } from "astro/config";
import vercel from "@astrojs/vercel";

// Static pages by default; routes with `prerender = false` (the /api endpoints) run as Vercel functions.
export default defineConfig({ site: "https://flekto.nl", adapter: vercel() });
