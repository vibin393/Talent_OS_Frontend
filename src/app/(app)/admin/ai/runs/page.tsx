import type { Metadata } from "next";
import { RunsPage } from "@/features/ai-governance/runs-page";

export const metadata: Metadata = { title: "Agent runs" };

export default function Page() {
  return <RunsPage />;
}
