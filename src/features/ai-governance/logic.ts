/** Pure view logic of the AI governance console (Epic 65, spec B2). */
import { parseDecimal } from "@/features/dashboards/p2/money";
import type { RunStatus } from "@/lib/api/agentic-types";
import type { ViolationKind } from "@/lib/api/governance-types";

// ---------------------------------------------------------------- tabs
export const CONSOLE_TABS = [
  { label: "Runs", href: "/admin/ai/runs" },
  { label: "Proposals", href: "/admin/ai/proposals" },
  { label: "Action log", href: "/admin/ai/log" },
  { label: "Policy violations", href: "/admin/ai/violations" },
  { label: "Costs", href: "/admin/ai/costs" },
  { label: "Copilot usage", href: "/admin/ai/copilot-usage" },
  { label: "Evaluations", href: "/admin/ai/evals" },
  { label: "MCP sessions", href: "/admin/ai/mcp-sessions" }, // Epic 73
] as const;

/** The console tab of `pathname` (run detail pages belong to "Runs"). */
export function activeConsoleTab(pathname: string): string {
  return CONSOLE_TABS.find((t) => pathname === t.href || pathname.startsWith(`${t.href}/`))?.href ?? CONSOLE_TABS[0].href;
}

// ---------------------------------------------------------------- kill switch / reasons
export const MIN_REASON = 10;
export const REASON_TOO_SHORT = `Enter at least ${MIN_REASON} characters.`;

/** Validation message of a required reason (≥ `min` characters after trimming), or null when valid. */
export function reasonError(reason: string, min = MIN_REASON): string | null {
  const n = reason.trim().length;
  if (n === 0) return "Enter a reason.";
  if (n < min) return `Enter at least ${min} characters.`;
  return null;
}

export const KILL_SWITCH_TEXT = {
  label: "Agent kill switch",
  stopTitle: "Stop all AI agents?",
  stopBody:
    "Queued runs are cancelled and running runs stop before their next step. Pending proposals stay reviewable. Copilot stops too.",
  stopButton: "Stop all agents",
  resumeTitle: "Resume AI agents?",
  resumeNote: "Stopped runs are not restarted.",
  resumeButton: "Resume agents",
  onBanner: "Agent kill switch is on. All agent and Copilot activity is stopped.",
  platformBanner: "Paused by the platform operator",
} as const;

export type KillSwitchState = { kill_switch: boolean; platform_kill_switch: boolean; global_kill_switch: boolean };

/** What the kill-switch control shows: switch position, disabled flag and the banner text. */
export function killSwitchView(s: KillSwitchState | null | undefined): { checked: boolean; disabled: boolean; banner: string | null } {
  if (!s) return { checked: false, disabled: true, banner: null };
  const platform = s.platform_kill_switch || s.global_kill_switch;
  if (platform) return { checked: true, disabled: true, banner: KILL_SWITCH_TEXT.platformBanner };
  return { checked: s.kill_switch, disabled: false, banner: s.kill_switch ? KILL_SWITCH_TEXT.onBanner : null };
}

// ---------------------------------------------------------------- Copilot privacy
export const COPILOT_PRIVATE_TEXT = "Copilot conversations are private to their user.";

/** Copilot runs: payload button disabled, arguments and summaries hidden. */
export function copilotPrivacy(run: { origin?: string; copilot_private?: boolean; payload_available?: boolean }): {
  payloadDisabled: boolean;
  hideArgs: boolean;
  note: string | null;
} {
  const priv = !!run.copilot_private || run.origin === "copilot";
  return {
    payloadDisabled: priv || run.payload_available === false,
    hideArgs: priv,
    note: priv ? COPILOT_PRIVATE_TEXT : null,
  };
}

// ---------------------------------------------------------------- run labels
export const RUN_STATUSES: readonly RunStatus[] = ["queued", "running", "waiting", "completed", "stopped", "failed", "cancelled"];
export const RUN_STATUS_LABELS: Record<RunStatus, string> = {
  queued: "Queued",
  running: "Running",
  waiting: "Waiting",
  completed: "Completed",
  stopped: "Stopped",
  failed: "Failed",
  cancelled: "Cancelled",
};
export type BadgeColor = "brand" | "danger" | "important" | "informative" | "severe" | "subtle" | "success" | "warning";
export const RUN_STATUS_COLORS: Record<RunStatus, BadgeColor> = {
  queued: "informative",
  running: "brand",
  waiting: "warning",
  completed: "success",
  stopped: "subtle",
  failed: "danger",
  cancelled: "subtle",
};
export const ORIGINS = [
  { value: "agent", label: "Agent" },
  { value: "copilot", label: "Copilot" },
  { value: "conversation", label: "Conversation" },
] as const;

