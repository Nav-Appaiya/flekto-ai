// Invoice maths in cents (no floating-point drift) and the items a Dutch invoice must contain.

const toCents = (n) => Math.round(Number(n || 0) * 100);
export const fromCents = (c) => c / 100;

/** Lines { description, qty, price, vat } -> amounts per line, VAT per rate, totals (all in euros). */
export function invoiceTotals(lines) {
  const rows = lines.map((l) => ({ ...l, amount: Math.round(Number(l.qty || 0) * toCents(l.price)) }));
  const byRate = new Map();
  for (const r of rows) byRate.set(Number(r.vat), (byRate.get(Number(r.vat)) ?? 0) + r.amount);
  const vat = [...byRate].sort(([a], [b]) => b - a).map(([rate, base]) => ({ rate, base, vat: Math.round((base * rate) / 100) }));
  const subtotal = rows.reduce((sum, r) => sum + r.amount, 0);
  const vatTotal = vat.reduce((sum, v) => sum + v.vat, 0);
  return {
    lines: rows.map((r) => ({ ...r, amount: fromCents(r.amount) })),
    vat: vat.map((v) => ({ rate: v.rate, base: fromCents(v.base), vat: fromCents(v.vat) })),
    subtotal: fromCents(subtotal),
    total: fromCents(subtotal + vatTotal),
  };
}

// What the Belastingdienst requires on an invoice (simplified to what a freelancer fills in).
const REQUIRED = [
  ["number", "factuurnummer"], ["date", "factuurdatum"], ["sellerName", "je (bedrijfs)naam"], ["sellerAddress", "je adres"],
  ["kvk", "KvK-nummer"], ["btw", "btw-identificatienummer"], ["clientName", "naam van je klant"], ["clientAddress", "adres van je klant"],
];

export const missingFields = (invoice) => REQUIRED.filter(([key]) => !String(invoice[key] ?? "").trim()).map(([, label]) => label);

/** "€ 1.234,50" */
export const euro = (n) => new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(n);
