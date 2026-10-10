import { describe, expect, it } from "vitest";
import {
  coerceList,
  coerceScalar,
  defaultValue,
  definitionStats,
  definitionToTree,
  emptyCondition,
  emptyGroup,
  filterableFields,
  groupFields,
  nodeIdAtPath,
  operatorsForField,
  OPS_BY_TYPE,
  treeToDefinition,
  unavailableFields,
  updateNode,
  valueKind,
  type BuilderGroup,
} from "./logic";
import type { Definition, FieldType, SemanticField, SemanticSource } from "./types";

function field(key: string, type: FieldType, ops: string[], extra: Partial<SemanticField> = {}): SemanticField {
  return { key, label: key, type, pii_class: "none", ops, enum_values: null, join: null, ...extra };
}

const CANDIDATES: SemanticSource = {
  key: "candidates.candidate",
  label: "Candidate",
  fields: [
    field("notice_period_days", "int", ["eq", "lt", "lte", "gt", "gte", "between", "is_null"]),
    field("availability_date", "date", ["lt", "gt", "within_days", "is_null"]),
    field("city", "string", ["eq", "in", "contains", "starts_with"]),
    field("status", "enum", ["eq", "in", "not_in"], { enum_values: ["active", "passive"] }),
    field("skills", "skill", ["skill_match"]),
    field("consent_marketing", "enum", [], { enum_values: ["granted", "withdrawn", "none"] }),
    field("stage_history.stage_key", "enum", ["in"], { join: "stage_history", enum_values: ["selected", "offered"] }),
    field("stage_history.entered_at", "datetime", ["within_days"], { join: "stage_history" }),
  ],
};

const SILVER: Definition = {
  filters: {
    and: [
      { field: "stage_history.stage_key", op: "in", value: ["selected", "offered"] },
      { field: "stage_history.entered_at", op: "within_days", value: 548 },
      {
        or: [
          { field: "days_since_last_placement", op: "is_null", value: true },
          { field: "days_since_last_placement", op: "gt", value: 548 },
        ],
      },
    ],
  },
};

describe("builder tree serialisation", () => {
  it("round-trips a nested definition exactly", () => {
    expect(treeToDefinition(definitionToTree(SILVER))).toEqual(SILVER);
  });

  it("round-trips skill_match and within_days objects", () => {
    const defn: Definition = {
      filters: {
        or: [
          { field: "notice_period_days", op: "lte", value: 15 },
          { field: "availability_date", op: "within_days", value: { days: 15, direction: "future" } },
          {
            field: "skills",
            op: "skill_match",
            value: { ref: { kind: "global", id: "0b6c7f3e-0000-4000-8000-000000000001" }, min_proficiency: 3, expand: true },
          },
        ],
      },
    };
    expect(treeToDefinition(definitionToTree(defn))).toEqual(defn);
  });

  it("wraps a bare leaf in an AND group and treats null as empty", () => {
    const leaf: Definition = { filters: { field: "city", op: "eq", value: "Pune" } };
    expect(treeToDefinition(definitionToTree(leaf))).toEqual({ filters: { and: [leaf.filters] } });
    expect(treeToDefinition(definitionToTree({ filters: null }))).toEqual({ filters: null });
    expect(treeToDefinition(definitionToTree(null))).toEqual({ filters: null });
  });

  it("drops rows without a field or operator and empty groups", () => {
    const root: BuilderGroup = {
      ...emptyGroup("and", false),
      children: [emptyCondition(), emptyGroup("or", false), { kind: "condition", id: "x", field: "city", op: "eq", value: "Pune" }],
    };
    expect(treeToDefinition(root)).toEqual({ filters: { and: [{ field: "city", op: "eq", value: "Pune" }] } });
  });

  it("drops incomplete values only for the live preview", () => {
    const root: BuilderGroup = {
      ...emptyGroup("and", false),
      children: [
        { kind: "condition", id: "a", field: "city", op: "in", value: [] },
        { kind: "condition", id: "b", field: "notice_period_days", op: "between", value: [10, null] },
        { kind: "condition", id: "c", field: "skills", op: "skill_match", value: { ref: null, min_proficiency: null, expand: true } },
        { kind: "condition", id: "d", field: "notice_period_days", op: "lte", value: 30 },
      ],
    };
    expect(treeToDefinition(root, { dropIncomplete: true })).toEqual({
      filters: { and: [{ field: "notice_period_days", op: "lte", value: 30 }] },
    });
    expect((treeToDefinition(root).filters as { and: unknown[] }).and).toHaveLength(4);
  });

  it("strips the display label from skill values", () => {
    const root: BuilderGroup = {
      ...emptyGroup("and", false),
      children: [
        {
          kind: "condition",
          id: "s",
          field: "skills",
          op: "skill_match",
          value: { ref: { kind: "tenant", id: "t1" }, min_proficiency: null, expand: false, label: "Java" },
        },
      ],
    };
    expect(treeToDefinition(root)).toEqual({
      filters: { and: [{ field: "skills", op: "skill_match", value: { ref: { kind: "tenant", id: "t1" }, min_proficiency: null, expand: false } }] },
    });
  });

  it("counts depth and conditions", () => {
    expect(definitionStats(SILVER)).toEqual({ depth: 2, conditions: 4 });
    expect(definitionStats({ filters: null })).toEqual({ depth: 0, conditions: 0 });
  });

  it("updates and removes nodes deeply, and maps a 422 path to a row", () => {
    const tree = definitionToTree(SILVER);
    const or = tree.children[2];
    expect(or.kind).toBe("group");
    const target = (or as BuilderGroup).children[1];
    expect(nodeIdAtPath(tree, "$.filters.and[2].or[1].value")).toBe(target.id);
    const removed = updateNode(tree, target.id, () => null);
    expect((treeToDefinition(removed).filters as { and: { or?: unknown[] }[] }).and[2].or).toHaveLength(1);
  });
});