export function runStatusLabel(s: string): string {
  return RUN_STATUS_LABELS[s as RunStatus] ?? s;
}

/** Run detail polls every 5 s while the run is still moving. */
export const RUN_POLL_MS = 5000;
export function shouldPollRun(status: string | null | undefined): boolean {
  return status === "running" || status === "waiting" || status === "queued";
}

export const RISK_LABELS: Record<string, string> = { read: "Read", low: "Low", high: "High" };
export const RISK_COLORS: Record<string, BadgeColor> = { read: "subtle", low: "informative", high: "danger" };
export const MODE_LABELS: Record<string, string> = { auto: "Auto", suggest: "Suggest", off: "Off" };
export const OUTCOME_LABELS: Record<string, string> = {
  executed: "Executed",
  proposed: "Proposed",
  refused: "Refused",
  policy_violation: "Policy violation",
  invalid: "Invalid",
  failed: "Failed",
  not_found: "Not found",
  deduplicated: "Deduplicated",
};
export const OUTCOME_COLORS: Record<string, BadgeColor> = {
  executed: "success",
  proposed: "brand",
  refused: "warning",
  policy_violation: "danger",
  invalid: "warning",
  failed: "danger",
  not_found: "subtle",
  deduplicated: "subtle",
};

export function label(map: Record<string, string>, key: string | null | undefined): string {
  if (!key) return "—";
  return map[key] ?? humanize(key);
}

export function humanize(key: string): string {
  const s = key.replace(/[_.]+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "2 h 05 min", "45 s" (null -> "—"). */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) return "—";
  const s = Math.round(seconds);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ${String(s % 60).padStart(2, "0")} s`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} h ${String(m % 60).padStart(2, "0")} min`;
  return `${Math.floor(h / 24)} d ${h % 24} h`;
}

export function runDurationSeconds(run: { started_at: string | null; finished_at: string | null }, now = Date.now()): number | null {
  if (!run.started_at) return null;
  const start = Date.parse(run.started_at);
  const end = run.finished_at ? Date.parse(run.finished_at) : now;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.max(0, (end - start) / 1000);
}

/** Short run reference shown in grids ("RUN-1a2b3c4d"). */
export function runRef(id: string): string {
  return `RUN-${id.replace(/-/g, "").slice(0, 8)}`;
}

// ---------------------------------------------------------------- violations
export const VIOLATION_TABS: readonly { value: ViolationKind; label: string }[] = [
  { value: "refused_tool", label: "Refused tools" },
  { value: "injection_detected", label: "Injection detections" },
  { value: "possible_cross_scope", label: "Possible cross-scope attempts" },
];
export const CROSS_SCOPE_NOTE =
  "Out-of-scope and non-existent records look the same to agents by design, so cross-scope attempts are shown as possible.";

/** The API `kind` of a violations tab value (unknown values fall back to the first tab). */
export function violationKind(tab: string | null | undefined): ViolationKind {
  return VIOLATION_TABS.find((t) => t.value === tab)?.value ?? "refused_tool";
}

// ---------------------------------------------------------------- money / costs
/** Decimal-string USD with western grouping and 2 decimals, never through float for display ("$1,234.57"). */
export function formatUsd(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const raw = typeof value === "number" ? (Number.isFinite(value) ? value.toFixed(6) : "") : value;
  const d = parseDecimal(raw);
  if (!d) return "—";
  const grouped = d.integer.replace(/\B(?=(\d{3})+(?!\d))/g, ","); // NOSONAR
  return `${d.negative ? "-" : ""}$${grouped}.${d.fraction}`;
}

/** Micro-dollars (integer) -> "$0.01". */
export function formatMicrosUsd(micros: number | null | undefined): string {
  if (micros === null || micros === undefined || !Number.isFinite(micros)) return "—";
  const neg = micros < 0;
  const abs = Math.abs(Math.round(micros));
  const integer = Math.floor(abs / 1_000_000);
  const frac = String(abs % 1_000_000).padStart(6, "0");
  return formatUsd(`${neg ? "-" : ""}${integer}.${frac}`);
}

export function formatTokens(n: number | null | undefined): string {
  return n === null || n === undefined ? "—" : n.toLocaleString("en-US");
}

/** Budget use bar: warning from 80 %, error at 100 %. */
export function budgetIntent(pct: number | null | undefined): "brand" | "warning" | "error" {
  if (pct === null || pct === undefined) return "brand";
  if (pct >= 100) return "error";
  if (pct >= 80) return "warning";
  return "brand";
}

