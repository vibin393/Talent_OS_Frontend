/** Vendor-facing progress labels (Epic 17, FR-97): status + label only, never reason text. */
import type { BadgeProps } from "@fluentui/react-components";

type Color = NonNullable<BadgeProps["color"]>;

const LABEL_COLORS: Record<string, Color> = {
  Received: "informative",
  Shortlisted: "brand",
  "Submitted to client": "brand",
  Interviewing: "important",
  Offered: "success",
  Placed: "success",
  "Not selected": "danger",
  Duplicate: "warning",
  Withdrawn: "subtle",
};

/** Badge colour of a vendor label (tenant-configured labels fall back to `informative`). */
export function labelColor(label: string): Color {
  return LABEL_COLORS[label] ?? "informative";
}

export const PORTAL_NAV: { href: string; label: string; requiresAny?: string[] }[] = [
  { href: "/vendor", label: "Home" },
  { href: "/vendor/releases", label: "Releases", requiresAny: ["releases:view", "submissions:create"] },
  { href: "/vendor/submissions", label: "Submissions", requiresAny: ["releases:view", "submissions:create"] },
  { href: "/vendor/placements", label: "Placements", requiresAny: ["placements:view"] },
  { href: "/vendor/documents", label: "Documents", requiresAny: ["documents:manage"] },
  { href: "/vendor/statements", label: "Statements", requiresAny: ["statements:view"] },
  { href: "/vendor/scorecard", label: "Scorecard" },
];

/** Nav entries a Vendor User may see (`me.portal_permissions`); the Epic 14 shell renders them. */
export function visiblePortalNav(permissions: readonly string[]) {
  return PORTAL_NAV.filter((n) => !n.requiresAny || n.requiresAny.some((p) => permissions.includes(p)));
}

export type PortalErrorState =
  | { kind: "forbidden"; action: string; ask: string }
  | { kind: "not_found" }
  | { kind: "error"; message: string };

/** FR-82: a 403 becomes the "You don't have access" state (ask the account manager); 404 is "not found". */
export function portalErrorState(error: unknown): PortalErrorState {
  const e = error as { status?: number; details?: Record<string, unknown>; message?: string } | null;
  if (e && e.status === 403) {
    const action = typeof e.details?.action === "string" ? e.details.action : "this area";
    const ask = e.details?.ask === "tenant_admin" ? "your Tenant Admin" : "your Account Manager";
    return { kind: "forbidden", action, ask };
  }
  if (e && e.status === 404) return { kind: "not_found" };
  return { kind: "error", message: e?.message || "Something went wrong. Please try again." };
}
