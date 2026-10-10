import type { Metadata } from "next";
import { BuilderView } from "@/features/report-builder/builder-view";

export const metadata: Metadata = { title: "Custom report" };

/** `/reports/custom/[id]` (Epic 47): open, run, edit, share, export, schedule or pin a saved report. */
export default async function CustomReportPage({ params }: PageProps<"/reports/custom/[id]">) {
  const { id } = await params;
  return <BuilderView reportId={id} />;
}
