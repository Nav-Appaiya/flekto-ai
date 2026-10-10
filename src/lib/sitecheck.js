// Fetches a public web page and checks SEO basics, security headers, the CMS behind it and its link preview.
// Server-only (Node): `safeFetch` refuses private and internal addresses so the endpoint can't be used to probe networks.
import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

const MAX_BYTES = 3 * 1024 * 1024;
const MAX_REDIRECTS = 4;
const TIMEOUT_MS = 8000;

const PRIVATE = new BlockList();
for (const [net, prefix] of [["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
  ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["224.0.0.0", 3]]) PRIVATE.addSubnet(net, prefix, "ipv4");
for (const [net, prefix] of [["::", 127], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8]]) PRIVATE.addSubnet(net, prefix, "ipv6");

export const isPrivateAddress = (address) => PRIVATE.check(address, isIP(address) === 6 ? "ipv6" : "ipv4");

/** "flekto.nl" -> "https://flekto.nl/"; throws on anything that isn't a plain public http(s) URL. */
export function normalizeUrl(input) {
  const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(input.trim()) ? input.trim() : `https://${input.trim()}`);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Alleen http- en https-adressen");
  if (url.username || url.password) throw new Error("Geen inloggegevens in de URL");
  if (url.port && !["80", "443"].includes(url.port)) throw new Error("Alleen de standaardpoorten 80 en 443");
  if (!url.hostname.includes(".")) throw new Error("Dat lijkt geen websiteadres");
  return url;
}

async function assertPublicHost(hostname) {
  const addresses = await lookup(hostname.replace(/^\[|\]$/g, ""), { all: true }).catch(() => []);
  if (!addresses.length) throw new Error("Dit domein bestaat niet (of heeft geen DNS)");
  if (addresses.some((a) => isPrivateAddress(a.address))) throw new Error("Dit adres is niet publiek bereikbaar");
}

async function readCapped(res) {
  const reader = res.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) { await reader.cancel(); break; }
    chunks.push(value);
  }
  return { html: new TextDecoder().decode(Buffer.concat(chunks)), bytes: size };
}

/**
 * GET a public page, following redirects by hand so every hop is checked.
 * ponytail: DNS is resolved again by fetch, so a rebinding domain could still slip through; pin the IP with an undici Agent if that matters.
 */
export async function safeFetch(input) {
  let url = normalizeUrl(input);
  const started = Date.now();
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicHost(url.hostname);
    const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; FlektoSiteCheck/1.0; +https://flekto.nl/tools/website-check/)", Accept: "text/html,*/*" } });
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) { url = normalizeUrl(new URL(location, url).href); continue; }
    const { html, bytes } = await readCapped(res);
    return { url: url.href, status: res.status, ms: Date.now() - started, headers: res.headers, html, bytes, redirects: hop };
  }
  throw new Error("Te veel redirects");
}

// --- HTML parsing (regex is enough for reading a handful of head tags) ----------------------------

const ATTR = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const decode = (s) => s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&(\w+);/g, (m, n) => ENTITIES[n] ?? m).trim();

function attrs(tag) {
  const result = {};
  for (const [, name, ...values] of tag.matchAll(ATTR)) result[name.toLowerCase()] = decode(values.find((v) => v !== undefined));
  return result;
}

const tags = (html, name) => [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, "gi"))].map((m) => attrs(m[0]));

/** Head facts from an HTML document. */
export function parsePage(html) {
  const metas = tags(html, "meta");
  const meta = (key) => metas.find((m) => (m.name ?? m.property ?? "").toLowerCase() === key)?.content ?? "";
  const links = tags(html, "link");
  return {
    title: decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? ""),
    description: meta("description"),
    lang: tags(html, "html")[0]?.lang ?? "",
    viewport: meta("viewport"),
    robots: meta("robots"),
    generator: meta("generator"),
    canonical: links.find((l) => (l.rel ?? "").toLowerCase() === "canonical")?.href ?? "",
    h1: (html.match(/<h1\b/gi) ?? []).length,
    imagesWithoutAlt: tags(html, "img").filter((img) => !("alt" in img)).length,
    og: Object.fromEntries(["title", "description", "image", "site_name", "url"].map((k) => [k, meta(`og:${k}`)])),
    twitterCard: meta("twitter:card"),
  };
}

