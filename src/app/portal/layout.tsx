import type { Metadata } from "next";
import { QueryBoundary } from "@/features/access-denied/query-boundary";
import { PortalShell } from "@/features/portal/portal-shell";
import { PortalCopilot } from "@/features/portal-copilot/portal-copilot";

export const metadata: Metadata = {
  title: { absolute: "Candidate portal", template: "%s · Candidate portal" },
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalShell>
      <QueryBoundary ask="account_manager">{children}</QueryBoundary>
      <PortalCopilot portal="candidate" />
    </PortalShell>
  );
}
