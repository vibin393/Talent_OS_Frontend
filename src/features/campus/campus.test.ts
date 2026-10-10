import { describe, expect, it } from "vitest";
import {
  branchesFor,
  buildSlotGrid,
  campusLinkPath,
  canOverride,
  cleanAnswers,
  eligibilityReason,
  funnelSegments,
  isE164,
  isProtectedKey,
  keyFromLabel,
  moveTargets,
  normalizeSchema,
  overrideReasonError,
  plainFieldKeys,
  previewAssignment,
  programsFromDraft,
  registrationQuery,
  schemaBody,
  STANDARD_FIELDS,
  validateAnswers,
  validateBatch,
  validateFormSchema,
} from "./logic";
import { FUNNEL_STAGES, type BatchOut, type FormField, type FunnelRow, type PublicFormField, type SlotOut } from "./types";

const byProgram = { "B.Tech": ["CSE", "IT"], MCA: [] };

const fields: PublicFormField[] = [
  { key: "program", label: "Program", type: "select", required: true },
  { key: "branch", label: "Branch", type: "select", required: true },
  { key: "cgpa", label: "CGPA", type: "decimal", required: false, min: "0", max: "10" },
  { key: "backlogs", label: "Backlogs", type: "number", required: false, min: "0" },
  { key: "graduation_year", label: "Year", type: "number", required: true },
  { key: "skills", label: "Skills", type: "multiselect", required: false, options: ["Java", "Python"] },
  { key: "start", label: "Can start", type: "date", required: false },
  { key: "relocate", label: "Will relocate", type: "bool", required: true },
  { key: "resume", label: "Resume", type: "file", required: true },
];

function file(size: number): File {
  return { name: "cv.pdf", size } as File;
}

describe("form-schema renderer validation", () => {
  const ok = { program: "B.Tech", branch: "CSE", cgpa: "7.5", backlogs: "0", graduation_year: "2027", relocate: true };

  it("accepts a complete, valid answer set", () => {
    expect(validateAnswers(fields, ok, { resume: file(1000) }, byProgram)).toEqual({});
  });

  it("flags required fields, bool must be ticked, file must be attached", () => {
    const e = validateAnswers(fields, {}, {}, byProgram);
    expect(Object.keys(e).sort()).toEqual(["branch", "graduation_year", "program", "relocate", "resume"]);
  });

  it("checks number types and ranges", () => {
    const e = validateAnswers(fields, { ...ok, cgpa: "10.5", backlogs: "1.5", graduation_year: "x" }, { resume: file(1) }, byProgram);
    expect(e.cgpa).toMatch(/10 or less/);
    expect(e.backlogs).toMatch(/whole number/);
    expect(e.graduation_year).toMatch(/whole number/);
    expect(validateAnswers(fields, { ...ok, cgpa: "7.555" }, { resume: file(1) }, byProgram).cgpa).toMatch(/2 decimals/);
  });

  it("keeps the branch to the chosen program's branches", () => {
    expect(validateAnswers(fields, { ...ok, branch: "ECE" }, { resume: file(1) }, byProgram).branch).toBeDefined();
    expect(branchesFor("B.Tech", byProgram)).toEqual(["CSE", "IT"]);
    expect(branchesFor("MCA", byProgram)).toEqual([]);
    expect(branchesFor(null, byProgram)).toEqual(["CSE", "IT"]);
  });

  it("refuses options that are not offered and big files", () => {
    const e = validateAnswers(fields, { ...ok, skills: ["Rust"] }, { resume: file(6 * 1024 * 1024) }, byProgram);
    expect(e.skills).toBeDefined();
    expect(e.resume).toMatch(/5 MB/);
  });

  it("cleans answers for the API: numbers typed, decimals as strings, files and empties dropped", () => {
    expect(cleanAnswers(fields, { ...ok, skills: [], start: "" })).toEqual({
      program: "B.Tech",
      branch: "CSE",
      cgpa: "7.5",
      backlogs: 0,
      graduation_year: 2027,
      relocate: true,
    });
  });
});

