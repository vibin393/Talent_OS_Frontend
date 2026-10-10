import { describe, expect, it } from "vitest";
import {
  auditChangeRows,
  auditChangeSummary,
  auditDataRows,
  auditExportUrl,
  auditListQuery,
  dayStartIso,
  EMPTY_AUDIT_FILTERS,
  formatAuditAction,
  formatAuditValue,
  hasActiveAuditFilters,
  humanizeField,
  invalidAuditRange,
  shortId,
} from "./audit-format";

describe("audit change formatting", () => {
  it("formats old -> new rows sorted by field", () => {
    expect(
      auditChangeRows({
        name: { old: "Ann", new: "Anna" },
        is_active: { old: true, new: false },
        business_unit_id: { old: null, new: "bu-1" },
      }),
    ).toEqual([
      { field: "business_unit_id", label: "Business unit id", old: "—", new: "bu-1", kind: "added" },
      { field: "is_active", label: "Is active", old: "Yes", new: "No", kind: "changed" },
      { field: "name", label: "Name", old: "Ann", new: "Anna", kind: "changed" },
    ]);
  });

  it("marks deletes as removed and keeps erased PII visible", () => {
    expect(auditChangeRows({ email: { old: "[erased]", new: null } })).toEqual([
      { field: "email", label: "Email", old: "[erased]", new: "—", kind: "removed" },
    ]);
  });

  it("treats a bare value as the new value", () => {
    expect(auditChangeRows({ tags: ["a", "b"] })[0]).toMatchObject({ old: "—", new: "a, b", kind: "added" });
  });

  it("returns no rows for empty or invalid changes", () => {
    expect(auditChangeRows(null)).toEqual([]);
    expect(auditChangeRows(undefined)).toEqual([]);
    expect(auditChangeRows({})).toEqual([]);
  });

  it("formats values", () => {
    expect(formatAuditValue(null)).toBe("—");
    expect(formatAuditValue("")).toBe("—");
    expect(formatAuditValue(0)).toBe("0");
    expect(formatAuditValue([])).toBe("—");
    expect(formatAuditValue({ a: 1 })).toBe('{"a":1}');
    expect(formatAuditValue([{ a: 1 }])).toBe('[{"a":1}]');
  });

  it("summarises changes and data", () => {
    expect(auditChangeSummary({ a: { old: 1, new: 2 } })).toBe("1 field: A");
    expect(auditChangeSummary({ a: 1, b: 2, c: 3, d: 4 })).toBe("4 fields: A, B, C +1 more");
    expect(auditChangeSummary(null)).toBe("");
    expect(auditDataRows({ rows: 3, filters: { action: "user." } })).toEqual([
      { key: "filters", label: "Filters", value: '{"action":"user."}' },
      { key: "rows", label: "Rows", value: "3" },
    ]);
  });

  it("humanizes names", () => {
    expect(humanizeField("business_unit_id")).toBe("Business unit id");
    expect(formatAuditAction("auth.login_failed")).toBe("Auth login failed");
    expect(shortId("3f2a9c1e-0000-0000-0000-000000000000")).toBe("3f2a9c1e…");
    expect(shortId(null)).toBe("—");
  });
});

describe("audit filter -> query mapping", () => {
  it("omits empty filters", () => {
    expect(auditListQuery(EMPTY_AUDIT_FILTERS, 1)).toBe("page=1&page_size=20");
    expect(auditExportUrl(EMPTY_AUDIT_FILTERS)).toBe("/api/v1/admin/audit-logs/export.csv");
    expect(hasActiveAuditFilters(EMPTY_AUDIT_FILTERS)).toBe(false);
  });

  it("maps filters and makes the end day inclusive", () => {
    const filters = {
      entityType: " user ",
      entityId: "abc",
      actorId: "actor-1",
      action: "user.",
      fromDate: "2026-09-01",
      toDate: "2026-09-30",
    };
    const params = new URLSearchParams(auditListQuery(filters, 2, 50));
    expect(params.get("entity_type")).toBe("user");
    expect(params.get("entity_id")).toBe("abc");
    expect(params.get("actor_id")).toBe("actor-1");
    expect(params.get("action")).toBe("user.");
    expect(params.get("from")).toBe(new Date(2026, 8, 1).toISOString());
    expect(params.get("to")).toBe(new Date(2026, 9, 1).toISOString());
    expect(params.get("page")).toBe("2");
    expect(params.get("page_size")).toBe("50");
    const exportParams = new URLSearchParams(auditExportUrl(filters).split("?")[1]);
    expect(exportParams.get("page")).toBeNull();
    expect(exportParams.get("action")).toBe("user.");
    expect(hasActiveAuditFilters(filters)).toBe(true);
  });

  it("ignores invalid days and flags inverted ranges", () => {
    expect(dayStartIso("not-a-day")).toBeNull();
    expect(new URLSearchParams(auditListQuery({ ...EMPTY_AUDIT_FILTERS, fromDate: "bad" }, 1)).get("from")).toBeNull();
    expect(invalidAuditRange({ ...EMPTY_AUDIT_FILTERS, fromDate: "2026-09-10", toDate: "2026-09-01" })).toBe(true);
    expect(invalidAuditRange({ ...EMPTY_AUDIT_FILTERS, fromDate: "2026-09-10", toDate: "2026-09-10" })).toBe(false);
  });
});
