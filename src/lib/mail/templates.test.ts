import { describe, expect, it } from "vitest";
import { renderActionEmail } from "./templates";

const base = {
  greeting: "Hallo Andrea",
  body: "Mit diesem Link meldest du dich an.",
  buttonLabel: "Jetzt anmelden",
  url: "http://localhost:3000/api/auth/magic-link/verify?token=abc&callbackURL=%2F",
  footer: "Falls du das nicht angefordert hast, ignoriere diese E-Mail.",
  signature: "Dein Lektionsplaner",
};

describe("renderActionEmail", () => {
  it("renders text and html with the link", () => {
    const { text, html } = renderActionEmail(base);
    expect(text).toContain(base.url);
    expect(html).toContain(
      'href="http://localhost:3000/api/auth/magic-link/verify?token=abc&amp;callbackURL=%2F"',
    );
  });

  it("escapes interpolated values", () => {
    const { html } = renderActionEmail({ ...base, greeting: 'Hallo <script>alert("x")</script>' });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("refuses non-http links", () => {
    expect(() => renderActionEmail({ ...base, url: "javascript:alert(1)" })).toThrow();
  });
});
