// Cloudflare Email Worker for the mail domain:
//   reply@<domain>  -> AI answer + mail check, sent back to the (DMARC-verified) sender
//   <id>@<domain>   -> stored in that temporary inbox, shown on flekto.nl/tools/tijdelijke-inbox/
import PostalMime from "postal-mime";
import { EmailMessage } from "cloudflare:email";
import { createMimeMessage } from "mimetext";
import { writeReply } from "./ai.js";
import { mailChecks, replyBody, shouldAutoReply } from "./mail.js";
import { rpc, senderHash } from "./store.js";

const MAX_RAW_BYTES = 2 * 1024 * 1024;
const MAX_STORED_HEADERS = 60;

// `mail` bundles what every step needs: { message (Cloudflare), email (parsed), env }.

/** Arguments for deliver_email: the parsed mail without attachment contents. */
function inboxRecord({ message, email }) {
  return {
    p_from: email.from?.address ?? message.from,
    p_from_name: email.from?.name ?? "",
    p_subject: email.subject ?? "",
    p_text: email.text ?? "",
    p_html: email.html ?? "",
    p_attachments: (email.attachments ?? []).map((a) => ({ filename: a.filename, mimeType: a.mimeType, size: a.content?.byteLength ?? 0 })),
    p_headers: email.headers.slice(0, MAX_STORED_HEADERS),
  };
}

async function deliverToInbox(mail, inbox) {
  const delivered = await rpc(mail.env, "deliver_email", { p_inbox: inbox, ...inboxRecord(mail) });
  if (!delivered) mail.message.setReject("Dit adres bestaat niet (meer) of de inbox is vol.");
}

/** AI text plus a note explaining why it's missing, if it is. */
async function aiAnswer({ email, env }, decision) {
  if (decision === "reply_without_ai") return { aiText: null, note: "Het AI-dagbudget is op; hieronder alleen de mailcheck." };
  try {
    return { aiText: await writeReply(env.ANTHROPIC_API_KEY, email), note: null };
  } catch (err) {
    console.error("claude", err);
    return { aiText: null, note: "Het AI-antwoord lukte niet; hieronder wel de mailcheck." };
  }
}

/** Base64 in 76-character lines: the body has emoji and accents, which plain 7bit MIME can't carry. */
const mimeBase64 = (text) => Buffer.from(text, "utf-8").toString("base64").replace(/.{76}/g, "$&\r\n");

const replySubject = (subject) => (/^re:/i.test(subject ?? "") ? subject : `Re: ${subject || "je bericht"}`);

function buildReply({ message, email, env }, body) {
  const from = `reply@${env.MAIL_DOMAIN}`;
  const mime = createMimeMessage();
  mime.setSender({ name: "Flekto antwoordbot", addr: from });
  mime.setRecipient(message.from);
  mime.setSubject(replySubject(email.subject));
  if (email.messageId) {
    mime.setHeader("In-Reply-To", email.messageId);
    mime.setHeader("References", email.messageId);
  }
  mime.setHeader("Auto-Submitted", "auto-replied"); // tells other bots not to answer us
  mime.addMessage({ contentType: "text/plain", encoding: "base64", data: mimeBase64(body) });
  return new EmailMessage(from, message.from, mime.asRaw());
}

async function answer(mail) {
  if (!shouldAutoReply(mail.email)) return;
  const decision = await rpc(mail.env, "claim_reply", { p_sender_hash: await senderHash(mail.message.from) });
  if (decision === "skip") return;
  const { aiText, note } = await aiAnswer(mail, decision);
  // Cloudflare only lets us reply to senders that pass DMARC, so forged senders never get mail from us.
  await mail.message.reply(buildReply(mail, replyBody({ aiText, checks: mailChecks(mail.email), note })));
}

export default {
  async email(message, env) {
    if (message.rawSize > MAX_RAW_BYTES) return message.setReject("Bericht is groter dan 2 MB.");
    const local = message.to.split("@")[0].toLowerCase();
    const mail = { message, email: await PostalMime.parse(message.raw), env };
    return local === "reply" ? answer(mail) : deliverToInbox(mail, local);
  },
};
