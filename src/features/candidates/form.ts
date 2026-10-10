/**
 * Candidate form model: all inputs are strings/booleans so they bind directly to Fluent inputs.
 * Pure conversions to and from the API shapes (create, update, prefill, 360) plus validation.
 */
import type {
  Candidate360Out,
  CandidateCreate,
  CandidatePrefill,
  CandidateSource,
  CandidateUpdate,
  CertificationIn,
  CompensationUnit,
  EducationIn,
  EmploymentIn,
  LinkIn,
  SkillRefIn,
} from "@/lib/api/types";
import { isCompensationMasked } from "./format";

export type LinkKind = NonNullable<LinkIn["kind"]>;

export type EmailRow = { email: string; is_primary: boolean };
export type PhoneRow = { phone: string; is_primary: boolean };
export type LinkRow = { url: string; kind: LinkKind | "" };
export type EmploymentRow = {
  employer: string;
  title: string;
  location: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  description: string;
};
export type EducationRow = {
  institution: string;
  degree: string;
  field: string;
  start_year: string;
  end_year: string;
  grade: string;
};
export type CertificationRow = {
  name: string;
  issuer: string;
  issued_on: string;
  expires_on: string;
  credential_id: string;
};
export type SkillRow = {
  name: string;
  ref: SkillRefIn | null;
  years: string;
  last_used: string;
  source: "parsed" | "manual";
  /** Parsed skill with no catalog match (shown with a warning; created as a pending tenant skill). */
  unresolved?: boolean;
};

export type CompensationGroup = { amount: string; currency: string; unit: CompensationUnit | "" };

export type CandidateFormValues = {
  full_name: string;
  current_title: string;
  current_employer: string;
  experience_years: string;
  city: string;
  state: string;
  country: string;
  current_ctc: CompensationGroup;
  expected_ctc: CompensationGroup;
  availability_date: string;
  notice_period_days: string;
  last_working_date: string;
  work_authorization: string;
  willing_to_relocate: "" | "yes" | "no";
  source: CandidateSource | "";
  source_detail: string;
  owner_id: string | null;
  emails: EmailRow[];
  phones: PhoneRow[];
  links: LinkRow[];
  employment: EmploymentRow[];
  education: EducationRow[];
  certifications: CertificationRow[];
  skills: SkillRow[];
  tags: string[];
};

const emptyComp = (): CompensationGroup => ({ amount: "", currency: "INR", unit: "annual" });

export function emptyCandidateForm(): CandidateFormValues {
  return {
    full_name: "",
    current_title: "",
    current_employer: "",
    experience_years: "",
    city: "",
    state: "",
    country: "",
    current_ctc: emptyComp(),
    expected_ctc: emptyComp(),
    availability_date: "",
    notice_period_days: "",
    last_working_date: "",
    work_authorization: "",
    willing_to_relocate: "",
    source: "manual",
    source_detail: "",
    owner_id: null,
    emails: [{ email: "", is_primary: true }],
    phones: [{ phone: "", is_primary: true }],
    links: [],
    employment: [],
    education: [],
    certifications: [],
    skills: [],
    tags: [],
  };
}

export const emptyEmployment = (): EmploymentRow => ({
  employer: "",
  title: "",
  location: "",
  start_date: "",
  end_date: "",
  is_current: false,
  description: "",
});
export const emptyEducation = (): EducationRow => ({
  institution: "",
  degree: "",
  field: "",
  start_year: "",
  end_year: "",
  grade: "",
});
export const emptyCertification = (): CertificationRow => ({
  name: "",
  issuer: "",
  issued_on: "",
  expires_on: "",
  credential_id: "",
});

const s = (v: string | number | null | undefined): string => (v === null || v === undefined ? "" : String(v));

/** Months -> years text ("66" -> "5.5"). */
export function monthsToYears(months: number | null | undefined): string {
  if (months === null || months === undefined || !Number.isFinite(months)) return "";
  return String(Math.round((months / 12) * 10) / 10);
}

/** Years text -> months (rounded), null when blank; NaN when not a number. */
export function yearsToMonths(years: string): number | null {
  const t = years.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n * 12) : Number.NaN;
}

type Scalars = Pick<
  CandidatePrefill,
  | "full_name"
  | "current_title"
  | "current_employer"
  | "total_experience_months"
  | "location"
  | "current_ctc_amount"
  | "current_ctc_currency"
  | "current_ctc_unit"
  | "expected_ctc_amount"
  | "expected_ctc_currency"
  | "expected_ctc_unit"
  | "availability_date"
  | "notice_period_days"
  | "last_working_date"
  | "work_authorization"
  | "willing_to_relocate"
  | "source"
  | "source_detail"
  | "owner_id"
