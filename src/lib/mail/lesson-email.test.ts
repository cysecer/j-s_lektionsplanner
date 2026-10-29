import { describe, expect, it } from "vitest";
import { toFieldErrors } from "@/lib/server/result";
import { lessonMailSchema, renderLessonEmail } from "./lesson-email";

const valid = {
  lessonId: "0192f0c4-7c1e-7000-8000-000000000001",
  layoutId: null,
  to: [" Anna@Example.ch", "anna@example.ch", "ben@example.ch"],
  subject: "Lektionsvorbereitung 28.11.2018",
  message: "Hallo zusammen\r\n\r\nIm Anhang die Lektion.\r\nGruss Petra  ",
};

function errors(input: object) {
  const result = lessonMailSchema.safeParse({ ...valid, ...input });
  return result.success ? {} : toFieldErrors(result.error);
}

describe("lessonMailSchema", () => {
  it("normalises recipients and line breaks", () => {
    expect(lessonMailSchema.parse(valid)).toMatchObject({
      to: ["anna@example.ch", "ben@example.ch"],
      message: "Hallo zusammen\n\nIm Anhang die Lektion.\nGruss Petra",
    });
  });

  it("needs at least one and at most 20 distinct recipients", () => {
    expect(errors({ to: [] }).to).toEqual(["validation.recipientsRequired"]);
    const many = Array.from({ length: 21 }, (_, i) => `p${i}@example.ch`);
    expect(errors({ to: many }).to).toEqual(["validation.tooManyRecipients"]);
    expect(errors({ to: [...many.slice(0, 20), "P0@example.ch"] })).toEqual({});
  });

  it("refuses invalid addresses and header injection", () => {
    expect(errors({ to: ["kein-mail"] })["to.0"]).toEqual(["validation.email"]);
    expect(errors({ to: ["a@b.ch\r\nBcc: x@y.z"] })["to.0"]).toEqual(["validation.email"]);
    expect(errors({ subject: "Hallo\r\nBcc: x@y.z" }).subject).toEqual(["validation.invalid"]);
    expect(errors({ subject: "   " }).subject).toEqual(["validation.required"]);
    expect(errors({ message: "Text\u0000" }).message).toEqual(["validation.invalid"]);
    expect(errors({ message: "Tab\tund\nZeile" })).toEqual({});
  });

  it("limits the message length and rejects unknown keys", () => {
    expect(errors({ message: "x".repeat(5001) }).message).toEqual([
      { key: "validation.tooLongMax", values: { max: 5000 } },
    ]);
    expect(lessonMailSchema.safeParse({ ...valid, bcc: ["x@y.z"] }).success).toBe(false);
  });
});

describe("renderLessonEmail", () => {
  it("escapes everything and keeps paragraphs and line breaks", () => {
    const { text, html } = renderLessonEmail({
      message: "Hallo <b>alle</b>\nZeile 2\n\nAbsatz & Ende",
      footer: 'Gesendet von "Petra"',
      attachmentName: "2018-11-28_Lektionsvorbereitung.pdf",
    });
    expect(text).toBe('Hallo <b>alle</b>\nZeile 2\n\nAbsatz & Ende\n\n—\nGesendet von "Petra"');
    expect(html).toContain("Hallo &lt;b&gt;alle&lt;/b&gt;<br>Zeile 2</p>");
    expect(html).toContain("Absatz &amp; Ende</p>");
    expect(html).toContain("Gesendet von &quot;Petra&quot;");
    expect(html).not.toContain("<b>");
  });
});
