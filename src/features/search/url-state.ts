/**
 * Candidate search state <-> readable URL params (`/candidates/search?q=...&skills=a,b&exp=3-8`).
 *
 * The URL is the source of truth for the search page, so reload / share restores the same search.
 * Natural-language searches keep the *interpreted* structured state (`q`, filters, `sem`) plus the
 * original text (`nlq`) and the `ai=1` flag, so opening a shared link never re-calls the AI.
 */
import type { CandidateSearchFilters, CandidateSearchIn } from "@/lib/api/types";

export type SearchMode = "boolean" | "nl";
export type SearchSort = "relevance" | "updated" | "experience";

export type SearchFilters = {
  skills: string[];
  skillsMode: "any" | "all";
  expMin: number | null;
  expMax: number | null;
  countries: string[];
  cities: string[];
  workAuth: string[];
  compMin: number | null;
  compMax: number | null;
  compCurrency: string;
  noticeMaxDays: number | null;
  availableBy: string | null;
  certifications: string[];
  employers: string[];
  tags: string[];
  sources: string[];
  owners: string[];
  updatedAfter: string | null;
  updatedBefore: string | null;
  notSubmittedTo: string | null;
  /** Epic 37: include related skills (skills graph expansion); undefined = on. */
  expandSkills?: boolean;
};

export type SearchState = {
  mode: SearchMode;
  /** Boolean query (boolean mode) or the interpreted keyword query (NL mode). */
  q: string;
  /** NL mode: the user's natural-language text. */
  nlq: string;
  /** NL mode: true once the text was interpreted into structured filters (chips). */
  interpreted: boolean;
  /** NL mode: semantic text used for the vector ranking. */
  sem: string;
  filters: SearchFilters;
  sort: SearchSort;
  page: number;
  /** Display labels for id-valued filters (skills / tags / owners / client), keyed by id. */
  labels: Record<string, string>;
};

export const EMPTY_FILTERS: SearchFilters = {
  skills: [],
  skillsMode: "any",
  expMin: null,
  expMax: null,
  countries: [],
  cities: [],
  workAuth: [],
  compMin: null,
  compMax: null,
  compCurrency: "INR",
  noticeMaxDays: null,
  availableBy: null,
  certifications: [],
  employers: [],
  tags: [],
  sources: [],
  owners: [],
  updatedAfter: null,
  updatedBefore: null,
  notSubmittedTo: null,
};

export const EMPTY_STATE: SearchState = {
  mode: "boolean",
  q: "",
  nlq: "",
  interpreted: false,
  sem: "",
  filters: EMPTY_FILTERS,
  sort: "relevance",
  page: 1,
  labels: {},
};

