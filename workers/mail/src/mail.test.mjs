import assert from "node:assert/strict";
import { authResults, mailChecks, replyBody, shouldAutoReply } from "./mail.js";

const email = (headers = {}, extra = {}) => ({
  from: { address: "jan@voorbeeld.nl", name: "Jan" }, subject: "Vraag", text: "Hoi, zie https://bit.ly/x", html: "",
  messageId: "<1@voorbeeld.nl>", attachments: [],
  headers: Object.entries(headers).map(([key, value]) => ({ key, value })), ...extra,
});

const signed = email({ "authentication-results": "mx.cloudflare.net; dkim=pass header.d=voorbeeld.nl; spf=pass smtp.mailfrom=x; dmarc=pass" });
assert.deepEqual(authResults(signed), { spf: "pass", dkim: "pass", dmarc: "pass" });
assert.deepEqual(authResults(email({ "received-spf": "softfail (domain does not designate)" })), { spf: "softfail", dkim: null, dmarc: null });

const checks = mailChecks(signed);
assert.equal(checks.find((c) => c.label === "SPF").status, "ok");
assert.equal(checks.find((c) => c.label === "Links").status, "warn"); // bit.ly
assert.equal(mailChecks(email({}, { subject: "GRATIS GELD" })).find((c) => c.label === "Onderwerp").status, "warn");
assert.equal(mailChecks(email({}, { messageId: undefined })).find((c) => c.label === "Message-ID").status, "bad");
assert.equal(mailChecks(email()).find((c) => c.label === "DKIM").status, "warn");

assert.ok(shouldAutoReply(signed));
assert.ok(!shouldAutoReply(email({ "auto-submitted": "auto-replied" })));
assert.ok(shouldAutoReply(email({ "auto-submitted": "no" })));
assert.ok(!shouldAutoReply(email({ precedence: "bulk" })));
assert.ok(!shouldAutoReply(email({ "list-id": "<news.x>" })));
assert.ok(!shouldAutoReply(email({}, { from: { address: "MAILER-DAEMON@x.nl" } })));

const body = replyBody({ aiText: "Hoi Jan!", checks: checks.slice(0, 1), note: null });
assert.match(body, /^Hoi Jan!\n──/);
assert.match(body, /✅ SPF: pass/);
assert.match(replyBody({ aiText: null, checks: [], note: "dagbudget op" }), /^\(dagbudget op\)/);
console.log("ok");
