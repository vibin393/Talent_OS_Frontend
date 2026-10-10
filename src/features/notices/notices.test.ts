import { describe, expect, it } from "vitest";
import type { AuthOut, PlatformNoticeOut } from "@/lib/api/types";
import { noticeIntent, supportBannerText, visibleNotices } from "./support";

const NOW = new Date("2026-10-31T12:00:00Z");
const me = { user: {}, tenant: {}, permissions: {} } as unknown as AuthOut;

describe("support banner", () => {
  it("shows operator and countdown only for support sessions", () => {
    expect(supportBannerText(me, NOW)).toBeNull();
    expect(
      supportBannerText({ ...me, principal_type: "support", support: { operator_name: "Asha (Talent OS)", expires_at: "2026-10-31T13:30:00Z" } }, NOW),
    ).toBe("Support access (read-only) — Asha (Talent OS) — ends in 01:30");
    expect(supportBannerText({ ...me, principal_type: "support" }, NOW)).toBe("Support access (read-only) — Talent OS support — ends in —");
  });
});

const notice = (over: Partial<PlatformNoticeOut>): PlatformNoticeOut => ({
  id: "n",
  tenant_id: null,
  audience: "admins",
  kind: "maintenance",
  severity: "info",
  title: "t",
  body_md: "b",
  expires_at: null,
  created_at: "2026-10-01T00:00:00Z",
  acknowledged: false,
  ...over,
});

describe("notice banner", () => {
  it("maps intents and filters acknowledged / expired notices", () => {
    expect(noticeIntent({ kind: "incident", severity: "low" })).toBe("error");
    expect(noticeIntent({ kind: "maintenance", severity: "critical" })).toBe("warning");
    expect(noticeIntent({ kind: "sub_processor", severity: "info" })).toBe("info");
    const list = visibleNotices(
      [
        notice({ id: "a" }),
        notice({ id: "b", acknowledged: true }),
        notice({ id: "c", expires_at: "2026-10-30T00:00:00Z" }),
        notice({ id: "d", kind: "incident", created_at: "2026-09-01T00:00:00Z" }),
      ],
      NOW,
    );
    expect(list.map((n) => n.id)).toEqual(["d", "a"]);
  });
});
