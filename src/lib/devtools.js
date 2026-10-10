// Small developer utilities. Every mode is a pure function input -> string (or Promise<string>); errors throw.

const pretty = (v) => JSON.stringify(v, null, 2);
const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

// --- JSON -> TypeScript ---------------------------------------------------------------------------

const pascal = (s) => s.replace(/(^|[^a-zA-Z0-9]+)([a-zA-Z0-9])/g, (_, __, c) => c.toUpperCase()).replace(/^\d/, "_$&") || "Item";
const propKey = (k) => (/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k));
const singular = (name) => (name.endsWith("s") && name.length > 1 ? name.slice(0, -1) : `${name}Item`);

/** Union type of every value seen at one position; objects seen there are merged into one interface. */
function typeOf(values, name, out) {
  const parts = new Set();
  for (const v of values) if (v === null) parts.add("null"); else if (typeof v !== "object") parts.add(typeof v);
  const objects = values.filter(isObject);
  if (objects.length) parts.add(declare(objects, name, out));
  const arrays = values.filter(Array.isArray);
  if (arrays.length) {
    const inner = typeOf(arrays.flat(), singular(name), out);
    parts.add(inner.includes("|") ? `(${inner})[]` : `${inner}[]`);
  }
  return [...parts].join(" | ") || "unknown";
}

function declare(objects, name, out) {
  let unique = name;
  for (let i = 2; out.has(unique); i++) unique = `${name}${i}`;
  out.set(unique, ""); // reserve before recursing so children can't take the name
  const keys = [...new Set(objects.flatMap(Object.keys))];
  const lines = keys.map((k) => {
    const having = objects.filter((o) => k in o);
    return `  ${propKey(k)}${having.length < objects.length ? "?" : ""}: ${typeOf(having.map((o) => o[k]), pascal(k), out)};`;
  });
  out.set(unique, `export interface ${unique} {\n${lines.join("\n")}\n}`);
  return unique;
}

export function jsonToTs(input) {
  const out = new Map();
  const root = typeOf([JSON.parse(input)], "Root", out);
  const decls = [...out.values()];
  return out.has(root) ? decls.join("\n\n") : [`export type Root = ${root};`, ...decls].join("\n\n");
}

// --- CSV ------------------------------------------------------------------------------------------

const csvCell = (v) => {
  const s = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function jsonToCsv(input) {
  const data = JSON.parse(input);
  const rows = (Array.isArray(data) ? data : [data]).map((r) => (isObject(r) ? r : { value: r }));
  const keys = [...new Set(rows.flatMap(Object.keys))];
  return [keys.map(csvCell).join(","), ...rows.map((r) => keys.map((k) => csvCell(r[k])).join(","))].join("\n");
}

/** RFC 4180 with quoted fields. Picks `;` when the header has more of those than commas (Dutch Excel). */
export function parseCsv(text) {
  const firstLine = text.split("\n", 1)[0];
  const sep = (firstLine.match(/;/g) ?? []).length > (firstLine.match(/,/g) ?? []).length ? ";" : ",";
  const rows = [[]];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) { rows.at(-1).push(field); field = ""; }
    else if (c === "\n") { rows.at(-1).push(field); field = ""; rows.push([]); }
    else if (c !== "\r") field += c;
  }
  rows.at(-1).push(field);
  return rows.filter((r) => r.some((f) => f !== ""));
}

export function csvToJson(input) {
  const [header, ...rows] = parseCsv(input);
  if (!header) throw new Error("Geen CSV gevonden");
  return pretty(rows.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""]))));
}

// --- YAML -----------------------------------------------------------------------------------------

