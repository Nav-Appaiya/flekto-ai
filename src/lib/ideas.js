// Idea generators fed by what's trending this week. The server collects "signals" (trending repos, posts,
// stories); the browser turns them into ideas with a seeded random generator: the same seed gives the same ideas,
// so today's date makes a daily set and a random seed makes endless new ones.

const WEEK = 7 * 864e5;
const UA = { "User-Agent": "Mozilla/5.0 (flekto.nl idee-radar)" };

async function get(url, as = "json") {
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`${url} ${res.status}`);
  return res[as]();
}

const since = (ms) => new Date(Date.now() - ms);
const hnUrl = (h) => h.url || `https://news.ycombinator.com/item?id=${h.objectID}`;
const decode = (s) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");

/** "Show HN: Bigwords.page – Turn any screen into…" -> "Bigwords.page"; undefined when it's a sentence, not a name. */
export function showHnName(title) {
  const name = title.replace(/^Show HN:\s*/i, "").split(/\s+[–—-]\s+|:\s/)[0].trim();
  return name.split(/\s+/).length <= 3 ? name : undefined;
}

/** Entries of a Reddit Atom feed; the source is the entry's subreddit. */
const firstGroup = (text, re, fallback = "") => text.match(re)?.[1] ?? fallback;

export function parseRedditAtom(xml) {
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];
  return entries.map((entry) => ({
    title: decode(firstGroup(entry, /<title>([\s\S]*?)<\/title>/)),
    url: firstGroup(entry, /<link href="([^"]+)"/),
    source: firstGroup(entry, /<category [^>]*label="([^"]+)"/, "Reddit"),
  })).filter((s) => s.title && s.url);
}

// One combined feed for several subreddits: Reddit answers parallel requests from one IP with 429.
const reddit = (...subs) => async () => parseRedditAtom(await get(`https://www.reddit.com/r/${subs.join("+")}/top/.rss?t=week&limit=50`, "text"));

// Every signal: { title, url, source, topic? }. `topic` is a short name the dev templates can build on.
const SOURCES = {
  dev: {
    GitHub: async () => (await get(`https://api.github.com/search/repositories?q=created:>${since(WEEK).toISOString().slice(0, 10)}&sort=stars&order=desc&per_page=30`))
      .items.map((r) => ({ topic: r.name, title: `${r.full_name}: ${r.description ?? ""} (★ ${r.stargazers_count})`, url: r.html_url, source: "GitHub" })),
    "Hacker News": async () => (await get(`https://hn.algolia.com/api/v1/search?tags=show_hn&hitsPerPage=30&numericFilters=points>15,created_at_i>${Math.floor(since(WEEK) / 1000)}`))
      .hits.map((h) => ({ topic: showHnName(h.title), title: h.title, url: hnUrl(h), source: "Hacker News" })),
    "dev.to": async () => (await get("https://dev.to/api/articles?top=7&per_page=30"))
      .filter((a) => a.tag_list.length).map((a) => ({ topic: a.tag_list[0], title: a.title, url: a.url, source: "dev.to" })),
    Lobsters: async () => (await get("https://lobste.rs/hottest.json"))
      .map((s) => ({ topic: s.tags[0], title: s.title, url: s.url || s.short_id_url, source: "Lobsters" })),
    Reddit: reddit("webdev", "javascript", "programming"),
  },
  income: {
    Reddit: reddit("passive_income", "sidehustle", "SideProject", "EntrepreneurRideAlong", "juststart"),
    "Hacker News": async () => (await get(`https://hn.algolia.com/api/v1/search?query=revenue%20side%20project&tags=story&hitsPerPage=30&numericFilters=created_at_i>${Math.floor(since(30 * 864e5) / 1000)}`))
      .hits.map((h) => ({ title: h.title, url: hnUrl(h), source: "Hacker News" })),
    "dev.to": async () => (await get("https://dev.to/api/articles?tag=sideprojects&top=30&per_page=30"))
      .map((a) => ({ title: a.title, url: a.url, source: "dev.to" })),
  },
};

export const KINDS = Object.keys(SOURCES);

/** One failing or rate-limited source shouldn't empty the page. */
export async function fetchSignals(kind) {
  const entries = Object.entries(SOURCES[kind]);
  const results = await Promise.allSettled(entries.map(([, load]) => load()));
  results.forEach((r, i) => r.status === "rejected" && console.error(entries[i][0], r.reason));
  return {
    updatedAt: new Date().toISOString(),
    sources: entries.map(([name], i) => ({ name, ok: results[i].status === "fulfilled" })),
    signals: results.flatMap((r) => (r.status === "fulfilled" ? r.value : [])),
  };
}

