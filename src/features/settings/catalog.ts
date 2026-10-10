/** Pure helpers for the tenant settings hub (`/admin/settings`, Epic 12 story 12.8). */
import { isApiError } from "@/lib/api/errors";
import type { SettingsCatalogEntry } from "@/lib/api/types";

export const SETTINGS_CATEGORIES = [
  { value: "organization", label: "Organization" },
  { value: "services", label: "Services" },
  { value: "security_privacy", label: "Security & privacy" },
] as const;

export type SettingsCategory = (typeof SETTINGS_CATEGORIES)[number]["value"];

/** Epic 35 settings registry entry: the P1 catalog entry plus its permission and owning epic. */
export type SettingsRegistryEntry = SettingsCatalogEntry & {
  permission?: string | null;
  owner_epic?: string | number | null;
};

/** "security_privacy" -> "Security privacy" for categories the hub has no label for. */
function categoryLabel(value: string): string {
  if (value === "ai") return "AI";
  const s = value.replace(/[_.]+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Categories to show as tabs: the known ones first, then any new registry category in first-seen order. */
export function settingsCategories(catalog: readonly SettingsCatalogEntry[] | undefined): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = SETTINGS_CATEGORIES.map((c) => ({ value: c.value, label: c.label }));
  for (const e of catalog ?? []) {
    if (!out.some((c) => c.value === e.category)) out.push({ value: e.category, label: categoryLabel(e.category) });
  }
  return out;
}

/** "Owner: Epic 16" for an unavailable registry entry (or null when the entry is available / has no owner). */
export function ownerEpicLabel(entry: Pick<SettingsRegistryEntry, "available" | "owner_epic">): string | null {
  if (entry.available || entry.owner_epic === null || entry.owner_epic === undefined || entry.owner_epic === "") return null;
  const raw = String(entry.owner_epic).trim();
  const n = /^(?:epic[\s_-]*)?(\d+)$/i.exec(raw);
  return `Owner: ${n ? `Epic ${n[1]}` : raw}`;
}

/** Sections edited in the hub's own panel. */
export const PANEL_KEYS = ["company", "regional", "id_prefixes", "link_expiries"] as const;
export type PanelKey = (typeof PANEL_KEYS)[number];

export function isPanelKey(key: string): key is PanelKey {
  return (PANEL_KEYS as readonly string[]).includes(key);
}

/**
 * Pages that own a setting in another domain. Keys without a page here are shown without a link
 * (their owning UI is not built yet, or lives inside a feature page).
 */
export const SETTING_PAGES: Record<string, string> = {
  ai_features: "/admin/ai",
  consent: "/admin/privacy?tab=consent",
  retention: "/admin/privacy?tab=retention",
  security: "/admin/security",
  api_keys: "/admin/security#api-keys",
  // Owned by the demands domain (Epic 4 UI).
  business_hours: "/admin/sla",
  sla: "/admin/sla",
  demand_settings: "/admin/sla",
  approval_chains: "/admin/approval-chains",
  // Owned by the pipeline domain (Epic 6 UI).
  stages: "/admin/pipeline?tab=stages",
  reasons: "/admin/pipeline?tab=reasons",
  questionnaires: "/admin/pipeline?tab=questionnaires",
  margin: "/admin/pipeline?tab=settings",
  // Owned by the vendors domain (Epic 17 UI).
  vendor_settings: "/admin/vendors",
  // Epic 52: Phase 3 settings pages (owners' screens).
  skills_graph: "/settings/skills-graph",
  talent_pools: "/talent-pools",
  pool_templates: "/talent-pools",
  marketing: "/marketing/settings",
  assessments: "/assessments",
  assessment_provider: "/assessments",
  mobility: "/admin/mobility",
  referrals: "/admin/referrals",
  campus: "/campus",
  workforce: "/workforce",
  project_budgets: "/projects",
  immigration: "/settings/immigration",
  report_builder: "/reports/custom",
  report_schedules: "/reports/custom",
  analytics: "/admin/predictions",
  prediction_models: "/admin/predictions",
  fairness: "/fairness/settings",
  aedt_inventory: "/fairness/aedt",
  client_sso: "/clients",
  fx_feed: "/settings/fx-feed",
  tds_deductor_tans: "/receivables/tds",
  // Epic 65: Phase 4 AI settings.
  agentic: "/admin/ai/agents",
  agents: "/admin/ai/agents",
  ai_kill_switch: "/admin/ai/runs",
  ai_governance: "/admin/ai/runs",
  ai_evals: "/admin/ai/evals",
  copilot: "/settings/ai/copilot",
};

/** Epic 52: owner epics of Phase 3 (Epic 37-52); their unavailable hub entries are hidden (spec B3). */
export function isPhase3Owner(ownerEpic: string | number | null | undefined): boolean {
  const n = Number(/(\d+)/.exec(String(ownerEpic ?? ""))?.[1]);
  return n >= 37 && n <= 52;
}

/** Epic 65: owner epics of Phase 4 (Epic 53-65); their unavailable hub entries are hidden too (spec B6). */
export function isPhase4Owner(ownerEpic: string | number | null | undefined): boolean {
  const n = Number(/(\d+)/.exec(String(ownerEpic ?? ""))?.[1]);
  return n >= 53 && n <= 65;
}

export type SettingsRow = SettingsRegistryEntry & { action: "panel" | "link" | "none"; href?: string };

/** Catalog entries of one category, each tagged with how the hub opens it. */
export function settingsRows(catalog: readonly SettingsRegistryEntry[], category: string, pages = SETTING_PAGES): SettingsRow[] {
  return catalog
    .filter((e) => e.category === category)
    .filter((e) => e.available || (!isPhase3Owner(e.owner_epic) && !isPhase4Owner(e.owner_epic)))
    .map((e) => {
      if (!e.available) return { ...e, action: "none" as const };
      if (isPanelKey(e.key)) return { ...e, action: "panel" as const };
      const href = pages[e.key];
      return href ? { ...e, action: "link" as const, href } : { ...e, action: "none" as const };
    });
}

/**
 * Field messages from a 422 `validation_failed` envelope, keyed by the field path inside the section
 * (`timezone`, `grievance_officer.email`). Accepts both the settings dict form
 * `{fields: {path: message}}` and the request-validation list form `[{field: "body.x", message}]`.
 */
export function settingsFieldErrors(e: unknown): Record<string, string> {
  if (!isApiError(e) || e.status !== 422) return {};
  const fields = e.details.fields;
  const out: Record<string, string> = {};
  const norm = (path: string) => path.replace(/^body\./, "");
  if (Array.isArray(fields)) {
    for (const f of fields) {
      if (f && typeof f === "object" && typeof (f as { field?: unknown }).field === "string") {
        const { field, message } = f as { field: string; message?: unknown };
        const key = norm(field);
        if (!(key in out)) out[key] = typeof message === "string" ? message : "Invalid value";
      }
    }
  } else if (fields && typeof fields === "object") {
    for (const [path, msg] of Object.entries(fields as Record<string, unknown>)) {
      if (typeof msg === "string") out[norm(path)] = msg;
      else if (Array.isArray(msg) && typeof msg[0] === "string") out[norm(path)] = msg[0];
    }
  }
  return out;
}

export const DATE_FORMATS = ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD", "DD MMM YYYY"] as const;
export const NUMBER_FORMATS = [
  { value: "indian", label: "Indian (12,34,567.89)" },
  { value: "international", label: "International (1,234,567.89)" },
] as const;
export const CURRENCIES = (
  "INR USD EUR GBP AED SGD AUD CAD JPY CNY CHF SEK NOK DKK NZD ZAR HKD MYR THB IDR PHP LKR BDT NPR SAR QAR KWD OMR BHD"
).split(" ");

export const ID_PREFIX_KEYS = ["REQ", "CAN", "APP", "SUB", "DSR"] as const;
export const ID_PREFIX_LABELS: Record<(typeof ID_PREFIX_KEYS)[number], string> = {
  REQ: "Demands",
  CAN: "Candidates",
  APP: "Applications",
  SUB: "Submissions",
  DSR: "Data subject requests",
};

/** Client-side check mirroring the backend: 2–5 capital letters, all unique. */
export function idPrefixErrors(values: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  const seen = new Map<string, string>();
  for (const [k, raw] of Object.entries(values)) {
    const v = raw.trim();
    if (!/^[A-Z]{2,5}$/.test(v)) out[k] = "Use 2–5 capital letters";
    else if (seen.has(v)) out[k] = `Already used for ${seen.get(v)}`;
    else seen.set(v, k);
  }
  return out;
}

export const LINK_EXPIRY_LIMITS = {
  consent_request: { label: "Consent requests", min: 1, max: 30 },
  ai_screening: { label: "AI screening questionnaires", min: 1, max: 30 },
  client_feedback: { label: "Client feedback", min: 1, max: 30 },
  dsr_export: { label: "Data export downloads", min: 1, max: 14 },
} as const;

type SetError = (name: never, error: { type: string; message: string }, options?: { shouldFocus: boolean }) => void;

/**
 * Map a 422 `details.fields` onto a react-hook-form (by field path, focusing the first). Returns the
 * messages that matched no known field so the panel can show them in its error bar.
 */
export function applySettingsErrors(e: unknown, setError: SetError, known: readonly string[]): string[] {
  const unmatched: string[] = [];
  let first = true;
  for (const [path, message] of Object.entries(settingsFieldErrors(e))) {
    if (known.includes(path)) {
      setError(path as never, { type: "server", message }, { shouldFocus: first });
      first = false;
    } else {
      unmatched.push(`${path}: ${message}`);
    }
  }
  return unmatched;
}
