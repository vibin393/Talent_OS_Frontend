import { describe, expect, it } from "vitest";
import { caseQuery } from "./api";
import { aadhaarLast4Error, adjudicateGuard, consentGate, needsLawfulAttestation, reasonsError, summariseDeclaration } from "./logic";

describe("adjudicate guard", () => {
  it("allows Clear only from under review", () => {
    expect(adjudicateGuard({ status: "under_review", discrepancy_awaiting_response: false })).toEqual({ canClear: true, canFail: true, blocker: null });
    expect(adjudicateGuard({ status: "discrepancy", discrepancy_awaiting_response: false }).canClear).toBe(false);
    expect(adjudicateGuard({ status: "in_verification", discrepancy_awaiting_response: false })).toMatchObject({ canClear: false, canFail: false });
  });
  it("blocks Failed while a discrepancy awaits the candidate", () => {
    const g = adjudicateGuard({ status: "discrepancy", discrepancy_awaiting_response: true });
    expect(g.canFail).toBe(false);
    expect(g.blocker).toMatch(/awaiting/);
    expect(adjudicateGuard({ status: "discrepancy", discrepancy_awaiting_response: false }).canFail).toBe(true);
  });
  it("requires 20 characters of reasons", () => {
    expect(reasonsError("too short")).not.toBeNull();
    expect(reasonsError("All checks verified with the employer HR.")).toBeNull();
  });
});

describe("worker consent gate", () => {
  it("asks for consent before documents", () => {
    expect(consentGate({ status: "in_progress", stage: "documents", consent_given: false })).toBe("consent");
    expect(consentGate({ status: "in_progress", stage: "documents", consent_given: true })).toBe("documents");
    expect(consentGate({ status: "in_progress", stage: "not_started", consent_given: false })).toBe("waiting");
    expect(consentGate({ status: "in_progress", stage: "verification", consent_given: true })).toBe("waiting");
    expect(consentGate({ status: "clear", stage: "decided", consent_given: true })).toBe("done");
  });
});

describe("Aadhaar and packages", () => {
  it("refuses a full Aadhaar number and accepts the last 4 digits", () => {
    expect(aadhaarLast4Error("2345 6789 0124")).toMatch(/Never enter/);
    expect(aadhaarLast4Error("12a4")).toMatch(/exactly/);
    expect(aadhaarLast4Error("1234")).toBeNull();
  });
  it("flags criminal / drug checks for lawful attestation", () => {
    expect(needsLawfulAttestation(["identity", "employment"])).toBe(false);
    expect(needsLawfulAttestation(["identity", "drug_test"])).toBe(true);
  });
  it("builds the case filter query and summarises declarations", () => {
    expect(caseQuery({ status: "discrepancy", overdue: false })).toBe("?status=discrepancy");
    expect(summariseDeclaration({ aadhaar_last4: "1234" })).toBe("Aadhaar ending 1234");
    expect(summariseDeclaration({ entries: [{ employer: "Infosys" }] })).toBe("Infosys");
  });
});
