import type { Metadata } from "next";
import { LeaveTypesAdmin } from "@/features/leave/leave-types-admin";

export const metadata: Metadata = { title: "Leave types" };

export default function Page() {
  return <LeaveTypesAdmin />;
}
