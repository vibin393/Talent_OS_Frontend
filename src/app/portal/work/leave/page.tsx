import type { Metadata } from "next";
import { WorkerLeavePage } from "@/features/leave/worker-leave-page";

export const metadata: Metadata = { title: "My leave" };

export default function Page() {
  return <WorkerLeavePage />;
}
