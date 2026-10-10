import assert from "node:assert/strict";
import { cheapestWindow } from "./stroom.js";

const t0 = new Date("2026-10-10T00:00:00Z");
const prices = [5, 1, 1, 9, 0, 0, 0, 8].map((price, h) => ({ time: new Date(t0.getTime() + h * 3600_000), price }));

assert.deepEqual(cheapestWindow(prices, 2, t0), { start: 4, avg: 0 });
assert.equal(cheapestWindow(prices, 3, t0).start, 4);
// window may start in the current (partial) hour, but never before it
assert.equal(cheapestWindow(prices, 1, new Date("2026-10-10T05:30:00Z")).start, 5);
assert.equal(cheapestWindow(prices, 2, new Date("2026-10-10T07:00:00Z")), null);
console.log("ok");