describe("form builder rules", () => {
  it("always has the standard fields first, typed, and keeps custom fields", () => {
    const custom: FormField = { key: "linkedin", label: "LinkedIn", type: "text" };
    const out = normalizeSchema([custom, { key: "cgpa", label: "Score", type: "text", required: true }]);
    expect(out.slice(0, STANDARD_FIELDS.length).map((f) => f.key)).toEqual(STANDARD_FIELDS.map((f) => f.key));
    expect(out.find((f) => f.key === "cgpa")).toMatchObject({ type: "decimal", label: "Score", required: true, standard: true });
    expect(out[out.length - 1]).toMatchObject({ key: "linkedin", standard: false });
  });

  it("refuses protected keys", () => {
    for (const k of ["caste", "religion", "gender", "age", "dob", "marital_status", "candidate_gender", "date_of_birth"]) expect(isProtectedKey(k)).toBe(true);
    for (const k of ["agency", "page", "stage", "linkedin"]) expect(isProtectedKey(k)).toBe(false);
    const e = validateFormSchema([...normalizeSchema([]), { key: "religion", label: "Religion", type: "text" }]);
    expect(Object.values(e)[0]).toMatch(/protected/);
  });

  it("caps custom fields at 20 and needs options for choices", () => {
    const many = Array.from({ length: 21 }, (_, i) => ({ key: `f${i}`, label: `F${i}`, type: "text" as const }));
    expect(Object.values(validateFormSchema([...normalizeSchema([]), ...many])).some((m) => /20 custom/.test(m))).toBe(true);
    const e = validateFormSchema([...normalizeSchema([]), { key: "shift", label: "Shift", type: "select", options: [" "] }]);
    expect(Object.values(e)[0]).toMatch(/option/);
  });

  it("derives keys from labels and builds the body", () => {
    expect(keyFromLabel("LinkedIn profile URL")).toBe("linkedin_profile_url");
    expect(keyFromLabel("10th %")).toBe("f_10th");
    const body = schemaBody([{ key: "shift", label: " Shift ", type: "select", options: ["Day", " Day", "", "Night"], min: "" }]);
    expect(body.fields[0]).toEqual({ key: "shift", label: "Shift", type: "select", required: false, standard: false, options: ["Day", "Night"] });
  });

  it("parses program rows", () => {
    expect(programsFromDraft([{ name: " B.Tech ", branches: "CSE, IT, CSE," }, { name: "", branches: "x" }])).toEqual([{ name: "B.Tech", branches: ["CSE", "IT"] }]);
  });
});

describe("eligibility reason rendering", () => {
  const base = { overridden: false, override_reason: null, status: "registered" as const };
  it("shows the first failing rule's label", () => {
    const r = eligibilityReason({ ...base, status: "not_eligible", eligibility: { eligible: false, failing_rule: { index: 2, field: "cgpa", op: "gte", value: "7.0", label: "CGPA ≥ 7.0" } } });
    expect(r).toEqual({ tone: "warning", text: "Not eligible", detail: "Fails: CGPA ≥ 7.0" });
  });
  it("covers eligible, not evaluated and overridden", () => {
    expect(eligibilityReason({ ...base, eligibility: { eligible: true } }).text).toBe("Eligible");
    expect(eligibilityReason({ ...base, eligibility: null }).text).toBe("Not evaluated");
    expect(eligibilityReason({ ...base, overridden: true, override_reason: "Topper", eligibility: { eligible: false } })).toMatchObject({ text: "Overridden ★", detail: "Topper" });
  });
  it("only offers override on not-eligible, needs a 5-character reason", () => {
    expect(canOverride({ status: "not_eligible", overridden: false })).toBe(true);
    expect(canOverride({ status: "eligible", overridden: false })).toBe(false);
    expect(overrideReasonError("ok")).toMatch(/5 characters/);
    expect(overrideReasonError("  valid reason ")).toBeNull();
  });
});

