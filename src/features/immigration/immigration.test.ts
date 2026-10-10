import { describe, expect, it } from "vitest";
import {
  addOffset,
  buildPermit,
  caseQuery,
  casesHref,
  cleanDefinition,
  emptyDefinition,
  emptyPermitForm,
  filtersFromParams,
  groupStages,
  isBackwardMove,
  maskedNumber,
  offsetsError,
  permitErrors,
  portalUploadGate,
  publicCanUpload,
  setPrimary,
  validateDefinition,
} from "./logic";
import type { ExpiryFieldDef, StageOut, VisaTypeDefinition } from "./types";

const def = (patch: Partial<VisaTypeDefinition> = {}): VisaTypeDefinition => ({ ...emptyDefinition(), ...patch });
const paths = (d: VisaTypeDefinition) => validateDefinition(d).map((i) => i.path);

describe("definition editor validation", () => {
  it("accepts the default definition", () => {
    expect(validateDefinition(emptyDefinition())).toEqual([]);
  });
  it("requires every stage category to be preparing, filed or pending_decision", () => {
    const d = def({
      stages: [
        { key: "prep", label: "Prep", category: "preparing" },
        { key: "filed", label: "Filed", category: "submitted" },
      ],
    });
    expect(paths(d)).toContain("stages.1.category");
    expect(paths(def({ stages: [{ key: "p", label: "P", category: "pending_decision" }] }))).toEqual([]);
  });
  it("requires at least one stage, valid unique keys and labels", () => {
    expect(paths(def({ stages: [] }))).toContain("stages");
    const d = def({
      stages: [
        { key: "a", label: "A", category: "preparing" },
        { key: "a", label: "", category: "filed" },
        { key: "Bad Key", label: "B", category: "filed" },
      ],
    });
    expect(paths(d)).toEqual(expect.arrayContaining(["stages.1.key", "stages.1.label", "stages.2.key"]));
  });
  it("needs exactly one primary expiry field", () => {
    const none: ExpiryFieldDef[] = [
      { key: "a", label: "A", primary: false, required: true },
      { key: "b", label: "B", primary: false, required: false },
    ];
    expect(paths(def({ expiry_fields: none }))).toContain("expiry_fields");
    expect(paths(def({ expiry_fields: none.map((f) => ({ ...f, primary: true })) }))).toContain("expiry_fields");
    expect(paths(def({ expiry_fields: setPrimary(none, 1) }))).toEqual([]);
    expect(setPrimary(none, 0).map((f) => f.primary)).toEqual([true, false]);
    expect(paths(def({ expiry_fields: [] }))).toContain("expiry_fields");
  });
  it("validates alert offsets: 1..365, unique, descending", () => {
    expect(offsetsError([120, 90, 60, 30])).toBeNull();
    expect(offsetsError([30, 60])).toMatch(/descending/);
    expect(offsetsError([60, 60])).toMatch(/unique/);
    expect(offsetsError([400])).toMatch(/1 and 365/);
    expect(offsetsError([0])).toMatch(/1 and 365/);
    expect(paths(def({ alert_offsets: [30, 90] }))).toContain("alert_offsets");
  });
  it("adds offsets sorted descending and refuses duplicates or out of range", () => {
    expect(addOffset([90, 30], "60")).toEqual({ offsets: [90, 60, 30] });
    expect(addOffset([90, 30], "30")).toHaveProperty("error");
    expect(addOffset([90], "366")).toHaveProperty("error");
    expect(addOffset([90], "1.5")).toHaveProperty("error");
    expect(addOffset([], "")).toHaveProperty("error");
  });
  it("cleans optional empty fields before sending", () => {
    const d = cleanDefinition(def({ stages: [{ key: " prep ", label: "Prep", category: "preparing", sla_days: null, help: " " }] }));
    expect(d.stages[0]).toEqual({ key: "prep", label: "Prep", category: "preparing" });
  });
});

