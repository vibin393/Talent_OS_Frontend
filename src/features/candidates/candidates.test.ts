import { describe, expect, it } from "vitest";
import type { Candidate360Out, DiffEntry } from "@/lib/api/types";
import { allDiffKeys, buildDiffPatch, diffKey, diffValueText } from "./diff";
import {
  formatCompensation,
  formatExperience,
  formatHumanId,
  formatLocation,
  formatMoney,
  formatRole,
  HIDDEN,
  isCompensationMasked,
} from "./format";
import {
  candidateToForm,
  emptyCandidateForm,
  formToCreate,
  formToUpdate,
  prefillToForm,
  serverFieldErrors,
  validateCandidateForm,
  yearsToMonths,
} from "./form";
import { buildMergeBody, canUndoMerge, compareValueText, defaultFieldChoices, fieldsFromOther } from "./merge";
import { importProgress, validateImportFiles, validateSingleUpload, RESUME_EXTENSIONS, MAX_FILE_BYTES } from "./import-validation";
import { candidateListQuery, EMPTY_CANDIDATE_FILTERS, fromApiSort, hasActiveCandidateFilters, toApiSort } from "./query";

const DIFF: DiffEntry[] = [
  { field: "current_title", current: "Engineer", parsed: "Senior Engineer" },
  { field: "location", current: null, parsed: { city: "Pune" } },
  { field: "emails", parsed: "a@x.com" },
  { field: "emails", parsed: "b@x.com" },
  { field: "skills", parsed: "React" },
  { field: "employment", index: 0, parsed: { employer: "Infosys", title: "Dev" } },
  { field: "employment", index: 2, parsed: { employer: "TCS", title: "Lead", is_current: true, start_date: "2020-01-01" } },
  { field: "education", index: 1, parsed: { institution: "IIT", degree: "BTech" } },
  { field: "certifications", index: 0, parsed: { name: "AWS SA", issuer: "Amazon" } },
];

describe("buildDiffPatch", () => {
  it("returns only the chosen fields", () => {
    const patch = buildDiffPatch(DIFF, new Set(["current_title", "emails:b@x.com", "employment#2", "certifications#0"]));
    expect(patch).toEqual({
      fields: ["current_title"],
      emails: ["b@x.com"],
      phones: [],
      links: [],
      skills: [],
      employment_idx: [2],
      education_idx: [],
      certification_idx: [0],
    });
  });

  it("returns an empty patch when nothing is selected and everything when all are", () => {
    const none = buildDiffPatch(DIFF, []);
    expect(Object.values(none).every((v) => Array.isArray(v) && v.length === 0)).toBe(true);
    const all = buildDiffPatch(DIFF, allDiffKeys(DIFF));
    expect(all.fields).toEqual(["current_title", "location"]);
    expect(all.emails).toEqual(["a@x.com", "b@x.com"]);
    expect(all.skills).toEqual(["React"]);
    expect(all.employment_idx).toEqual([0, 2]);
    expect(all.education_idx).toEqual([1]);
  });

  it("ignores unknown keys and gives unique keys per row", () => {
    expect(buildDiffPatch(DIFF, ["nope", "emails:c@x.com"]).emails).toEqual([]);
    expect(new Set(allDiffKeys(DIFF)).size).toBe(DIFF.length);
    expect(diffKey({ field: "employment", index: 3 })).toBe("employment#3");
  });

  it("renders values", () => {
    expect(diffValueText("location", { city: "Pune", country: "India" })).toBe("Pune, India");
    expect(diffValueText("employment", DIFF[6].parsed)).toBe("Lead @ TCS, 2020-01-01 – present");
    expect(diffValueText("total_experience_months", 30)).toBe("2 yrs 6 mos");
    expect(diffValueText("current_title", null)).toBe("—");
  });
});

