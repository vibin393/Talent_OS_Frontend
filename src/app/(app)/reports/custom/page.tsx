import type { Metadata } from "next";
import { ReportsListView } from "@/features/report-builder/reports-list-view";

export const metadata: Metadata = { title: "Custom reports" };

/** `/reports/custom` (Epic 47): Mine / Shared with me. */
export default function CustomReportsPage() {
  return <ReportsListView />;
}
