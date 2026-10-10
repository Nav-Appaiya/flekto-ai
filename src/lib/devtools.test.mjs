import assert from "node:assert/strict";
import { base64Decode, base64Encode, convertTimestamp, csvToJson, curlToFetch, decodeJwt, DEV_TOOLS, fromNow, hashes,
  jsonToCsv, jsonToTs, jsonToYaml, lookupStatus, parseQuery, shellWords, uuidv7 } from "./devtools.js";

assert.equal(jsonToTs('{"id":1,"tags":["a"],"items":[{"sku":"A"},{"sku":"B","qty":2}],"x":null}'), `export interface Root {
  id: number;
  tags: string[];
  items: Item[];
  x: null;
}

export interface Item {
  sku: string;
  qty?: number;
}`);
assert.equal(jsonToTs("[1,\"a\"]"), "export type Root = (number | string)[];");
assert.match(jsonToTs('{"a-b":{"c":1},"d":{"c":"x"}}'), /"a-b": AB;[\s\S]*interface D \{\n  c: string;/);

assert.equal(jsonToCsv('[{"a":1,"b":"x,y"},{"a":2,"c":{"n":1}}]'), 'a,b,c\n1,"x,y",\n2,,"{""n"":1}"');
assert.deepEqual(JSON.parse(csvToJson('naam;stad\n"Ada ""A""";Utrecht\r\nLinus;"Delft\nZuid"\n')),
  [{ naam: 'Ada "A"', stad: "Utrecht" }, { naam: "Linus", stad: "Delft\nZuid" }]);

assert.equal(jsonToYaml('{"services":{"web":{"image":"nginx","ports":["80:80"],"env":{}}},"list":[{"a":1,"b":[true,null]},[1,2]],"s":"yes","e":[]}'),
  `services:
  web:
    image: nginx
    ports:
      - "80:80"
    env: {}
list:
  - a: 1
    b:
      - true
      - null
  - - 1
    - 2
s: "yes"
e: []`);

assert.equal(base64Encode("Hallo 👋"), "SGFsbG8g8J+Riw==");
assert.equal(base64Decode("SGFsbG8g8J-Riw"), "Hallo 👋");
const jwt = `${base64Encode('{"alg":"HS256"}')}.${base64Encode('{"sub":"1","exp":1}').replace(/=/g, "")}.sig`;
assert.match(decodeJwt(`Bearer ${jwt}`), /"sub": "1"[\s\S]*exp: 1970-01-01T00:00:01.000Z\n⚠️ Verlopen/);
assert.throws(() => decodeJwt("abc"), /drie delen/);

assert.deepEqual(JSON.parse(parseQuery("https://x.nl/?q=a+b&t=1&t=2")), { q: "a b", t: ["1", "2"] });
assert.deepEqual(JSON.parse(parseQuery("?x=%20y")), { x: " y" });

assert.match(convertTimestamp("1700000000"), /ISO 8601 {3}2023-11-14T22:13:20.000Z/);
assert.match(convertTimestamp("1700000000000"), /Unix \(s\) {3}1700000000/);
assert.match(convertTimestamp("2024-01-01T00:00:00Z"), /Unix \(s\) {3}1704067200/);
assert.throws(() => convertTimestamp("gisteren"));
assert.equal(fromNow(0, 3 * 864e5), "3 dagen geleden");

assert.match(await hashes("abc"), /SHA-256 {2}ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad/);

const v7 = uuidv7(0x0189abcdef01);
assert.match(v7, /^0189abcd-ef01-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
const uuidTool = DEV_TOOLS.find((t) => t.slug === "uuid-generator");
assert.equal(uuidTool.modes[0].run("3").split("\n").length, 3);
assert.equal(uuidTool.modes[1].run("").split("\n").length, 5);

assert.deepEqual(shellWords(`curl 'a b' "c\\"d" e\\ f \\\n -g`), ["curl", "a b", 'c"d', "e f", "-g"]);
assert.equal(curlToFetch(`curl -XPOST https://api.x/u -H 'Content-Type: application/json' -H "Authorization: Bearer t:1" --data-raw '{"n":1}' --compressed`),
  `const res = await fetch("https://api.x/u", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer t:1"
  },
  body: "{\\"n\\":1}",
});
const data = await res.json();`);
assert.equal(curlToFetch("curl https://x.nl"), 'const res = await fetch("https://x.nl");\nconst data = await res.json();');
assert.match(curlToFetch("curl -u ada:pw -d a=1 https://x.nl"), /"Authorization": "Basic YWRhOnB3"[\s\S]*"Content-Type": "application\/x-www-form-urlencoded"[\s\S]*method: "POST"|method: "POST"/);

assert.match(lookupStatus("429"), /^429 {2}Too Many/);
assert.match(lookupStatus("redirect"), /307/);
assert.throws(() => lookupStatus("999"));

assert.equal(new Set(DEV_TOOLS.map((t) => t.slug)).size, 15);
console.log("ok");
