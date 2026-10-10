/** Demand form model (react-hook-form + zod) and the pure mapping to the create/update API bodies. */
import { z } from "zod";
import type {
  DemandCreate,
  DemandEmploymentType,
  DemandOut,
  DemandPriority,
  DemandRateUnit,
  DemandSkillIn,
  DemandUpdate,
  DemandWorkMode,
  InterviewPlanStep,
} from "@/lib/api/types";

export const EMPLOYMENT_TYPES: readonly DemandEmploymentType[] = ["contract", "contract_to_hire", "permanent", "freelance"];
export const EMPLOYMENT_LABELS: Record<DemandEmploymentType, string> = {
  contract: "Contract",
  contract_to_hire: "Contract to hire",
  permanent: "Permanent",
  freelance: "Freelance",
};
export const WORK_MODES: readonly DemandWorkMode[] = ["onsite", "hybrid", "remote"];
export const WORK_MODE_LABELS: Record<DemandWorkMode, string> = { onsite: "On-site", hybrid: "Hybrid", remote: "Remote" };
export const RATE_UNITS: readonly DemandRateUnit[] = ["hour", "day", "month", "year"];
export const RATE_UNIT_LABELS: Record<DemandRateUnit, string> = { hour: "Per hour", day: "Per day", month: "Per month", year: "Per year" };

const optNumber = (min: number, max: number, message: string) =>
  z
    .string()
    .trim()
    .refine((v) => v === "" || (Number.isFinite(Number(v)) && Number(v) >= min && Number(v) <= max), message);

const optInt = (min: number, max: number, message: string) =>
  z
    .string()
    .trim()
    .refine((v) => v === "" || (/^\d+$/.test(v) && Number(v) >= min && Number(v) <= max), message);

export const skillSchema = z.object({
  label: z.string().trim().min(1).max(200),
  skillId: z.string().nullable(),
  skillRefKind: z.enum(["global", "tenant"]).nullable(),
  kind: z.enum(["mandatory", "preferred"]),
  status: z.string().nullable().optional(),
});
export type SkillValue = z.infer<typeof skillSchema>;

export const demandFormSchema = z
  .object({
    title: z.string().trim().min(1, "Enter a title").max(300, "Use at most 300 characters"),
    clientId: z.string().min(1, "Choose a client"),
    clientName: z.string(),
    endClient: z.string().trim().max(300),
    hiringManagerContactId: z.string(),
    department: z.string().trim().max(200),
    positions: optInt(1, 10000, "Enter a whole number from 1").refine((v) => v !== "", "Enter the number of positions"),
    priority: z.enum(["low", "medium", "high", "critical"]),
    employmentType: z.union([z.enum(["contract", "contract_to_hire", "permanent", "freelance"]), z.literal("")]),
    country: z
      .string()
      .trim()
      .refine((v) => v === "" || /^[A-Za-z]{2}$/.test(v), "Use a 2-letter country code, e.g. IN"),
    location: z.string().trim().max(300),
    workMode: z.union([z.enum(["onsite", "hybrid", "remote"]), z.literal("")]),
    shift: z.string().trim().max(100),
    travelPercent: optInt(0, 100, "Enter 0–100"),
    skills: z.array(skillSchema).max(100),
    minExperience: optNumber(0, 99, "Enter 0–99 years"),
    maxExperience: optNumber(0, 99, "Enter 0–99 years"),
    education: z.string().trim().max(500),
    certifications: z.string(),
    languages: z.string(),
    workAuthorization: z.string(),
    clearance: z.string().trim().max(200),
    billRate: optNumber(0, 999999999999, "Enter an amount"),
    payRateMin: optNumber(0, 999999999999, "Enter an amount"),
    payRateMax: optNumber(0, 999999999999, "Enter an amount"),
    currency: z
      .string()
      .trim()
      .refine((v) => v === "" || /^[A-Za-z]{3}$/.test(v), "Use a 3-letter currency code, e.g. INR"),
    rateUnit: z.union([z.enum(["hour", "day", "month", "year"]), z.literal("")]),
    startDate: z.string(),
    targetClosureDate: z.string(),
    submissionLimit: optInt(1, 1000, "Enter 1–1000"),
    interviewPlan: z
      .array(z.object({ name: z.string().trim().min(1, "Enter a round name").max(200), kind: z.string().trim().max(50) }))
      .max(20),
  })
  .superRefine((v, ctx) => {
    if (v.minExperience && v.maxExperience && Number(v.minExperience) > Number(v.maxExperience)) {
      ctx.addIssue({ code: "custom", path: ["maxExperience"], message: "Must be at least the minimum" });
    }
    if (v.payRateMin && v.payRateMax && Number(v.payRateMin) > Number(v.payRateMax)) {
      ctx.addIssue({ code: "custom", path: ["payRateMax"], message: "Must be at least the minimum" });
    }
    if (v.startDate && v.targetClosureDate && v.targetClosureDate < v.startDate) {
      ctx.addIssue({ code: "custom", path: ["targetClosureDate"], message: "Must be on or after the start date" });
    }
  });

