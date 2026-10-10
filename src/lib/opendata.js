// Dutch (and EU) open data behind the kenteken-check, btw-check, regen and schoolvakanties tools.
// Parsing is kept apart from fetching so the tests can run without network.
import { geocode, isPostcode, normalizePostcode } from "./gratis.js";

const UA = { "User-Agent": "Mozilla/5.0 (flekto.nl tools)" };

/** Error with a message that's fine to show to the visitor. */
export class UserError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

async function get(url, as = "json") {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`${new URL(url).host} ${res.status}`);
  return res[as]();
}

// --- Kenteken (RDW) -------------------------------------------------------------------------------

export const normalizeKenteken = (s) => String(s ?? "").replace(/[\s-]/g, "").toUpperCase();
export const isKenteken = (s) => /^[A-Z0-9]{6}$/.test(normalizeKenteken(s));

/** RDW dates are "20280329". */
const rdwDate = (s) => (/^\d{8}$/.test(s ?? "") ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6)}` : null);
const euro = (s) => (s ? Number(s) : null);

export function parseVoertuig(vehicle, fuels) {
  return {
    kenteken: vehicle.kenteken,
    soort: vehicle.voertuigsoort,
    merk: vehicle.merk,
    model: vehicle.handelsbenaming,
    kleur: vehicle.eerste_kleur,
    brandstof: fuels.map((f) => f.brandstof_omschrijving).join(" + ") || null,
    vermogenKw: fuels.map((f) => Number(f.nettomaximumvermogen)).find((kw) => kw > 0) ?? null,
    eersteToelating: rdwDate(vehicle.datum_eerste_toelating),
    apkTot: rdwDate(vehicle.vervaldatum_apk),
    catalogusprijs: euro(vehicle.catalogusprijs),
    massaRijklaar: euro(vehicle.massa_rijklaar),
    trekgewichtGeremd: euro(vehicle.maximum_trekken_massa_geremd),
    zitplaatsen: euro(vehicle.aantal_zitplaatsen),
    verzekerd: vehicle.wam_verzekerd === "Ja",
    geimporteerd: vehicle.datum_eerste_toelating !== vehicle.datum_eerste_tenaamstelling_in_nederland,
  };
}

export async function kenteken(input) {
  if (!isKenteken(input)) throw new UserError("Een kenteken heeft 6 letters en cijfers, bijvoorbeeld 12-ABC-3");
  const plate = normalizeKenteken(input);
  const [vehicles, fuels] = await Promise.all([
    get(`https://opendata.rdw.nl/resource/m9d7-ebf2.json?kenteken=${plate}`),
    get(`https://opendata.rdw.nl/resource/8ys7-d773.json?kenteken=${plate}`),
  ]);
  if (!vehicles.length) throw new UserError("Dit kenteken staat niet in de RDW-gegevens", 404);
  return parseVoertuig(vehicles[0], fuels);
}

// --- BTW-nummer (EU VIES) -------------------------------------------------------------------------

export const normalizeVat = (s) => String(s ?? "").replace(/[\s.-]/g, "").toUpperCase();
export const isVatFormat = (s) => /^[A-Z]{2}[0-9A-Z+*]{2,12}$/.test(normalizeVat(s));

const VIES_DOWN = new Set(["MS_UNAVAILABLE", "SERVICE_UNAVAILABLE", "TIMEOUT", "MS_MAX_CONCURRENT_REQ", "GLOBAL_MAX_CONCURRENT_REQ"]);
const blank = (s) => (!s || s === "---" ? "" : s.trim());

export function parseVies(body) {
  if (VIES_DOWN.has(body.userError)) throw new UserError("De btw-database van dit land is even niet bereikbaar. Probeer het later nog eens.", 503);
  return { valid: body.isValid === true, nummer: body.vatNumber, naam: blank(body.name), adres: blank(body.address).replace(/\n/g, ", "), gecontroleerd: body.requestDate };
}

export async function btwCheck(input) {
  if (!isVatFormat(input)) throw new UserError("Begin met de landcode, bijvoorbeeld NL123456789B01");
  const vat = normalizeVat(input);
  const country = vat.slice(0, 2) === "GR" ? "EL" : vat.slice(0, 2);
  return { land: country, ...parseVies(await get(`https://ec.europa.eu/taxation_customs/vies/rest-api/ms/${country}/vat/${encodeURIComponent(vat.slice(2))}`)) };
}

// --- Regen (Buienradar) ---------------------------------------------------------------------------

