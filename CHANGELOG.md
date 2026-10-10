# Changelog

Alles wat er per versie veranderd is. Ik hou [Keep a Changelog](https://keepachangelog.com/nl/1.1.0/) aan en de versienummers volgen [SemVer](https://semver.org/lang/nl/).

## [Unreleased]

### Toegevoegd
- Tijdelijke inbox: een wegwerp-mailadres waarvan je de mails live in je browser ziet, met afgeschermde HTML-weergave en externe plaatjes pas na een klik.
- Mail-antwoordbot: mail de bot en krijg een antwoord van Claude terug, plus een check van SPF, DKIM, DMARC en spamsignalen.
- Cloudflare Email Worker (`workers/mail/`) die de mail voor beide tools ontvangt.
- README-uitleg over de mail-worker en de variabele `PUBLIC_MAIL_DOMAIN`.

## [1.0.0] - 2026-10-10

De eerste echte release. De site ziet er nu hetzelfde uit als flekto.nl en alles is beschreven in de README.

### Toegevoegd
- README met uitleg over alle tools, hoe je het zelf draait en hoe je een tool toevoegt.
- Deze changelog.
- Footer met contactgegevens en een Contact-link in het menu.

### Veranderd
- Nieuwe opmaak in de stijl van flekto.nl: Hanken Grotesk, blauw als accentkleur, rustige kaarten en knoppen met een zachte schaduw.
- Teksten op de homepage, de toolspagina, de dev tools en de idee-generators herschreven.
- cURL → fetch opgesplitst in een parser en een stuk dat de code maakt, zodat nieuwe curl-opties makkelijker toe te voegen zijn.
- Grafiek van de stroomprijs-planner gebruikt grijsblauw voor gewone uren, zodat het goedkoopste blok goed opvalt in de nieuwe kleuren.

## [0.2.0] - 2026-10-10

Een flinke lading nieuwe tools.

### Toegevoegd
- 12 dev tools onder `/tools/dev/`: JSON formatter, JSON → TypeScript, JSON ⇄ CSV, JSON → YAML, JWT decoder, Base64, URL encoder & query parser, Unix timestamp, hash generator, UUID generator (v4 en v7), cURL → fetch en HTTP statuscodes.
- Dev idee-generator: dagelijks nieuwe ideeën voor tools en side projects, op basis van wat trending is op GitHub, Hacker News, dev.to, Lobsters en Reddit.
- Passief inkomen ideeën: uitgewerkte ideeën met startkosten, stappenplan en risico's, gekoppeld aan trending posts van Reddit, Hacker News en dev.to.
- Viral-radar NL, Paste & deel, Request bin, Afbeelding verkleinen, QR-code maker en de BTW- & uurtarief-calculator.

## [0.1.0] - 2026-10-10

Begin van de site.

### Toegevoegd
- Gratis-radar met pushmeldingen via een GitHub Action.
- Stroomprijs-planner.
- NL dev toolkit voor test-BSN, IBAN, postcode, KvK en BTW.

[Unreleased]: https://github.com/Nav-Appaiya/flekto-ai/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/Nav-Appaiya/flekto-ai/compare/22a3264...v1.0.0
[0.2.0]: https://github.com/Nav-Appaiya/flekto-ai/compare/6aff345...22a3264
[0.1.0]: https://github.com/Nav-Appaiya/flekto-ai/commit/6aff345