describe("outcome dialog permit form", () => {
  const fields: ExpiryFieldDef[] = [
    { key: "permit_expiry", label: "Permit expiry", primary: true, required: true },
    { key: "brp_expiry", label: "BRP expiry", primary: false, required: true },
    { key: "stamp_expiry", label: "Stamp expiry", primary: false, required: false },
  ];
  it("requires number, start date and every required expiry field from the version", () => {
    const errs = permitErrors(fields, emptyPermitForm());
    expect(Object.keys(errs).sort()).toEqual(["expiry.brp_expiry", "expiry.permit_expiry", "number", "valid_from"]);
  });
  it("passes when required fields are filled and maps primary to valid_to", () => {
    const form = {
      ...emptyPermitForm(),
      number: " AB123456 ",
      valid_from: "2026-10-01",
      values: { permit_expiry: "2029-10-01", brp_expiry: "2029-09-30", stamp_expiry: "" },
    };
    expect(permitErrors(fields, form)).toEqual({});
    expect(buildPermit(fields, form)).toEqual({
      permit_type: null,
      number: "AB123456",
      valid_from: "2026-10-01",
      valid_to: "2029-10-01",
      expiry_values: { brp_expiry: "2029-09-30" },
      conditions: null,
    });
  });
  it("rejects expiry dates before the start date", () => {
    const form = { ...emptyPermitForm(), number: "X1", valid_from: "2026-10-01", values: { permit_expiry: "2025-01-01", brp_expiry: "2027-01-01" } };
    expect(permitErrors(fields, form)).toHaveProperty("expiry.permit_expiry");
  });
});

describe("masking", () => {
  it("shows only the last 4 behind dots", () => {
    expect(maskedNumber("1234")).toBe("••••1234");
    expect(maskedNumber(null)).toBe("—");
    expect(maskedNumber("")).toBe("—");
  });
});

describe("worker portal consent gating", () => {
  it("asks for consent before the first upload", () => {
    expect(portalUploadGate(false, { can_upload: true, status: "requested" })).toBe("consent");
    expect(portalUploadGate(true, { can_upload: true, status: "requested" })).toBe("upload");
    expect(portalUploadGate(true, { can_upload: true, status: "rejected" })).toBe("upload");
    expect(portalUploadGate(false, { can_upload: false, status: "verified" })).toBe("done");
    expect(portalUploadGate(true, { can_upload: false, status: "uploaded" })).toBe("none");
  });
  it("public counsel page needs the consent box ticked when required", () => {
    expect(publicCanUpload(true, false, { can_upload: true })).toBe(false);
    expect(publicCanUpload(true, true, { can_upload: true })).toBe(true);
    expect(publicCanUpload(false, false, { can_upload: true })).toBe(true);
    expect(publicCanUpload(true, true, { can_upload: false })).toBe(false);
  });
});

describe("stages and filters", () => {
  const stages: StageOut[] = [
    { key: "docs", label: "Docs", category: "preparing", sla_days: 14 },
    { key: "cos", label: "CoS", category: "preparing", sla_days: null },
    { key: "filed", label: "Filed", category: "filed", sla_days: null },
    { key: "decision", label: "Decision", category: "pending_decision", sla_days: 21 },
  ];
  it("groups stages by category in canonical order", () => {
    expect(groupStages(stages).map((g) => [g.category, g.stages.length])).toEqual([
      ["preparing", 2],
      ["filed", 1],
      ["pending_decision", 1],
    ]);
  });
  it("detects backward moves (reason required)", () => {
    expect(isBackwardMove(stages, "filed", "docs")).toBe(true);
    expect(isBackwardMove(stages, "docs", "filed")).toBe(false);
    expect(isBackwardMove(stages, null, "docs")).toBe(false);
  });
  it("round-trips dashboard drill-down filters", () => {
    const href = casesHref({ overdue: "true", country: "GB" });
    expect(href).toBe("/immigration/cases?overdue=true&country=GB");
    const params = new URLSearchParams(href.split("?")[1]);
    const f = filtersFromParams(params);
    expect(f).toEqual({ overdue: true, country: "GB" });
    expect(caseQuery(f)).toBe("?country=GB&overdue=true");
    expect(caseQuery({ overdue: false, q: "" })).toBe("");
  });
});
