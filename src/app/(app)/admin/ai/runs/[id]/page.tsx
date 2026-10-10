import type { Metadata } from "next";
import { RunDetail } from "@/features/ai-governance/run-detail";

export const metadata: Metadata = { title: "Agent run" };

export default async function Page({ params }: PageProps<"/admin/ai/runs/[id]">) {
  const { id } = await params;
  return <RunDetail key={id} runId={id} />;
}
