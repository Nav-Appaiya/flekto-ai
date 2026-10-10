import assert from "node:assert/strict";
import { keywords, matchArticles, parseArticles, parseTrends } from "./trends.js";

const trendsXml = `<rss><channel><title>Daily</title>
<item><title>Feyenoord - AZ</title><ht:approx_traffic>5000+</ht:approx_traffic><pubDate>Sat, 10 Oct 2026 09:10:00 -0700</pubDate>
<ht:picture>https://img/1</ht:picture>
<ht:news_item><ht:news_item_title>Feyenoord &amp; AZ spelen gelijk</ht:news_item_title><ht:news_item_url>https://x/1</ht:news_item_url><ht:news_item_source>VI</ht:news_item_source></ht:news_item>
</item></channel></rss>`;
const [trend] = parseTrends(trendsXml);
assert.equal(trend.title, "Feyenoord - AZ");
assert.equal(trend.traffic, "5000+");
assert.deepEqual(trend.news, [{ title: "Feyenoord & AZ spelen gelijk", url: "https://x/1", source: "VI" }]);

const articles = parseArticles(`<rss><item><title><![CDATA[Feyenoord wint ruim van AZ]]></title><link>https://nu/1</link><pubDate>Sat, 10 Oct 2026 18:00:00 +0200</pubDate></item>
<item><title>Kabinet valt</title><link>https://nu/2</link><pubDate>Sat, 10 Oct 2026 17:00:00 +0200</pubDate></item></rss>`, "NU.nl");
assert.equal(articles[0].title, "Feyenoord wint ruim van AZ");
assert.equal(articles[0].date, "2026-10-10T16:00:00.000Z");

assert.deepEqual(keywords("Śląsk Wrocław – de Lech"), ["slask", "wrocław".normalize("NFD").replace(/\p{Diacritic}/gu, ""), "lech"]);
assert.deepEqual(matchArticles("feyenoord - az", articles).map((a) => a.url), ["https://nu/1"]); // "az" too short: 1 keyword
assert.deepEqual(matchArticles("kabinet schoof", articles).map((a) => a.url), ["https://nu/2"]); // 1 of 2 words is enough
assert.deepEqual(matchArticles("schoof premier spreekt", articles), []); // needs 2 of 3
assert.deepEqual(matchArticles("az", articles), []); // no usable keywords
assert.deepEqual(matchArticles("kabinet", articles).map((a) => a.url), ["https://nu/2"]);
const evil = parseArticles(`<rss><item><title>x</title><link>javascript:alert(1)</link><pubDate>Sat, 10 Oct 2026 18:00:00 +0200</pubDate></item></rss>`, "X");
assert.deepEqual(evil, []); // non-web links are dropped
console.log("ok");
