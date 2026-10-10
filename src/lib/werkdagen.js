// Dutch public holidays and working days per month, for freelancers planning billable hours.

/** Easter Sunday (anonymous Gregorian algorithm), as a UTC date. */
export function easter(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  return new Date(Date.UTC(year, month - 1, ((h + l - 7 * m + 114) % 31) + 1));
}

const utc = (year, month, day) => new Date(Date.UTC(year, month - 1, day));
const plusDays = (date, n) => new Date(date.getTime() + n * 864e5);
export const iso = (date) => date.toISOString().slice(0, 10);

/** Koningsdag moves to the 26th when the 27th is a Sunday. */
const koningsdag = (year) => (utc(year, 4, 27).getUTCDay() === 0 ? utc(year, 4, 26) : utc(year, 4, 27));

/** `optional`: not a day off for everyone (Goede Vrijdag, and Bevrijdingsdag outside lustrum years in many CAOs). */
export function holidays(year) {
  const e = easter(year);
  return [
    { name: "Nieuwjaarsdag", date: utc(year, 1, 1) },
    { name: "Goede Vrijdag", date: plusDays(e, -2), optional: true },
    { name: "Eerste paasdag", date: e },
    { name: "Tweede paasdag", date: plusDays(e, 1) },
    { name: "Koningsdag", date: koningsdag(year) },
    { name: "Bevrijdingsdag", date: utc(year, 5, 5), optional: year % 5 !== 0 },
    { name: "Hemelvaartsdag", date: plusDays(e, 39) },
    { name: "Eerste pinksterdag", date: plusDays(e, 49) },
    { name: "Tweede pinksterdag", date: plusDays(e, 50) },
    { name: "Eerste kerstdag", date: utc(year, 12, 25) },
    { name: "Tweede kerstdag", date: utc(year, 12, 26) },
  ].map((h) => ({ ...h, date: iso(h.date), optional: Boolean(h.optional) }));
}

const isWeekday = (date) => date.getUTCDay() % 6 !== 0;

/** Working days per month: weekdays minus the holidays you take off. */
export function workdays(year, { includeOptional = false } = {}) {
  const off = new Set(holidays(year).filter((h) => includeOptional || !h.optional).map((h) => h.date));
  return Array.from({ length: 12 }, (_, m) => {
    const days = new Date(Date.UTC(year, m + 1, 0)).getUTCDate();
    const dates = Array.from({ length: days }, (_, d) => utc(year, m + 1, d + 1));
    return { month: m, days: dates.filter((d) => isWeekday(d) && !off.has(iso(d))).length };
  });
}

/** Billable hours: working days minus vacation days, times hours per day. */
export function billableHours(months, { hoursPerDay, vacationDays }) {
  const total = months.reduce((sum, m) => sum + m.days, 0);
  const days = Math.max(total - vacationDays, 0);
  return { workdays: total, days, hours: days * hoursPerDay };
}