// --- Generation (runs in the browser) -------------------------------------------------------------

/** mulberry32 seeded by a string. */
export function rng(seed) {
  let a = [...String(seed)].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 2654435761), 1779033703) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (random, list) => list[Math.floor(random() * list.length)];

// t = main trending topic, u = a second one for mash-ups.
const DEV_TEMPLATES = [
  { title: (t) => `${t} playground in de browser`, pitch: (t) => `Laat mensen ${t} uitproberen zonder iets te installeren: editor links, resultaat rechts, deelbare links.`, effort: "1–2 weken", money: "Gratis tool → sponsor of 'Pro' met opslaan/teams" },
  { title: (t) => `${t} cheat sheet + snippet-generator`, pitch: (t) => `Eén pagina met de 20 dingen die iedereen opzoekt over ${t}, plus een generator die kant-en-klare snippets maakt.`, effort: "Weekend", money: "SEO-verkeer → advertenties of affiliate" },
  { title: (t) => `Config-validator voor ${t}`, pitch: (t) => `Plak je ${t}-config en zie direct fouten, waarschuwingen en best practices. Ook als GitHub Action.`, effort: "1 week", money: "Gratis online, betaalde CI-integratie" },
  { title: (t) => `${t} migratie-assistent`, pitch: (t) => `Helpt projecten overstappen naar (of weg van) ${t}: checklist, codemods en een rapport wat er moet gebeuren.`, effort: "2–4 weken", money: "Eenmalige licentie of consultancy-leads" },
  { title: (t) => `VS Code-extensie voor ${t}`, pitch: (t) => `Autocomplete, snippets en inline docs voor ${t}, rechtstreeks in de editor.`, effort: "1–2 weken", money: "Gratis basis, Pro-features via licentie" },
  { title: (t) => `Starter-template generator voor ${t}`, pitch: (t) => `Kies je stack, vink opties aan en download een ${t}-project dat meteen draait, met tests en CI.`, effort: "1 week", money: "Premium templates verkopen (Gumroad/Lemon Squeezy)" },
  { title: (t) => `${t} status- en release-tracker`, pitch: (t) => `Volg releases, breaking changes en security advisories rond ${t}, met e-mail of RSS als er iets verandert.`, effort: "Weekend", money: "Nieuwsbrief met sponsors" },
  { title: (t) => `${t} vs. alternatieven`, pitch: (t) => `Eerlijke, actuele vergelijking van ${t} met de alternatieven: features, performance, prijs, community.`, effort: "Weekend", money: "Affiliate-links en sponsored listings" },
  { title: (t) => `Mock-API en testdata voor ${t}`, pitch: (t) => `Genereer realistische nepdata en een mock-endpoint om ${t}-integraties te testen zonder echte backend.`, effort: "1–2 weken", money: "Gratis tier, betaald voor meer requests" },
  { title: (t) => `CLI die ${t}-taken automatiseert`, pitch: (t) => `Een npx-commando dat het saaie werk rond ${t} doet: setup, upgraden, opschonen. Eén regel in je README.`, effort: "1 week", money: "Open source → GitHub Sponsors" },
  { title: (t) => `Interactieve ${t}-cursus`, pitch: (t) => `Korte lessen met oefeningen die in de browser worden nagekeken, van nul tot productie met ${t}.`, effort: "1 maand", money: "Eenmalige aankoop of abonnement" },
  { title: (t) => `AI-assistent die ${t} uitlegt`, pitch: (t) => `Plak code of een foutmelding rond ${t} en krijg uitleg, een fix en links naar de docs.`, effort: "1–2 weken", money: "Credits per vraag of maandabonnement" },
  { title: (t) => `${t} performance-dashboard`, pitch: (t) => `Meet en visualiseer hoe snel je ${t}-setup is, met trends over tijd en alerts bij regressies.`, effort: "2–4 weken", money: "SaaS per project" },
  { title: (t, u) => `Mash-up: ${t} × ${u}`, pitch: (t, u) => `Beide gaan nu viraal. Bouw de brug: een integratie, plugin of template die ${t} en ${u} samen laat werken.`, effort: "1–2 weken", money: "Eerste in een nieuwe niche: sponsors of betaalde plugin" },
];

