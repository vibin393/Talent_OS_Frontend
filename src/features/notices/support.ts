/** Support-session banner text (Epic 12 story 12.5): "Support access (read-only) — {operator} — ends in hh:mm". */
import { formatCountdown } from "@/features/privacy/format";
import type { AuthOut, PlatformNoticeOut } from "@/lib/api/types";

/**
 * Extra fields `GET /auth/me` carries for a support session. Not yet in the OpenAPI schema, so they are
 * read defensively: `principal_type: "support"` plus the grant's operator and expiry.
 */
export type SupportSessionInfo = {
  principal_type?: string | null;
  support?: { operator_name?: string | null; expires_at?: string | null } | null;
  operator_name?: string | null;
  support_expires_at?: string | null;
};

export function supportSession(me: (AuthOut & SupportSessionInfo) | null | undefined): { operator: string; expiresAt: string | null } | null {
  if (!me || me.principal_type !== "support") return null;
  const operator = me.support?.operator_name ?? me.operator_name ?? "Talent OS support";
  const expiresAt = me.support?.expires_at ?? me.support_expires_at ?? null;
  return { operator, expiresAt };
}

export function supportBannerText(me: (AuthOut & SupportSessionInfo) | null | undefined, now: Date = new Date()): string | null {
  const s = supportSession(me);
  if (!s) return null;
  return `Support access (read-only) — ${s.operator} — ends in ${formatCountdown(s.expiresAt, now)}`;
}

export type NoticeIntent = "error" | "warning" | "info";

/** Incidents are errors; high/critical notices warn; the rest inform. */
export function noticeIntent(n: Pick<PlatformNoticeOut, "kind" | "severity">): NoticeIntent {
  if (n.kind === "incident") return "error";
  if (n.severity === "high" || n.severity === "critical") return "warning";
  return "info";
}

/** Unacknowledged, unexpired notices, incidents first then newest first. */
export function visibleNotices(notices: readonly PlatformNoticeOut[], now: Date = new Date()): PlatformNoticeOut[] {
  const rank = (n: PlatformNoticeOut) => (n.kind === "incident" ? 0 : 1);
  return notices
    .filter((n) => !n.acknowledged && (!n.expires_at || Date.parse(n.expires_at) > now.getTime()))
    .sort((a, b) => rank(a) - rank(b) || b.created_at.localeCompare(a.created_at));
}
