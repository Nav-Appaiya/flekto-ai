// Supabase RPC calls; the worker-only functions check WORKER_SECRET themselves.

export async function rpc(env, fn, args) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: env.SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ p_secret: env.WORKER_SECRET, ...args }),
  });
  if (!res.ok) throw new Error(`${fn}: ${res.status} ${await res.text()}`);
  return res.json();
}

/** Quota is tracked per sender without storing addresses. */
export async function senderHash(address) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(address.toLowerCase()));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