const NICHES = ["zzp'ers", "kleine webshops", "thuiswerkers", "studenten", "jonge ouders", "huisdiereigenaren", "hardlopers en fietsers",
  "moestuinders", "makelaars", "kappers en salons", "verenigingen", "docenten", "fotografen", "content creators", "Excel-gebruikers",
  "AI-beginners", "mensen die willen besparen op energie", "senioren met een smartphone", "expats in Nederland", "thuiskoks", "gamers",
  "kleine aannemers", "vloggers", "boekhouders", "ontwikkelaars"];

// Passive-income models with the facts people actually need to decide. passive: 1 (veel onderhoud) – 5 (loopt vanzelf).
const INCOME_MODELS = [
  { name: "Notion- of Google Sheets-template", start: "€0", firstEuro: "1–4 weken", passive: 4, how: "Bouw één template die een vervelend probleem oplost en verkoop het via Gumroad of Etsy.",
    steps: ["Zoek een terugkerende vraag in de doelgroep", "Bouw de template in een weekend", "Zet hem op Gumroad + Etsy met een gratis lite-versie", "Deel de gratis versie in fora en groepen"], risk: "Makkelijk te kopiëren; win op kwaliteit en uitleg." },
  { name: "Micro-SaaS", start: "€20–100/mnd hosting", firstEuro: "1–3 maanden", passive: 3, how: "Een kleine webapp die één taak heel goed doet, met maandabonnement.",
    steps: ["Valideer met een landingspagina en wachtlijst", "Bouw de kleinste versie die betaald kan worden", "Stripe/Lemon Squeezy-abonnement", "Groei via SEO-pagina's en integraties"], risk: "Support en churn kosten tijd; begin smal." },
  { name: "Nieuwsbrief met sponsors", start: "€0", firstEuro: "3–6 maanden", passive: 2, how: "Wekelijkse curatie van een niche; geld uit sponsorplekken en betaalde edities.",
    steps: ["Kies een niche waar je zelf toch al over leest", "Gebruik Beehiiv of Substack", "Publiceer 8 edities voor je sponsors zoekt", "Vraag €50 per 1.000 abonnees per plek"], risk: "Pas geld bij een paar duizend lezers; consistentie is alles." },
  { name: "Affiliate-vergelijkingssite", start: "€10 domein", firstEuro: "2–6 maanden", passive: 4, how: "Eerlijke vergelijkingen en reviews die gevonden worden in Google, met affiliate-links.",
    steps: ["Kies producten met >€50 prijs en een affiliateprogramma (Bol, Amazon, Awin)", "Schrijf 20 diepgaande 'beste X voor Y'-pagina's", "Voeg eigen foto's/tests toe", "Update elk kwartaal"], risk: "Google-updates kunnen verkeer halveren; spreid over kanalen." },
  { name: "Online mini-cursus", start: "€0–30/mnd", firstEuro: "1–2 maanden", passive: 4, how: "1–2 uur video of tekst die één concrete vaardigheid leert.",
    steps: ["Beantwoord de vraag die je het vaakst krijgt", "Neem 10 korte lessen op", "Verkoop via Teachable, Gumroad of je eigen site", "Gebruik een gratis eerste les als lead magnet"], risk: "Verkoop vraagt een publiek; bouw dat eerst op." },
  { name: "Stockfoto's, -video's of -illustraties", start: "€0 met eigen gear", firstEuro: "1–3 maanden", passive: 5, how: "Upload beeldmateriaal naar Adobe Stock, Shutterstock en Pond5; je krijgt per download betaald.",
    steps: ["Kijk welke zoektermen veel vraag en weinig aanbod hebben", "Schiet series van 20+ variaties", "Tag zorgvuldig met keywords", "Upload wekelijks; het is een volumespel"], risk: "Lage opbrengst per download; volume nodig." },
  { name: "Chrome-extensie", start: "$5 eenmalig", firstEuro: "1–2 maanden", passive: 4, how: "Een browserextensie die een irritatie op een populaire site oplost, met betaalde Pro-features.",
    steps: ["Zoek klachten over een populaire webapp", "Bouw een extensie die het oplost", "Gratis basis, Pro via ExtensionPay", "Laat reviews werken in de Chrome Web Store"], risk: "De site kan veranderen en je extensie breken." },
  { name: "Betaalde API", start: "€0–20/mnd", firstEuro: "1–3 maanden", passive: 4, how: "Verpak data of een berekening die developers vaak nodig hebben als API met pay-per-use.",
    steps: ["Kies data die lastig zelf te maken is", "Bouw een endpoint met API-keys", "Publiceer op RapidAPI en met goede docs", "Gratis tier, betalen per 1.000 calls"], risk: "Bronnen of licenties kunnen veranderen; check de voorwaarden." },
  { name: "Print-on-demand", start: "€0", firstEuro: "1–2 maanden", passive: 4, how: "Ontwerpen op shirts, posters of mokken; Printful/Gelato print en verstuurt.",
    steps: ["Kies een niche met eigen humor of trots", "Maak 30 ontwerpen", "Verkoop via Etsy of een Shopify-shop", "Gebruik Pinterest voor gratis verkeer"], risk: "Kleine marge; ontwerpen moeten echt raken." },
  { name: "E-book of gids", start: "€0", firstEuro: "1 maand", passive: 5, how: "Een praktische PDF of Kindle-boek over een specifiek probleem.",
    steps: ["Schrijf 30–60 pagina's met concrete stappen", "Laat een cover maken", "Publiceer op Amazon KDP en Gumroad", "Hergebruik hoofdstukken als blogposts"], risk: "Veel aanbod; specifieker is beter." },
  { name: "YouTube-kanaal met evergreen tutorials", start: "€0", firstEuro: "6–12 maanden", passive: 3, how: "Tutorials die jaren gezocht blijven worden; inkomsten uit advertenties, affiliate en sponsors.",
    steps: ["Maak een lijst van 50 'hoe doe ik X'-vragen", "Publiceer 1–2 video's per week", "Linken naar affiliate-gereedschap in de beschrijving", "Na 1.000 abonnees: YouTube Partner"], risk: "Lange aanloop voordat het betaalt." },
  { name: "WordPress- of Shopify-plugin", start: "€0", firstEuro: "1–3 maanden", passive: 3, how: "Een plugin die een gat in een groot ecosysteem vult; verkoop jaarlicenties.",
    steps: ["Lees 1-sterrenreviews van populaire plugins", "Bouw het betere alternatief", "Gratis versie in de officiële directory", "Pro-versie met jaarlicentie"], risk: "Support bij updates van het platform." },
  { name: "Digitale planners en printables", start: "€0", firstEuro: "2–6 weken", passive: 5, how: "PDF-planners, checklists en werkbladen die mensen downloaden en printen.",
    steps: ["Zoek bestsellers op Etsy in je niche", "Maak een betere of specifiekere versie in Canva", "Bundel in sets", "Pinterest-pins per product"], risk: "Concurrentie op Etsy is groot; niche en stijl maken het verschil." },
  { name: "Directory- of jobboard-site", start: "€10–30/mnd", firstEuro: "2–4 maanden", passive: 3, how: "Een gecureerde lijst (tools, vacatures, locaties) met betaalde vermeldingen.",
    steps: ["Verzamel de eerste 100 vermeldingen zelf", "Maak elke vermelding een SEO-pagina", "Verkoop 'featured' plekken", "Automatiseer instuurformulieren"], risk: "Verkeer opbouwen kost tijd." },
];

