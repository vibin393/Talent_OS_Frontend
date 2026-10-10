import { describe, expect, it } from "vitest";
import { parseInline, parseMarkdown } from "./markdown";

describe("notice markdown", () => {
  it("parses headings, lists and inline marks", () => {
    const blocks = parseMarkdown("# Title\n\nHello **world**\n\n- one\n- two\n1. a");
    expect(blocks.map((b) => b.t)).toEqual(["h", "p", "ul", "ol"]);
    expect(parseInline("**b** and *i*")).toEqual([
      { t: "strong", v: [{ t: "text", v: "b" }] },
      { t: "text", v: " and " },
      { t: "em", v: [{ t: "text", v: "i" }] },
    ]);
  });
  it("drops unsafe links and never emits HTML", () => {
    expect(parseInline("[x](javascript:alert`1`)")).toEqual([{ t: "text", v: "x" }]);
    expect(parseInline("<script>")).toEqual([{ t: "text", v: "<script>" }]);
    expect(parseInline("[x](https://a.test)")).toEqual([{ t: "link", href: "https://a.test", v: [{ t: "text", v: "x" }] }]);
  });
});