describe("format helpers", () => {
  it("formats human ids", () => {
    expect(formatHumanId(1)).toBe("CAN-000001");
    expect(formatHumanId(1234567)).toBe("CAN-1234567");
    expect(formatHumanId(" can-000002 ")).toBe("CAN-000002");
    expect(formatHumanId(null)).toBe("—");
    expect(formatHumanId(-1)).toBe("—");
  });

  const base = {
    current_ctc_amount: "1200000.00",
    current_ctc_currency: "INR",
    current_ctc_unit: "annual" as const,
    expected_ctc_amount: null,
    expected_ctc_currency: null,
    expected_ctc_unit: null,
    masked_fields: [] as string[],
  };

  it("renders compensation and 'Hidden' when masked", () => {
    expect(formatCompensation(base, "current", "en-US")).toBe("₹1,200,000.00 per year");
    expect(formatCompensation(base, "expected", "en-US")).toBe("—");
    const masked = {
      ...base,
      current_ctc_amount: null,
      current_ctc_currency: null,
      current_ctc_unit: null,
      masked_fields: ["current_ctc_amount", "current_ctc_currency", "current_ctc_unit", "expected_ctc_amount"],
    };
    expect(formatCompensation(masked, "current")).toBe(HIDDEN);
    expect(formatCompensation(masked, "expected")).toBe(HIDDEN);
    expect(isCompensationMasked(base, "current")).toBe(false);
    expect(formatMoney("10", "XX1", "en-US")).toBe("10 XX1");
  });

  it("formats location, experience and role", () => {
    expect(formatLocation({ city: "Pune", state: "", country: "India" })).toBe("Pune, India");
    expect(formatLocation(null)).toBe("—");
    expect(formatExperience(0)).toBe("0 mos");
    expect(formatExperience(12)).toBe("1 yr");
    expect(formatExperience(63)).toBe("5 yrs 3 mos");
    expect(formatExperience(null)).toBe("—");
    expect(formatRole("Dev", "Infosys")).toBe("Dev @ Infosys");
    expect(formatRole(null, "Infosys")).toBe("Infosys");
  });
});

describe("import pre-validation", () => {
  const f = (name: string, size = 1000) => ({ name, size });

  it("accepts resumes and a single zip", () => {
    expect(validateImportFiles([f("a.pdf"), f("b.docx")])).toMatchObject({ ok: true, errors: [], isZip: false });
    expect(validateImportFiles([f("batch.ZIP", 50_000_000)])).toMatchObject({ ok: true, isZip: true });
  });

  it("rejects too many, too large, mixed and empty selections", () => {
    expect(validateImportFiles([]).ok).toBe(false);
    const many = Array.from({ length: 201 }, (_, i) => f(`${i}.pdf`));
    expect(validateImportFiles(many).errors[0]).toMatch(/at most 200/);
    expect(validateImportFiles(Array.from({ length: 200 }, (_, i) => f(`${i}.pdf`))).ok).toBe(true);
    expect(validateImportFiles([f("big.pdf", MAX_FILE_BYTES + 1)]).errors[0]).toMatch(/larger than 10 MB/);
    expect(validateImportFiles([f("ok.pdf", MAX_FILE_BYTES)]).ok).toBe(true);
    expect(validateImportFiles([f("a.zip"), f("b.pdf")]).ok).toBe(false);
    expect(validateImportFiles([f("a.zip", 201 * 1024 * 1024)]).ok).toBe(false);
  });

  it("warns about other file types without blocking", () => {
    const r = validateImportFiles([f("a.pdf"), f("photo.png")]);
    expect(r.ok).toBe(true);
    expect(r.warnings[0]).toMatch(/photo.png/);
  });

  it("computes batch progress", () => {
    expect(importProgress(4, { created: 1, failed: 1, queued: 2 })).toBe(0.5);
    expect(importProgress(0, {})).toBe(1);
    expect(importProgress(2, { linked: 1, needs_review: 1 })).toBe(1);
  });

  it("checks single uploads", () => {
    expect(validateSingleUpload(f("cv.pdf"), RESUME_EXTENSIONS)).toBeNull();
    expect(validateSingleUpload(f("cv.txt"), RESUME_EXTENSIONS)).toMatch(/PDF, DOCX/);
    expect(validateSingleUpload(f("cv.pdf", 0), RESUME_EXTENSIONS)).toMatch(/empty/);
  });
});

