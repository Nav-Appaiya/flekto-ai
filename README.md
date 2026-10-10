# Flekto.nl tools

Hoi! Dit is de code achter de tools op [flekto.nl](https://flekto.nl). Ik ben Nav, freelance webdeveloper sinds 2016, en naast klantwerk bouw ik graag kleine tools voor dingen waar ik zelf tegenaan loop. Alles is gratis en je hebt geen account nodig. De meeste tools draaien helemaal in je browser, dus er gaat ook niks naar een server.

Wat er in zit en hoe je het zelf draait staat hieronder. Wat er per versie veranderd is vind je in de [CHANGELOG](CHANGELOG.md).

## Wat zit erin?

### Voor iedereen

| Tool | Wat doet het? |
| --- | --- |
| 🎁 **Gratis-radar** (`/tools/gratis-radar/`) | Laat gratis spullen op Marktplaats zien binnen een paar km van je postcode. Met een GitHub Action krijg je ook pushmeldingen via ntfy.sh. |
| ⚡ **Stroomprijs-planner** (`/tools/stroomprijs/`) | Voor als je een dynamisch energiecontract hebt: zie wanneer stroom vandaag en morgen het goedkoopst is en plan je wasmachine of laadsessie daarop. |
| 🔥 **Viral-radar NL** (`/tools/viral/`) | Waar heeft Nederland het nu over? De snelst stijgende zoektermen uit Google Trends, met nieuws erbij van NU.nl, AD en NOS. |
| 🖼️ **Afbeelding verkleinen** (`/tools/afbeelding-verkleinen/`) | Foto's kleiner en lichter maken voor de mail of je site. Gebeurt in je browser, er wordt niks geüpload. |
| 🔳 **QR-code maker** (`/tools/qr-code/`) | QR-codes voor een link, tekst of je wifi. Download als PNG of SVG. |
| 🧮 **BTW- & uurtarief-calculator** (`/tools/btw-calculator/`) | Van incl. naar excl. btw en terug, en uitrekenen welk uurtarief je als zzp'er nodig hebt. |
| 💸 **Passief inkomen ideeën** (`/tools/passief-inkomen/`) | Ideeën om er iets naast te verdienen, met startkosten, hoe lang het duurt tot je eerste euro, een stappenplan en de risico's. Elk idee linkt naar een post die die week trending is op Reddit, Hacker News of dev.to. |

### Voor developers

| Tool | Wat doet het? |
| --- | --- |
| 🧰 **NL dev toolkit** (`/tools/nl-dev-toolkit/`) | Test-BSN's, IBAN's, postcodes, KvK- en BTW-nummers checken of genereren. Nep, maar ze kloppen met de 11-proef en mod 97. |
| 📋 **Paste & deel** (`/tools/paste/`) | Tekst of een screenshot plakken en een link krijgen die vanzelf weer verdwijnt. |
| 📮 **Request bin** (`/tools/request-bin/`) | Webhooks en HTTP-requests opvangen en live bekijken. Handig bij het debuggen van API-koppelingen. |
| 📥 **Tijdelijke inbox** (`/tools/tijdelijke-inbox/`) | Een wegwerp-mailadres (10 minuten, een uur of een dag) waarvan je de mails live ziet. Fijn voor aanmeldingen of om de mails van je eigen app te testen. HTML-mails worden in een afgeschermd frame getoond en externe plaatjes (trackingpixels) laden pas als jij dat wilt. |
| 🤖 **Mail-antwoordbot** (`/tools/mail-antwoordbot/`) | Mail de bot en je krijgt binnen een minuut antwoord: een reactie geschreven door Claude plus een check van SPF, DKIM, DMARC en spamsignalen. Antwoordt nooit op automatische mails, dus geen mail-loops. |
| 💡 **Dev idee-generator** (`/tools/idee-generator/`) | Elke dag nieuwe ideeën voor een side project of tool, op basis van wat er die week trending is op GitHub, Hacker News, dev.to, Lobsters en Reddit. Je kunt eindeloos nieuwe ideeën laten maken. |
| 🧹 **JSON formatter** (`/tools/dev/json-formatter/`) | JSON opmaken, minifyen of de keys sorteren. Klopt er iets niet, dan zie je waar. |
| 🔷 **JSON → TypeScript** (`/tools/dev/json-naar-typescript/`) | Plak een API-response en krijg de interfaces terug, inclusief optionele velden en geneste objecten. |
| 📊 **JSON ⇄ CSV** (`/tools/dev/json-csv/`) | Heen en terug tussen JSON en CSV. Snapt ook de `;` van de Nederlandse Excel. |
| 📄 **JSON → YAML** (`/tools/dev/json-naar-yaml/`) | Voor Docker Compose, Kubernetes of GitHub Actions. Dingen als `"80:80"` en `"yes"` krijgen netjes quotes. |
| 🔑 **JWT decoder** (`/tools/dev/jwt-decoder/`) | Header en payload van een token bekijken, met `iat`/`exp` als datum en of hij al verlopen is. |
| 🔤 **Base64** (`/tools/dev/base64/`) | Encoden en decoden, ook met emoji en base64url. |
| 🔗 **URL encoder & query parser** (`/tools/dev/url-encoder/`) | URL-stukjes encoden/decoden of een query string omzetten naar JSON (dubbele keys worden een array). |
| ⏱️ **Unix timestamp** (`/tools/dev/unix-timestamp/`) | Unix-tijd in seconden of milliseconden naar een datum in NL-tijd, en andersom. |
| #️⃣ **Hash generator** (`/tools/dev/hash-generator/`) | SHA-1, SHA-256, SHA-384 en SHA-512 in één keer. |
| 🆔 **UUID generator** (`/tools/dev/uuid-generator/`) | UUID v4 of v7 (sorteert op tijd, fijn als database-key), tot 1000 tegelijk. |
| 🌀 **cURL → fetch** (`/tools/dev/curl-naar-fetch/`) | cURL-commando uit de docs of DevTools omzetten naar `fetch()`. Kent `-X`, `-H`, `-d`, `--json`, `-u` en nog wat meer. |
| 🚦 **HTTP statuscodes** (`/tools/dev/http-statuscodes/`) | Zoek op code of woord wat een statuscode betekent, in normaal Nederlands. |

### Hoe de idee-generators werken

Beide generators halen elk uur nieuwe "signalen" op via `/api/ideas?kind=dev` of `?kind=income`. Signalen zijn posts en repo's die die week populair zijn. De CDN cachet dat een uur, zodat ik GitHub en Reddit niet bestook.

In de browser worden die signalen gecombineerd met formats (dev) of verdienmodellen en doelgroepen (passief inkomen). Dat gebeurt met een random generator die je een seed geeft:

- **Ideeën van vandaag** gebruiken de datum als seed. Iedereen ziet dus dezelfde set en morgen is het een nieuwe.
- **Nog een paar ideeën** gebruikt een willekeurige seed, dus je kunt blijven klikken.

Valt een bron uit (Reddit doet dat nog weleens zonder login), dan draait de rest gewoon door en staat er op de pagina welke bron even niet bereikbaar is.

## Zelf draaien

Je hebt Node 22 of nieuwer nodig.

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # bouwt naar dist/ voor Vercel
```

De site is gemaakt met [Astro](https://astro.build) en draait op Vercel. Pagina's zijn statisch, alleen de routes onder `src/pages/api/` draaien als serverless functions.

### Omgevingsvariabelen

Zet ze in `.env` (staat in `.gitignore`) of in Vercel:

| Variabele | Nodig voor |
| --- | --- |
| `SUPABASE_URL`, `SUPABASE_KEY` | Paste & deel, Request bin en Tijdelijke inbox (opslag in Supabase) |
| `PUBLIC_MAIL_DOMAIN` | Tijdelijke inbox en Mail-antwoordbot. Zolang deze leeg is staat er "binnenkort geactiveerd" op die pagina's. |

De gratis-radar meldingen draaien via `.github/workflows/gratis-radar.yml`. Daarvoor stel je in GitHub de variabelen `POSTCODE`, `RADIUS_KM` en `KEYWORDS` in, en het secret `NTFY_TOPIC`.

### De mail-worker

De tijdelijke inbox en de antwoordbot krijgen hun mail binnen via een Cloudflare Email Worker in `workers/mail/`. Die heeft een eigen (los) maildomein nodig met Cloudflare Email Routing erop.

```bash
cd workers/mail
npm install
npx wrangler secret put WORKER_SECRET       # zelfde waarde als in .dev.vars
npx wrangler secret put ANTHROPIC_API_KEY   # voor de antwoordbot
npm run deploy
```

Zet in `wrangler.toml` je domein bij `MAIL_DOMAIN` en gebruik hetzelfde domein voor `PUBLIC_MAIL_DOMAIN` op de site. Mails naar `reply@<domein>` gaan naar de antwoordbot, al het andere naar de tijdelijke inboxen.

### Tests

Geen testframework, gewoon `node:assert`. Elk bestand print `ok` als alles goed gaat:

```bash
for f in src/lib/*.test.mjs; do node "$f"; done
node workers/mail/src/mail.test.mjs
```

## Hoe het in elkaar zit

```
src/
  layouts/Base.astro       de opmaak (zelfde stijl als flekto.nl)
  data/tools.js            lijst met alle tools op de homepage
  components/              ToolGrid en IdeaFeed
  lib/                     de logica, los van de pagina's, met een .test.mjs ernaast
    devtools.js            alle 12 dev tools (elke actie is gewoon input -> string)
    ideas.js               bronnen + idee-generators
  pages/tools/             een pagina per tool
  pages/tools/dev/[slug]   één template voor alle dev tools
  pages/api/               serverless endpoints
gratis-radar/radar.mjs     cronjob voor de gratis-radar meldingen
workers/mail/              Cloudflare Email Worker voor de mailtools
```

### Een dev tool toevoegen

Zet een object in `DEV_TOOLS` in `src/lib/devtools.js`:

```js
{ slug: "mijn-tool", name: "Mijn tool", emoji: "🛠️", blurb: "Wat hij doet.",
  placeholder: "voorbeeldinvoer",
  modes: [{ label: "Doe het", run: (input) => input.toUpperCase() }] },
```

Dat is alles. De pagina, de link op de homepage en de "andere dev tools"-lijst komen er vanzelf bij. Een `run` mag ook een Promise teruggeven, en als hij een error gooit wordt de melding in rood getoond.

## Contact

Vragen, ideeën of een bug gevonden? Mail me op [info@flekto.nl](mailto:info@flekto.nl) of bel (010) 307 5430.
