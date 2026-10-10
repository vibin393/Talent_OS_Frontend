import type { PortalNavItem } from "@/features/external-portal/portal-frame";

/**
 * Client Portal navigation (shell: Epic 14; content: Epics 18, 25, 29, ...). Shared additive file: each epic
 * appends the entries of the pages it owns (`permission` = the Client User portal permission it needs).
 */
export const CLIENT_NAV: PortalNavItem[] = [
  { href: "/client", label: "Home" },
  { href: "/client/timesheets", label: "Timesheets", permission: "time:approve" }, // Epic 25
  { href: "/client/leave-calendar", label: "Leave calendar" }, // Epic 26 (shows a notice when the Client has not opted in)
  { href: "/client/expenses", label: "Expenses", permission: "time:approve" }, // Epic 27 (same placement time route approvers)
  { href: "/client/invoices", label: "Invoices", permission: "invoices:view" }, // Epic 29
  { href: "/client/statement", label: "Statement", permission: "invoices:view" }, // Epic 30
  { href: "/client/placements", label: "Placements" }, // Epic 31 (extension / offboarding confirmations)
  // Epic 18: client portal content
  { href: "/client/approvals", label: "Approvals" }, // Epic 18 (hub across kinds; empty when nothing targets the user)
  { href: "/client/demands", label: "Demands" }, // Epic 18 (requests are open to every active Client User)
  { href: "/client/scorecards", label: "Scorecards", permission: "submissions:review" }, // Epic 18
  { href: "/client/team", label: "Team", permission: "placements:view" }, // Epic 18
  { href: "/client/purchase-orders", label: "Purchase orders", permission: "invoices:view" }, // Epic 18 (Epic 16 PO read model)
  { href: "/client/compliance", label: "Compliance" }, // Epic 18
  { href: "/client/delegation", label: "Out of office" }, // Epic 18
  { href: "/client/projects", label: "Projects", permission: "projects:view" }, // Epic 45 (SOW projects, deliverable acceptance)
  { href: "/client/forecasts", label: "Forecasts", permission: "forecasts:submit" }, // Epic 44 (hiring forecasts)
];

export const CLIENT_PUBLIC_PATHS = ["/client/sign-in"] as const;
