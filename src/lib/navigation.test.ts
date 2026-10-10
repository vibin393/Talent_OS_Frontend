import { describe, expect, it } from "vitest";
import { DEFAULT_APP_PATH, isPublicPath, loginUrl, safeNextPath } from "./navigation";

describe("safeNextPath", () => {
  it.each([
    ["/..//evil.com"],
    ["/.//evil.com"],
    ["/a/..//evil.com"],
    ["/a/b/../..//evil.com/x"],
    ["//evil.com"],
    ["/\\evil.com"],
    ["/\t/evil.com"],
    ["/\n/evil.com"],
    ["https://evil.com"],
    ["http:/evil.com"],
    ["javascript:alert(1)"],
    ["evil.com"],
    ["/login?x=1"],
    ["/accept-invite?token=abc"],
    [""],
    [null],
    [undefined],
  ])("rejects %j", (next) => {
    expect(safeNextPath(next)).toBe(DEFAULT_APP_PATH);
  });

  it.each([
    ["/candidates?q=1#x", "/candidates?q=1#x"],
    ["/dashboard", "/dashboard"],
    ["/demands/123", "/demands/123"],
    ["/a/../candidates", "/candidates"],
  ])("accepts %j", (next, expected) => {
    expect(safeNextPath(next)).toBe(expected);
  });
});

describe("isPublicPath", () => {
  it.each(["/login", "/accept-invite", "/forgot-password", "/reset-password", "/status", "/login/x"])(
    "%s is public",
    (p) => expect(isPublicPath(p)).toBe(true),
  );
  it.each(["/dashboard", "/", "/loginx", "/admin"])("%s is not public", (p) => expect(isPublicPath(p)).toBe(false));
});

describe("loginUrl", () => {
  it("omits next for empty or root", () => {
    expect(loginUrl()).toBe("/login");
    expect(loginUrl("/")).toBe("/login");
  });
  it("encodes next", () => {
    expect(loginUrl("/candidates?q=a b&x=1")).toBe("/login?next=%2Fcandidates%3Fq%3Da%20b%26x%3D1");
  });
});
