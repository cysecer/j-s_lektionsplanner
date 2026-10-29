/**
 * "2018-11-28_Lektionsvorbereitung_Kids_Spiele.pdf". Parts keep letters
 * (incl. umlauts) and digits; everything else becomes a dash.
 */
export function pdfFileName(parts: {
  date: string;
  word: string;
  team: string | null;
  title: string;
}): string {
  const clean = (value: string, max: number) =>
    value
      .normalize("NFC")
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, max)
      .replace(/-+$/, "");
  const name = [
    parts.date,
    clean(parts.word, 40),
    parts.team && clean(parts.team, 40),
    clean(parts.title, 80),
  ]
    .filter(Boolean)
    .join("_");
  return `${name}.pdf`;
}

/**
 * Content-Disposition with an ASCII fallback and the UTF-8 name (RFC 6266),
 * so "Ballspiele_für_Kids.pdf" arrives intact in every browser.
 */
export function attachmentHeader(fileName: string): string {
  const ascii = fileName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]/g, "-");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

/** Escapes text for the PDF footer template (it is HTML). */
export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
