import type { Metadata } from "next";
import { PortalDashboard } from "@/features/modules/portal/portal-dashboard";

export const metadata: Metadata = { title: "Job Portal" };

// Native Job Portal dashboard (native unification) — rendered in the Talent OS shell via the module
// gateway, not an iframe.
export default function Page() {
  return <PortalDashboard />;
}
