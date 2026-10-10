import type { Metadata } from "next";
import { LeaveRequestsAdmin } from "@/features/leave/leave-admin";

export const metadata: Metadata = { title: "Leave" };

export default function Page() {
  return <LeaveRequestsAdmin />;
}