>;

function scalarsToForm(p: Scalars): Partial<CandidateFormValues> {
  return {
    full_name: s(p.full_name),
    current_title: s(p.current_title),
    current_employer: s(p.current_employer),
    experience_years: monthsToYears(p.total_experience_months),
    city: s(p.location?.city),
    state: s(p.location?.state),
    country: s(p.location?.country),
    current_ctc: {
      amount: s(p.current_ctc_amount),
      currency: s(p.current_ctc_currency) || "INR",
      unit: p.current_ctc_unit ?? "annual",
    },
    expected_ctc: {
      amount: s(p.expected_ctc_amount),
      currency: s(p.expected_ctc_currency) || "INR",
      unit: p.expected_ctc_unit ?? "annual",
    },
    availability_date: s(p.availability_date),
    notice_period_days: s(p.notice_period_days),
    last_working_date: s(p.last_working_date),
    work_authorization: s(p.work_authorization),
    willing_to_relocate: p.willing_to_relocate === true ? "yes" : p.willing_to_relocate === false ? "no" : "",
    source: p.source ?? "manual",
    source_detail: s(p.source_detail),
    owner_id: p.owner_id ?? null,
  };
}

function employmentRows(rows: readonly (EmploymentIn | Candidate360Out["employment"][number])[]): EmploymentRow[] {
  return rows.map((e) => ({
    employer: s(e.employer),
    title: s(e.title),
    location: s(e.location),
    start_date: s(e.start_date),
    end_date: s(e.end_date),
    is_current: !!e.is_current,
    description: s(e.description),
  }));
}
function educationRows(rows: readonly (EducationIn | Candidate360Out["education"][number])[]): EducationRow[] {
  return rows.map((e) => ({
    institution: s(e.institution),
    degree: s(e.degree),
    field: s(e.field),
    start_year: s(e.start_year),
    end_year: s(e.end_year),
    grade: s(e.grade),
  }));
}
function certificationRows(
  rows: readonly (CertificationIn | Candidate360Out["certifications"][number])[],
): CertificationRow[] {
  return rows.map((c) => ({
    name: s(c.name),
    issuer: s(c.issuer),
    issued_on: s(c.issued_on),
    expires_on: s(c.expires_on),
    credential_id: s(c.credential_id),
  }));
}

/** Form values from a resume-draft `prefill` (parsed skills marked; unresolved names flagged). */
export function prefillToForm(prefill: CandidatePrefill, unresolvedNames: readonly string[] = []): CandidateFormValues {
  const base = emptyCandidateForm();
  const unresolved = new Set(unresolvedNames.map((n) => n.toLowerCase()));
  return {
    ...base,
    ...scalarsToForm(prefill),
    source: prefill.source ?? "resume_upload",
    emails: prefill.emails?.length ? prefill.emails.map((e) => ({ email: e.email, is_primary: !!e.is_primary })) : base.emails,
    phones: prefill.phones?.length ? prefill.phones.map((p) => ({ phone: p.phone, is_primary: !!p.is_primary })) : base.phones,
    links: (prefill.links ?? []).map((l) => ({ url: l.url, kind: l.kind ?? "" })),
    employment: employmentRows(prefill.employment ?? []),
    education: educationRows(prefill.education ?? []),
    certifications: certificationRows(prefill.certifications ?? []),
    skills: (prefill.skills ?? []).map((sk) =>
      typeof sk === "string"
        ? { name: sk, ref: null, years: "", last_used: "", source: "parsed" as const, unresolved: unresolved.has(sk.toLowerCase()) }
        : {
            name: sk.name ?? "",
            ref: sk.ref ?? null,
            years: s(sk.years),
            last_used: s(sk.last_used),
            source: sk.source ?? "parsed",
            unresolved: !sk.ref && unresolved.has((sk.name ?? "").toLowerCase()),
          },
    ),
    tags: [...(prefill.tags ?? [])],
  };
}

