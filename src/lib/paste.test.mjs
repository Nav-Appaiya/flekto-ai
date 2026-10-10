import assert from "node:assert/strict";
import { isValidTtl, sniffImage } from "./paste.js";

const bytes = (...b) => new Uint8Array([...b, ...new Array(12).fill(0)]);
assert.equal(sniffImage(bytes(0x89, 0x50, 0x4e, 0x47)), "image/png");
assert.equal(sniffImage(bytes(0xff, 0xd8, 0xff, 0xe0)), "image/jpeg");
assert.equal(sniffImage(bytes(0x47, 0x49, 0x46, 0x38)), "image/gif");
assert.equal(sniffImage(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 ")), "image/webp");
assert.equal(sniffImage(new TextEncoder().encode("<svg onload=alert(1)>")), null);
assert.equal(sniffImage(new TextEncoder().encode("<html>")), null);
assert.ok(isValidTtl(60) && !isValidTtl(61));
console.log("ok");
