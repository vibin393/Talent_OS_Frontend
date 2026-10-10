import type { Metadata } from "next";
import { SequenceDetail } from "@/features/sequences/sequence-detail";

export const metadata: Metadata = { title: "Sequence" };

/** `/marketing/sequences/[id]` (Epic 39). */
export default async function SequencePage({ params }: PageProps<"/marketing/sequences/[id]">) {
  const { id } = await params;
  return <SequenceDetail key={id} sequenceId={id} />;
}
