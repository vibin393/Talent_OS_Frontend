import type { PortalNavItem } from "@/features/external-portal/portal-frame";

/**
 * Vendor Portal navigation (shell: Epic 14; content pages: Epic 17). Shared additive file: each epic appends
 * the entries of the pages it owns.
 */
export const VENDOR_NAV: PortalNavItem[] = [
  { href: "/vendor", label: "Home" },
  // Epic 17 (Vendors & Vendor Portal) content.
  { href: "/vendor/releases", label: "Requirements" },
  { href: "/vendor/submissions", label: "Submissions" },
  { href: "/vendor/placements", label: "Placements" },
  { href: "/vendor/statements", label: "Statements" },
  { href: "/vendor/documents", label: "Documents" },
  { href: "/vendor/scorecard", label: "Scorecard" },
  // Epic 14: vendor self-administration (vendor admins; others see Access Denied).
  { href: "/vendor/users", label: "Users" },
];

export const VENDOR_PUBLIC_PATHS = ["/vendor/sign-in", "/vendor/accept-invite", "/vendor/reset-password"] as const;