function slot(id: string, panel: number, hhmm: string, reg: string | null = null): SlotOut {
  return {
    id,
    panel_index: panel,
    starts_at: `2027-01-10T${hhmm}:00Z`,
    ends_at: `2027-01-10T${hhmm}:30Z`,
    registration_id: reg,
    candidate_name: reg ? `Name ${reg}` : null,
    interview_id: null,
  };
}

describe("slot grid and assignment preview", () => {
  const batch: Pick<BatchOut, "panels" | "slots"> = {
    panels: [
      { label: "A", interviewer_user_ids: ["u1"] },
      { label: "B", interviewer_user_ids: ["u2"] },
    ],
    slots: [slot("a2", 0, "10:30"), slot("a1", 0, "10:00", "r1"), slot("b1", 1, "10:00"), slot("b2", 1, "10:30")],
  };

  it("builds rows by time and columns by panel", () => {
    const g = buildSlotGrid(batch);
    expect(g.times).toEqual(["2027-01-10T10:00:00Z", "2027-01-10T10:30:00Z"]);
    expect(g.panels.map((p) => p.cells.map((c) => c?.id))).toEqual([
      ["a1", "a2"],
      ["b1", "b2"],
    ]);
  });

  it("previews filling free slots time-major across panels", () => {
    const p = previewAssignment(batch, ["X", "Y", "Z", "W"]);
    expect(p.free).toBe(3);
    expect(p.assigned).toEqual([
      { slotId: "b1", name: "X" },
      { slotId: "a2", name: "Y" },
      { slotId: "b2", name: "Z" },
    ]);
    expect(p.unassigned).toEqual(["W"]);
  });

  it("lists empty slots as move targets", () => {
    expect(moveTargets(batch as BatchOut, "a1").map((s) => s.id).sort()).toEqual(["a2", "b1", "b2"]);
  });

  it("validates a batch body", () => {
    const ok = { demand_id: "d", date: "2027-01-10", start_time: "09:00", end_time: "17:00", panels: [{ label: "A", interviewer_user_ids: ["u"] }] };
    expect(validateBatch(ok)).toBeNull();
    expect(validateBatch({ ...ok, end_time: "08:00" })).toMatch(/end after/);
    expect(validateBatch({ ...ok, panels: [{ label: "A", interviewer_user_ids: [] }] })).toMatch(/interviewer/);
  });
});

describe("misc", () => {
  it("builds the registration query with repeated status", () => {
    expect(registrationQuery({ status: ["eligible", "assessed"], q: " a ", flagged: true }, 50, 100)).toBe(
      "?status=eligible&status=assessed&q=a&flagged=true&limit=50&offset=100",
    );
  });
  it("splits a funnel row into exclusive stage segments", () => {
    const row = { registered: 100, eligible: 60, assessed: 50, shortlisted: 20, interviewed: 15, offered: 10, accepted: 8, joined: 7 } as FunnelRow;
    const segs = funnelSegments(row, FUNNEL_STAGES);
    expect(segs.map((s) => s.count)).toEqual([40, 10, 30, 5, 5, 2, 1, 7]);
    expect(segs.reduce((n, s) => n + s.count, 0)).toBe(100);
  });
  it("checks E.164 phones", () => {
    expect(isE164("+91 98765 43210")).toBe(true);
    expect(isE164("9876543210")).toBe(false);
  });
  it("maps generic secure links of campus purposes", () => {
    expect(campusLinkPath("campus_registration", "abc")).toBe("/campus/r/abc");
    expect(campusLinkPath("event_checkin", "a/b")).toBe("/campus/e/a%2Fb");
    expect(campusLinkPath("esign", "abc")).toBeNull();
  });
});

describe("field error keys", () => {
  it("maps dotted paths to plain keys", () => {
    expect(plainFieldKeys({ "answers.cgpa": "bad", program: "x", "payload.email": "e" })).toEqual({ cgpa: "bad", program: "x", email: "e" });
  });
});
