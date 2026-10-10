// Pure helpers for the mail worker: authentication results, the mail check report and loop protection.
// `email` is the object postal-mime returns: { from, subject, text, html, headers: [{ key, value }], messageId, attachments }.

const header = (email, name) => email.headers.find((h) => h.key === name)?.value ?? "";

/** spf/dkim/dmarc verdicts ("pass", "fail", "none", …) from the receiving server's Authentication-Results. */
export function authResults(email) {
  const results = `${header(email, "authentication-results")} ${header(email, "arc-authentication-results")}`;
  const verdict = (method) => results.match(new RegExp(`\\b${method}=(\\w+)`, "i"))?.[1].toLowerCase() ?? null;
  const receivedSpf = header(email, "received-spf").split(/\s/)[0].toLowerCase(); // "pass (…)" -> "pass"
  return { spf: verdict("spf") ?? (receivedSpf || null), dkim: verdict("dkim"), dmarc: verdict("dmarc") };
}

const authCheck = (label, result) => ({
  label,
  status: result === "pass" ? "ok" : result === "none" || !result ? "warn" : "bad",
  detail: result ?? "geen resultaat",
});

const LINK_SHORTENERS = /\b(bit\.ly|tinyurl\.com|t\.co|goo\.gl|ow\.ly|is\.gd|buff\.ly)\//i;
const isShouting = (subject) => subject === subject.toUpperCase() && /[A-Z]{4}/.test(subject);
const linksIn = (email) => (email.html || email.text || "").match(/https?:\/\/[^\s"'<>]+/g) ?? [];

function messageIdCheck(email) {
  return { label: "Message-ID", status: email.messageId ? "ok" : "bad", detail: email.messageId ? "aanwezig" : "ontbreekt" };
}

function textPartCheck(email) {
  const hasText = Boolean(email.text?.trim());
  return { label: "Tekstversie", status: hasText ? "ok" : "warn",
    detail: hasText ? "aanwezig" : "alleen HTML: spamfilters waarderen een tekstversie" };
}

function subjectCheck(email) {
  const subject = email.subject ?? "";
  if (!subject) return { label: "Onderwerp", status: "warn", detail: "leeg" };
  if (isShouting(subject)) return { label: "Onderwerp", status: "warn", detail: "volledig in hoofdletters" };
  return { label: "Onderwerp", status: "ok", detail: `"${subject}"` };
}

function linksCheck(email) {
  const links = linksIn(email);
  const shortened = links.some((l) => LINK_SHORTENERS.test(l));
  return { label: "Links", status: shortened ? "warn" : "ok",
    detail: `${links.length} link(s)${shortened ? ", met linkverkorter (spamsignaal)" : ""}` };
}

function unsubscribeCheck(email) {
  const present = Boolean(header(email, "list-unsubscribe"));
  return { label: "List-Unsubscribe", status: present ? "ok" : "info",
    detail: present ? "aanwezig" : "niet aanwezig (verplicht voor nieuwsbrieven)" };
}

const attachmentsCheck = (email) => ({ label: "Bijlagen", status: "info", detail: `${email.attachments?.length ?? 0}` });

const CONTENT_CHECKS = [messageIdCheck, textPartCheck, subjectCheck, linksCheck, unsubscribeCheck, attachmentsCheck];

/** The full mail check: authentication first, then content signals. */
export function mailChecks(email) {
  const auth = authResults(email);
  return [authCheck("SPF", auth.spf), authCheck("DKIM", auth.dkim), authCheck("DMARC", auth.dmarc),
    ...CONTENT_CHECKS.map((check) => check(email))];
}

const ICONS = { ok: "✅", warn: "⚠️", bad: "❌", info: "ℹ️" };

export const formatReport = (checks) => checks.map((c) => `${ICONS[c.status]} ${c.label}: ${c.detail}`).join("\n");

// Signs that a mail was sent by a machine (bounce, auto-reply, mailing list).
const AUTOMATED_SIGNS = [
  (email) => !["", "no"].includes(header(email, "auto-submitted").toLowerCase()),
  (email) => ["bulk", "list", "junk", "auto_reply"].includes(header(email, "precedence").toLowerCase()),
  (email) => Boolean(header(email, "list-id")),
  (email) => /^(mailer-daemon|postmaster|no-?reply|bounce)/i.test(email.from?.address ?? ""),
];

/** Never answer automated mail: two bots replying to each other is a mail loop. */
export const shouldAutoReply = (email) => !AUTOMATED_SIGNS.some((isAutomated) => isAutomated(email));

/** Body of the reply mail: the AI answer (if any) above the mail check report. */
export function replyBody({ aiText, checks, note }) {
  return [
    aiText ?? "",
    note ? `(${note})` : "",
    "──────────────",
    "Mailcheck van je bericht:",
    formatReport(checks),
    "",
    "— Flekto antwoordbot · https://flekto.nl/tools/mail-antwoordbot/",
  ].filter((line, i) => line || i > 1).join("\n").trim();
}