const yamlNeedsQuotes = (s) => s === "" || s !== s.trim() || /^[-?:,[\]{}#&*!|>'"%@`]|[:#]\s|:$|\n/.test(s)
  || /^(true|false|null|yes|no|on|off|~)$/i.test(s) || !Number.isNaN(Number(s)) || /^[\d:._+-]+$/.test(s); // numbers, and YAML 1.1 base-60 like 80:80
const yamlScalar = (v) => (typeof v === "string" ? (yamlNeedsQuotes(v) ? JSON.stringify(v) : v) : String(v));
const hasChildren = (v) => v !== null && typeof v === "object" && Object.keys(v).length > 0;

function toYaml(v, indent) {
  if (Array.isArray(v)) {
    if (!v.length) return " []";
    // "- " is two wide, so children indent by two and the first line moves up next to the dash.
    return v.map((x) => `\n${indent}- ${toYaml(x, indent + "  ").trimStart()}`).join("");
  }
  if (isObject(v)) {
    if (!hasChildren(v)) return " {}";
    return Object.entries(v).map(([k, x]) => `\n${indent}${yamlNeedsQuotes(k) ? JSON.stringify(k) : k}:${hasChildren(x) ? toYaml(x, indent + "  ") : toYaml(x, indent)}`).join("");
  }
  return ` ${v === null ? "null" : yamlScalar(v)}`;
}

export const jsonToYaml = (input) => toYaml(JSON.parse(input), "").trim();

// --- Encoding -------------------------------------------------------------------------------------

export function base64Encode(input) {
  let binary = "";
  for (const byte of new TextEncoder().encode(input)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** Accepts standard and URL-safe base64, with or without padding. */
export function base64Decode(input) {
  const b64 = input.trim().replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, "="));
  return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

export function decodeJwt(input) {
  const parts = input.trim().replace(/^Bearer\s+/i, "").split(".");
  if (parts.length !== 3) throw new Error("Een JWT bestaat uit drie delen gescheiden door punten");
  const [header, payload] = parts.slice(0, 2).map((p) => JSON.parse(base64Decode(p)));
  const times = ["iat", "nbf", "exp"].filter((k) => typeof payload[k] === "number")
    .map((k) => `${k}: ${new Date(payload[k] * 1000).toISOString()}`);
  if (typeof payload.exp === "number") times.push(payload.exp * 1000 < Date.now() ? "⚠️ Verlopen" : "✅ Nog geldig");
  return [`// Header\n${pretty(header)}`, `// Payload\n${pretty(payload)}`, times.join("\n"),
    "// Handtekening is niet gecontroleerd: daarvoor heb je de sleutel nodig."].filter(Boolean).join("\n\n");
}

/** Query string (or full URL) to an object; repeated keys become arrays. */
export function parseQuery(input) {
  const s = input.trim();
  const params = /^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? new URL(s).searchParams : new URLSearchParams(s.replace(/^[^?]*\?/, ""));
  const result = {};
  for (const [k, v] of params) result[k] = k in result ? [].concat(result[k], v) : v;
  return pretty(result);
}

// --- Time, ids, hashes ----------------------------------------------------------------------------

const relative = new Intl.RelativeTimeFormat("nl", { numeric: "auto" });
const UNITS = [["year", 31536e6], ["month", 2592e6], ["day", 864e5], ["hour", 36e5], ["minute", 6e4], ["second", 1e3]];

export function fromNow(ms, now = Date.now()) {
  const diff = ms - now;
  const [unit, size] = UNITS.find(([, size]) => Math.abs(diff) >= size) ?? UNITS.at(-1);
  return relative.format(Math.round(diff / size), unit);
}

/** Unix seconds, unix milliseconds (13+ digits) or any date string; empty means now. */
export function convertTimestamp(input) {
  const s = input.trim();
  const ms = !s ? Date.now() : /^-?\d+(\.\d+)?$/.test(s) ? Number(s) * (s.replace(/^-/, "").split(".")[0].length >= 13 ? 1 : 1000) : Date.parse(s);
  if (Number.isNaN(ms)) throw new Error("Onbekend datumformaat");
  const d = new Date(ms);
  return [
    `Unix (s)   ${Math.floor(ms / 1000)}`,
    `Unix (ms)  ${ms}`,
    `ISO 8601   ${d.toISOString()}`,
    `Nederland  ${d.toLocaleString("nl-NL", { timeZone: "Europe/Amsterdam", dateStyle: "full", timeStyle: "medium" })}`,
    `Relatief   ${fromNow(ms)}`,
  ].join("\n");
}

const hex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");

export async function hashes(input) {
  const data = new TextEncoder().encode(input);
  const rows = await Promise.all(["SHA-1", "SHA-256", "SHA-384", "SHA-512"].map(async (alg) =>
    `${alg.padEnd(8)} ${hex(new Uint8Array(await crypto.subtle.digest(alg, data)))}`));
  return rows.join("\n");
}

/** Version 7: 48-bit millisecond timestamp up front, so ids sort by creation time (good for DB keys). */
export function uuidv7(now = Date.now()) {
  const b = crypto.getRandomValues(new Uint8Array(16));
  for (let i = 5, t = now; i >= 0; i--, t = Math.floor(t / 256)) b[i] = t % 256;
  b[6] = (b[6] & 0x0f) | 0x70;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = hex(b);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const many = (make) => (input) => Array.from({ length: Math.min(Math.max(parseInt(input, 10) || 5, 1), 1000) }, make).join("\n");

// --- cURL -> fetch --------------------------------------------------------------------------------

/** Splits a shell command into words, honouring quotes and line continuations. */
export function shellWords(s) {
  const words = [];
  let cur = null;
  let quote = null;
  const text = s.replace(/\\\r?\n/g, " ");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === quote) quote = null;
      else if (c === "\\" && quote === '"' && /["\\$`]/.test(text[i + 1])) cur += text[++i];
      else cur += c;
    } else if (c === "'" || c === '"') { quote = c; cur ??= ""; }
    else if (/\s/.test(c)) { if (cur !== null) words.push(cur); cur = null; }
    else if (c === "\\") cur = (cur ?? "") + (text[++i] ?? "");
    else cur = (cur ?? "") + c;
  }
  if (quote) throw new Error("Aanhalingsteken niet afgesloten");
  if (cur !== null) words.push(cur);
  return words;
}

const setHeader = (name) => (req, value) => { req.headers[name] = value; };
const addData = (req, value) => { req.data.push(value); };
const ignore = () => {};

/** curl options that take a value, and what each does to the request. */
const CURL_FLAGS = {
  "-X": (req, value) => { req.method = value; },
  "-H": (req, value) => {
    const [name, ...rest] = value.split(":");
    req.headers[name.trim()] = rest.join(":").trim();
  },
  "-d": addData, "--data-raw": addData, "--data-binary": addData, "--data-ascii": addData,
  "--json": (req, value) => {
    req.headers["Content-Type"] ??= "application/json";
    req.headers.Accept ??= "application/json";
    req.data.push(value);
  },
  "-u": (req, value) => { req.headers.Authorization = `Basic ${base64Encode(value)}`; },
  "-A": setHeader("User-Agent"),
  "-b": setHeader("Cookie"),
  "-o": ignore, "-m": ignore, "-w": ignore, "-e": ignore, "--connect-timeout": ignore,
};
const LONG_NAMES = { "--request": "-X", "--header": "-H", "--data": "-d", "--user": "-u", "--user-agent": "-A",
  "--cookie": "-b", "--output": "-o", "--max-time": "-m", "--write-out": "-w", "--referer": "-e" };

export function parseCurl(input) {
  const words = shellWords(input.trim());
  const req = { url: "", method: "", headers: {}, data: [] };
  for (let i = words[0] === "curl" ? 1 : 0; i < words.length; i++) {
    const word = words[i];
    const apply = CURL_FLAGS[LONG_NAMES[word] ?? word];
    if (apply) apply(req, words[++i] ?? "");
    else if (/^-X\w+$/.test(word)) req.method = word.slice(2);
    else if (word === "-I" || word === "--head") req.method = "HEAD";
    else if (!word.startsWith("-")) req.url ||= word;
  }
  if (!req.url) throw new Error("Geen URL gevonden");
  return req;
}

function fetchCode({ url, method, headers, data }) {
  const verb = (method || (data.length ? "POST" : "GET")).toUpperCase();
  const hasType = Object.keys(headers).some((h) => h.toLowerCase() === "content-type");
  const allHeaders = data.length && !hasType ? { ...headers, "Content-Type": "application/x-www-form-urlencoded" } : headers;
  const options = [
    verb !== "GET" && `  method: ${JSON.stringify(verb)},`,
    Object.keys(allHeaders).length && `  headers: ${JSON.stringify(allHeaders, null, 2).replace(/\n/g, "\n  ")},`,
    data.length && `  body: ${JSON.stringify(data.join("&"))},`,
  ].filter(Boolean);
  const init = options.length ? `, {\n${options.join("\n")}\n}` : "";
  return `const res = await fetch(${JSON.stringify(url)}${init});\nconst data = await res.json();`;
}

export const curlToFetch = (input) => fetchCode(parseCurl(input));

// --- HTTP status codes ----------------------------------------------------------------------------

export const STATUS = {
  100: "Continue: ga door met het versturen van de body.", 101: "Switching Protocols: bijvoorbeeld naar WebSocket.",
  200: "OK: gelukt.", 201: "Created: resource aangemaakt, vaak met Location-header.", 202: "Accepted: ontvangen, wordt later verwerkt.",
  204: "No Content: gelukt, geen body.", 206: "Partial Content: antwoord op een Range-verzoek.",
  301: "Moved Permanently: permanent verhuisd; zoekmachines volgen mee.", 302: "Found: tijdelijke redirect.",
  303: "See Other: ga met GET naar een andere URL (na een POST).", 304: "Not Modified: gebruik je cache (ETag / If-Modified-Since).",
  307: "Temporary Redirect: als 302, maar methode en body blijven gelijk.", 308: "Permanent Redirect: als 301, maar methode en body blijven gelijk.",
  400: "Bad Request: ongeldige syntax of validatiefout.", 401: "Unauthorized: niet ingelogd of token ontbreekt/ongeldig.",
  402: "Payment Required: betaling vereist.", 403: "Forbidden: ingelogd, maar geen toegang.", 404: "Not Found: bestaat niet.",
  405: "Method Not Allowed: deze HTTP-methode mag hier niet; zie de Allow-header.", 406: "Not Acceptable: geen formaat dat bij je Accept-header past.",
  408: "Request Timeout: de client was te traag.", 409: "Conflict: botst met de huidige staat (bijv. dubbele invoer of versieconflict).",
  410: "Gone: bestond, maar is definitief weg.", 412: "Precondition Failed: If-Match / If-Unmodified-Since klopt niet.",
  413: "Content Too Large: body te groot.", 414: "URI Too Long: URL te lang.", 415: "Unsupported Media Type: verkeerde Content-Type.",
  418: "I'm a teapot: grap uit RFC 2324.", 422: "Unprocessable Content: syntax klopt, inhoud niet (validatiefout).",
  425: "Too Early: replay-risico bij TLS early data.", 428: "Precondition Required: stuur If-Match mee.",
  429: "Too Many Requests: rate limit; kijk naar Retry-After.", 431: "Request Header Fields Too Large: headers (vaak cookies) te groot.",
  451: "Unavailable For Legal Reasons: om juridische redenen geblokkeerd.",
  500: "Internal Server Error: er ging iets mis op de server.", 501: "Not Implemented: de server kent deze methode niet.",
  502: "Bad Gateway: de proxy kreeg een ongeldig antwoord van upstream.", 503: "Service Unavailable: overbelast of onderhoud; kijk naar Retry-After.",
  504: "Gateway Timeout: upstream reageerde niet op tijd.", 507: "Insufficient Storage: opslag vol.", 511: "Network Authentication Required: captive portal (wifi-login).",
};

export function lookupStatus(input) {
  const q = input.trim().toLowerCase();
  const rows = Object.entries(STATUS).filter(([code, text]) => !q || code.startsWith(q) || text.toLowerCase().includes(q));
  if (!rows.length) throw new Error("Geen statuscode gevonden");
  return rows.map(([code, text]) => `${code}  ${text}`).join("\n");
}

// --- Registry -------------------------------------------------------------------------------------

export const DEV_TOOLS = [
  { slug: "json-formatter", name: "JSON formatter", emoji: "🧹", blurb: "Valideer, formatteer of minify JSON, met de foutpositie als het niet klopt.",
    placeholder: '{"naam":"Flekto","tools":[1,2,3]}',
    modes: [{ label: "Formatteer", run: (s) => pretty(JSON.parse(s)) }, { label: "Minify", run: (s) => JSON.stringify(JSON.parse(s)) },
      { label: "Sorteer keys", run: (s) => pretty(JSON.parse(s, (_, v) => (isObject(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v))) }] },
  { slug: "json-naar-typescript", name: "JSON → TypeScript", emoji: "🔷", blurb: "Plak een API-response en krijg direct TypeScript-interfaces, met optionele velden.",
    placeholder: '{"id":1,"user":{"name":"Ada","tags":["admin"]},"items":[{"sku":"A1"},{"sku":"B2","qty":2}]}',
    modes: [{ label: "Genereer types", run: jsonToTs }] },
  { slug: "json-csv", name: "JSON ⇄ CSV", emoji: "📊", blurb: "Zet een JSON-array om naar CSV voor Excel, of andersom. Snapt ook ; als scheidingsteken.",
    placeholder: '[{"naam":"Ada","stad":"Utrecht"},{"naam":"Linus","stad":"Delft"}]',
    modes: [{ label: "JSON → CSV", run: jsonToCsv }, { label: "CSV → JSON", run: csvToJson }] },
  { slug: "json-naar-yaml", name: "JSON → YAML", emoji: "📄", blurb: "Zet JSON om naar YAML voor Docker Compose, Kubernetes of GitHub Actions.",
    placeholder: '{"services":{"web":{"image":"nginx","ports":["80:80"]}}}',
    modes: [{ label: "Naar YAML", run: jsonToYaml }] },
  { slug: "jwt-decoder", name: "JWT decoder", emoji: "🔑", blurb: "Bekijk header en payload van een JWT, met leesbare iat/exp en of hij verlopen is.",
    placeholder: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMiLCJleHAiOjE5MDAwMDAwMDB9.sig",
    modes: [{ label: "Decodeer", run: decodeJwt }] },
  { slug: "base64", name: "Base64", emoji: "🔤", blurb: "Base64 coderen en decoderen, UTF-8-veilig en met ondersteuning voor base64url.",
    placeholder: "Hallo wereld 👋",
    modes: [{ label: "Encode", run: base64Encode }, { label: "Decode", run: base64Decode }] },
  { slug: "url-encoder", name: "URL encoder & query parser", emoji: "🔗", blurb: "Encode/decode URL-componenten of pak een query string uit naar JSON.",
    placeholder: "https://example.com/zoek?q=fiets+huren&tag=a&tag=b",
    modes: [{ label: "Encode", run: encodeURIComponent }, { label: "Decode", run: (s) => decodeURIComponent(s.replace(/\+/g, " ")) }, { label: "Query → JSON", run: parseQuery }] },
  { slug: "unix-timestamp", name: "Unix timestamp", emoji: "⏱️", blurb: "Zet Unix-tijd (s of ms) om naar een datum en andersom, in Nederlandse tijd.",
    placeholder: "1760000000 (leeg = nu)",
    modes: [{ label: "Converteer", run: convertTimestamp }] },
  { slug: "hash-generator", name: "Hash generator", emoji: "#️⃣", blurb: "SHA-1, SHA-256, SHA-384 en SHA-512 van je tekst, berekend in je browser.",
    placeholder: "wachtwoord123",
    modes: [{ label: "Bereken", run: hashes }] },
  { slug: "uuid-generator", name: "UUID generator", emoji: "🆔", blurb: "Genereer UUID v4 of tijd-sorteerbare v7 voor database-keys, tot 1000 tegelijk.",
    placeholder: "Aantal (standaard 5)",
    modes: [{ label: "UUID v4", run: many(() => crypto.randomUUID()) }, { label: "UUID v7", run: many(() => uuidv7()) }] },
  { slug: "curl-naar-fetch", name: "cURL → fetch", emoji: "🌀", blurb: "Plak een cURL-commando uit je docs of DevTools en krijg JavaScript fetch()-code.",
    placeholder: "curl -X POST https://api.example.com/users -H 'Content-Type: application/json' -d '{\"name\":\"Ada\"}'",
    modes: [{ label: "Converteer", run: curlToFetch }] },
  { slug: "http-statuscodes", name: "HTTP statuscodes", emoji: "🚦", blurb: "Wat betekent 409, 422 of 429 ook alweer? Zoek op code of trefwoord.",
    placeholder: "429 of 'redirect' (leeg = alles)",
    modes: [{ label: "Zoek", run: lookupStatus }] },
];
