import { describe, expect, it } from "vitest";
import { clearDraft, draftKey, linkErrorCopy, loadDraft, saveDraft, screenFor } from "./logic";

describe("public link screens by purpose", () => {
  it("AI screening: consent first, then questions, then done", () => {
    expect(screenFor({ purpose: "ai_screening", status: "sent", consent_required: true })).toBe("screening_consent");
    expect(screenFor({ purpose: "ai_screening", status: "sent", consent_required: false })).toBe("screening_questions");
    expect(screenFor({ purpose: "ai_screening", status: "answered", consent_required: false })).toBe("screening_done");
    expect(screenFor({ purpose: "ai_screening", status: "consent_declined" })).toBe("screening_declined");
    expect(screenFor({ purpose: "ai_screening", status: "expired" })).toBe("screening_closed");
  });
  it("consent request and client feedback", () => {
    expect(screenFor({ purpose: "consent_request" })).toBe("consent_request");
    expect(screenFor({ purpose: "client_feedback", status: "none" })).toBe("client_feedback");
    expect(screenFor({ purpose: "offer_response" })).toBe("unsupported");
  });
});

describe("public link error copy", () => {
  it.each([
    [404, "link_invalid", "Link not found"],
    [410, "link_expired", "This link has expired"],
    [410, "link_used", "This link has already been used"],
    [410, "link_revoked", "This link is no longer active"],
    [429, "rate_limited", "Too many attempts"],
    [0, "network_error", "Cannot reach the server"],
  ])("%i %s", (status, code, title) => {
    expect(linkErrorCopy(status, code).title).toBe(title);
  });
});

describe("answer draft", () => {
  const mem = () => {
    const m = new Map<string, string>();
    return {
      m,
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
      removeItem: (k: string) => void m.delete(k),
    };
  };
  it("round-trips without storing the raw token", () => {
    const s = mem();
    saveDraft("tok-secret-123", { a: "x" }, s);
    expect(loadDraft("tok-secret-123", s)).toEqual({ a: "x" });
    const key = [...s.m.keys()][0];
    expect(key).toBe(draftKey("tok-secret-123"));
    expect(key).not.toContain("tok-secret");
    clearDraft("tok-secret-123", s);
    expect(loadDraft("tok-secret-123", s)).toEqual({});
  });
  it("tolerates broken or throwing storage", () => {
    const fail = () => {
      throw new Error("denied");
    };
    const throwing = { getItem: fail, setItem: fail, removeItem: fail };
    expect(loadDraft("t", throwing)).toEqual({});
    expect(() => saveDraft("t", { a: 1 }, throwing)).not.toThrow();
    expect(loadDraft("t", null)).toEqual({});
  });
});
