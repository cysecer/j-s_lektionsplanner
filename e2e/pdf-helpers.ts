/** Reading generated PDFs in tests, with PDF.js. */

type Box = { str: string; x0: number; y0: number; x1: number; y1: number };
export type PdfPage = { text: string; boxes: Box[] };

export async function readPdf(pdf: Uint8Array): Promise<PdfPage[]> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await getDocument({ data: new Uint8Array(pdf), useSystemFonts: true }).promise;
  const pages: PdfPage[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const content = await (await doc.getPage(n)).getTextContent();
    const boxes: Box[] = [];
    const parts: string[] = [];
    for (const item of content.items) {
      if (!("str" in item)) continue;
      parts.push(item.str);
      if (!item.str.trim()) continue;
      const [x, y] = [item.transform[4] as number, item.transform[5] as number];
      boxes.push({ str: item.str, x0: x, y0: y, x1: x + item.width, y1: y + item.height });
    }
    pages.push({ text: parts.join(" "), boxes });
  }
  await doc.cleanup();
  return pages;
}

/**
 * Pairs of text runs that are drawn over each other – the symptom of a
 * layout that went wrong at a page break. Touching runs on one line are fine.
 */
export function overlappingText(page: PdfPage): string[] {
  const found: string[] = [];
  const { boxes } = page;
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]!;
      const b = boxes[j]!;
      const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
      const h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
      if (w <= 0 || h <= 0) continue;
      const smaller = Math.min((a.x1 - a.x0) * (a.y1 - a.y0), (b.x1 - b.x0) * (b.y1 - b.y0));
      if (w * h > 0.25 * smaller) found.push(`"${a.str}" ✕ "${b.str}"`);
    }
  }
  return found;
}