// --- Checks --------------------------------------------------------------------------------------

const check = (group, label, status, detail) => ({ group, label, status, detail });

const lengthCheck = (label, text, min, max) => (!text
  ? check("SEO", label, "bad", "ontbreekt")
  : check("SEO", label, text.length >= min && text.length <= max ? "ok" : "warn", `${text.length} tekens (ideaal ${min}–${max}): "${text}"`));

function seoChecks(page) {
  return [
    lengthCheck("Titel", page.title, 30, 60),
    lengthCheck("Meta description", page.description, 70, 160),
    check("SEO", "H1", page.h1 === 1 ? "ok" : "warn", page.h1 === 1 ? "precies één" : `${page.h1} stuks (één is het duidelijkst)`),
    check("SEO", "Canonical", page.canonical ? "ok" : "warn", page.canonical || "ontbreekt"),
    check("SEO", "Indexeren", /noindex/i.test(page.robots) ? "bad" : "ok", /noindex/i.test(page.robots) ? "noindex: Google laat deze pagina weg" : "toegestaan"),
    check("SEO", "Taal", page.lang ? "ok" : "warn", page.lang || "geen lang-attribuut op <html>"),
    check("SEO", "Mobiel", page.viewport ? "ok" : "bad", page.viewport ? "viewport ingesteld" : "geen viewport-meta: slecht op mobiel"),
    check("SEO", "Alt-teksten", page.imagesWithoutAlt ? "warn" : "ok", page.imagesWithoutAlt ? `${page.imagesWithoutAlt} afbeelding(en) zonder alt` : "alle afbeeldingen hebben alt"),
    check("Delen", "Open Graph", page.og.title && page.og.image ? "ok" : "warn", page.og.image ? "titel en afbeelding aanwezig" : "geen og:image: links delen zonder plaatje"),
  ];
}

const SECURITY_HEADERS = [
  ["strict-transport-security", "HSTS", "dwingt https af"],
  ["content-security-policy", "Content-Security-Policy", "beperkt welke scripts mogen draaien"],
  ["x-content-type-options", "X-Content-Type-Options", "voorkomt MIME-sniffing"],
  ["referrer-policy", "Referrer-Policy", "bepaalt wat je meestuurt naar andere sites"],
];

/** PHP below 8.2 no longer gets security fixes. */
export function phpVersion(headers) {
  const version = (headers.get("x-powered-by") ?? "").match(/PHP\/(\d+)\.(\d+)/i);
  return version ? { version: `${version[1]}.${version[2]}`, outdated: Number(version[1]) * 100 + Number(version[2]) < 802 } : null;
}

function securityChecks(result) {
  const { headers } = result;
  const php = phpVersion(headers);
  const framing = headers.has("x-frame-options") || /frame-ancestors/i.test(headers.get("content-security-policy") ?? "");
  return [
    check("Veiligheid", "HTTPS", result.url.startsWith("https:") ? "ok" : "bad", result.url.startsWith("https:") ? "ja" : "nee: browsers tonen 'niet veilig'"),
    ...SECURITY_HEADERS.map(([name, label, why]) => check("Veiligheid", label, headers.has(name) ? "ok" : "warn", headers.has(name) ? "aanwezig" : `ontbreekt (${why})`)),
    check("Veiligheid", "Clickjacking", framing ? "ok" : "warn", framing ? "beschermd" : "geen X-Frame-Options of frame-ancestors"),
    ...(php ? [check("Veiligheid", "PHP-versie", php.outdated ? "bad" : "info", php.outdated ? `PHP ${php.version} krijgt geen beveiligingsupdates meer` : `PHP ${php.version} (zichtbaar in X-Powered-By)`)] : []),
  ];
}

