// Calls the Postgres functions in the flekto-tools Supabase project (tables themselves are not exposed).

export class DbError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function rpc(fn, args = {}) {
  const res = await fetch(`${import.meta.env.SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: import.meta.env.SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new DbError(body?.message ?? `db ${res.status}`, res.status);
  return body;
}
