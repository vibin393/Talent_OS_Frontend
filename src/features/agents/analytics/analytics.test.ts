import { describe, expect, it } from "vitest";
import type { RunResult } from "@/features/report-builder/types";
import {
  LABELS,
  STARTER_QUESTIONS,
  answersForRun,
  askAvailability,
  builderHref,
  cardErrorKind,
  cardErrorText,
  defaultTab,
  openInBuilderState,
  prefillFromAnswer,
  savedLabel,
  suppressedNote,
  toTsv,
  visibleResult,
} from "./logic";
import type { AnswerSummaryOut, CopilotStatus } from "./types";

const RESULT: RunResult = {
  run_id: null,
  report_id: null,
  definition_version: null,
  columns: [
    { key: "client.name", label: "Client", type: "string", masked: false },
    { key: "n", label: "n", type: "int", masked: false },
    { key: "bill_rate", label: "Bill rate", type: "decimal", masked: true },
  ],
  rows: [
    { "client.name": "Acme", n: 3, bill_rate: null },
    { suppressed: true },
    { "client.name": "Globex\tLtd", n: 1200, bill_rate: null },
  ],
  total: 3,
  truncated: false,
  row_limit: 500,
  masked_fields: ["bill_rate"],
  limit_hit: null,
  viz: { type: "bar", x: "client.name", value: "n" },
};

const STATUS: CopilotStatus = {
  available: true,
  reason: null,
  questions_left_this_hour: 10,
  questions_per_hour: 30,
  retention_days: 90,
  allow_feedback_comments: true,
  modes: [
    { agent_key: "copilot", label: "Copilot" },
    { agent_key: "analytics", label: "Ask about your data" },
  ],
};

describe("analytics answer card logic", () => {
  it("defaults to the chart unless the viz is a table", () => {
    expect(defaultTab({ type: "bar" })).toBe("chart");
    expect(defaultTab({ type: "kpi" })).toBe("chart");
    expect(defaultTab({ type: "table" })).toBe("table");
  });

  it("hides suppressed groups and says so", () => {
    const { result, hidden } = visibleResult(RESULT);
    expect(hidden).toBe(1);
    expect(result.rows).toHaveLength(2);
    expect(suppressedNote(hidden, 5)).toBe("Groups with fewer than 5 records are hidden.");
    expect(suppressedNote(0, 5)).toBeNull();
  });

  it("maps the needs-repair and timeout states to the exact copy", () => {
    expect(cardErrorText(cardErrorKind("analytics_answer_needs_repair"))).toBe("This answer refers to a field that no longer exists. Ask again.");
    expect(cardErrorKind(null, "needs_repair")).toBe("needs_repair");
    expect(cardErrorText(cardErrorKind("query_timeout"))).toBe("This question took too long to answer. Try narrowing it (for example a shorter date range).");
    expect(cardErrorText(cardErrorKind("forbidden"))).toBeNull();
  });

  it("disables Open in report builder without report:build", () => {
    expect(openInBuilderState(false)).toEqual({ disabled: true, tooltip: "You need permission to build reports" });
    expect(openInBuilderState(true)).toEqual({ disabled: false, tooltip: null });
    expect(builderHref("a1")).toBe("/reports/custom/new?from_answer=a1");
    expect(LABELS.openInBuilder).toBe("Open in report builder");
  });

  it("copies the visible rows as TSV with masked cells hidden", () => {
    expect(toTsv(RESULT).split("\n")).toEqual(["Client\tn\tBill rate", "Acme\t3\tHidden", "Globex Ltd\t1,200\tHidden"]);
  });

  it("labels a saved answer", () => {
    expect(savedLabel("Placements by client")).toBe("Saved as report: Placements by client");
    expect(savedLabel(null)).toBeNull();
  });
});

describe("ask page", () => {
  it("gates on copilot:use and the analytics mode", () => {
    expect(askAvailability(false, STATUS, false)).toBe("no_access");
    expect(askAvailability(true, undefined, false)).toBe("loading");
    expect(askAvailability(true, STATUS, false)).toBe("ok");
    expect(askAvailability(true, { ...STATUS, modes: [{ agent_key: "copilot", label: "Copilot" }] }, false)).toBe("off");
    expect(askAvailability(true, { ...STATUS, available: false, reason: "not_enabled" }, false)).toBe("off");
    expect(askAvailability(true, { ...STATUS, available: false, reason: "no_permission" }, false)).toBe("no_access");
    expect(askAvailability(true, undefined, true)).toBe("off");
    expect(LABELS.turnedOff).toBe("Ask about your data is turned off for your organisation.");
    expect(LABELS.noAccess).toBe("You don't have access to AI answers. You can still build a report.");
  });

  it("has the four starter questions and the composer copy", () => {
    expect(STARTER_QUESTIONS).toHaveLength(4);
    expect(STARTER_QUESTIONS[0]).toBe("Placements by client this financial year");
    expect(LABELS.composer).toBe("Ask a question, for example: placements by client this quarter");
  });

  it("attaches answers to the assistant turn of their run", () => {
    const a = (id: string, run: string | null, at: string): AnswerSummaryOut => ({
      id, question: "q", source_key: "s", source_label: null, status: "ok", row_count: 1, saved_report_id: null, conversation_id: "c", run_id: run, created_at: at,
    });
    const list = [a("2", "r1", "2026-10-08T10:01:00Z"), a("1", "r1", "2026-10-08T10:00:00Z"), a("3", "r2", "2026-10-08T10:02:00Z")];
    expect(answersForRun(list, "r1").map((x) => x.id)).toEqual(["1", "2"]);
    expect(answersForRun(list, null)).toEqual([]);
  });
});

describe("builder pre-fill", () => {
  it("initialises the builder from an answer", () => {
    const definition = { source: "placements.placement", group_by: [{ field: "client.name" }] };
    const p = prefillFromAnswer({ id: "a1", question: "  Placements by client  ", definition, viz: { type: "bar", x: "client.name" } });
    expect(p).toEqual({ answerId: "a1", name: "Placements by client", definition, viz: { type: "bar", x: "client.name" } });
    expect(prefillFromAnswer({ id: "a2", question: " ", definition, viz: { type: "table" } }).name).toBe("Report from answer");
  });
});
