import { rpc } from "../../../../lib/db.js";
import { json } from "../../../../lib/http.js";

export const prerender = false;

const MAX_BODY = 64 * 1024;
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "*" };
// Platform headers say nothing about what the caller sent.
const isPlatformHeader = (name) => /^(x-vercel-|x-forwarded-|x-real-ip$|forwarded$)/.test(name);

// A browser opening the bin URL on our own site would attach its flekto.nl cookies; those must never be stored.
const isOwnCookie = (name, request) => name === "cookie" && request.headers.get("sec-fetch-site") === "same-origin";

function describe(request, path) {
  const url = new URL(request.url);
  const headers = Object.fromEntries([...request.headers]
    .filter(([name]) => !isPlatformHeader(name) && !isOwnCookie(name, request)));
  return { method: request.method, path: `/${path ?? ""}`, query: Object.fromEntries(url.searchParams), headers };
}

/** Catches any request to /api/bin/<id>/<anything> and stores it for the request-bin viewer. */
export async function ALL({ request, params, clientAddress }) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  const req = describe(request, params.path);
  const body = (await request.text()).slice(0, MAX_BODY);
  try {
    await rpc("capture_request", {
      p_bin: params.id, p_method: req.method, p_path: req.path, p_query: req.query,
      p_headers: req.headers, p_body: body, p_ip: clientAddress,
    });
    return json({ ok: true, captured: `${req.method} ${req.path}` }, 200, CORS);
  } catch (err) {
    const status = err.message === "bin_not_found" ? 404 : err.message === "bin_full" ? 429 : 502;
    return json({ ok: false, error: err.message }, status, CORS);
  }
}
