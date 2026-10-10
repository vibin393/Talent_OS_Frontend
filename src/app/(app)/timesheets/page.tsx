import type { Metadata } from "next";
import { TimesheetMonitor } from "@/features/timesheets/monitor-view";

export const metadata: Metadata = { title: "Timesheets" };

export default function Page() {
  return <TimesheetMonitor />;
}
