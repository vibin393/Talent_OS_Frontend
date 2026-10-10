import { describe, expect, it } from "vitest";
import { tokenFromHash } from "./url-token";

describe("fragment token parsing", () => {
  it("reads #token=", () => {
    expect(tokenFromHash("#token=abc_DEF-123")).toBe("abc_DEF-123");
    expect(tokenFromHash("token=xyz")).toBe("xyz");
    expect(tokenFromHash("#foo=1&token=t%2Bk")).toBe("t+k");
  });
  it("returns empty for missing tokens", () => {
    expect(tokenFromHash("")).toBe("");
    expect(tokenFromHash("#")).toBe("");
    expect(tokenFromHash("#section-2")).toBe("");
    expect(tokenFromHash(undefined)).toBe("");
  });
});
