import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { detectImageType, ImageError, MAX_UPLOAD_BYTES, processImage } from "./process";

function solid(width: number, height: number, alpha = false) {
  return sharp({
    create: {
      width,
      height,
      channels: alpha ? 4 : 3,
      background: alpha ? { r: 200, g: 0, b: 0, alpha: 0.5 } : { r: 200, g: 0, b: 0 },
    },
  });
}

describe("detectImageType", () => {
  it("recognises PNG, JPEG and HEIC by content", async () => {
    expect(detectImageType(await solid(4, 4).png().toBuffer())).toBe("png");
    expect(detectImageType(await solid(4, 4).jpeg().toBuffer())).toBe("jpeg");
    const heicHeader = Buffer.from([0, 0, 0, 24, ...Buffer.from("ftypheic"), 0, 0, 0, 0]);
    expect(detectImageType(heicHeader)).toBe("heic");
  });

  it.each([
    [
      "SVG (could carry scripts)",
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>'),
    ],
    ["HTML renamed to .png", Buffer.from("<!doctype html><html><body>x</body></html>")],
    ["GIF", Buffer.from("GIF89a\x01\x00\x01\x00\x00\x00\x00")],
    ["PDF", Buffer.from("%PDF-1.7\n%âãÏÓ\n1 0 obj")],
    ["too short", Buffer.from([0xff, 0xd8])],
  ])("rejects %s", (_label, data) => {
    expect(detectImageType(data)).toBeNull();
  });
});

describe("processImage", () => {
  it("scales large photos down and re-encodes as JPEG", async () => {
    const input = await solid(4000, 3000).jpeg().toBuffer();
    const result = await processImage(input, { maxDimension: 2000 });
    expect(result).toMatchObject({
      mimeType: "image/jpeg",
      extension: "jpg",
      width: 2000,
      height: 1500,
    });
  });

  it("keeps transparency as PNG and never enlarges", async () => {
    const result = await processImage(await solid(300, 200, true).png().toBuffer(), {
      maxDimension: 1024,
    });
    expect(result).toMatchObject({ mimeType: "image/png", width: 300, height: 200 });
  });

  it("strips metadata such as GPS location", async () => {
    const withGps = await solid(50, 50)
      .withExif({
        IFD0: { Copyright: "secret" },
        IFD3: { GPSLatitudeRef: "N", GPSLatitude: "47/1 22/1 0/1" },
      })
      .jpeg()
      .toBuffer();
    expect((await sharp(withGps).metadata()).exif).toBeDefined();
    const result = await processImage(withGps, { maxDimension: 100 });
    const meta = await sharp(result.data).metadata();
    expect(meta.exif).toBeUndefined();
    expect(meta.icc).toBeUndefined();
  });

  it("applies the EXIF orientation before stripping it", async () => {
    const rotated = await solid(200, 100).withMetadata({ orientation: 6 }).jpeg().toBuffer();
    const result = await processImage(rotated, { maxDimension: 1000 });
    expect([result.width, result.height]).toEqual([100, 200]);
  });

  it("rejects unsupported, empty, oversized and corrupt files", async () => {
    await expect(
      processImage(Buffer.from("<svg/>".padEnd(64)), { maxDimension: 10 }),
    ).rejects.toEqual(new ImageError("unsupportedType"));
    await expect(processImage(Buffer.alloc(0), { maxDimension: 10 })).rejects.toEqual(
      new ImageError("tooLarge"),
    );
    await expect(
      processImage(Buffer.alloc(MAX_UPLOAD_BYTES + 1), { maxDimension: 10 }),
    ).rejects.toEqual(new ImageError("tooLarge"));
    const truncated = (await solid(100, 100).png().toBuffer()).subarray(0, 60);
    await expect(processImage(truncated, { maxDimension: 10 })).rejects.toEqual(
      new ImageError("unreadable"),
    );
    const fakeHeic = Buffer.from([0, 0, 0, 24, ...Buffer.from("ftypheic"), ...Buffer.alloc(64)]);
    await expect(processImage(fakeHeic, { maxDimension: 10 })).rejects.toEqual(
      new ImageError("unreadable"),
    );
  });
});
