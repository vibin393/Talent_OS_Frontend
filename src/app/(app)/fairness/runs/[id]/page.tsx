import type { Metadata } from "next";
import { RunView } from "@/features/fairness/run-view";

export const metadata: Metadata = { title: "Fairness report" };

export default async function Page({ params }: PageProps<"/fairness/runs/[id]">) {
  const { id } = await params;
  return <RunView key={id} runId={id} />;
}
