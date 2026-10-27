/**
 * Minimal transactional email layout: greeting, one paragraph, one button,
 * the plain link as fallback. Every interpolated value is HTML-escaped.
 */

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export type ActionEmail = {
  greeting: string;
  body: string;
  buttonLabel: string;
  url: string;
  footer: string;
  signature: string;
};

export function renderActionEmail(email: ActionEmail): { text: string; html: string } {
  const url = new URL(email.url);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Email links must use http(s)");
  }
  const href = escapeHtml(url.toString());

  const text = [
    `${email.greeting},`,
    "",
    email.body,
    url.toString(),
    "",
    email.footer,
    "",
    email.signature,
  ].join("\n");

  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f5f5f4;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#1c1917">
<div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px">
<p style="margin:0 0 16px">${escapeHtml(email.greeting)},</p>
<p style="margin:0 0 24px;line-height:1.5">${escapeHtml(email.body)}</p>
<p style="margin:0 0 24px"><a href="${href}" style="display:inline-block;background:#2b579a;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">${escapeHtml(email.buttonLabel)}</a></p>
<p style="margin:0 0 24px;font-size:13px;color:#57534e;word-break:break-all">${href}</p>
<p style="margin:0 0 8px;font-size:13px;color:#57534e">${escapeHtml(email.footer)}</p>
<p style="margin:0;font-size:13px;color:#57534e">${escapeHtml(email.signature)}</p>
</div></body></html>`;

  return { text, html };
}
