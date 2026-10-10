import assert from "node:assert/strict";
import { generateIdeas, parseRedditAtom, rng, showHnName } from "./ideas.js";

assert.equal(showHnName("Show HN: Bigwords.page – Turn any screen into a sign"), "Bigwords.page");
assert.equal(showHnName("Show HN: Fluxer: open-source Discord"), "Fluxer");
assert.equal(showHnName("Show HN: The rarest tech books and docs you've probably never read"), undefined);

const atom = `<feed><entry><category term="x" label="r/x"/><title>I made $1k/mo with &amp; templates</title><link href="https://www.reddit.com/r/x/1/" /></entry>
<entry><title></title><link href="https://x" /></entry></feed>`;
assert.deepEqual(parseRedditAtom(atom), [{ title: "I made $1k/mo with & templates", url: "https://www.reddit.com/r/x/1/", source: "r/x" }]);

const a = rng("2026-10-10"), b = rng("2026-10-10");
assert.equal(a(), b());
assert.notEqual(rng("x")(), rng("y")());

const signals = [{ topic: "htmx", title: "t1", url: "u1", source: "GitHub" }, { topic: "bun", title: "t2", url: "u2", source: "dev.to" }];
const dev = generateIdeas("dev", signals, "day", 6);
assert.equal(dev.length, 6);
assert.deepEqual(generateIdeas("dev", signals, "day", 6), dev); // same seed, same ideas
assert.ok(dev.every((i) => /htmx|bun/.test(i.title) && i.inspiration.length));
assert.equal(new Set(dev.map((i) => i.title)).size, 6);
assert.deepEqual(generateIdeas("dev", [{ title: "no topic", url: "u", source: "r/webdev" }], "x"), []);

const income = generateIdeas("income", [], "day", 4);
assert.equal(income.length, 4);
assert.ok(income.every((i) => i.steps.length && i.facts.length === 4 && !i.inspiration.length));
console.log("ok");
