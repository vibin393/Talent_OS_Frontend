import type { Metadata } from "next";
import { JobBoardsReportPage } from "@/features/job-boards/report-page";

export const metadata: Metadata = { title: "Job board performance" };

export default function Page() {
  return <JobBoardsReportPage />;
}
