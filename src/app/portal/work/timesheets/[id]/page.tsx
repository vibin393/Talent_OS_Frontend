import type { Metadata } from "next";
import { WorkerTimesheetEntry } from "@/features/timesheets/worker-timesheet-entry";

export const metadata: Metadata = { title: "Timesheet" };

export default async function Page({ params }: PageProps<"/portal/work/timesheets/[id]">) {
  const { id } = await params;
  return <WorkerTimesheetEntry key={id} id={id} />;
}
