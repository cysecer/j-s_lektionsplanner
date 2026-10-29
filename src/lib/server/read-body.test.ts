import { describe, expect, it } from "vitest";
import { readBodyLimited } from "./read-body";

function streamOf(chunks: number[], onPull?: () => void) {
  let i = 0;
  return new ReadableStream<Uint8Array<ArrayBuffer>>({
    pull(controller) {
      onPull?.();
      if (i < chunks.length) controller.enqueue(new Uint8Array(chunks[i++]!));
      else controller.close();
    },
  });
}

describe("readBodyLimited", () => {
  it("reads a body within the limit", async () => {
    const body = await readBodyLimited(
      new Request("http://x", { method: "POST", body: "hello" }),
      10,
    );
    expect(body?.toString()).toBe("hello");
  });

  it("rejects by declared Content-Length without reading", async () => {
    let pulled = 0;
    const result = await readBodyLimited(
      { headers: new Headers({ "content-length": "1000" }), body: streamOf([10], () => pulled++) },
      100,
    );
    expect(result).toBeNull();
    // A ReadableStream pre-fetches one chunk on creation; nothing beyond that is read.
    expect(pulled).toBeLessThanOrEqual(1);
  });

  it("stops reading as soon as a lying stream exceeds the limit", async () => {
    let pulled = 0;
    const result = await readBodyLimited(
      {
        headers: new Headers({ "content-length": "5" }),
        body: streamOf([60, 60, 60, 60, 60], () => pulled++),
      },
      100,
    );
    expect(result).toBeNull();
    expect(pulled).toBeLessThanOrEqual(3);
  });

  it("returns an empty buffer for no body", async () => {
    expect(await readBodyLimited({ headers: new Headers(), body: null }, 10)).toEqual(
      Buffer.alloc(0),
    );
  });
});
