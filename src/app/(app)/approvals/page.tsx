import type { Metadata } from "next";
import { MyApprovals } from "@/features/approvals/my-approvals";

export const metadata: Metadata = { title: "My approvals" };

export default function ApprovalsPage() {
  return <MyApprovals />;
}
