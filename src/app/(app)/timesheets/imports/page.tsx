import type { Metadata } from "next";
import { TimesheetImports } from "@/features/timesheets/imports-view";

export const metadata: Metadata = { title: "Timesheet import" };

export default function Page() {
  return <TimesheetImports />;
}
