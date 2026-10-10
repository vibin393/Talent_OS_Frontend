import type { Metadata } from "next";
import { ClientLeaveCalendar } from "@/features/leave/client-leave-calendar";

export const metadata: Metadata = { title: "Leave calendar" };

export default function Page() {
  return <ClientLeaveCalendar />;
}