describe("operators per field type", () => {
  it("offers the catalogue ops that are valid for the type, in catalogue order", () => {
    expect(operatorsForField(field("n", "int", ["gt", "eq", "contains"]))).toEqual(["gt", "eq"]);
    expect(operatorsForField(field("d", "date", ["within_days", "lt", "starts_with"]))).toEqual(["within_days", "lt"]);
    expect(operatorsForField(field("s", "string", ["eq", "contains", "starts_with", "gt"]))).toEqual(["eq", "contains", "starts_with"]);
    expect(operatorsForField(field("k", "skill", ["skill_match", "eq"]))).toEqual(["skill_match"]);
    expect(operatorsForField(field("b", "bool", ["eq", "in"]))).toEqual(["eq"]);
  });

  it("never offers ordering operators on text or skill_match off skills", () => {
    for (const t of ["string", "enum", "uuid", "bool", "string_array"] as FieldType[]) {
      expect(OPS_BY_TYPE[t]).not.toContain("gt");
    }
    for (const t of Object.keys(OPS_BY_TYPE) as FieldType[]) {
      if (t !== "skill") expect(OPS_BY_TYPE[t]).not.toContain("skill_match");
    }
  });

  it("offers nothing for display-only fields", () => {
    expect(operatorsForField(field("consent_marketing", "enum", []))).toEqual([]);
    expect(operatorsForField(null)).toEqual([]);
  });

  it("picks a typed value editor and default per operator", () => {
    const int = field("n", "int", ["eq", "in", "between"]);
    const date = field("d", "date", ["between", "within_days"]);
    const en = field("e", "enum", ["eq", "in"], { enum_values: ["a"] });
    expect(valueKind(int, "eq")).toBe("number");
    expect(valueKind(int, "in")).toBe("number_multi");
    expect(valueKind(int, "between")).toBe("number_range");
    expect(valueKind(date, "between")).toBe("date_range");
    expect(valueKind(date, "within_days")).toBe("within_days");
    expect(valueKind(en, "in")).toBe("enum_multi");
    expect(valueKind(field("k", "skill", ["skill_match"]), "skill_match")).toBe("skill");
    expect(valueKind(int, "is_null")).toBe("is_null");
    expect(defaultValue(date, "within_days")).toEqual({ days: 30, direction: "future" });
    expect(defaultValue(int, "between")).toEqual([null, null]);
  });

  it("coerces typed values", () => {
    expect(coerceScalar("number", "12.7", "int")).toBe(12);
    expect(coerceScalar("number", "12.5", "decimal")).toBe(12.5);
    expect(coerceScalar("number", "abc")).toBeNull();
    expect(coerceScalar("date", "2026-10-06")).toBe("2026-10-06");
    expect(coerceScalar("date", "06/10/2026")).toBeNull();
    expect(coerceList("text_multi", " Pune, Mumbai,, Pune ")).toEqual(["Pune", "Mumbai"]);
    expect(coerceList("number_multi", "1, x, 2", "int")).toEqual([1, 2]);
  });
});

describe("catalogue fields in the builder", () => {
  it("excludes display-only fields (consent) from the builder", () => {
    const keys = filterableFields(CANDIDATES).map((f) => f.key);
    expect(keys).not.toContain("consent_marketing");
    expect(keys).toContain("notice_period_days");
  });

  it("hides compensation fields absent from the catalogue and flags definitions that use them", () => {
    // The catalogue omits `expected_comp_inr` for users without compensation:view.
    expect(filterableFields(CANDIDATES).some((f) => f.key === "expected_comp_inr")).toBe(false);
    const defn: Definition = {
      filters: { and: [{ field: "expected_comp_inr", op: "lte", value: 2000000 }, { field: "city", op: "eq", value: "Pune" }] },
    };
    expect(unavailableFields(defn, CANDIDATES)).toEqual(["expected_comp_inr"]);
    expect(unavailableFields({ filters: { field: "consent_marketing", op: "eq", value: "granted" } }, CANDIDATES)).toEqual(["consent_marketing"]);
  });

  it("groups fields by entity, base entity first", () => {
    const groups = groupFields(CANDIDATES);
    expect(groups.map((g) => g.label)).toEqual(["Candidate", "Stage history"]);
    expect(groups[1].fields.map((f) => f.key)).toEqual(["stage_history.stage_key", "stage_history.entered_at"]);
  });
});
