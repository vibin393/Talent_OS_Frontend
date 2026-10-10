/** Epic 64 pure UI logic (tested in `analytics.test.ts`): card states, labels, TSV copy, Ask page availability, builder pre-fill. */
import { formatCell } from "@/features/report-builder/logic";
import type { Definition, Row, RunResult, VizSpec } from "@/features/report-builder/types";
import type { AnswerOut, AnswerSummaryOut, CopilotStatus } from "./types";

export const LABELS = {
  pageTitle: "Ask about your data",
  pageSubtitle: "Answers use the same data and access as your reports. Nothing is saved until you choose to.",
  composer: "Ask a question, for example: placements by client this quarter",
  assumptions: "Assumptions",
  howCalculated: "How was this calculated?",
  openInBuilder: "Open in report builder",
  needBuild: "You need permission to build reports",
  copyTable: "Copy table",
  refresh: "Refresh",
  chart: "Chart",
  table: "Table",
  needsRepair: "This answer refers to a field that no longer exists. Ask again.",
  timeout: "This question took too long to answer. Try narrowing it (for example a shorter date range).",
  turnedOff: "Ask about your data is turned off for your organisation.",
  buildInstead: "Build a report instead",
  noAccess: "You don't have access to AI answers. You can still build a report.",
  history: "History",
  newQuestion: "New question",
  analytics: "Analytics",
} as const;

export const STARTER_QUESTIONS = [
  "Placements by client this financial year",
  "Average days from demand open to first submission, by recruiter, last 90 days",
  "Open demands by priority and status",
  "Interviews scheduled per week this quarter",
] as const;

export type CardTab = "chart" | "table";

export function defaultTab(viz: VizSpec): CardTab {
  return viz.type === "table" ? "table" : "chart";
}

export function isSuppressed(row: Row): boolean {
  return row.suppressed === true;
}

/** The rows a chart / table may show (suppressed small groups removed) and how many were hidden. */
export function visibleResult(result: RunResult): { result: RunResult; hidden: number } {
  const rows = result.rows.filter((r) => !isSuppressed(r));
  return { result: { ...result, rows }, hidden: result.rows.length - rows.length };
}

export function suppressedNote(hidden: number, k: number | null | undefined): string | null {
  if (hidden <= 0) return null;
  return `Groups with fewer than ${k ?? "the minimum number of"} records are hidden.`;
}

export type CardErrorKind = "needs_repair" | "timeout" | "other";

export function cardErrorKind(code: string | null | undefined, status?: string): CardErrorKind {
  if (code === "analytics_answer_needs_repair" || status === "needs_repair") return "needs_repair";
  if (code === "query_timeout") return "timeout";
  return "other";
}

export function cardErrorText(kind: CardErrorKind): string | null {
  if (kind === "needs_repair") return LABELS.needsRepair;
  if (kind === "timeout") return LABELS.timeout;
  return null;
}

export function builderHref(answerId: string): string {
  return `/reports/custom/new?from_answer=${encodeURIComponent(answerId)}`;
}

export function openInBuilderState(canBuild: boolean): { disabled: boolean; tooltip: string | null } {
  return canBuild ? { disabled: false, tooltip: null } : { disabled: true, tooltip: LABELS.needBuild };
}

function tsvCell(text: string): string {
  return text.replace(/[\t\r\n]+/g, " ");
}

/** Tab-separated copy of the visible rows (header = column labels; masked cells read "Hidden"). */
export function toTsv(result: RunResult): string {
  const lines = [result.columns.map((c) => tsvCell(c.label)).join("\t")];
  for (const row of result.rows) {
    if (isSuppressed(row)) continue;
    lines.push(result.columns.map((c) => tsvCell(formatCell(row[c.key] ?? null, c))).join("\t"));
  }
  return lines.join("\n");
}

export type Availability = "loading" | "no_access" | "off" | "ok";

/** Ask page gate: `copilot:use` first, then the Copilot status listing the `analytics` mode. */
export function askAvailability(canUseCopilot: boolean, status: CopilotStatus | undefined, statusError: boolean): Availability {
  if (!canUseCopilot) return "no_access";
  if (statusError) return "off";
  if (!status) return "loading";
  if (status.reason === "no_permission") return "no_access";
  if (!status.available || !status.modes.some((m) => m.agent_key === "analytics")) return "off";
  return "ok";
}

/** Answers produced by one assistant turn (matched by run id), oldest first. */
export function answersForRun(answers: readonly AnswerSummaryOut[], runId: string | null): AnswerSummaryOut[] {
  if (!runId) return [];
  return answers.filter((a) => a.run_id === runId).sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/** P3 builder pre-fill from an answer (`/reports/custom/new?from_answer=<id>`). */
export function prefillFromAnswer(answer: Pick<AnswerOut, "id" | "question" | "definition" | "viz">): { answerId: string; name: string; definition: Definition; viz: VizSpec } {
  const name = answer.question.trim().slice(0, 200) || "Report from answer";
  return { answerId: answer.id, name, definition: answer.definition, viz: answer.viz };
}

export function savedLabel(name: string | null): string | null {
  return name ? `Saved as report: ${name}` : null;
}
