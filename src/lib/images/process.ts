import heicConvert from "heic-convert";
import sharp from "sharp";

/** Accepted uploads: PNG, JPEG and HEIC/HEIF (iPhone photos). Decided by content, never by name. */
export type DetectedImageType = "png" | "jpeg" | "heic";

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const MAX_INPUT_PIXELS = 50_000_000; // guards against decompression bombs

const HEIC_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"]);

export function detectImageType(data: Uint8Array): DetectedImageType | null {
  if (data.length < 12) return null;
  if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) return "png";
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "jpeg";
  const ftyp = String.fromCharCode(...data.subarray(4, 8));
  const brand = String.fromCharCode(...data.subarray(8, 12));
  if (ftyp === "ftyp" && HEIC_BRANDS.has(brand)) return "heic";
  return null;
}

export class ImageError extends Error {
  constructor(readonly code: "tooLarge" | "unsupportedType" | "unreadable") {
    super(code);
  }
}

export type ProcessedImage = {
  data: Buffer;
  mimeType: "image/png" | "image/jpeg";
  extension: "png" | "jpg";
  width: number;
  height: number;
};

/**
 * Normalises an upload: converts HEIC, applies EXIF rotation, scales down to
 * `maxDimension`, strips all metadata (GPS, camera, …) and re-encodes.
 * Images with transparency stay PNG (logos, sketches); photos become JPEG.
 */
export async function processImage(
  input: Buffer,
  options: { maxDimension: number },
): Promise<ProcessedImage> {
  if (input.length === 0 || input.length > MAX_UPLOAD_BYTES) throw new ImageError("tooLarge");
  const type = detectImageType(input);
  if (!type) throw new ImageError("unsupportedType");

  let source = input;
  if (type === "heic") {
    try {
      source = Buffer.from(await heicConvert({ buffer: input, format: "JPEG", quality: 0.92 }));
    } catch {
      throw new ImageError("unreadable");
    }
  }

  try {
    const image = sharp(source, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" })
      .rotate()
      .resize({
        width: options.maxDimension,
        height: options.maxDimension,
        fit: "inside",
        withoutEnlargement: true,
      });
    const { hasAlpha } = await sharp(source, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
    const { data, info } = hasAlpha
      ? await image.png({ compressionLevel: 9 }).toBuffer({ resolveWithObject: true })
      : await image.jpeg({ quality: 82, mozjpeg: true }).toBuffer({ resolveWithObject: true });
    return hasAlpha
      ? { data, mimeType: "image/png", extension: "png", width: info.width, height: info.height }
      : { data, mimeType: "image/jpeg", extension: "jpg", width: info.width, height: info.height };
  } catch {
    throw new ImageError("unreadable");
  }
}
