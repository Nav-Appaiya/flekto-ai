// What the Netherlands is searching for right now (Google Trends), with background from Dutch news feeds.

// Sport and entertainment feeds matter: that's where most search spikes come from.
export const NEWS_FEEDS = [
  { source: "NU.nl", url: "https://www.nu.nl/rss/Algemeen" },
  { source: "NU.nl", url: "https://www.nu.nl/rss/Sport" },
  { source: "NU.nl", url: "https://www.nu.nl/rss/Entertainment" },
  { source: "AD", url: "https://www.ad.nl/home/rss.xml" },
  { source: "AD", url: "https://www.ad.nl/sport/rss.xml" },
  { source: "NOS", url: "https://feeds.nos.nl/nosnieuwsalgemeen" },
  { source: "NOS", url: "https://feeds.nos.nl/nosnieuwsbinnenland" },
  { source: "NOS", url: "https://feeds.nos.nl/nossportalgemeen" },
];
const TRENDS_URL = "https://trends.google.com/trending/rss?geo=NL";

const STOPWORDS = new Set("de het een en van voor met op in aan uit bij naar over door als ook niet the and for vs".split(" "));
const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

const decode = (s) => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&(\w+);/g, (m, name) => ENTITIES[name] ?? m)
  .trim();

/** Text of the first <name> element in an XML fragment ("" if absent). Good enough for these known feeds. */
function tag(xml, name) {
  const match = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`));
  return match ? decode(match[1]) : "";
}

// Feed URLs end up in href/src attributes: only plain web links, never javascript: or data: URLs.
const isWebUrl = (url) => /^https?:\/\//i.test(url);

const uniqueByUrl = (items) => [...new Map(items.map((i) => [i.url, i])).values()];

const blocks = (xml, name) => xml.match(new RegExp(`<${name}>[\\s\\S]*?</${name}>`, "g")) ?? [];

/** Lowercase words without accents, minus stopwords and very short words. */
export function keywords(text) {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()
    .split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

export function parseArticles(xml, source) {
  return blocks(xml, "item").map((item) => ({
    title: tag(item, "title"), url: tag(item, "link"), source, date: new Date(tag(item, "pubDate")).toISOString(),
  })).filter((a) => isWebUrl(a.url));
}

export function parseTrends(xml) {
  return blocks(xml, "item").map((item) => ({
    title: tag(item, "title"),
    traffic: tag(item, "ht:approx_traffic"),
    startedAt: new Date(tag(item, "pubDate")).toISOString(),
    picture: isWebUrl(tag(item, "ht:picture")) ? tag(item, "ht:picture") : null,
    news: blocks(item, "ht:news_item").map((n) => ({
      title: tag(n, "ht:news_item_title"), url: tag(n, "ht:news_item_url"), source: tag(n, "ht:news_item_source"),
    })).filter((n) => isWebUrl(n.url)),
  }));
}

/** Articles whose title contains at least half of the trend's keywords, best matches first. */
export function matchArticles(trendTitle, articles) {
  const wanted = keywords(trendTitle);
  const needed = Math.ceil(wanted.length / 2);
  return articles
    .map((article) => {
      const words = new Set(keywords(article.title));
      return { article, score: wanted.filter((w) => words.has(w)).length };
    })
    .filter((m) => needed > 0 && m.score >= needed)
    .sort((a, b) => b.score - a.score)
    .map((m) => m.article);
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (flekto.nl viral-radar)" } });
  if (!res.ok) throw new Error(`${url} ${res.status}`);
  return res.text();
}

/** One failing feed shouldn't empty the page, so news feeds are fetched independently. */
async function fetchArticles() {
  const results = await Promise.allSettled(NEWS_FEEDS.map(async (f) => parseArticles(await fetchText(f.url), f.source)));
  return uniqueByUrl(results.flatMap((r) => (r.status === "fulfilled" ? r.value : [])))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function fetchViral() {
  const [trends, articles] = await Promise.all([fetchText(TRENDS_URL).then(parseTrends), fetchArticles()]);
  return {
    updatedAt: new Date().toISOString(),
    // Google's own news links per trend (most relevant), topped up with matching headlines from the Dutch feeds.
    trends: trends.map(({ news, ...t }) => ({ ...t, background: uniqueByUrl([...news, ...matchArticles(t.title, articles)]).slice(0, 5) })),
    latest: articles.slice(0, 15),
  };
}
