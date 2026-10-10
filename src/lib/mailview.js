// Renders a received HTML mail for a sandboxed iframe (srcdoc). The iframe sandbox already blocks scripts;
// the CSP additionally blocks remote content (tracking pixels) unless the viewer opts in.

export function htmlMailDocument(html, { loadRemoteImages = false } = {}) {
  const imgSrc = loadRemoteImages ? "data: cid: https:" : "data: cid:";
  const csp = `default-src 'none'; style-src 'unsafe-inline'; img-src ${imgSrc}; font-src data:`;
  return `<!doctype html><html><head><meta charset="utf-8">`
    + `<meta http-equiv="Content-Security-Policy" content="${csp}">`
    + `<base target="_blank"><style>body{font:15px/1.5 system-ui,sans-serif;margin:16px;color:#17171a;background:#fff}</style>`
    + `</head><body>${html}</body></html>`;
}

/** Whether a mail's HTML references remote images, so the UI only offers "load images" when it matters. */
export const hasRemoteImages = (html) => /<img[^>]+src=["']?https?:/i.test(html);