/** Form values for editing an existing candidate (skills and tags are edited on their own tabs). */
export function candidateToForm(c: Candidate360Out): CandidateFormValues {
  const base = emptyCandidateForm();
  return {
    ...base,
    ...scalarsToForm(c),
    emails: c.emails.length ? c.emails.map((e) => ({ email: e.email, is_primary: e.is_primary })) : base.emails,
    phones: c.phones.length ? c.phones.map((p) => ({ phone: p.phone_e164, is_primary: p.is_primary })) : base.phones,
    links: c.links.map((l) => ({ url: l.url_norm, kind: l.kind })),
    employment: employmentRows(c.employment),
    education: educationRows(c.education),
    certifications: certificationRows(c.certifications),
    skills: c.skills.map((sk) => ({
      name: sk.skill.name,
      ref: { kind: sk.skill.kind, id: sk.skill.id },
      years: s(sk.years),
      last_used: s(sk.last_used),
      source: sk.source,
    })),
    tags: c.tags.map((t) => t.name),
  };
}

const t = (v: string): string | null => (v.trim() ? v.trim() : null);
const int = (v: string): number | null => {
  const x = v.trim();
  if (!x) return null;
  const n = Number(x);
  return Number.isInteger(n) ? n : null;
};

/** Exactly one primary among non-empty rows (the first one when none/several are flagged). */
function withPrimary<T extends { is_primary: boolean }>(rows: T[]): T[] {
  if (rows.length === 0) return rows;
  const first = rows.findIndex((r) => r.is_primary);
  const idx = first < 0 ? 0 : first;
  return rows.map((r, i) => ({ ...r, is_primary: i === idx }));
}

function scalarBody(v: CandidateFormValues, includeCompensation: boolean) {
  const location = { city: t(v.city), state: t(v.state), country: t(v.country) };
  const body: Omit<CandidateUpdate, "emails" | "phones" | "links" | "employment" | "education" | "certifications" | "skills"> = {
    full_name: v.full_name.trim(),
    current_title: t(v.current_title),
    current_employer: t(v.current_employer),
    total_experience_months: yearsToMonths(v.experience_years),
    location: location.city || location.state || location.country ? location : null,
    availability_date: t(v.availability_date),
    notice_period_days: int(v.notice_period_days),
    last_working_date: t(v.last_working_date),
    work_authorization: t(v.work_authorization),
    willing_to_relocate: v.willing_to_relocate === "" ? null : v.willing_to_relocate === "yes",
    source: v.source || null,
    source_detail: t(v.source_detail),
  };
  if (includeCompensation) {
    for (const kind of ["current", "expected"] as const) {
      const g = kind === "current" ? v.current_ctc : v.expected_ctc;
      const amount = t(g.amount);
      Object.assign(body, {
        [`${kind}_ctc_amount`]: amount,
        [`${kind}_ctc_currency`]: amount ? g.currency.trim().toUpperCase() || null : null,
        [`${kind}_ctc_unit`]: amount ? g.unit || null : null,
      });
    }
  }
  return body;
}

function childBody(v: CandidateFormValues) {
  return {
    emails: withPrimary(v.emails.filter((e) => e.email.trim()).map((e) => ({ email: e.email.trim(), is_primary: e.is_primary }))),
    phones: withPrimary(v.phones.filter((p) => p.phone.trim()).map((p) => ({ phone: p.phone.trim(), is_primary: p.is_primary }))),
    links: v.links.filter((l) => l.url.trim()).map((l) => ({ url: l.url.trim(), kind: l.kind || null })),
    employment: v.employment
      .filter((e) => e.employer.trim() || e.title.trim())
      .map((e) => ({
        employer: t(e.employer),
        title: t(e.title),
        location: t(e.location),
        start_date: t(e.start_date),
        end_date: e.is_current ? null : t(e.end_date),
        is_current: e.is_current,
        description: t(e.description),
      })),
    education: v.education
      .filter((e) => e.institution.trim() || e.degree.trim())
      .map((e) => ({
        institution: t(e.institution),
        degree: t(e.degree),
        field: t(e.field),
        start_year: int(e.start_year),
        end_year: int(e.end_year),
        grade: t(e.grade),
      })),
    certifications: v.certifications
      .filter((c) => c.name.trim())
      .map((c) => ({
        name: c.name.trim(),
        issuer: t(c.issuer),
        issued_on: t(c.issued_on),
        expires_on: t(c.expires_on),
        credential_id: t(c.credential_id),
      })),
  };
}

export function skillsBody(rows: readonly SkillRow[]) {
  return rows
    .filter((r) => r.ref || r.name.trim())
    .map((r) => ({
      ...(r.ref ? { ref: r.ref } : { name: r.name.trim() }),
      years: t(r.years),
      last_used: t(r.last_used),
      source: r.source,
    }));
}

