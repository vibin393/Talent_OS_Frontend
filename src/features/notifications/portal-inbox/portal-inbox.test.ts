import { describe, expect, it } from "vitest";
import { PORTAL_INBOX_BASE } from "./api";
import { markEveryRead, markOneRead, PORTAL_AREAS, portalLinkPath, setEmailPreference } from "./inbox-state";
import type { PortalInbox } from "./types";

const inbox = (): PortalInbox => ({
  unread_count: 2,
  items: [
    { id: "a", type: "timesheet_approval", title: "Approve", body: "", link: "/client/approvals/1", read_at: null, created_at: "2026-10-05T10:00:00Z" },
    { id: "b", type: "invoice_issued", title: "Invoice", body: "", link: null, read_at: null, created_at: "2026-10-05T09:00:00Z" },
    { id: "c", type: "invoice_issued", title: "Old", body: "", link: null, read_at: "2026-10-01T00:00:00Z", created_at: "2026-10-01T00:00:00Z" },
  ],
});

describe("portal bell read state", () => {
  it("marks one notification read and decrements the unread count once", () => {
    const once = markOneRead(inbox(), "a", "T");
    expect(once.unread_count).toBe(1);
    expect(once.items.find((n) => n.id === "a")?.read_at).toBe("T");
    expect(markOneRead(once, "a", "T2")).toBe(once);
    expect(markOneRead(once, "c")).toBe(once);
    expect(markOneRead(once, "missing")).toBe(once);
  });
  it("marks all read and keeps existing read times", () => {
    const all = markEveryRead(inbox(), "T");
    expect(all.unread_count).toBe(0);
    expect(all.items.every((n) => n.read_at)).toBe(true);
    expect(all.items.find((n) => n.id === "c")?.read_at).toBe("2026-10-01T00:00:00Z");
  });
  it("never turns off a mandatory email preference", () => {
    const prefs = [
      { type: "a", label: "A", email: true, mandatory: true },
      { type: "b", label: "B", email: true, mandatory: false },
    ];
    expect(setEmailPreference(prefs, "a", false)[0].email).toBe(true);
    expect(setEmailPreference(prefs, "b", false)[1].email).toBe(false);
  });
  it("follows only links inside the portal's own area", () => {
    expect(portalLinkPath("/client/approvals/1", PORTAL_AREAS.client)).toBe("/client/approvals/1");
    expect(portalLinkPath("/demands/1", PORTAL_AREAS.client)).toBeNull();
    expect(portalLinkPath("//evil.example/client", PORTAL_AREAS.client)).toBeNull();
    expect(portalLinkPath("/clientele", PORTAL_AREAS.client)).toBeNull();
    expect(portalLinkPath(null, PORTAL_AREAS.vendor)).toBeNull();
  });
  it("uses each portal's inbox base path", () => {
    expect(PORTAL_INBOX_BASE).toEqual({
      client: "/api/v1/client-portal/notifications",
      vendor: "/api/v1/vendor-portal/notifications",
      worker: "/api/v1/portal/work/notifications",
    });
  });
});