/** Buienradar's 0-255 value to mm per hour. */
export const mmPerHour = (value) => (value > 0 ? Math.round(10 ** ((value - 109) / 32) * 10) / 10 : 0);

/** "077|22:00" lines -> [{ time, mm }]. */
export const parseRaintext = (text) => text.trim().split(/\r?\n/).map((line) => {
  const [value, time] = line.split("|");
  return { time: time?.trim(), mm: mmPerHour(Number(value)) };
}).filter((p) => p.time);

export function rainSummary(points) {
  const first = points.findIndex((p) => p.mm >= 0.1);
  if (first === -1) return "Droog de komende twee uur 🌤️";
  if (first === 0) {
    const stop = points.findIndex((p) => p.mm < 0.1);
    return stop === -1 ? "Het regent en dat blijft de komende twee uur zo ☔" : `Het regent nu, droog vanaf ${points[stop].time} 🌦️`;
  }
  return `Regen vanaf ${points[first].time}, tot die tijd droog 🌂`;
}

export async function regen(input) {
  const postcode = normalizePostcode(input);
  if (!isPostcode(postcode)) throw new UserError("Vul een postcode in, bijvoorbeeld 3011 AB");
  const home = await geocode(postcode);
  if (!home) throw new UserError("Deze postcode kon ik niet vinden", 404);
  const points = parseRaintext(await get(`https://gpsgadget.buienradar.nl/data/raintext?lat=${home.lat.toFixed(2)}&lon=${home.lon.toFixed(2)}`, "text"));
  return { postcode, samenvatting: rainSummary(points), punten: points };
}

// --- Schoolvakanties (Rijksoverheid) --------------------------------------------------------------

/** "2026-2027" for dates from August 2026 up to July 2027. */
export function schoolYear(date = new Date()) {
  const start = date.getMonth() >= 7 ? date.getFullYear() : date.getFullYear() - 1;
  return `${start}-${start + 1}`;
}

const amsterdamDate = (iso) => new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Europe/Amsterdam" });

export function parseSchoolHolidays(body) {
  return body.content[0].vacations.map((v) => ({
    naam: v.type.trim(),
    verplicht: v.compulsorydates === "true",
    regios: Object.fromEntries(v.regions.map((r) => [r.region.trim(), { van: amsterdamDate(r.startdate), tot: amsterdamDate(r.enddate) }])),
  }));
}

export async function schoolvakanties(input) {
  const year = /^\d{4}-\d{4}$/.test(input ?? "") ? input : schoolYear();
  const body = await get(`https://opendata.rijksoverheid.nl/v1/infotypes/schoolholidays/schoolyear/${year}?output=json`).catch(() => null);
  if (!body?.content?.length) throw new UserError(`Voor schooljaar ${year} zijn de vakanties nog niet bekend`, 404);
  return { schooljaar: year, vakanties: parseSchoolHolidays(body) };
}

// --- Inflatie (CBS consumentenprijsindex, tabel 83131NED) ----------------------------------------

/** { 1996: 68.94, ... } from CBS yearly CPI rows. */
export const parseCpi = (rows) => Object.fromEntries(rows.filter((r) => r.CPI_1 !== null).map((r) => [Number(r.Perioden.slice(0, 4)), r.CPI_1]));

/** What `amount` in `from` is worth in `to`, by the change in the price index. */
export function inflate(cpi, amount, from, to) {
  if (!(from in cpi) || !(to in cpi)) throw new UserError(`Kies jaren tussen ${Math.min(...Object.keys(cpi))} en ${Math.max(...Object.keys(cpi))}`);
  const factor = cpi[to] / cpi[from];
  return { bedrag: Math.round(amount * factor * 100) / 100, procent: Math.round((factor - 1) * 1000) / 10 };
}

export async function inflatie() {
  const query = "$filter=Bestedingscategorieen eq 'T001112  ' and substringof('JJ',Perioden)&$select=Perioden,CPI_1";
  const { value } = await get(`https://opendata.cbs.nl/ODataApi/odata/83131NED/TypedDataSet?${encodeURI(query)}`);
  return { cpi: parseCpi(value) }; // the browser does the sums, so one cached response serves every question
}

// --- Adres (PDOK Locatieserver), shared by buurt and huis ----------------------------------------