/** POST /candidates body. */
export function formToCreate(v: CandidateFormValues, resumeId?: string | null): CandidateCreate {
  const body: CandidateCreate = {
    ...scalarBody(v, true),
    full_name: v.full_name.trim(),
    ...childBody(v),
    skills: skillsBody(v.skills),
    tags: [...new Set(v.tags.map((x) => x.trim()).filter(Boolean))],
  };
  if (v.owner_id) body.owner_id = v.owner_id;
  if (resumeId) body.resume_id = resumeId;
  return body;
}

/**
 * PATCH /candidates/{id} body from the edit drawer: every scalar plus the child lists (the API replaces
 * a provided list). Compensation is omitted when it is masked for the viewer so it is never wiped;
 * skills, tags and the owner are edited elsewhere and omitted.
 */
export function formToUpdate(v: CandidateFormValues, original: Pick<Candidate360Out, "masked_fields">): CandidateUpdate {
  const masked = isCompensationMasked(original, "current") || isCompensationMasked(original, "expected");
  return { ...scalarBody(v, !masked), ...childBody(v) };
}

export type FormErrors = Record<string, string>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CURRENCY_RE = /^[A-Za-z]{3}$/;

/** Client-side checks; keys are dotted paths (`emails.0.email`). The server validates again. */
export function validateCandidateForm(v: CandidateFormValues): FormErrors {
  const e: FormErrors = {};
  if (!v.full_name.trim()) e.full_name = "Enter the candidate's name.";
  else if (v.full_name.trim().length > 200) e.full_name = "Use at most 200 characters.";
  v.emails.forEach((row, i) => {
    if (row.email.trim() && !EMAIL_RE.test(row.email.trim())) e[`emails.${i}.email`] = "Enter a valid email address.";
  });
  v.phones.forEach((row, i) => {
    const digits = row.phone.replace(/\D/g, "");
    if (row.phone.trim() && (digits.length < 7 || digits.length > 15)) e[`phones.${i}.phone`] = "Enter a valid phone number.";
  });
  const months = yearsToMonths(v.experience_years);
  if (months !== null && (Number.isNaN(months) || months < 0 || months > 720)) {
    e.experience_years = "Enter years between 0 and 60.";
  }
  const notice = v.notice_period_days.trim();
  if (notice && (!Number.isInteger(Number(notice)) || Number(notice) < 0 || Number(notice) > 365)) {
    e.notice_period_days = "Enter whole days between 0 and 365.";
  }
  for (const kind of ["current_ctc", "expected_ctc"] as const) {
    const g = v[kind];
    if (g.amount.trim()) {
      const n = Number(g.amount.trim());
      if (!Number.isFinite(n) || n < 0) e[`${kind}.amount`] = "Enter a positive amount.";
      if (!CURRENCY_RE.test(g.currency.trim())) e[`${kind}.currency`] = "Use a 3-letter currency code.";
    }
  }
  v.education.forEach((row, i) => {
    for (const k of ["start_year", "end_year"] as const) {
      const y = row[k].trim();
      if (y && (!Number.isInteger(Number(y)) || Number(y) < 1900 || Number(y) > 2100)) e[`education.${i}.${k}`] = "Enter a year.";
    }
  });
  v.employment.forEach((row, i) => {
    if (row.start_date && row.end_date && !row.is_current && row.end_date < row.start_date) {
      e[`employment.${i}.end_date`] = "End date is before the start date.";
    }
  });
  v.skills.forEach((row, i) => {
    const y = row.years.trim();
    if (y && (!Number.isFinite(Number(y)) || Number(y) < 0 || Number(y) > 60)) e[`skills.${i}.years`] = "Enter years between 0 and 60.";
  });
  return e;
}

/**
 * Map a 422 `details.fields` list (`{field: "body.emails.0.email", message}`) to form error keys.
 * Unknown fields are returned under `_form`.
 */
export function serverFieldErrors(fields: unknown): FormErrors {
  const out: FormErrors = {};
  if (!Array.isArray(fields)) return out;
  for (const f of fields) {
    if (typeof f !== "object" || f === null) continue;
    const rec = f as Record<string, unknown>;
    if (typeof rec.field !== "string") continue;
    const path = rec.field.replace(/^body\./, "");
    const message = typeof rec.message === "string" ? rec.message : "Invalid value";
    const key = path
      .replace(/^total_experience_months$/, "experience_years")
      .replace(/^(current|expected)_ctc_amount$/, "$1_ctc.amount")
      .replace(/^(current|expected)_ctc_currency$/, "$1_ctc.currency")
      .replace(/^location\.(city|state|country)$/, "$1");
    if (!(key in out)) out[key] = message;
  }
  return out;
}
