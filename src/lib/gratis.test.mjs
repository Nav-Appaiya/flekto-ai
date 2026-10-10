import assert from "node:assert/strict";
import { haversineKm, newNearby } from "./gratis.js";

const home = { lat: 52.3788, lon: 4.9001 }; // 1012AB
const item = (id, lat, priceType = "FREE", title = "Bank") =>
  ({ itemId: id, title, vipUrl: `/v/${id}`, priceInfo: { priceType }, location: { latitude: lat, longitude: 4.9001 } });
const listings = [item("a", 52.3788), item("b", 52.40), item("c", 52.38, "FIXED"), item("d", 52.379),
  item("e", 52.3789, "FREE", "Kast"), item("f", 52.3788, "FREE", "Gezocht: fiets"), { ...item("g", 0), location: {} }];

assert.ok(haversineKm(home, { lat: 52.40, lon: 4.9001 }) > 2.3 && haversineKm(home, { lat: 52.40, lon: 4.9001 }) < 2.5);
const ids = (seen, keywords) => newNearby(listings, new Set(seen), { home, radiusKm: 2, keywords }).map((h) => h.id);
assert.deepEqual(ids(["d"]), ["a", "e"]); // b too far, c not free, d seen, f wanted-post, g no coords
assert.deepEqual(ids([], ["kast"]), ["e"]);
assert.equal(newNearby(listings, new Set(), { home, radiusKm: 2 })[0].url, "https://www.marktplaats.nl/v/a");
console.log("ok");
