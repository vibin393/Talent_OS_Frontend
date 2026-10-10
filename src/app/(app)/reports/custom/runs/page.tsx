import type { Metadata } from "next";
import { RunLogView } from "@/features/report-builder/run-log-view";

export const metadata: Metadata = { title: "Report run log" };

/** `/reports/custom/runs` (Epic 47, Tenant Admin): the custom report run log. */
export default function ReportRunLogPage() {
  return <RunLogView />;
}
