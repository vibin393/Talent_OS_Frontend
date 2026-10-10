import type { Metadata } from "next";
import { SchedulingSettings } from "@/features/agents/scheduling/scheduling-settings";

export const metadata: Metadata = { title: "Scheduling Agent" };

export default function Page() {
  return <SchedulingSettings />;
}
