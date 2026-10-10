import { describe, expect, it } from "vitest";
import {
  applyBlockedResult,
  formatPct,
  itemBlockers,
  marginTone,
  remainingSubmissions,
  type WizardItem,
  wizardBlockers,
} from "./wizard-logic";

const base: WizardItem = {
  applicationId: "a1",
  candidateId: "c1",
  candidateName: "Asha Rao",
  resumeKind: "client_formatted",
  payAmount: "1000",
  billAmount: "1500",
  currency: "INR",
  payUnit: "hour",
  billUnit: "hour",
  consent: "granted",
  attest: false,
  attestText: "",
  consentRequested: false,
  priorWarning: null,
  priorReason: "",
  consentRequiredByServer: false,
};

describe("margin formatting", () => {
  it("formats percentages", () => {
    expect(formatPct("12.50")).toBe("12.5%");
    expect(formatPct("-3.00")).toBe("-3%");
    expect(formatPct(null)).toBe("—");
  });
  it("colours by distance to the minimum", () => {
    expect(marginTone({ margin_pct: "8.00", min_margin_pct: "15", below_min_margin: true })).toBe("danger");
    expect(marginTone({ margin_pct: "17.00", min_margin_pct: "15", below_min_margin: false })).toBe("warning");
    expect(marginTone({ margin_pct: "25.00", min_margin_pct: "15", below_min_margin: false })).toBe("success");
  });
});

describe("wizard blocking", () => {
  it("passes a complete item", () => expect(itemBlockers(base, true)).toEqual([]));
  it("blocks without consent until attested (when allowed)", () => {
    const noConsent = { ...base, consent: "missing" as const };
    expect(itemBlockers(noConsent, true)[0]).toMatch(/Consent needed/);
    expect(itemBlockers({ ...noConsent, attest: true, attestText: "short" }, true)).toHaveLength(1);
    expect(itemBlockers({ ...noConsent, attest: true, attestText: "Agreed by phone today" }, true)).toEqual([]);
    // Attestation not allowed: only the candidate's own consent counts.
    expect(itemBlockers({ ...noConsent, attest: true, attestText: "Agreed by phone today" }, false)[0]).toMatch(/consent request/);
  });
  it("blocks a prior submission without a reason", () => {
    const prior = applyBlockedResult(base, { code: "prior_submission_warning", details: { last_submitted_at: "2026-08-20T10:00:00Z" } });
    expect(prior.priorWarning).toEqual({ lastSubmittedAt: "2026-08-20T10:00:00Z" });
    expect(itemBlockers(prior, true)[0]).toMatch(/give a reason/);
    expect(itemBlockers({ ...prior, priorReason: "Client asked to see him again" }, true)).toEqual([]);
  });
  it("marks consent required from the server", () => {
    const blocked = applyBlockedResult({ ...base, consent: "unknown" }, { code: "submission_consent_required" });
    expect(blocked.consentRequiredByServer).toBe(true);
    expect(itemBlockers(blocked, true)).toHaveLength(1);
  });
  it("checks rates, recipients and the submission limit", () => {
    expect(itemBlockers({ ...base, payAmount: "" }, true)[0]).toMatch(/rates/);
    expect(remainingSubmissions(null, 3)).toBeNull();
    expect(remainingSubmissions(3, 5)).toBe(0);
    const all = wizardBlockers([base, { ...base, applicationId: "a2" }], { attestationAllowed: true, recipientCount: 0, remaining: 1 });
    expect(all).toContain("Choose at least one client contact.");
    expect(all.some((b) => b.includes("Only 1 more submission"))).toBe(true);
  });
});
