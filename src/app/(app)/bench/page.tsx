import type { Metadata } from "next";
import { Suspense } from "react";
import { BenchView } from "@/features/bench/bench-view";

export const metadata: Metadata = { title: "Bench" };

export default function BenchPage() {
  return (
    <Suspense>
      <BenchView />
    </Suspense>
  );
}
