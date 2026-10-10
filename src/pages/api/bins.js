import { rpc } from "../../lib/db.js";
import { json } from "../../lib/http.js";

export const prerender = false;

export async function POST() {
  return json({ id: await rpc("create_bin") }, 201);
}
