import type { Metadata } from "next";
import { WorkerTimesheetList } from "@/features/timesheets/worker-timesheet-list";

export const metadata: Metadata = { title: "My timesheets" };

export default function Page() {
  return <WorkerTimesheetList />;
}
