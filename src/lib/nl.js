// Validators and test-data generators for Dutch identifiers. Generated values are fake but pass the checksums.

const digits = (s) => [...s].map(Number);
const randDigits = (n) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join("");
const clean = (s) => s.replace(/[\s.-]/g, "").toUpperCase();

/** 11-proef: weights 9..2 and -1 for the last digit, sum divisible by 11. */
function elfProef(nine) {
  const d = digits(nine);
  const sum = d.slice(0, 8).reduce((acc, x, i) => acc + x * (9 - i), 0) - d[8];
  return sum % 11 === 0;
}

/** Letters to numbers (A=10..Z=35), then mod 97 on the big number. */
function mod97(s) {
  const numeric = [...s].map((c) => (/[A-Z]/.test(c) ? c.charCodeAt(0) - 55 : c)).join("");
  return [...numeric].reduce((r, c) => (r * 10 + Number(c)) % 97, 0);
}

export const isBsn = (s) => /^\d{9}$/.test(clean(s)) && clean(s) !== "000000000" && elfProef(clean(s));

export function genBsn() {
  for (;;) {
    const candidate = randDigits(9);
    if (isBsn(candidate)) return candidate;
  }
}

const BANKS = ["ABNA", "INGB", "RABO", "TRIO", "SNSB", "ASNB", "KNAB", "BUNQ"];

export function isIban(s) {
  const iban = clean(s);
  return /^NL\d{2}[A-Z]{4}\d{10}$/.test(iban) && mod97(iban.slice(4) + iban.slice(0, 4)) === 1;
}

export function genIban() {
  const bban = BANKS[Math.floor(Math.random() * BANKS.length)] + randDigits(10);
  const check = String(98 - mod97(bban + "NL00")).padStart(2, "0");
  return `NL${check}${bban}`;
}

export const isPostcode = (s) => /^[1-9]\d{3}(?!SA|SD|SS)[A-Z]{2}$/.test(clean(s));

export function genPostcode() {
  const letter = () => "ABCEGHJKLMNPRTVWXZ"[Math.floor(Math.random() * 18)];
  return `${1000 + Math.floor(Math.random() * 9000)}${letter()}${letter()}`;
}

// KvK numbers dropped their checksum in 2016: any 8 digits not starting with 0.
export const isKvk = (s) => /^[1-9]\d{7}$/.test(clean(s));
export const genKvk = () => String(1 + Math.floor(Math.random() * 9)) + randDigits(7);

/** Old style passes the 11-proef on the 9 digits; post-2020 (eenmanszaak) style passes mod 97 on the whole id. */
export function isBtw(s) {
  const btw = clean(s);
  return /^NL\d{9}B\d{2}$/.test(btw) && (elfProef(btw.slice(2, 11)) || mod97(btw) === 1);
}

export const genBtw = () => `NL${genBsn()}B01`;

export const TYPES = [
  { key: "bsn", label: "BSN", example: "111222333", isValid: isBsn, generate: genBsn },
  { key: "iban", label: "IBAN (NL)", example: "NL91ABNA0417164300", isValid: isIban, generate: genIban },
  { key: "postcode", label: "Postcode", example: "1012 AB", isValid: isPostcode, generate: genPostcode },
  { key: "kvk", label: "KvK-nummer", example: "69599084", isValid: isKvk, generate: genKvk },
  { key: "btw", label: "BTW-id", example: "NL123456782B01", isValid: isBtw, generate: genBtw },
];
