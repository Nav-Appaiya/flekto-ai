// Dutch VAT and freelance hourly-rate maths. Amounts in euros, rounded to cents at the end.

export const VAT_RATES = [21, 9, 0];
const cents = (n) => Math.round(n * 100) / 100;

/** Split an amount into excl./btw/incl., whether the given amount already includes VAT or not. */
export function splitVat(amount, ratePct, includesVat) {
  const factor = 1 + ratePct / 100;
  const excl = includesVat ? amount / factor : amount;
  return { excl: cents(excl), vat: cents(excl * (factor - 1)), incl: cents(excl * factor) };
}

/**
 * Hourly rate needed to reach a yearly target: (income + business costs) / billable hours.
 * Billable hours = working weeks x hours per week x share of hours you can actually invoice.
 */
export function hourlyRate({ income, costs, weeks, hoursPerWeek, billablePct }) {
  const billableHours = Math.round(weeks * hoursPerWeek * (billablePct / 100));
  return { billableHours, rate: billableHours > 0 ? cents((income + costs) / billableHours) : 0 };
}
