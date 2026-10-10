/** Pure logic of the Proposal inbox (Epic 65, spec B3): tabs, filters, ageing, bulk rules, errors, keyboard. */
import { renderProposal, type RenderedProposal } from "@/features/agent-proposals/proposal-renderers";
import type { ProposalOut } from "@/lib/api/agentic-types";
import { isApiError } from "@/lib/api/errors";

export type InboxTab = "assigned" | "queues" | "all";
export const INBOX_TABS: readonly { value: InboxTab; label: string }[] = [
  { value: "assigned", label: "Assigned to me" },
  { value: "queues", label: "My queues" },
  { value: "all", label: "All I can decide" },
];

/** Tabs the viewer sees ("All I can decide" only with `ai:govern`). */
export function visibleTabs(canGovern: boolean): { value: InboxTab; label: string }[] {
  return INBOX_TABS.filter((t) => t.value !== "all" || canGovern);
}

/** `GET /proposals` query of a tab (pending only; `mine=true` except "All I can decide"). */
export function inboxQuery(tab: InboxTab, page = 1, pageSize = 100): string {
  const p = new URLSearchParams({ status: "pending", page: String(page), page_size: String(pageSize) });
  if (tab !== "all") p.set("mine", "true");
  return p.toString();
}

/** Copilot drafts are private to their user and never listed in the inbox. */
export function withoutCopilotDrafts<T extends Pick<ProposalOut, "origin">>(items: readonly T[]): T[] {
  return items.filter((p) => p.origin !== "copilot");
}

/** Client-side split of `mine=true` results into the two tabs. */
export function itemsForTab<T extends Pick<ProposalOut, "origin" | "assignee_user_id" | "route_role_key">>(
  items: readonly T[],
  tab: InboxTab,
  meId: string | null | undefined,
): T[] {
  const list = withoutCopilotDrafts(items);
  if (tab === "assigned") return list.filter((p) => !!meId && p.assignee_user_id === meId);
  if (tab === "queues") return list.filter((p) => p.route_role_key !== null && p.route_role_key !== undefined);
  return list;
}

// ---------------------------------------------------------------- ageing
export type AgeBucket = "under_4h" | "4_24h" | "over_24h" | "expiring";
export const AGE_BUCKETS: readonly { value: AgeBucket; label: string }[] = [
  { value: "under_4h", label: "Under 4 h" },
  { value: "4_24h", label: "4–24 h" },
  { value: "over_24h", label: "Over 24 h" },
  { value: "expiring", label: "Expiring soon" },
];
const HOUR = 3600_000;
/** "Expiring soon" = expires within this many hours. */
export const EXPIRING_SOON_HOURS = 24;

/** The created time of a Proposal (the API has no `created_at`; derived from the run or approximated). */
export type AgeingInput = { created_at?: string | null; expires_at: string };

export function ageHours(p: AgeingInput, now: number): number | null {
  if (!p.created_at) return null;
  const t = Date.parse(p.created_at);
  return Number.isFinite(t) ? Math.max(0, (now - t) / HOUR) : null;
}

export function inBucket(p: AgeingInput, bucket: AgeBucket, now: number): boolean {
  if (bucket === "expiring") {
    const exp = Date.parse(p.expires_at);
    return Number.isFinite(exp) && exp - now <= EXPIRING_SOON_HOURS * HOUR;
  }
  const h = ageHours(p, now);
  if (h === null) return false;
  if (bucket === "under_4h") return h < 4;
  if (bucket === "4_24h") return h >= 4 && h <= 24;
  return h > 24;
}

/** "45 min", "5 h", "3 d". */
export function formatSpan(ms: number): string {
  const abs = Math.abs(ms);
  if (abs < HOUR) return `${Math.max(1, Math.round(abs / 60_000))} min`;
  if (abs < 48 * HOUR) return `${Math.round(abs / HOUR)} h`;
  return `${Math.round(abs / (24 * HOUR))} d`;
}

export function ageText(p: AgeingInput, now: number): string {
  const h = ageHours(p, now);
  return h === null ? "—" : formatSpan(h * HOUR);
}

export function expiresText(expiresAt: string, now: number): string {
  const t = Date.parse(expiresAt);
  if (!Number.isFinite(t)) return "—";
  return t <= now ? "Expired" : formatSpan(t - now);
}

// ---------------------------------------------------------------- filters + grouping
export type InboxFilters = { agent: string | null; action: string | null; age: AgeBucket | null; record: string | null };
export const EMPTY_INBOX_FILTERS: InboxFilters = { agent: null, action: null, age: null, record: null };