/** "3011AB 10" or "3011 AB 10a" -> { postcode, huisnummer } */
export function parseAddress(input) {
  const match = String(input ?? "").toUpperCase().match(/([1-9]\d{3})\s*([A-Z]{2})\D*(\d+)\s*([A-Z0-9-]*)/);
  if (!match) throw new UserError("Vul je postcode en huisnummer in, bijvoorbeeld 3011 AB 10");
  return { postcode: `${match[1]}${match[2]}`, huisnummer: `${match[3]}${match[4] ? ` ${match[4]}` : ""}` };
}

async function findAddress(input) {
  const { postcode, huisnummer } = parseAddress(input);
  const q = new URLSearchParams({ q: `${postcode} ${huisnummer}`, fq: "type:adres", rows: "1",
    fl: "weergavenaam,postcode,buurtcode,buurtnaam,wijknaam,gemeentenaam,adresseerbaarobject_id" });
  const doc = (await get(`https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?${q}`)).response.docs[0];
  if (!doc || doc.postcode !== postcode) throw new UserError("Dit adres kon ik niet vinden", 404);
  return doc;
}

// --- Buurt in cijfers (CBS Kerncijfers wijken en buurten 2024, tabel 85984NED) --------------------

const BUURT_FIELDS = {
  inwoners: "AantalInwoners_5", huishoudens: "HuishoudensTotaal_29", gemHuishouden: "GemiddeldeHuishoudensgrootte_33",
  dichtheid: "Bevolkingsdichtheid_34", wozDuizend: "GemiddeldeWOZWaardeVanWoningen_39", koopPct: "Koopwoningen_47",
  huurPct: "HuurwoningenTotaal_48", corporatiePct: "InBezitWoningcorporatie_49", aardgasvrijPct: "AardgasvrijeWoningen_57",
  stroomKwh: "GemiddeldeElektriciteitslevering_53", gasM3: "GemiddeldAardgasverbruik_55",
  inkomenDuizend: "GemiddeldInkomenPerInwoner_78", kinderen: "k_0Tot15Jaar_8", ouderen: "k_65JaarOfOuder_12",
  autosPerHuishouden: "PersonenautoSPerHuishouden_105", afstandSupermarktKm: "AfstandTotGroteSupermarkt_115",
};

export const parseBuurt = (row) => Object.fromEntries(Object.entries(BUURT_FIELDS).map(([key, field]) => [key, row[field] ?? null]));

export async function buurt(input) {
  const address = await findAddress(input);
  const { value } = await get(`https://opendata.cbs.nl/ODataApi/odata/85984NED/TypedDataSet?$filter=WijkenEnBuurten eq '${address.buurtcode}'`);
  if (!value.length) throw new UserError("Voor deze buurt heeft het CBS (nog) geen cijfers", 404);
  return { adres: address.weergavenaam, buurt: address.buurtnaam, wijk: address.wijknaam, gemeente: address.gemeentenaam, jaar: 2024, cijfers: parseBuurt(value[0]) };
}

// --- Je huis (BAG via PDOK) -----------------------------------------------------------------------

const BAG = "https://api.pdok.nl/kadaster/bag/ogc/v2/collections";

export function parseHuis(unit, building) {
  return {
    gebruiksdoel: unit.gebruiksdoel,
    oppervlakte: unit.oppervlakte,
    status: unit.status ?? null,
    bouwjaar: building?.bouwjaar ?? null,
    adressenInPand: building?.aantal_verblijfsobjecten ?? null,
    pandStatus: building?.status ?? null,
  };
}

export async function huis(input) {
  const address = await findAddress(input);
  const [unit] = (await get(`${BAG}/verblijfsobject/items?f=json&identificatie=${address.adresseerbaarobject_id}`)).features;
  if (!unit) throw new UserError("Dit adres is geen verblijfsobject in de BAG (bijvoorbeeld een ligplaats)", 404);
  const buildingUrl = unit.properties["pand.href"]?.[0];
  const building = buildingUrl ? (await get(`${buildingUrl}?f=json`)).properties : null;
  return { adres: address.weergavenaam, ...parseHuis(unit.properties, building), bagId: address.adresseerbaarobject_id };
}

// --- Weer op een datum (KNMI daggegevens, station De Bilt) ----------------------------------------

/** KNMI gives tenths: TG 135 = 13.5 °C, RH 51 = 5.1 mm, SQ 25 = 2.5 hours sun, FG 21 = 2.1 m/s. -1 means < 0.05. */
const tenths = (v) => (v === null || v === undefined ? null : v < 0 ? 0 : v / 10);

