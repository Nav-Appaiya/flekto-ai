// Payload formats that phone cameras understand.

/** Backslash-escape the characters the WIFI: format reserves. */
const escapeWifi = (s) => s.replace(/([\\;,:"])/g, "\\$1");

/** Joining a network by scanning: WIFI:T:WPA;S:<ssid>;P:<password>;H:true;; */
export function wifiPayload({ ssid, password = "", security = "WPA", hidden = false }) {
  const parts = [`T:${security}`, `S:${escapeWifi(ssid)}`];
  if (security !== "nopass") parts.push(`P:${escapeWifi(password)}`);
  if (hidden) parts.push("H:true");
  return `WIFI:${parts.join(";")};;`;
}
