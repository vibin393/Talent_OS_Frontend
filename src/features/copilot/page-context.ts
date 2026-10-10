/**
 * Page context of the Copilot (Epic 54 B4): the route's record (type + id) or the list a page registered, plus the
 * visible label. Ids and labels only -- never record content.
 */
import type { CopilotEntityType, ListContext, PageContext } from "./types";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/** Route patterns of record pages, most specific first. */
const RECORD_ROUTES: { pattern: RegExp; type: CopilotEntityType; noun: string }[] = [
  { pattern: new RegExp(`^/clients/${UUID}/contacts/(${UUID})(?:/|$)`, "i"), type: "contact", noun: "Contact" },
  { pattern: new RegExp(`^/candidates/(${UUID})(?:/|$)`, "i"), type: "candidate", noun: "Candidate" },
  { pattern: new RegExp(`^/demands/(${UUID})(?:/|$)`, "i"), type: "demand", noun: "Demand" },
  { pattern: new RegExp(`^/applications/(${UUID})(?:/|$)`, "i"), type: "application", noun: "Application" },
  { pattern: new RegExp(`^/clients/(${UUID})(?:/|$)`, "i"), type: "client", noun: "Client" },
  { pattern: new RegExp(`^/placements/(${UUID})(?:/|$)`, "i"), type: "placement", noun: "Placement" },
  { pattern: new RegExp(`^/interviews/(${UUID})(?:/|$)`, "i"), type: "interview", noun: "Interview" },
  { pattern: new RegExp(`^/workers/(${UUID})(?:/|$)`, "i"), type: "worker", noun: "Worker" },
  { pattern: new RegExp(`^/offers/(${UUID})(?:/|$)`, "i"), type: "offer", noun: "Offer" },
  { pattern: new RegExp(`^/projects/(${UUID})(?:/|$)`, "i"), type: "project", noun: "Project" },
];

const LIST_NOUNS: Record<ListContext["kind"], string> = {
  candidates: "Candidates",
  demands: "Demands",
  pipeline: "Pipeline",
  interviews: "Interviews",
  placements: "Placements",
  tasks: "Tasks",
};

/** "Senior Data Engineer | REQ-1056 | Talent OS" -> "Senior Data Engineer" (the document title prefix). */
export function titlePrefix(documentTitle: string | null | undefined): string | null {
  const first = (documentTitle ?? "").split(/\s[|·–—-]\s/)[0]?.trim();
  if (!first || first === "Talent OS") return null;
  return first.slice(0, 100);
}

/** Context of a record route, or `null` for any other route. */
export function contextFromPath(pathname: string, documentTitle?: string | null): PageContext | null {
  const route = (pathname || "/").split("?")[0].slice(0, 200) || "/";
  for (const { pattern, type, noun } of RECORD_ROUTES) {
    const m = pattern.exec(route);
    if (m) {
      const title = titlePrefix(documentTitle);
      return { route, entity_type: type, entity_id: m[1].toLowerCase(), label: (title ? `${noun} ${title}` : noun).slice(0, 120) };
    }
  }
  return null;
}

/** Context of a list page: "Candidates (3 filters)". */
export function listContext(route: string, list: ListContext, label?: string | null): PageContext {
  const filters = Object.entries(list.filters ?? {}).filter(([, v]) => v !== "" && v !== undefined && !(Array.isArray(v) && !v.length));
  const count = filters.length;
  const base = label || LIST_NOUNS[list.kind];
  const text = count ? `${base} (${count} filter${count === 1 ? "" : "s"})` : base;
  return {
    route: (route || "/").slice(0, 200),
    list: {
      kind: list.kind,
      filters: Object.fromEntries(filters.slice(0, 20)),
      selected_ids: (list.selected_ids ?? []).slice(0, 50),
    },
    label: text.slice(0, 120),
  };
}

/** The chip text: "Using: Demand REQ-1056". */
export function chipLabel(context: PageContext | null): string | null {
  return context?.label ? `Using: ${context.label}` : null;
}