const stars = (n) => "★".repeat(n) + "☆".repeat(5 - n);

function devIdea(random, signals) {
  const withTopic = signals.filter((s) => s.topic);
  const [a, b] = [pick(random, withTopic), pick(random, withTopic)];
  const template = pick(random, a.topic === b.topic ? DEV_TEMPLATES.slice(0, -1) : DEV_TEMPLATES);
  return {
    title: template.title(a.topic, b.topic),
    pitch: template.pitch(a.topic, b.topic),
    facts: [["Bouwtijd", template.effort], ["Verdienmodel", template.money]],
    steps: [],
    inspiration: template === DEV_TEMPLATES.at(-1) ? [a, b] : [a],
  };
}

function incomeIdea(random, signals) {
  const model = pick(random, INCOME_MODELS);
  const niche = pick(random, NICHES);
  return {
    title: `${model.name} voor ${niche}`,
    pitch: model.how,
    facts: [["Startkosten", model.start], ["Eerste euro", model.firstEuro], ["Passief", stars(model.passive)], ["Risico", model.risk]],
    steps: model.steps,
    inspiration: signals.length ? [pick(random, signals)] : [],
  };
}

const MAKERS = { dev: devIdea, income: incomeIdea };

/** n ideas of a kind; the same seed and signals always give the same ideas. */
export function generateIdeas(kind, signals, seed, n = 6) {
  if (kind === "dev" && !signals.some((s) => s.topic)) return [];
  const random = rng(seed);
  const seen = new Set();
  const ideas = [];
  for (let tries = 0; ideas.length < n && tries < n * 10; tries++) {
    const idea = MAKERS[kind](random, signals);
    if (!seen.has(idea.title)) { seen.add(idea.title); ideas.push(idea); }
  }
  return ideas;
}
