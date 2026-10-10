import type { Metadata } from "next";
import { WorkBench } from "@/features/bench/work-bench";

export const metadata: Metadata = { title: "Bench" };

export default function Page() {
  return <WorkBench />;
}
