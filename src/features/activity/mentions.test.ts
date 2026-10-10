import { describe, expect, it } from "vitest";
import {
  formatMention,
  insertMention,
  mentionIds,
  mentionQueryAt,
  parseBody,
  sanitizeMentionName,
  toDisplay,
  toMarkup,
  toPlainText,
} from "./mentions";

const ANN = "0b8f4a5e-1c2d-4e3f-8a9b-0c1d2e3f4a5b";
const BOB = "11111111-2222-4333-8444-555555555555";

describe("formatMention", () => {
  it("builds the backend markup", () => {
    expect(formatMention("Ann Lee", ANN)).toBe(`@[Ann Lee](user:${ANN})`);
  });

  it("lower-cases the id and sanitizes the name", () => {
    expect(formatMention(" Ann ]\nLee ", ANN.toUpperCase())).toBe(`@[Ann Lee](user:${ANN})`);
  });

  it("caps names at 200 characters and never produces an empty name", () => {
    expect(sanitizeMentionName("x".repeat(250))).toHaveLength(200);
    expect(sanitizeMentionName(" ] ")).toBe("user");
  });
});

describe("parseBody", () => {
  it("splits text and mentions", () => {
    expect(parseBody(`Hi @[Ann Lee](user:${ANN}), call @[Bob](user:${BOB}).`)).toEqual([
      { kind: "text", text: "Hi " },
      { kind: "mention", name: "Ann Lee", id: ANN },
      { kind: "text", text: ", call " },
      { kind: "mention", name: "Bob", id: BOB },
      { kind: "text", text: "." },
    ]);
  });

  it("returns a single text segment without mentions and nothing for an empty body", () => {
    expect(parseBody("plain @ann text")).toEqual([{ kind: "text", text: "plain @ann text" }]);
    expect(parseBody("")).toEqual([]);
  });

  it("ignores malformed markup", () => {
    const body = "@[Ann](user:not-a-uuid) and @[](user:" + ANN + ") and @[A\nB](user:" + ANN + ")";
    expect(parseBody(body)).toEqual([{ kind: "text", text: body }]);
  });

  it("normalizes upper-case ids", () => {
    expect(mentionIds(`@[Ann](user:${ANN.toUpperCase()})`)).toEqual([ANN]);
  });
});

describe("mentionIds / toPlainText", () => {
  it("dedupes ids in order of appearance", () => {
    expect(mentionIds(`@[Bob](user:${BOB}) @[Ann](user:${ANN}) @[Bob](user:${BOB})`)).toEqual([BOB, ANN]);
  });

  it("renders mentions as @Name", () => {
    expect(toPlainText(`Ping @[Ann Lee](user:${ANN})!`)).toBe("Ping @Ann Lee!");
  });
});

describe("toMarkup / toDisplay", () => {
  it("wraps picked mentions and leaves other @words alone", () => {
    const text = "Thanks @Ann Lee and @Bob, cc @someone";
    expect(toMarkup(text, [{ id: ANN, name: "Ann Lee" }, { id: BOB, name: "Bob" }])).toBe(
      `Thanks @[Ann Lee](user:${ANN}) and @[Bob](user:${BOB}), cc @someone`,
    );
  });

  it("prefers the longest name and requires a word boundary", () => {
    const mentions = [
      { id: BOB, name: "Ann" },
      { id: ANN, name: "Ann Lee" },
    ];
    expect(toMarkup("@Ann Lee @Ann @Annie", mentions)).toBe(`@[Ann Lee](user:${ANN}) @[Ann](user:${BOB}) @Annie`);
  });

  it("drops mentions whose text was removed and escapes regex characters in names", () => {
    expect(toMarkup("no mention here", [{ id: ANN, name: "Ann" }])).toBe("no mention here");
    expect(toMarkup("hi @A.B (x)", [{ id: ANN, name: "A.B (x)" }])).toBe(`hi @[A.B (x)](user:${ANN})`);
    expect(toMarkup("hi @AxB", [{ id: ANN, name: "A.B" }])).toBe("hi @AxB");
  });

  it("does not re-wrap existing markup", () => {
    const body = `@[Ann](user:${ANN}) and @Ann`;
    expect(toMarkup(body, [{ id: ANN, name: "Ann" }])).toBe(`@[Ann](user:${ANN}) and @[Ann](user:${ANN})`);
  });

  it("round-trips through the display form", () => {
    const body = `Call @[Ann Lee](user:${ANN}) about @[Bob](user:${BOB}) tomorrow`;
    const { text, mentions } = toDisplay(body);
    expect(text).toBe("Call @Ann Lee about @Bob tomorrow");
    expect(mentions).toEqual([
      { id: ANN, name: "Ann Lee" },
      { id: BOB, name: "Bob" },
    ]);
    expect(toMarkup(text, mentions)).toBe(body);
  });

  it("handles unicode names", () => {
    expect(toMarkup("hola @José, ok", [{ id: ANN, name: "José" }])).toBe(`hola @[José](user:${ANN}), ok`);
    expect(toMarkup("@Josée", [{ id: ANN, name: "José" }])).toBe("@Josée");
  });
});

describe("mentionQueryAt / insertMention", () => {
  it("detects an @query before the caret", () => {
    expect(mentionQueryAt("hello @an", 9)).toEqual({ start: 6, query: "an" });
    expect(mentionQueryAt("@", 1)).toEqual({ start: 0, query: "" });
    expect(mentionQueryAt("see @ann l", 10)).toEqual({ start: 4, query: "ann l" });
  });

  it("ignores emails, finished tokens and line breaks", () => {
    expect(mentionQueryAt("mail a@b.com", 12)).toBeNull();
    expect(mentionQueryAt("hi @ ann", 8)).toBeNull();
    expect(mentionQueryAt("@ann\nnext", 9)).toBeNull();
    expect(mentionQueryAt("no at here", 10)).toBeNull();
  });

  it("uses only the text before the caret", () => {
    expect(mentionQueryAt("@an rest", 3)).toEqual({ start: 0, query: "an" });
  });

  it("replaces the query with @Name and a trailing space", () => {
    expect(insertMention("hi @an", 3, 6, "Ann Lee")).toEqual({ text: "hi @Ann Lee ", caret: 12 });
    expect(insertMention("hi @an more", 3, 6, "Ann")).toEqual({ text: "hi @Ann more", caret: 8 });
  });
});