describe("candidate list query", () => {
  it("maps filters and sort", () => {
    expect(candidateListQuery(EMPTY_CANDIDATE_FILTERS, 1)).toBe("page=1&page_size=20&sort=-updated_at");
    const q = new URLSearchParams(
      candidateListQuery(
        { q: " rahul ", ownerId: "o", tagId: "t", listId: "l", source: "referral", includeArchived: true, sort: "name" },
        3,
      ),
    );
    expect(Object.fromEntries(q)).toEqual({
      page: "3",
      page_size: "20",
      q: "rahul",
      owner_id: "o",
      tag_id: "t",
      list_id: "l",
      source: "referral",
      include_archived: "true",
      sort: "name",
    });
    expect(hasActiveCandidateFilters(EMPTY_CANDIDATE_FILTERS)).toBe(false);
    expect(hasActiveCandidateFilters({ ...EMPTY_CANDIDATE_FILTERS, includeArchived: true })).toBe(true);
  });

  it("converts grid sort state", () => {
    expect(toApiSort("name", "ascending", "-updated_at")).toBe("name");
    expect(toApiSort("updated", "descending", "name")).toBe("-updated_at");
    expect(toApiSort("owner", "ascending", "name")).toBe("name");
    expect(fromApiSort("-name")).toEqual({ sortColumn: "name", sortDirection: "descending" });
  });
});

describe("candidate form", () => {
  it("builds a create body with trimmed values, one primary and no empty rows", () => {
    const v = {
      ...emptyCandidateForm(),
      full_name: "  Rahul Sharma ",
      experience_years: "5.5",
      city: "Pune",
      current_ctc: { amount: "1200000", currency: "inr", unit: "annual" as const },
      emails: [
        { email: " R@X.com ", is_primary: false },
        { email: "", is_primary: true },
        { email: "r2@x.com", is_primary: false },
      ],
      phones: [{ phone: "", is_primary: true }],
      skills: [
        { name: "Java", ref: { kind: "global" as const, id: "g1" }, years: "4", last_used: "", source: "parsed" as const },
        { name: "FooLang", ref: null, years: "", last_used: "", source: "manual" as const },
      ],
      tags: ["java", "java", " "],
    };
    const body = formToCreate(v, "resume-1");
    expect(body.full_name).toBe("Rahul Sharma");
    expect(body.total_experience_months).toBe(66);
    expect(body.location).toEqual({ city: "Pune", state: null, country: null });
    expect(body.current_ctc_currency).toBe("INR");
    expect(body.expected_ctc_amount).toBeNull();
    expect(body.emails).toEqual([
      { email: "R@X.com", is_primary: true },
      { email: "r2@x.com", is_primary: false },
    ]);
    expect(body.phones).toEqual([]);
    expect(body.skills).toEqual([
      { ref: { kind: "global", id: "g1" }, years: "4", last_used: null, source: "parsed" },
      { name: "FooLang", years: null, last_used: null, source: "manual" },
    ]);
    expect(body.tags).toEqual(["java"]);
    expect(body.resume_id).toBe("resume-1");
  });

  it("omits masked compensation from updates", () => {
    const v = { ...emptyCandidateForm(), full_name: "A" };
    expect("current_ctc_amount" in formToUpdate(v, { masked_fields: ["current_ctc_amount"] })).toBe(false);
    expect(formToUpdate(v, { masked_fields: [] }).current_ctc_amount).toBeNull();
  });

  it("round-trips a candidate and a prefill", () => {
    const c = {
      full_name: "A",
      current_title: null,
      current_employer: "X",
      total_experience_months: 24,
      location: { city: "Pune" },
      emails: [{ id: "1", email: "a@x.com", is_primary: true }],
      phones: [{ id: "2", phone_e164: "+919876543210", is_primary: true }],
      links: [{ id: "3", url_norm: "github.com/a", kind: "github" }],
      employment: [],
      education: [],
      certifications: [],
      skills: [{ id: "s", skill: { kind: "global", id: "g", name: "Java" }, source: "manual", years: "2.0", last_used: null }],
      tags: [{ id: "t", name: "hot", color: null }],
      willing_to_relocate: true,
      source: "manual",
      masked_fields: [],
    } as unknown as Candidate360Out;
    const form = candidateToForm(c);
    expect(form.experience_years).toBe("2");
    expect(form.willing_to_relocate).toBe("yes");
    expect(form.phones[0].phone).toBe("+919876543210");
    expect(form.skills[0].ref).toEqual({ kind: "global", id: "g" });

    const pf = prefillToForm({ full_name: "B", skills: [{ name: "FooLang", source: "parsed" }], emails: [] }, ["foolang"]);
    expect(pf.full_name).toBe("B");
    expect(pf.source).toBe("resume_upload");
    expect(pf.skills[0]).toMatchObject({ name: "FooLang", unresolved: true });
    expect(pf.emails).toEqual([{ email: "", is_primary: true }]);
  });

  it("validates", () => {
    const errors = validateCandidateForm({
      ...emptyCandidateForm(),
      emails: [{ email: "bad", is_primary: true }],
      phones: [{ phone: "12", is_primary: true }],
      experience_years: "x",
      current_ctc: { amount: "-1", currency: "RUPEES", unit: "annual" },
    });
    expect(Object.keys(errors).sort()).toEqual(
      ["current_ctc.amount", "current_ctc.currency", "emails.0.email", "experience_years", "full_name", "phones.0.phone"].sort(),
    );
    expect(validateCandidateForm({ ...emptyCandidateForm(), full_name: "Ok" })).toEqual({});
    expect(yearsToMonths("")).toBeNull();
  });

  it("maps server field errors", () => {
    expect(
      serverFieldErrors([
        { field: "body.phones.0.phone", message: "Invalid phone" },
        { field: "body.total_experience_months", message: "Too big" },
        { field: "body.current_ctc_currency", message: "Bad" },
      ]),
    ).toEqual({ "phones.0.phone": "Invalid phone", experience_years: "Too big", "current_ctc.currency": "Bad" });
    expect(serverFieldErrors(undefined)).toEqual({});
  });
});