export type DemandFormValues = z.infer<typeof demandFormSchema>;

const s = (v: string | number | null | undefined) => (v === null || v === undefined ? "" : String(v));
const list = (v: readonly string[] | null | undefined) => (v ?? []).join(", ");

export function demandFormDefaults(d?: DemandOut | null, client?: { id: string; name: string } | null): DemandFormValues {
  return {
    title: d?.title ?? "",
    clientId: d?.client_id ?? client?.id ?? "",
    clientName: d?.client_name ?? client?.name ?? "",
    endClient: s(d?.end_client),
    hiringManagerContactId: s(d?.hiring_manager_contact_id),
    department: s(d?.department),
    positions: s(d?.positions ?? 1),
    priority: d?.priority ?? "medium",
    employmentType: d?.employment_type ?? "",
    country: s(d?.country),
    location: s(d?.location),
    workMode: d?.work_mode ?? "",
    shift: s(d?.shift),
    travelPercent: s(d?.travel_percent),
    skills: (d?.skills ?? []).map((k) => ({
      label: k.label,
      skillId: k.skill_id,
      skillRefKind: k.skill_ref_kind,
      kind: k.kind,
      status: k.skill_status ?? null,
    })),
    minExperience: s(d?.min_experience_years),
    maxExperience: s(d?.max_experience_years),
    education: s(d?.education),
    certifications: list(d?.certifications),
    languages: list(d?.languages),
    workAuthorization: list(d?.work_authorization),
    clearance: s(d?.clearance),
    billRate: s(d?.bill_rate),
    payRateMin: s(d?.pay_rate_min),
    payRateMax: s(d?.pay_rate_max),
    currency: s(d?.currency),
    rateUnit: d?.rate_unit ?? "",
    startDate: s(d?.start_date),
    targetClosureDate: s(d?.target_closure_date),
    submissionLimit: s(d?.submission_limit),
    interviewPlan: (d?.interview_plan ?? []).map((p) => ({ name: s(p.name as string), kind: s((p.kind as string) ?? "interview") })),
  };
}

const text = (v: string) => (v.trim() === "" ? null : v.trim());
const num = (v: string) => (v.trim() === "" ? null : v.trim());
const int = (v: string) => (v.trim() === "" ? null : Number(v.trim()));
const splitList = (v: string) =>
  v
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

function skillsIn(skills: readonly SkillValue[]): DemandSkillIn[] {
  return skills.map((k) => ({
    label: k.label.trim(),
    skill_id: k.skillId,
    skill_ref_kind: k.skillRefKind,
    kind: k.kind,
  }));
}

function planIn(plan: DemandFormValues["interviewPlan"]): InterviewPlanStep[] {
  return plan.map((p) => ({ name: p.name.trim(), kind: p.kind.trim() || "interview" }));
}