/** "Record" filter key of a Proposal (`<type>:<id>`). */
export function recordKey(p: Pick<ProposalOut, "target_type" | "target_id">): string | null {
  return p.target_type && p.target_id ? `${p.target_type}:${p.target_id}` : null;
}

export function applyFilters<T extends ProposalOut & AgeingInput>(items: readonly T[], f: InboxFilters, now: number): T[] {
  return items.filter(
    (p) =>
      (!f.agent || p.agent_key === f.agent) &&
      (!f.action || p.tool_key === f.action) &&
      (!f.record || recordKey(p) === f.record) &&
      (!f.age || inBucket(p, f.age, now)),
  );
}

export type GroupBy = "agent" | "record";

/** Groups in first-seen order; `label` is the agent name or the record's label. */
export function groupProposals<T extends ProposalOut>(items: readonly T[], by: GroupBy): { key: string; label: string; items: T[] }[] {
  const groups: { key: string; label: string; items: T[] }[] = [];
  for (const p of items) {
    const key = by === "agent" ? p.agent_key : (recordKey(p) ?? "none");
    const label = by === "agent" ? p.agent_name : recordLabel(p);
    let g = groups.find((x) => x.key === key);
    if (!g) {
      g = { key, label, items: [] };
      groups.push(g);
    }
    g.items.push(p);
  }
  return groups;
}

export function recordLabel(p: Pick<ProposalOut, "target_type" | "target_id" | "preview">): string {
  if (!p.target_type) return "No record";
  const type = p.target_type.charAt(0).toUpperCase() + p.target_type.slice(1).replace(/_/g, " ");
  const named = p.preview?.fields?.find(([k]) => /^(candidate|demand|client|record|subject)$/i.test(k))?.[1];
  return named ? `${type}: ${named}` : type;
}

// ---------------------------------------------------------------- bulk
export const BULK_TOOLTIP = "Bulk decisions need the same agent, action and Demand.";

/** The Demand of a Proposal for bulk eligibility (`preview.fields` entry `["demand_id", id]`, as the server checks). */
export function demandOf(p: Pick<ProposalOut, "preview">): string | null {
  const f = p.preview?.fields?.find(([k]) => k === "demand_id");
  return f ? f[1] : null;
}

export function bulkKey(p: Pick<ProposalOut, "agent_key" | "tool_key" | "preview">): string {
  return `${p.agent_key}|${p.tool_key}|${demandOf(p) ?? ""}`;
}

/**
 * Whether `p` may be checked with `selected` already checked: same agent, action and Demand as the first selected
 * item, decidable, and pending.
 */
export function bulkEligible(p: ProposalOut, selected: readonly ProposalOut[]): boolean {
  if (!p.can_decide || p.status !== "pending") return false;
  if (selected.length === 0) return true;
  return bulkKey(p) === bulkKey(selected[0]);
}

/** Every item of the bulk dialog, each with its preview expanded (FR-269 "shows each item"). */
export function bulkDialogItems(selected: readonly ProposalOut[]): { id: string; human_id: string; rendered: RenderedProposal }[] {
  return selected.map((p) => ({ id: p.id, human_id: p.human_id, rendered: renderProposal(p) }));
}

export function bulkTitle(decision: "approve" | "reject", n: number): string {
  return decision === "approve" ? `Approve ${n} proposals?` : `Reject ${n} proposals?`;
}

export function bulkBarText(n: number): string {
  return `${n} selected`;
}

// ---------------------------------------------------------------- errors
export const STALE_MESSAGE = "This record changed after the agent proposed this.";
export const NOT_PENDING_MESSAGE = "Someone already decided this proposal.";
export const FORBIDDEN_MESSAGE = "You can no longer perform this action.";
export const EDIT_NOT_ALLOWED_MESSAGE = "This change is not allowed in a proposal.";

export type DecisionError = { intent: "warning" | "error"; text: string; rerun: boolean };

/** Message of a failed decision (409 stale offers "Re-run agent"). */
export function decisionError(e: unknown): DecisionError {
  if (isApiError(e)) {
    if (e.status === 409 && e.code === "proposal_stale") return { intent: "warning", text: STALE_MESSAGE, rerun: true };
    if (e.status === 409 && e.code === "proposal_not_pending") return { intent: "warning", text: NOT_PENDING_MESSAGE, rerun: false };
    if (e.status === 403) return { intent: "error", text: FORBIDDEN_MESSAGE, rerun: false };
    if (e.status === 422 && (e.code === "autonomy_not_allowed" || e.code === "edit_not_allowed" || e.code === "risk_raising_edit"))
      return { intent: "error", text: EDIT_NOT_ALLOWED_MESSAGE, rerun: false };
    if (e.status === 422 && e.code === "bulk_mixed") return { intent: "error", text: BULK_TOOLTIP, rerun: false };
    if (e.status === 422 && e.code === "note_required") return { intent: "error", text: "Enter a reason.", rerun: false };
    if (e.message) return { intent: "error", text: e.message, rerun: false };
  }
  return { intent: "error", text: "Something went wrong. Please try again.", rerun: false };
}