/** `{day, agent_key, cost_usd}` points -> chart rows `{day, <agent>: number}` and the table rows. */
export function dailyCostSeries(points: readonly { day: string; agent_key: string; cost_usd: string }[]): {
  agents: string[];
  rows: Record<string, string | number>[];
} {
  const agents: string[] = [];
  const byDay = new Map<string, Record<string, string | number>>();
  for (const p of points) {
    if (!agents.includes(p.agent_key)) agents.push(p.agent_key);
    const row = byDay.get(p.day) ?? { day: p.day };
    row[p.agent_key] = Number(p.cost_usd) || 0;
    row[`${p.agent_key}__display`] = formatUsd(p.cost_usd);
    byDay.set(p.day, row);
  }
  const rows = [...byDay.values()].sort((a, b) => String(a.day).localeCompare(String(b.day)));
  return { agents, rows };
}

// ---------------------------------------------------------------- runs query
export type RunFilters = {
  agentKey: string | null;
  statuses: string[];
  origin: string | null;
  ownerId: string | null;
  ownerLabel?: string;
  subjectType: string;
  subjectId: string;
  from: string;
  to: string;
  taintedOnly: boolean;
  withViolations: boolean;
};

export const EMPTY_RUN_FILTERS: RunFilters = {
  agentKey: null,
  statuses: [],
  origin: null,
  ownerId: null,
  subjectType: "",
  subjectId: "",
  from: "",
  to: "",
  taintedOnly: false,
  withViolations: false,
};

function dayStart(d: string): string {
  return new Date(`${d}T00:00:00`).toISOString();
}
function dayEnd(d: string): string {
  const end = new Date(`${d}T00:00:00`);
  end.setDate(end.getDate() + 1);
  return end.toISOString();
}

/** Query string of `GET /ai-governance/runs`; also the `filters` of the `agent_runs` export. */
export function runFilterParams(f: RunFilters): Record<string, string> {
  const p: Record<string, string> = {};
  if (f.agentKey) p.agent_key = f.agentKey;
  if (f.statuses.length) p.status = f.statuses.join(",");
  if (f.origin) p.origin = f.origin;
  if (f.ownerId) p.owner_user_id = f.ownerId;
  if (f.subjectType.trim()) p.subject_type = f.subjectType.trim();
  if (f.subjectId.trim()) p.subject_id = f.subjectId.trim();
  if (f.from) p.created_from = dayStart(f.from);
  if (f.to) p.created_to = dayEnd(f.to);
  if (f.taintedOnly) p.tainted = "true";
  if (f.withViolations) p.with_violations = "true";
  return p;
}

export function runsQuery(f: RunFilters, page: number, pageSize: number): string {
  return new URLSearchParams({ ...runFilterParams(f), page: String(page), page_size: String(pageSize) }).toString();
}

/** Where a run subject / tool target opens in the app (null when it has no page). */
export function subjectHref(type: string | null | undefined, id: string | null | undefined): string | null {
  if (!type || !id) return null;
  const routes: Record<string, string> = {
    candidate: "/candidates/",
    demand: "/demands/",
    client: "/clients/",
    placement: "/placements/",
    offer: "/offers/",
    lead: "/leads/",
    opportunity: "/opportunities/",
    vendor: "/vendors/",
    project: "/projects/",
    task: "/tasks?id=",
  };
  const base = routes[type];
  return base ? `${base}${encodeURIComponent(id)}` : null;
}

/** "Step {n} · Model call". */
export function stepTitle(n: number): string {
  return `Step ${n} · Model call`;
}

/** Tool calls of one step, in order. */
export function toolCallsOfStep<T extends { step_no: number }>(calls: readonly T[], step: number): T[] {
  return calls.filter((c) => c.step_no === step);
}

// ---------------------------------------------------------------- evaluations
export const EVAL_STATUS: Record<string, { label: string; color: BadgeColor }> = {
  passing: { label: "Passing", color: "success" },
  below_threshold: { label: "Below threshold", color: "danger" },
  not_run: { label: "Not run", color: "subtle" },
};
export const EVALS_FOOTNOTE = "Results come from platform evaluation sets. Your data is never used in them.";

export function formatScore(score: string | number | null | undefined): string {
  if (score === null || score === undefined || score === "") return "—";
  const n = Number(score);
  return Number.isFinite(n) ? n.toFixed(2) : String(score);
}

// ---------------------------------------------------------------- Copilot usage
export const COPILOT_USAGE_NOTE = "Conversation content is private to each user. Only usage metadata is shown.";

/** Comments per day (`created_at` date) from the usage comments list. */
export function commentsPerDay(comments: readonly { created_at: string }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of comments) {
    const day = c.created_at.slice(0, 10);
    out[day] = (out[day] ?? 0) + 1;
  }
  return out;
}
