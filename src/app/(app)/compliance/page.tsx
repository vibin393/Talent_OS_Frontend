import type { Metadata } from "next";
import { ComplianceDashboardView } from "@/features/compliance/dashboard-view";

export const metadata: Metadata = { title: "Compliance" };

export default function Page() {
  return <ComplianceDashboardView />;
}