export const MIN_REJECT_REASON = 3;
export function rejectReasonError(reason: string): string | null {
  return reason.trim().length < MIN_REJECT_REASON ? `Enter at least ${MIN_REJECT_REASON} characters.` : null;
}

// ---------------------------------------------------------------- opened signal
/** Fires `send(id)` once per Proposal id (the detail pane's `POST .../opened`). */
export function createOpenedTracker(send: (id: string) => void): (id: string) => boolean {
  const seen = new Set<string>();
  return (id: string) => {
    if (seen.has(id)) return false;
    seen.add(id);
    send(id);
    return true;
  };
}

// ---------------------------------------------------------------- keyboard
/** Next active index of the listbox for a key (`role="option"` rows; ↑/↓/Home/End). */
export function nextIndex(key: string, index: number, length: number): number {
  if (length === 0) return -1;
  switch (key) {
    case "ArrowDown":
      return Math.min(length - 1, index + 1);
    case "ArrowUp":
      return Math.max(0, index - 1);
    case "Home":
      return 0;
    case "End":
      return length - 1;
    default:
      return index;
  }
}

/** After a decision removes item `id`, the id to focus next (the following item, else the previous). */
export function nextAfterDecision(ids: readonly string[], id: string): string | null {
  const i = ids.indexOf(id);
  if (i < 0) return ids[0] ?? null;
  return ids[i + 1] ?? ids[i - 1] ?? null;
}

// ---------------------------------------------------------------- edit-and-approve form
export type SchemaField = {
  name: string;
  label: string;
  type: "string" | "text" | "number" | "integer" | "boolean" | "enum" | "json";
  required: boolean;
  options?: string[];
};

/** Form fields of a tool's `input_schema` (top-level properties only; objects/arrays fall back to JSON). */
export function schemaFields(schema: Record<string, unknown> | null | undefined): SchemaField[] {
  const props = (schema?.properties ?? {}) as Record<string, Record<string, unknown>>;
  const required = new Set(Array.isArray(schema?.required) ? (schema.required as string[]) : []);
  return Object.entries(props).map(([name, def]) => {
    const label = typeof def.title === "string" ? def.title : name.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
    let type: SchemaField["type"] = "json";
    if (Array.isArray(def.enum)) type = "enum";
    else if (def.type === "string") type = typeof def.maxLength === "number" && def.maxLength <= 200 ? "string" : "text";
    else if (def.type === "integer") type = "integer";
    else if (def.type === "number") type = "number";
    else if (def.type === "boolean") type = "boolean";
    return { name, label, type, required: required.has(name), options: Array.isArray(def.enum) ? def.enum.map(String) : undefined };
  });
}

/** Initial form values (strings) from the Proposal args. */
export function formValues(fields: readonly SchemaField[], args: Record<string, unknown> | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fields) {
    const v = args?.[f.name];
    out[f.name] = v === null || v === undefined ? "" : f.type === "json" ? JSON.stringify(v, null, 2) : String(v);
  }
  return out;
}

/** Parse the form back to `edited_args` (only changed fields kept over the original args); errors by field. */
export function parseEdited(
  fields: readonly SchemaField[],
  values: Record<string, string>,
  args: Record<string, unknown> | null | undefined,
): { args: Record<string, unknown>; errors: Record<string, string> } {
  const out: Record<string, unknown> = { ...(args ?? {}) };
  const errors: Record<string, string> = {};
  for (const f of fields) {
    const raw = values[f.name] ?? "";
    if (raw.trim() === "") {
      if (f.required) errors[f.name] = "Required.";
      else delete out[f.name];
      continue;
    }
    if (f.type === "integer" || f.type === "number") {
      const n = Number(raw);
      if (!Number.isFinite(n) || (f.type === "integer" && !Number.isInteger(n))) errors[f.name] = "Enter a number.";
      else out[f.name] = n;
    } else if (f.type === "boolean") out[f.name] = raw === "true";
    else if (f.type === "json") {
      try {
        out[f.name] = JSON.parse(raw);
      } catch {
        errors[f.name] = "Enter valid JSON.";
      }
    } else out[f.name] = raw;
  }
  return { args: out, errors };
}

export function confidenceText(c: string | null | undefined): string {
  if (c === null || c === undefined || c === "") return "—";
  const n = Number(c);
  if (!Number.isFinite(n)) return "—";
  return `${Math.round(n <= 1 ? n * 100 : n)}%`;
}
