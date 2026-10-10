import type { Metadata } from "next";
import { TeamLeaveCalendar } from "@/features/leave/leave-admin";

export const metadata: Metadata = { title: "Team leave calendar" };

export default function Page() {
  return <TeamLeaveCalendar />;
}