describe("merge helpers", () => {
  it("defaults choices to the survivor and builds the body", () => {
    expect(defaultFieldChoices(["full_name", "location"], "b")).toEqual({ full_name: "b", location: "b" });
    expect(buildMergeBody("a", { a: "A", b: "B" }, ["full_name", "location"], { location: "b" })).toEqual({
      survivor_id: "A",
      field_choices: { full_name: "a", location: "b" },
    });
    expect(fieldsFromOther("a", ["full_name", "location"], { location: "b" })).toBe(1);
    const now = new Date("2026-09-30T00:00:00Z");
    expect(canUndoMerge({ can_undo: true, undone_at: null, undo_until: "2026-10-30T00:00:00Z" }, now)).toBe(true);
    expect(canUndoMerge({ can_undo: true, undone_at: null, undo_until: "2026-09-29T00:00:00Z" }, now)).toBe(false);
    expect(canUndoMerge({ can_undo: true, undone_at: "2026-09-29T00:00:00Z", undo_until: "2026-10-30T00:00:00Z" }, now)).toBe(false);
  });

  it("renders compared values with masking", () => {
    const p = {
      full_name: "A",
      location: { city: "Pune" },
      willing_to_relocate: false,
      source: "referral",
      owner_id: "u1",
      owner_name: "Owner One",
      current_ctc_amount: null,
      masked_fields: ["current_ctc_amount"],
    } as unknown as Candidate360Out;
    expect(compareValueText("location", p)).toBe("Pune");
    expect(compareValueText("willing_to_relocate", p)).toBe("No");
    expect(compareValueText("source", p)).toBe("Referral");
    expect(compareValueText("owner_id", p)).toBe("Owner One");
    expect(compareValueText("current_ctc_amount", p)).toBe("Hidden");
    expect(compareValueText("current_title", p)).toBe("—");
  });
});
