import { describe, expect, it } from "vitest";
import bundle from "@/app/developers/_generated/docs-bundle.json";
import { canDo, canFinish, checkState, fragmentToken, gstinError, operationAnchor, pkcePair, timeLeft } from "./logic";

describe("developer portal logic", () => {
  it("applies the org role matrix", () => {
    expect(canDo("viewer", "developer")).toBe(false);
    expect(canDo("developer", "developer")).toBe(true);
    expect(canDo("developer", "owner")).toBe(false);
    expect(canDo("owner", "owner")).toBe(true);
    expect(canDo(null, "viewer")).toBe(false);
  });

  it("validates GSTIN like the backend", () => {
    expect(gstinError("27AAPFU0939F1ZV")).toBeNull();
    expect(gstinError("27AAPFU0939F1ZX")).toMatch(/check digit/);
    expect(gstinError("ABC")).toMatch(/format/);
  });

  it("builds an S256 PKCE pair", async () => {
    const { verifier, challenge } = await pkcePair(new Uint8Array(32));
    expect(verifier).toHaveLength(43);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("tracks conformance runs", () => {
    expect(checkState(null)).toBe("pending");
    expect(checkState(false)).toBe("failed");
    const created = new Date(Date.now() - 4 * 60 * 1000).toISOString();
    expect(canFinish(created)).toBe(false);
    expect(canFinish(created, Date.now() + 60 * 1000)).toBe(true);
    expect(timeLeft(new Date(Date.now() + 90_500).toISOString())).toBe("1:30");
  });

  it("reads one-time tokens from the fragment", () => {
    expect(fragmentToken("#t=abc_DEF-1")).toBe("abc_DEF-1");
    expect(fragmentToken("")).toBeNull();
  });

  it("gives every bundle operation, event and tool an anchor", () => {
    const ops = Object.values(bundle.openapi.paths as Record<string, Record<string, { operationId?: string }>>)
      .flatMap((p) => Object.values(p))
      .map((op) => op.operationId);
    expect(ops.length).toBeGreaterThan(10);
    for (const id of ops) expect(operationAnchor(String(id))).toMatch(/^op-/);
    expect(bundle.events.length).toBeGreaterThan(0);
    expect(bundle.scopes.every((s: { description: string }) => s.description)).toBe(true);
  });
});