function speedChecks(result) {
  const kb = Math.round(result.bytes / 1024);
  const compressed = /gzip|br|zstd|deflate/i.test(result.headers.get("content-encoding") ?? "");
  return [
    check("Snelheid", "Laadtijd HTML", result.ms < 800 ? "ok" : result.ms < 2000 ? "warn" : "bad", `${result.ms} ms vanaf onze server`),
    check("Snelheid", "Grootte HTML", kb < 200 ? "ok" : "warn", `${kb} kB`),
    check("Snelheid", "Compressie", compressed ? "ok" : "warn", compressed ? result.headers.get("content-encoding") : "geen gzip/brotli"),
    check("Snelheid", "Redirects", result.redirects <= 1 ? "ok" : "warn", `${result.redirects}`),
  ];
}

// --- CMS detection -------------------------------------------------------------------------------

// [name, kind, test(html, headers)] - the first match per name wins.
const SIGNATURES = [
  ["WordPress", "cms", (h) => /\/wp-content\/|\/wp-includes\//i.test(h)],
  ["WooCommerce", "webshop", (h) => /woocommerce/i.test(h)],
  ["Magento 2", "webshop", (h, hd) => /Magento_|mage\/cookies|static\/version\d+/i.test(h) || hd.has("x-magento-tags")],
  ["Magento 1", "webshop", (h) => /Mage\.Cookies|skin\/frontend\//i.test(h)],
  ["Shopify", "webshop", (h, hd) => /cdn\.shopify\.com/i.test(h) || hd.has("x-shopid")],
  ["Lightspeed", "webshop", (h) => /shoplightspeed\.com/i.test(h)],
  ["PrestaShop", "webshop", (h) => /prestashop/i.test(h)],
  ["CCV Shop", "webshop", (h) => /ccvshop/i.test(h)],
  ["Drupal", "cms", (h) => /\/sites\/default\/files|Drupal\.settings/i.test(h)],
  ["Joomla", "cms", (h) => /\/media\/jui\/|com_content/i.test(h)],
  ["Wix", "sitebouwer", (h) => /static\.parastorage\.com|wix\.com/i.test(h)],
  ["Squarespace", "sitebouwer", (h) => /static1\.squarespace\.com/i.test(h)],
  ["Webflow", "sitebouwer", (h) => /data-wf-site/i.test(h)],
  ["Next.js", "framework", (h) => /__NEXT_DATA__|\/_next\/static/i.test(h)],
  ["Nuxt", "framework", (h) => /__NUXT__|\/_nuxt\//i.test(h)],
  ["Laravel", "framework", (h, hd) => /laravel_session/i.test(hd.get("set-cookie") ?? "")],
  ["Cloudflare", "hosting", (h, hd) => /cloudflare/i.test(hd.get("server") ?? "")],
  ["Vercel", "hosting", (h, hd) => hd.has("x-vercel-id")],
];

export function detectCms(html, headers, generator = "") {
  const found = SIGNATURES.filter(([, , test]) => test(html, headers)).map(([name, kind]) => ({ name, kind, version: "" }));
  const [, genName, genVersion] = generator.match(/^([A-Za-z][\w .-]*?)\s+v?(\d[\w.]*)/) ?? [];
  const named = genName && found.find((f) => genName.toLowerCase().startsWith(f.name.toLowerCase().split(" ")[0]));
  if (named) named.version = genVersion;
  else if (genName) found.unshift({ name: genName, kind: "cms", version: genVersion ?? "" });
  const php = phpVersion(headers);
  if (php) found.push({ name: "PHP", kind: "server", version: php.version });
  return found;
}

/** Everything the three site tools show, from one fetch. */
export async function analyzeSite(input) {
  const result = await safeFetch(input);
  const page = parsePage(result.html);
  const absolute = (href) => { try { return href ? new URL(href, result.url).href : ""; } catch { return ""; } };
  return {
    url: result.url,
    status: result.status,
    checks: [...seoChecks(page), ...securityChecks(result), ...speedChecks(result)],
    cms: detectCms(result.html, result.headers, page.generator),
    preview: {
      title: page.og.title || page.title,
      description: page.og.description || page.description,
      image: absolute(page.og.image),
      siteName: page.og.site_name || new URL(result.url).hostname.replace(/^www\./, ""),
      domain: new URL(result.url).hostname.replace(/^www\./, ""),
      hasOg: Boolean(page.og.title || page.og.image),
      twitterCard: page.twitterCard,
    },
  };
}
