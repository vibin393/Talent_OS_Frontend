/** Pure state for the header global search (M365-style grouped results popover). */
import type { GlobalSearchOut as ApiSearchOut, QuickHit as ApiQuickHit, QuickHitType as ApiHitType } from "@/lib/api/types";

/** Epic 34 (hand-written): Phase 2 groups registered by reporting, and the exact-match flag. */
export type QuickHitType = ApiHitType | "vendor" | "placement" | "worker" | "invoice" | P3QuickHitType | P4QuickHitType;

/** Epic 52 (hand-written): Phase 3 groups. `QuickHit.url` is already a frontend path. */
export const P3_HIT_TYPES = [
  "talent_pool",
  "campaign",
  "assessment",
  "campus_drive",
  "recruitment_event",
  "project",
  "immigration_case",
  "report_definition",
] as const;
export type P3QuickHitType = (typeof P3_HIT_TYPES)[number];

/** Epic 65 (hand-written): Phase 4 groups (`/proposals?id=<id>`, `/knowledge/sources/<id>`). */
export const P4_HIT_TYPES = ["agent_proposal", "knowledge_source"] as const;
export type P4QuickHitType = (typeof P4_HIT_TYPES)[number];
export type QuickHit = Omit<ApiQuickHit, "type"> & { type: QuickHitType; exact?: boolean };
export type GlobalSearchOut = {
  exact?: QuickHit | null;
  groups: { type: QuickHitType; items: QuickHit[]; has_more?: boolean; timed_out?: boolean }[];
};

export function asSearchOut(out: ApiSearchOut | null | undefined): GlobalSearchOut | null {
  return (out as unknown as GlobalSearchOut | null | undefined) ?? null;
}

export const GROUP_ORDER: readonly QuickHitType[] = [
  "candidate",
  "demand",
  "client",
  "contact",
  "placement",
  "worker",
  "invoice",
  "vendor",
  ...P3_HIT_TYPES,
  ...P4_HIT_TYPES,
];

export const GROUP_LABELS: Record<QuickHitType, string> = {
  candidate: "Candidates",
  demand: "Demands",
  client: "Clients",
  contact: "Contacts",
  vendor: "Vendors",
  placement: "Placements",
  worker: "Workers",
  invoice: "Invoices",
  talent_pool: "Talent pools",
  campaign: "Campaigns",
  assessment: "Assessments",
  campus_drive: "Campus drives",
  recruitment_event: "Recruitment events",
  project: "Projects",
  immigration_case: "Immigration cases",
  report_definition: "Reports",
  agent_proposal: "Proposals",
  knowledge_source: "Knowledge sources",
};

export const MIN_QUERY = 2;

export type ResultSection = { key: "top" | QuickHitType; title: string; hits: QuickHit[]; hasMore: boolean; timedOut: boolean };

/**
 * Sections in display order: "Top result" (the exact hit) first, then Candidates, Demands, Clients,
 * Contacts. The exact hit is not repeated inside its group; empty groups are dropped unless timed out.
 */
export function resultSections(out: GlobalSearchOut | null | undefined): ResultSection[] {
  if (!out) return [];
  const sections: ResultSection[] = [];
  const exact = out.exact ?? null;
  if (exact) sections.push({ key: "top", title: "Top result", hits: [exact], hasMore: false, timedOut: false });
  for (const type of GROUP_ORDER) {
    const group = out.groups.find((g) => g.type === type);
    if (!group) continue;
    const hits = group.items.filter((h) => !(exact && h.type === exact.type && h.id === exact.id));
    if (hits.length === 0 && !group.timed_out) continue;
    sections.push({
      key: type,
      title: GROUP_LABELS[type],
      hits,
      hasMore: !!group.has_more,
      timedOut: !!group.timed_out,
    });
  }
  return sections;
}

/** All navigable hits in keyboard order. */
export function flatHits(sections: readonly ResultSection[]): QuickHit[] {
  return sections.flatMap((s) => s.hits);
}

export function optionId(hit: Pick<QuickHit, "type" | "id">): string {
  return `global-search-${hit.type}-${hit.id}`;
}

export type NavState = { open: boolean; active: number };
export type NavAction =
  | { type: "open" }
  | { type: "close" }
  | { type: "move"; delta: 1 | -1; count: number }
  | { type: "reset" };

export const INITIAL_NAV: NavState = { open: false, active: -1 };

/** Keyboard/open state: ↑/↓ wrap through `count` options (opening the popover first), Esc closes. */
export function navReducer(state: NavState, action: NavAction): NavState {
  switch (action.type) {
    case "open":
      return state.open ? state : { open: true, active: -1 };
    case "close":
      return { open: false, active: -1 };
    case "reset":
      return { ...state, active: -1 };
    case "move": {
      if (action.count <= 0) return { open: true, active: -1 };
      if (!state.open) return { open: true, active: action.delta > 0 ? 0 : action.count - 1 };
      if (state.active < 0) return { open: true, active: action.delta > 0 ? 0 : action.count - 1 };
      return { open: true, active: (state.active + action.delta + action.count) % action.count };
    }
  }
}

/** Row subtitle (`human_id · email`); the API subtitle may already lead with the human id. */
export function hitSubtitle(hit: Pick<QuickHit, "human_id" | "subtitle">): string {
  const sub = (hit.subtitle ?? "").trim();
  const hid = (hit.human_id ?? "").trim();
  if (!hid) return sub;
  if (!sub) return hid;
  return sub.toLowerCase().startsWith(hid.toLowerCase()) ? sub : `${hid} · ${sub}`;
}

/** URL of the full candidate search for the header query. */
export function seeAllHref(q: string): string {
  return `/candidates/search?q=${encodeURIComponent(q.trim())}`;
}
