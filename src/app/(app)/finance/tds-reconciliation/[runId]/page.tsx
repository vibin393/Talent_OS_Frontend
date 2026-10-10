import type { Metadata } from "next";
import { TdsRunDetailView } from "@/features/receivables/tds-recon/run-detail-view";

export const metadata: Metadata = { title: "TDS statement run" };

export default async function Page({ params }: PageProps<"/finance/tds-reconciliation/[runId]">) {
  const { runId } = await params;
  return <TdsRunDetailView key={runId} runId={runId} />;
}
