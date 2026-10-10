import type { Metadata } from "next";
import { InternalJobsBoard } from "@/features/mobility/board/board-view";

export const metadata: Metadata = { title: "Internal jobs" };

export default function Page() {
  return <InternalJobsBoard />;
}
