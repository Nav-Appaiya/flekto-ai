import assert from "node:assert/strict";
import { fitWithin, formatBytes, renamed } from "./image.js";
import { wifiPayload } from "./qr.js";
import { hourlyRate, splitVat } from "./btw.js";

assert.deepEqual(fitWithin(4000, 3000, 1600), { width: 1600, height: 1200 });
assert.deepEqual(fitWithin(800, 600, 1600), { width: 800, height: 600 }); // no upscaling
assert.deepEqual(fitWithin(1000, 3000, 1500), { width: 500, height: 1500 });
assert.equal(formatBytes(2_500_000), "2.4 MB");
assert.equal(renamed("vakantie.foto.HEIC", "image/jpeg"), "vakantie.foto.jpg");
assert.equal(renamed("a.png", "image/webp"), "a.webp");

assert.equal(wifiPayload({ ssid: "Thuis", password: "geheim" }), "WIFI:T:WPA;S:Thuis;P:geheim;;");
assert.equal(wifiPayload({ ssid: 'a;b,c:"d\\', password: "x" }), 'WIFI:T:WPA;S:a\\;b\\,c\\:\\"d\\\\;P:x;;');
assert.equal(wifiPayload({ ssid: "Open", security: "nopass", hidden: true }), "WIFI:T:nopass;S:Open;H:true;;");

assert.deepEqual(splitVat(100, 21, false), { excl: 100, vat: 21, incl: 121 });
assert.deepEqual(splitVat(121, 21, true), { excl: 100, vat: 21, incl: 121 });
assert.deepEqual(splitVat(10.9, 9, true), { excl: 10, vat: 0.9, incl: 10.9 });
assert.deepEqual(splitVat(50, 0, true), { excl: 50, vat: 0, incl: 50 });
assert.deepEqual(hourlyRate({ income: 60000, costs: 12000, weeks: 45, hoursPerWeek: 40, billablePct: 60 }),
  { billableHours: 1080, rate: 66.67 });
assert.equal(hourlyRate({ income: 1, costs: 0, weeks: 0, hoursPerWeek: 40, billablePct: 60 }).rate, 0);
console.log("ok");
