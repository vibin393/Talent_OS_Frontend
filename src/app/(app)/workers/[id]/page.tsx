import type { Metadata } from "next";
import { Worker360 } from "@/features/workers/worker-360";

export const metadata: Metadata = { title: "Worker" };

export default async function WorkerPage({ params }: PageProps<"/workers/[id]">) {
  const { id } = await params;
  return <Worker360 key={id} candidateId={id} />;
}