export function parseKnmiDay(day) {
  return { datum: day.date.slice(0, 10), gemiddeld: tenths(day.TG), min: tenths(day.TN), max: tenths(day.TX),
    regenMm: tenths(day.RH), zonUren: tenths(day.SQ), windMs: tenths(day.FG) };
}

export async function weer(input) {
  const date = String(input ?? "");
  const day = new Date(`${date}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(day.getTime())) throw new UserError("Kies een datum");
  if (day < new Date("1901-01-01") || day > new Date(Date.now() - 864e5)) throw new UserError("Kies een datum tussen 1901 en gisteren");
  const res = await fetch("https://www.daggegevens.knmi.nl/klimatologie/daggegevens", {
    method: "POST", headers: UA, signal: AbortSignal.timeout(10000),
    body: new URLSearchParams({ start: date.replace(/-/g, ""), end: date.replace(/-/g, ""), vars: "TG:TN:TX:RH:SQ:FG", stns: "260", fmt: "json" }),
  });
  if (!res.ok) throw new Error(`knmi ${res.status}`);
  const [row] = await res.json();
  if (!row) throw new UserError("Voor deze datum heeft het KNMI geen metingen", 404);
  return { station: "De Bilt", ...parseKnmiDay(row) };
}

// --- Terugroepacties (RDW) ------------------------------------------------------------------------

export function parseRecalls(statuses, actions) {
  const byCode = new Map(actions.map((a) => [a.referentiecode_rdw, a]));
  return statuses.map((s) => {
    const action = byCode.get(s.referentiecode_rdw) ?? {};
    return { code: s.referentiecode_rdw, status: s.status, opgelost: s.code_status === "P", defect: action.omschrijving_defect ?? "",
      gevolg: action.materi_le_gevolgen ?? "", herstel: action.beschrijving_van_het_herstel ?? "", gemeld: rdwDate(action.datum_melding_bij_rdw) };
  });
}

export async function terugroep(input) {
  if (!isKenteken(input)) throw new UserError("Een kenteken heeft 6 letters en cijfers, bijvoorbeeld 12-ABC-3");
  const plate = normalizeKenteken(input);
  const statuses = await get(`https://opendata.rdw.nl/resource/t49b-isb7.json?kenteken=${plate}`);
  const codes = statuses.map((s) => `'${s.referentiecode_rdw.replace(/'/g, "")}'`).join(",");
  const actions = codes ? await get(`https://opendata.rdw.nl/resource/j9yg-7rg9.json?$where=${encodeURIComponent(`referentiecode_rdw in(${codes})`)}`) : [];
  return { kenteken: plate, acties: parseRecalls(statuses, actions) };
}

// --- Open data zoeker (data.overheid.nl, CKAN) ----------------------------------------------------

export function parseDatasets(result) {
  return { totaal: result.count, datasets: result.results.map((d) => ({
    titel: d.title, organisatie: d.organization?.title ?? d.authority ?? "", beschrijving: (d.notes ?? "").slice(0, 280),
    url: `https://data.overheid.nl/dataset/${d.name}`, formaten: [...new Set((d.resources ?? []).map((r) => (r.format ?? "").split("/").at(-1).toUpperCase()).filter(Boolean))].slice(0, 6),
    bijgewerkt: (d.metadata_modified ?? "").slice(0, 10),
  })) };
}

export async function datasets(input) {
  const q = String(input ?? "").trim().slice(0, 100);
  if (!q) throw new UserError("Waar zoek je data over?");
  const { result } = await get(`https://data.overheid.nl/data/api/3/action/package_search?${new URLSearchParams({ q, rows: "20" })}`);
  return parseDatasets(result);
}

// --- Registry for /api/nl/[source] ---------------------------------------------------------------

export const SOURCES = {
  kenteken: { load: kenteken, cacheSeconds: 86400 },
  btw: { load: btwCheck, cacheSeconds: 3600 },
  regen: { load: regen, cacheSeconds: 300 },
  schoolvakanties: { load: schoolvakanties, cacheSeconds: 86400 },
  inflatie: { load: inflatie, cacheSeconds: 86400 },
  buurt: { load: buurt, cacheSeconds: 86400 },
  huis: { load: huis, cacheSeconds: 86400 },
  weer: { load: weer, cacheSeconds: 86400 * 30 },
  terugroep: { load: terugroep, cacheSeconds: 86400 },
  datasets: { load: datasets, cacheSeconds: 3600 },
};