/** Every writable field of the form as API values (the compensation fields only when `withCompensation`). */
function fields(v: DemandFormValues, withCompensation: boolean) {
  const body = {
    title: v.title.trim(),
    client_id: v.clientId,
    positions: Number(v.positions),
    priority: v.priority as DemandPriority,
    end_client: text(v.endClient),
    hiring_manager_contact_id: v.hiringManagerContactId || null,
    department: text(v.department),
    employment_type: (v.employmentType || null) as DemandEmploymentType | null,
    country: v.country.trim() ? v.country.trim().toUpperCase() : null,
    location: text(v.location),
    work_mode: (v.workMode || null) as DemandWorkMode | null,
    shift: text(v.shift),
    travel_percent: int(v.travelPercent),
    min_experience_years: num(v.minExperience),
    max_experience_years: num(v.maxExperience),
    education: text(v.education),
    certifications: splitList(v.certifications),
    languages: splitList(v.languages),
    work_authorization: splitList(v.workAuthorization),
    clearance: text(v.clearance),
    currency: v.currency.trim() ? v.currency.trim().toUpperCase() : null,
    rate_unit: (v.rateUnit || null) as DemandRateUnit | null,
    start_date: v.startDate || null,
    target_closure_date: v.targetClosureDate || null,
    submission_limit: int(v.submissionLimit),
    interview_plan: planIn(v.interviewPlan),
    skills: skillsIn(v.skills),
  } as Record<string, unknown>;
  if (withCompensation) {
    body.bill_rate = num(v.billRate);
    body.pay_rate_min = num(v.payRateMin);
    body.pay_rate_max = num(v.payRateMax);
  }
  return body;
}

export function buildDemandCreate(v: DemandFormValues, withCompensation: boolean): DemandCreate {
  const body = fields(v, withCompensation);
  // Drop empty optional values so the create body stays small.
  for (const [k, val] of Object.entries(body)) {
    if (val === null || (Array.isArray(val) && val.length === 0)) delete body[k];
  }
  return body as DemandCreate;
}

function same(a: unknown, b: unknown): boolean {
  const norm = (x: unknown) => (x === undefined ? null : x);
  const an = norm(a);
  const bn = norm(b);
  // Decimals come back as strings ("10.0"): compare numerically when both parse.
  if (typeof an === "string" && typeof bn === "string" && an !== "" && bn !== "" && Number.isFinite(Number(an)) && Number.isFinite(Number(bn)) && /^[\d.]+$/.test(an) && /^[\d.]+$/.test(bn)) {
    return Number(an) === Number(bn);
  }
  return JSON.stringify(an) === JSON.stringify(bn);
}

/** Only the fields that changed against `d` (edits clear their AI-extracted flag server-side). */
export function buildDemandUpdate(d: DemandOut, v: DemandFormValues, withCompensation: boolean): DemandUpdate {
  const next = fields(v, withCompensation);
  const before = fields(demandFormDefaults(d), withCompensation);
  const body: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(next)) {
    if (!same(val, before[k])) body[k] = val;
  }
  return body as DemandUpdate;
}

/** Form field (react-hook-form name) for an API field name, for server 422 mapping and AI badges. */
export const API_TO_FORM: Record<string, keyof DemandFormValues> = {
  title: "title",
  client_id: "clientId",
  end_client: "endClient",
  hiring_manager_contact_id: "hiringManagerContactId",
  department: "department",
  positions: "positions",
  priority: "priority",
  employment_type: "employmentType",
  country: "country",
  location: "location",
  work_mode: "workMode",
  shift: "shift",
  travel_percent: "travelPercent",
  skills: "skills",
  mandatory_skills: "skills",
  preferred_skills: "skills",
  min_experience_years: "minExperience",
  max_experience_years: "maxExperience",
  education: "education",
  certifications: "certifications",
  languages: "languages",
  work_authorization: "workAuthorization",
  clearance: "clearance",
  bill_rate: "billRate",
  pay_rate_min: "payRateMin",
  pay_rate_max: "payRateMax",
  currency: "currency",
  rate_unit: "rateUnit",
  start_date: "startDate",
  target_closure_date: "targetClosureDate",
  submission_limit: "submissionLimit",
  interview_plan: "interviewPlan",
};
