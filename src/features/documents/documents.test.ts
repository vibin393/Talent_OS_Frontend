import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import {
  accessLevelInfo,
  canCancelRequest,
  categorySlug,
  expiryBadge,
  hasSigner,
  insertAtCursor,
  mergeToken,
  moveItem,
  ownerMergeRefs,
  removeAt,
  renumberRoles,
  requestErrorMessage,
  type SignerDraft,
  toSignerIns,
  unknownMergeFields,
  verifyResultCopy,
} from "./logic";

describe("signer reorder", () => {
  const list = ["a", "b", "c"];
  it("moves up and down", () => {
    expect(moveItem(list, 1, -1)).toEqual(["b", "a", "c"]);
    expect(moveItem(list, 1, 1)).toEqual(["a", "c", "b"]);
  });
  it("ignores moves past the ends and never mutates", () => {
    expect(moveItem(list, 0, -1)).toEqual(list);
    expect(moveItem(list, 2, 1)).toEqual(list);
    expect(list).toEqual(["a", "b", "c"]);
  });
  it("removes and renumbers roles in list order", () => {
    expect(removeAt(list, 1)).toEqual(["a", "c"]);
    expect(
      renumberRoles([
        { role: "tenant_signatory", order: 5, label: "Signatory" },
        { role: "worker", order: 1, label: "Employee" },
      ]).map((r) => r.order),
    ).toEqual([1, 2]);
  });
  it("builds the signer payload and detects duplicates", () => {
    const drafts: SignerDraft[] = [
      { key: "1", kind: "candidate", principal_id: "c1", name: "Asha", email: "" },
      { key: "2", kind: "contact", name: " Ravi ", email: " ravi@x.in " },
    ];
    expect(toSignerIns(drafts)).toEqual([
      { kind: "candidate", principal_id: "c1", name: "Asha" },
      { kind: "contact", email: "ravi@x.in", name: "Ravi" },
    ]);
    expect(hasSigner(drafts, { kind: "candidate", principal_id: "c1", email: "" })).toBe(true);
    expect(hasSigner(drafts, { kind: "contact", email: "RAVI@x.in" })).toBe(true);
    expect(hasSigner(drafts, { kind: "user", principal_id: "u1", email: "u@x.in" })).toBe(false);
  });
});

describe("expiry badge", () => {
  const today = "2026-10-05";
  it("no date", () => expect(expiryBadge(null, today).state).toBe("none"));
  it("expired is danger", () => {
    const b = expiryBadge("2026-10-01", today);
    expect(b.state).toBe("expired");
    expect(b.color).toBe("danger");
  });
  it("under 30 days is warning", () => {
    expect(expiryBadge("2026-10-05", today)).toMatchObject({ state: "soon", color: "warning", label: "Expires today" });
    expect(expiryBadge("2026-10-06", today).label).toBe("Expires in 1 day");
    expect(expiryBadge("2026-11-03", today)).toMatchObject({ state: "soon", days: 29 });
  });
  it("30 days or more is fine", () => expect(expiryBadge("2026-11-04", today).state).toBe("ok"));
});

describe("access level", () => {
  it("hr and finance are restricted", () => {
    expect(accessLevelInfo("hr")).toMatchObject({ label: "HR only", restricted: true });
    expect(accessLevelInfo("finance")).toMatchObject({ label: "Finance only", restricted: true });
    expect(accessLevelInfo("entity").restricted).toBe(false);
  });
});

describe("verify result copy", () => {
  it("maps each match", () => {
    expect(verifyResultCopy({ match: "final", human_id: "SR-1" })).toMatchObject({ intent: "success", title: "Matches the signed document" });
    expect(verifyResultCopy({ match: "original" })).toMatchObject({ intent: "warning", title: "Matches the original (unsigned) document" });
    expect(verifyResultCopy({ match: "none" })).toMatchObject({ intent: "error", title: "No match" });
  });
});

describe("template editor helpers", () => {
  it("inserts a merge field at the cursor", () => {
    const token = mergeToken("candidate", "full_name");
    expect(token).toBe("{{ candidate.full_name }}");
    expect(insertAtCursor("Dear ,", 5, 5, token)).toEqual({ value: `Dear ${token},`, caret: 5 + token.length });
    expect(insertAtCursor("abc", 1, 2, "X")).toEqual({ value: "aXc", caret: 2 });
    expect(insertAtCursor("abc", null, null, "X").value).toBe("abcX");
  });
  it("reads unknown merge fields from a publish 422", () => {
    const e = new ApiError(422, "unknown_merge_field", "Unknown", { fields: ["candidate.shoe_size", 3] });
    expect(unknownMergeFields(e)).toEqual(["candidate.shoe_size"]);
    expect(unknownMergeFields(new ApiError(422, "other", "x"))).toBeNull();
  });
  it("slugs categories and merge refs", () => {
    expect(categorySlug(" ID proof ")).toBe("id_proof");
    expect(ownerMergeRefs("candidate", "c1")).toEqual({ candidate_id: "c1" });
  });
  it("request helpers", () => {
    expect(canCancelRequest("sent")).toBe(true);
    expect(canCancelRequest("completed")).toBe(false);
    expect(requestErrorMessage(new ApiError(422, "merge_source_missing", "x", { namespaces: ["client"] }), "f")).toContain("(client)");
    expect(requestErrorMessage(new Error("x"), "fallback")).toBe("fallback");
  });
});
