import { describe, expect, it } from "vitest";
import {
  buildChainIn,
  chainDraft,
  describeCondition,
  emptyStep,
  hasChainErrors,
  moveItem,
  parseCondition,
  rowError,
  serializeCondition,
  validateChain,
} from "./conditions";

describe("condition serialization", () => {
  it("returns null without rows", () => {
    expect(serializeCondition({ mode: "all", rows: [] })).toBeNull();
  });

  it("coerces numeric values and upper-cases countries", () => {
    expect(
      serializeCondition({
        mode: "any",
        rows: [
          { field: "bill_rate", op: "gte", value: " 2000 " },
          { field: "country", op: "in", value: "in, us" },
          { field: "positions", op: "in", value: "1,2" },
        ],
      }),
    ).toEqual({
      any: [
        { field: "bill_rate", op: "gte", value: 2000 },
        { field: "country", op: "in", value: ["IN", "US"] },
        { field: "positions", op: "in", value: [1, 2] },
      ],
    });
  });

  it("round-trips through parseCondition", () => {
    const stored = { all: [{ field: "margin_percent", op: "lt", value: 15 }, { field: "employment_type", op: "eq", value: "permanent" }] };
    expect(serializeCondition(parseCondition(stored))).toEqual(stored);
  });

  it("drops unknown fields and ops when parsing", () => {
    expect(parseCondition({ all: [{ field: "salary", op: "gt", value: 1 }, { field: "positions", op: "like", value: 1 }] }).rows).toEqual([]);
    expect(parseCondition(null)).toEqual({ mode: "all", rows: [] });
  });

  it("validates rows", () => {
    expect(rowError({ field: "bill_rate", op: "gt", value: "abc" })).toBe("Enter a number");
    expect(rowError({ field: "country", op: "gt", value: "IN" })).toBe("This operator needs a numeric field");
    expect(rowError({ field: "country", op: "eq", value: "IND" })).toBe("Use a 2-letter country code");
    expect(rowError({ field: "client_id", op: "eq", value: " " })).toBe("Enter a value");
    expect(rowError({ field: "positions", op: "in", value: "1, 3" })).toBeNull();
  });

  it("describes conditions in plain language", () => {
    expect(describeCondition(null)).toBe("Always applies");
    expect(describeCondition({ all: [{ field: "bill_rate", op: "gte", value: 2000 }] })).toBe(
      "Applies when bill rate at least 2000",
    );
  });
});

describe("chain drafts", () => {
  it("moves steps up and down within bounds", () => {
    expect(moveItem([1, 2, 3], 0, 1)).toEqual([2, 1, 3]);
    expect(moveItem([1, 2, 3], 0, -1)).toEqual([1, 2, 3]);
    expect(moveItem([1, 2, 3], 2, -1)).toEqual([1, 3, 2]);
  });

  it("requires a step name and approver", () => {
    const d = chainDraft();
    const errors = validateChain(d);
    expect(hasChainErrors(errors)).toBe(true);
    const step = { ...emptyStep(), name: "Finance", approverId: "r1" };
    expect(hasChainErrors(validateChain({ ...d, steps: [step] }))).toBe(false);
  });

  it("builds the API body with exactly one approver per step", () => {
    const body = buildChainIn({
      name: " Demands ",
      subjectType: "demand",
      isActive: true,
      steps: [
        { ...emptyStep(), name: "Finance", approverKind: "user", approverId: "u1", condition: { mode: "all", rows: [{ field: "bill_rate", op: "gte", value: "2000" }] } },
        { ...emptyStep(), name: "Delivery head", approverKind: "role", approverId: "r1" },
      ],
    });
    expect(body).toEqual({
      name: "Demands",
      subject_type: "demand",
      is_active: true,
      steps: [
        { name: "Finance", approver_user_id: "u1", approver_role_id: null, condition: { all: [{ field: "bill_rate", op: "gte", value: 2000 }] } },
        { name: "Delivery head", approver_user_id: null, approver_role_id: "r1", condition: null },
      ],
    });
  });
});

describe("approval key facts", () => {
  it("summarises the facts shown in My approvals", async () => {
    const { keyFacts } = await import("./facts");
    expect(keyFacts({ positions: 2, bill_rate: "1500.00", margin_percent: "26.67", country: "IN", employment_type: "contract_to_hire" })).toBe(
      "2 positions · bill 1,500 · margin 26.7% · IN · contract to hire",
    );
    expect(keyFacts({})).toBe("—");
  });
});
