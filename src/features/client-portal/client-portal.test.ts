import { describe, expect, it } from "vitest";
import { formatMoney } from "@/features/billing/money";
import { linkErrorCopy } from "@/features/public-links/logic";
import { CLIENT_NAV } from "@/app/client/nav-items";
import {
  availabilityLabel,
  canCompare,
  commentError,
  consumedShare,
  delegateBadge,
  experienceLabel,
  toggleCompare,
  validateSlots,
  visibleNav,
} from "./logic";

describe("compare selection", () => {
  it("caps the selection at 4 and needs at least 2", () => {
    let sel: string[] = [];
    for (const id of ["a", "b", "c", "d", "e"]) sel = toggleCompare(sel, id);
    expect(sel).toEqual(["a", "b", "c", "d"]);
    expect(canCompare(sel)).toBe(true);
    sel = toggleCompare(sel, "b");
    expect(sel).toEqual(["a", "c", "d"]);
    expect(canCompare(["a"])).toBe(false);
  });
});

describe("slot rows", () => {
  const now = new Date("2026-10-05T09:00:00");
  it("accepts future rows with end after start", () => {
    const r = validateSlots([{ date: "2026-10-07", start: "10:00", end: "11:00" }], "Asia/Kolkata", now);
    expect(r.errors).toEqual([null]);
    expect(r.slots).toHaveLength(1);
  });
  it("rejects end before start, past times and more than 5 rows", () => {
    expect(validateSlots([{ date: "2026-10-07", start: "11:00", end: "10:00" }], "UTC", now).errors[0]).toMatch(/after start/);
    expect(validateSlots([{ date: "2026-10-01", start: "10:00", end: "11:00" }], "UTC", now).errors[0]).toMatch(/future/);
    const six = Array.from({ length: 6 }, () => ({ date: "2026-10-07", start: "10:00", end: "11:00" }));
    expect(validateSlots(six, "UTC", now).slots).toBeNull();
    expect(validateSlots([{ date: "", start: "10:00", end: "11:00" }], "UTC", now).slots).toBeNull();
  });
});

describe("decisions", () => {
  it("requires a comment to reject", () => {
    expect(commentError("reject", " ")).not.toBeNull();
    expect(commentError("rejected", "")).not.toBeNull();
    expect(commentError("reject", "Too many hours")).toBeNull();
    expect(commentError("approve", "")).toBeNull();
  });
  it("shows the delegate badge only when acting for someone", () => {
    expect(delegateBadge("Dev Rao")).toBe("for Dev Rao");
    expect(delegateBadge(null)).toBeNull();
  });
});

describe("nav gating", () => {
  it("hides entries the Client User lacks the permission for", () => {
    const hrefs = visibleNav(CLIENT_NAV, ["submissions:review"]).map((n) => n.href);
    expect(hrefs).toContain("/client/scorecards");
    expect(hrefs).toContain("/client/approvals");
    expect(hrefs).not.toContain("/client/team");
    expect(hrefs).not.toContain("/client/purchase-orders");
    expect(visibleNav(CLIENT_NAV, ["placements:view"]).map((n) => n.href)).toContain("/client/team");
  });
});

describe("rendering helpers", () => {
  it("renders money from Decimal strings and PO shares", () => {
    expect(formatMoney({ amount: "1500.00", currency: "INR" })).toContain("1,500.00");
    expect(formatMoney({ amount: "1234567.5", currency: "INR" })).toContain("12,34,567.50");
    expect(consumedShare("250.00", "1000.00")).toBe(0.25);
    expect(consumedShare("1500", "1000")).toBe(1);
    expect(consumedShare("10", null)).toBeNull();
  });
  it("labels experience and availability", () => {
    expect(experienceLabel(62)).toBe("5 yrs 2 mo");
    expect(availabilityLabel(0)).toBe("Immediate");
    expect(availabilityLabel(30)).toBe("30 days notice");
  });
  it("uses the shared link error copy for the client_approval renderer", () => {
    expect(linkErrorCopy(410, "link_used").title).toMatch(/already been used/);
    expect(linkErrorCopy(410, "link_expired").title).toMatch(/expired/);
    expect(linkErrorCopy(404, "link_invalid").title).toMatch(/not found/);
  });
});
