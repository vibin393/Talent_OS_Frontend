import { describe, expect, it } from "vitest";
import { auditExportUrl, auditListQuery, EMPTY_AUDIT_FILTERS, hasActiveAuditFilters } from "./audit-format";

describe("audit log actor-type filter", () => {
  it("sends actor_type when chosen", () => {
    const f = { ...EMPTY_AUDIT_FILTERS, actorType: "client_user" };
    expect(auditListQuery(f, 1, 25)).toContain("actor_type=client_user");
    expect(auditExportUrl(f)).toContain("actor_type=client_user");
    expect(hasActiveAuditFilters(f)).toBe(true);
  });
  it("omits it when empty", () => {
    expect(auditListQuery({ ...EMPTY_AUDIT_FILTERS, actorType: "" }, 1, 25)).not.toContain("actor_type");
    expect(hasActiveAuditFilters(EMPTY_AUDIT_FILTERS)).toBe(false);
  });
});
