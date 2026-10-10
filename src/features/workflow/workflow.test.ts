import { describe, expect, it } from "vitest";
import type { PipelineStageOut, WorkflowFieldOut } from "@/lib/api/types";
import {
  actionLines,
  buildConditions,
  buildRuleBody,
  coerceValue,
  emptyRule,
  moveStageOptions,
  newClause,
  newGroup,
  parseConditions,
  parseErrorPath,
  rowIdForError,
  traceLines,
  valueEditorKind,
} from "./rule-model";

describe("value editor per field type", () => {
  it("chooses the input from type and operator", () => {
    expect(valueEditorKind("enum", "eq")).toBe("enum");
    expect(valueEditorKind("enum", "in")).toBe("enum-multi");
    expect(valueEditorKind("int", "gte")).toBe("number");
    expect(valueEditorKind("decimal", "lt")).toBe("number");
    expect(valueEditorKind("date", "gt")).toBe("date");
    expect(valueEditorKind("bool", "eq")).toBe("bool");
    expect(valueEditorKind("list", "contains")).toBe("text");
    expect(valueEditorKind("str", "not_in")).toBe("tags");
    expect(valueEditorKind("uuid", "in")).toBe("tags");
    expect(valueEditorKind("str", "is_empty")).toBe("none");
  });

  it("coerces values when the editor changes", () => {
    expect(coerceValue("enum-multi", "high")).toEqual(["high"]);
    expect(coerceValue("enum", ["high", "low"])).toBe("high");
    expect(coerceValue("number", "4")).toBe(4);
    expect(coerceValue("number", "abc")).toBe(0);
    expect(coerceValue("bool", null)).toBe(true);
    expect(coerceValue("none", "x")).toBeNull();
  });
});

describe("move_stage targets (FR-65)", () => {
  const stage = (key: string, kind: string, archived = false) =>
    ({ id: key, key, label: key, kind, position: 0, archived_at: archived ? "2026-01-01" : null, terminal: false }) as PipelineStageOut;
  const stages = [
    stage("applied", "anchored"),
    stage("screening", "custom"),
    stage("shortlisted", "anchored"),
    stage("submitted", "anchored"),
    stage("interviewing", "anchored"),
    stage("selected", "anchored"),
    stage("offered", "anchored"),
    stage("hired", "anchored"),
    stage("rejected", "anchored"),
    stage("withdrawn", "anchored"),
    stage("old_custom", "custom", true),
  ];
  const blocked = ["hired", "offered", "rejected", "selected", "shortlisted", "submitted", "withdrawn"];

  it("lists only workflow-allowed targets", () => {
    expect(moveStageOptions(stages, blocked).map((s) => s.key)).toEqual(["screening", "interviewing"]);
  });

  it("never offers a human-only stage even if the registry omits it", () => {
    expect(moveStageOptions(stages, []).map((s) => s.key)).toEqual(["screening", "interviewing"]);
  });
});

describe("conditions JSON", () => {
  it("empty means always", () => {
    expect(buildConditions(emptyRule().conditions)).toEqual({});
    expect(parseConditions({}).draft.items).toEqual([]);
  });

  it("round-trips all/any with one nested group", () => {
    const json = {
      all: [
        { field: "priority", op: "eq", value: "high" },
        { any: [{ field: "status", op: "eq", value: "open" }, { field: "location.city", op: "is_empty" }] },
      ],
    };
    const { draft, unsupported } = parseConditions(json);
    expect(unsupported).toBe(false);
    expect(buildConditions(draft)).toEqual(json);
  });

  it("flags structures the builder cannot show", () => {
    expect(parseConditions({ not: { field: "status", op: "eq", value: "open" } }).unsupported).toBe(true);
  });

  it("drops empty optional params from actions", () => {
    const rule = emptyRule("demand.created");
    rule.name = " High priority ";
    rule.actions = [{ id: "a", type: "create_task", params: { title: "Call client", due_in_hours: null, owner: "" } }];
    expect(buildRuleBody(rule)).toMatchObject({
      name: "High priority",
      actions: [{ type: "create_task", params: { title: "Call client" } }],
    });
  });
});

describe("422 path -> row", () => {
  it("parses condition and action paths", () => {
    expect(parseErrorPath("conditions.all[1].any[0].value")).toEqual({ section: "conditions", indexes: [1, 0] });
    expect(parseErrorPath("actions[2].params.title")).toEqual({ section: "actions", index: 2, param: "title" });
    expect(parseErrorPath("actions[0].type")).toEqual({ section: "actions", index: 0, param: null });
    expect(parseErrorPath("trigger")).toEqual({ section: "trigger" });
    expect(parseErrorPath("conditions")).toEqual({ section: "conditions-root" });
  });

  it("maps a path to the offending row", () => {
    const rule = emptyRule("demand.created");
    const c0 = newClause("priority");
    const g = newGroup("any");
    const c1 = newClause("status");
    g.clauses = [c1];
    rule.conditions = { match: "all", items: [c0, g] };
    rule.actions = [
      { id: "a0", type: "notify", params: {} },
      { id: "a1", type: "create_task", params: {} },
    ];
    expect(rowIdForError(rule, "conditions.all[0].value")).toBe(c0.id);
    expect(rowIdForError(rule, "conditions.all[1].any[0].op")).toBe(c1.id);
    expect(rowIdForError(rule, "conditions.all[1]")).toBe(g.id);
    expect(rowIdForError(rule, "actions[1].params.title")).toBe("a1");
    expect(rowIdForError(rule, "trigger")).toBeNull();
  });
});

describe("test-run rendering", () => {
  const fields = [{ path: "priority", label: "Priority", type: "enum", values: ["high"], ops: ["eq"] }] as WorkflowFieldOut[];

  it("renders ✓/✗ per condition with the actual value", () => {
    const lines = traceLines(
      [
        { path: "conditions.all[0]", field: "priority", op: "eq", value: "high", actual: "high", result: true },
        { path: "conditions.all[1]", field: "created", op: "gt", value: "abc", actual: "2026-01-01", result: false, note: "incompatible values: expected an ISO date" },
      ],
      fields,
    );
    expect(lines[0]).toMatchObject({ label: "Priority is high", ok: true, actual: "high" });
    expect(lines[1]).toMatchObject({ ok: false, note: "incompatible values: expected an ISO date" });
  });

  it("renders would-run and would-fail action lines", () => {
    const lines = actionLines(
      [
        { index: 0, type: "create_task", status: "would_run", detail: "Would create task 'Call client' for Priya (due in 4 h)" },
        { index: 1, type: "move_stage", status: "error", detail: "Human-only stage", error_code: "transition_not_allowed" },
        { index: 2, type: "notify", status: "would_run", detail: "" },
      ],
      { notify: "Send a notification" },
    );
    expect(lines.map((l) => [l.ok, l.text])).toEqual([
      [true, "Would create task 'Call client' for Priya (due in 4 h)"],
      [false, "Would fail: transition not allowed (Human-only stage)"],
      [true, "Would run: Send a notification"],
    ]);
  });
});
