import assert from "node:assert/strict";
import { hasRemoteImages, htmlMailDocument } from "./mailview.js";

const doc = htmlMailDocument("<p>Hoi</p>");
assert.match(doc, /img-src data: cid:;/);
assert.ok(!doc.includes("https:;"));
assert.match(htmlMailDocument("<p>Hoi</p>", { loadRemoteImages: true }), /img-src data: cid: https:;/);
assert.match(doc, /<body><p>Hoi<\/p><\/body>/);
assert.ok(hasRemoteImages('<img src="https://t.example/p.gif">'));
assert.ok(!hasRemoteImages('<img src="cid:logo">'));
console.log("ok");