export const PAGE_SIZE = 20;
const SORTS: readonly SearchSort[] = ["relevance", "updated", "experience"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------- list encoding
/** Comma-joined list; commas and backslashes inside items are backslash-escaped. */
export function joinList(items: readonly string[]): string {
  return items.map((s) => s.replace(/\\/g, "\\\\").replace(/,/g, "\\,")).join(",");
}

export function splitList(raw: string | null | undefined): string[] {
  return raw ? splitListKeepEmpty(raw).filter(Boolean) : [];
}

function num(raw: string | undefined | null): number | null {
  if (raw === undefined || raw === null || raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function rangeParam(min: number | null, max: number | null): string | null {
  if (min === null && max === null) return null;
  return `${min ?? ""}-${max ?? ""}`;
}

function parseRange(raw: string | null): [number | null, number | null] {
  if (!raw) return [null, null];
  const idx = raw.indexOf("-");
  if (idx < 0) return [num(raw), null];
  return [num(raw.slice(0, idx)), num(raw.slice(idx + 1))];
}

function date(raw: string | null): string | null {
  return raw && DATE_RE.test(raw) ? raw : null;
}

function ids(raw: string | null): string[] {
  return splitList(raw).filter((s) => UUID_RE.test(s));
}

// ---------------------------------------------------------------- serialize / parse
/** Readable URL params for `state` (defaults omitted). Labels travel for id filters so chips read well. */
export function stateToParams(state: SearchState): URLSearchParams {
  const p = new URLSearchParams();
  const f = state.filters;
  const set = (k: string, v: string | null | undefined) => {
    if (v !== null && v !== undefined && v !== "") p.set(k, v);
  };
  set("q", state.q.trim());
  if (state.mode === "nl") {
    p.set("mode", "nl");
    set("nlq", state.nlq.trim());
    if (state.interpreted) p.set("ai", "1");
    set("sem", state.sem.trim());
  }
  set("skills", joinList(f.skills));
  if (f.skills.length) set("skill_labels", joinList(f.skills.map((id) => state.labels[id] ?? "")));
  if (f.skillsMode === "all") p.set("skills_mode", "all");
  if (f.expandSkills === false) p.set("related", "0");
  set("exp", rangeParam(f.expMin, f.expMax));
  set("countries", joinList(f.countries));
  set("cities", joinList(f.cities));
  set("work_auth", joinList(f.workAuth));
  set("comp", rangeParam(f.compMin, f.compMax));
  if ((f.compMin !== null || f.compMax !== null) && f.compCurrency !== "INR") p.set("cur", f.compCurrency);
  set("notice", f.noticeMaxDays === null ? null : String(f.noticeMaxDays));
  set("avail", f.availableBy);
  set("certs", joinList(f.certifications));
  set("employers", joinList(f.employers));
  set("tags", joinList(f.tags));
  if (f.tags.length) set("tag_labels", joinList(f.tags.map((id) => state.labels[id] ?? "")));
  set("sources", joinList(f.sources));
  set("owners", joinList(f.owners));
  set("updated", f.updatedAfter || f.updatedBefore ? `${f.updatedAfter ?? ""}~${f.updatedBefore ?? ""}` : null);
  set("not_sub", f.notSubmittedTo);
  if (f.notSubmittedTo && state.labels[f.notSubmittedTo]) set("not_sub_label", state.labels[f.notSubmittedTo]);
  if (state.sort !== "relevance") p.set("sort", state.sort);
  if (state.page > 1) p.set("page", String(state.page));
  return p;
}

type ParamSource = Pick<URLSearchParams, "get">;

export function paramsToState(p: ParamSource): SearchState {
  const labels: Record<string, string> = {};
  const skills = ids(p.get("skills"));
  // Labels are positional; keep empty slots so they stay aligned with the ids.
  const skillLabels = (p.get("skill_labels") ?? "").length ? splitListKeepEmpty(p.get("skill_labels") ?? "") : [];
  skills.forEach((id, i) => {
    if (skillLabels[i]) labels[id] = skillLabels[i];
  });
  const tags = ids(p.get("tags"));
  const tagLabels = (p.get("tag_labels") ?? "").length ? splitListKeepEmpty(p.get("tag_labels") ?? "") : [];
  tags.forEach((id, i) => {
    if (tagLabels[i]) labels[id] = tagLabels[i];
  });
  const notSub = p.get("not_sub");
  const notSubmittedTo = notSub && UUID_RE.test(notSub) ? notSub : null;
  const notSubLabel = p.get("not_sub_label");
  if (notSubmittedTo && notSubLabel) labels[notSubmittedTo] = notSubLabel;
  const [expMin, expMax] = parseRange(p.get("exp"));
  const [compMin, compMax] = parseRange(p.get("comp"));
  const cur = (p.get("cur") ?? "INR").toUpperCase();
  const [updatedAfter, updatedBefore] = (p.get("updated") ?? "~").split("~");
  const notice = num(p.get("notice"));
  const sort = p.get("sort") as SearchSort | null;
  const page = Math.floor(num(p.get("page")) ?? 1);
  const mode: SearchMode = p.get("mode") === "nl" ? "nl" : "boolean";
  return {
    mode,
    q: p.get("q") ?? "",
    nlq: mode === "nl" ? (p.get("nlq") ?? "") : "",
    interpreted: mode === "nl" && p.get("ai") === "1",
    sem: mode === "nl" ? (p.get("sem") ?? "") : "",
    filters: {
      skills,
      skillsMode: p.get("skills_mode") === "all" ? "all" : "any",
      ...(p.get("related") === "0" ? { expandSkills: false } : {}),
      expMin,
      expMax,
      countries: splitList(p.get("countries")),
      cities: splitList(p.get("cities")),
      workAuth: splitList(p.get("work_auth")),
      compMin,
      compMax,
      compCurrency: /^[A-Z]{3}$/.test(cur) ? cur : "INR",
      noticeMaxDays: notice === null ? null : Math.min(365, Math.floor(notice)),
      availableBy: date(p.get("avail")),
      certifications: splitList(p.get("certs")),
      employers: splitList(p.get("employers")),
      tags,
      sources: splitList(p.get("sources")),
      owners: ids(p.get("owners")),
      updatedAfter: date(updatedAfter ?? null),
      updatedBefore: date(updatedBefore ?? null),
      notSubmittedTo,
    },
    sort: sort && SORTS.includes(sort) ? sort : "relevance",
    page: page >= 1 ? Math.min(page, 1000) : 1,
    labels,
  };
}

function splitListKeepEmpty(raw: string): string[] {
  const out: string[] = [];
  let cur = "";
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === "\\" && i + 1 < raw.length) cur += raw[++i];
    else if (ch === ",") {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

// ---------------------------------------------------------------- API mapping
export function filtersToApi(f: SearchFilters): CandidateSearchFilters {
  const out: CandidateSearchFilters = { skills_mode: f.skillsMode, comp_currency: f.compCurrency };
  if (f.skills.length) out.skills = f.skills;
  if (f.expandSkills === false) Object.assign(out, { expand_skills: false });
  if (f.expMin !== null) out.experience_min = f.expMin;
  if (f.expMax !== null) out.experience_max = f.expMax;
  if (f.countries.length) out.countries = f.countries;
  if (f.cities.length) out.cities = f.cities;
  if (f.workAuth.length) out.work_auth = f.workAuth;
  if (f.compMin !== null) out.comp_min = f.compMin;
  if (f.compMax !== null) out.comp_max = f.compMax;
  if (f.noticeMaxDays !== null) out.notice_max_days = f.noticeMaxDays;
  if (f.availableBy) out.available_by = f.availableBy;
  if (f.certifications.length) out.certifications = f.certifications;
  if (f.employers.length) out.current_employers = f.employers;
  if (f.tags.length) out.tags = f.tags;
  if (f.sources.length) out.sources = f.sources;
  if (f.owners.length) out.owner_ids = f.owners;
  if (f.updatedAfter) out.updated_after = `${f.updatedAfter}T00:00:00Z`;
  if (f.updatedBefore) out.updated_before = `${f.updatedBefore}T23:59:59Z`;
  if (f.notSubmittedTo) out.not_submitted_to_client_id = f.notSubmittedTo;
  return out;
}

type ApiFiltersOut = {
  skills?: string[];
  skills_mode?: "any" | "all";
  experience_min?: number | string | null;
  experience_max?: number | string | null;
  countries?: string[];
  cities?: string[];
  work_auth?: string[];
  comp_min?: number | string | null;
  comp_max?: number | string | null;
  comp_currency?: string;
  notice_max_days?: number | null;
  available_by?: string | null;
  certifications?: string[];
  current_employers?: string[];
  tags?: string[];
  sources?: string[];
  owner_ids?: string[];
  updated_after?: string | null;
  updated_before?: string | null;
  not_submitted_to_client_id?: string | null;
};

function toNum(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** The API's `applied_filters` (NL interpretation) as page filters. */
export function filtersFromApi(a: ApiFiltersOut): SearchFilters {
  return {
    skills: a.skills ?? [],
    skillsMode: a.skills_mode ?? "any",
    expMin: toNum(a.experience_min),
    expMax: toNum(a.experience_max),
    countries: a.countries ?? [],
    cities: a.cities ?? [],
    workAuth: a.work_auth ?? [],
    compMin: toNum(a.comp_min),
    compMax: toNum(a.comp_max),
    compCurrency: a.comp_currency ?? "INR",
    noticeMaxDays: a.notice_max_days ?? null,
    availableBy: a.available_by ?? null,
    certifications: a.certifications ?? [],
    employers: a.current_employers ?? [],
    tags: a.tags ?? [],
    sources: a.sources ?? [],
    owners: a.owner_ids ?? [],
    updatedAfter: a.updated_after ? a.updated_after.slice(0, 10) : null,
    updatedBefore: a.updated_before ? a.updated_before.slice(0, 10) : null,
    notSubmittedTo: a.not_submitted_to_client_id ?? null,
  };
}

/** The request body the page sends for `state`, or null when there is nothing to search yet. */
export function stateToRequest(state: SearchState): CandidateSearchIn {
  const base = { filters: filtersToApi(state.filters), sort: state.sort, page: state.page, page_size: PAGE_SIZE };
  if (state.mode === "nl") {
    if (state.interpreted) {
      return { ...base, mode: "structured", q: state.q.trim() || null, semantic_text: state.sem.trim() || null };
    }
    return { ...base, mode: "nl", q: state.nlq.trim() || null };
  }
  return { ...base, mode: "boolean", q: state.q.trim() || null };
}

export function activeFilterCount(f: SearchFilters): number {
  let n = 0;
  for (const [k, v] of Object.entries(f) as [keyof SearchFilters, unknown][]) {
    if (k === "skillsMode" || k === "compCurrency") continue;
    if (Array.isArray(v) ? v.length > 0 : v !== null) n++;
  }
  return n;
}
