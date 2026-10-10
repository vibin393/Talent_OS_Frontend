import type { Metadata } from "next";
import { HrmsSyncQueue } from "@/features/hrms-sync/sync-queue";

export const metadata: Metadata = { title: "HRMS sync" };

export default function Page() {
  return <HrmsSyncQueue />;
}
