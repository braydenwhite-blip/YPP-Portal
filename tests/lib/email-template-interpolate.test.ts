import { describe, expect, it } from "vitest";
import {
  interpolate,
  interpolateSubject,
  escapeHtml,
  extractVariableNames,
} from "@/lib/email-templates/interpolate";

describe("escapeHtml", () => {
  it("escapes the HTML-significant characters", () => {
    expect(escapeHtml(`<a href="x">&'`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&#39;");
  });
});

describe("interpolate", () => {
  it("substitutes and HTML-escapes values by default", () => {
    const out = interpolate("<p>Hi {{name}}</p>", { name: "<script>alert(1)</script>" });
    expect(out).toBe("<p>Hi &lt;script&gt;alert(1)&lt;/script&gt;</p>");
  });

  it("supports spaced placeholders", () => {
    expect(interpolate("a {{ x }} b", { x: "Y" })).toBe("a Y b");
  });

  it("drops missing variables (empty by default) rather than leaking the token", () => {
    expect(interpolate("Hi {{missing}}!", {})).toBe("Hi !");
  });

  it("does NOT re-interpolate a value that itself contains a placeholder", () => {
    // single-pass: {{inner}} produced by the first value is left as literal text
    const out = interpolate("{{a}}", { a: "{{b}}", b: "X" });
    expect(out).toBe("{{b}}");
  });

  it("throws on missing when onMissing=throw", () => {
    expect(() => interpolate("{{x}}", {}, { onMissing: "throw" })).toThrow(/x/);
  });

  it("can keep the raw token when onMissing=keep", () => {
    expect(interpolate("{{x}}", {}, { onMissing: "keep" })).toBe("{{x}}");
  });
});

describe("interpolateSubject", () => {
  it("does not HTML-escape (plain text) but strips control characters", () => {
    const out = interpolateSubject("Re: {{title}}", { title: "A & B\nnewline" });
    expect(out).toBe("Re: A & B newline");
  });
});

describe("extractVariableNames", () => {
  it("returns the unique set of referenced variables", () => {
    expect(extractVariableNames("{{a}} {{b}} {{a}}").sort()).toEqual(["a", "b"]);
  });
});
