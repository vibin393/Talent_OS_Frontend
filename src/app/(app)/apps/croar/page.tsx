import type { Metadata } from "next";
import { CroarDashboard } from "@/features/modules/croar/croar-dashboard";

export const metadata: Metadata = { title: "Croar" };

// Native Croar dashboard (native unification) — rendered in the Talent OS shell via the module
// gateway, not an iframe. The contextual Croar sidebar is driven by the module-nav registry.
export default function Page() {
  return <CroarDashboard />;
}
