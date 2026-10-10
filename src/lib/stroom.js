// Hourly day-ahead electricity prices (EnergyZero, incl. btw) and the cheapest window to run something.

const HOUR = 3600_000;

/** Prices from local midnight today until midnight after tomorrow: [{ time: Date, price: €/kWh }]. */
export async function fetchPrices(now = new Date()) {
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const till = new Date(from.getTime() + 48 * HOUR - 1);
  const q = new URLSearchParams({
    fromDate: from.toISOString(), tillDate: till.toISOString(), interval: "4", usageType: "1", inclBtw: "true",
  });
  const res = await fetch(`https://api.energyzero.nl/v1/energyprices?${q}`);
  if (!res.ok) throw new Error(`EnergyZero ${res.status}`);
  const { Prices } = await res.json();
  return Prices.map((p) => ({ time: new Date(p.readingDate), price: p.price }));
}

/** Consecutive block of `hours` starting at/after `after` with the lowest average price, or null. */
export function cheapestWindow(prices, hours, after) {
  const startHour = after.getTime() - (after.getTime() % HOUR);
  let best = null;
  for (let i = 0; i + hours <= prices.length; i++) {
    const block = prices.slice(i, i + hours);
    if (block[0].time.getTime() < startHour) continue;
    const avg = block.reduce((sum, p) => sum + p.price, 0) / hours;
    if (!best || avg < best.avg) best = { start: i, avg };
  }
  return best;
}
