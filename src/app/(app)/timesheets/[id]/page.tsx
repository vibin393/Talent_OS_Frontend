import type { Metadata } from "next";
import { TimesheetDetail } from "@/features/timesheets/timesheet-detail";

export const metadata: Metadata = { title: "Timesheet" };

export default async function Page({ params }: PageProps<"/timesheets/[id]">) {
  const { id } = await params;
  return <TimesheetDetail key={id} id={id} />;
}
