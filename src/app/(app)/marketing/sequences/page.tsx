import type { Metadata } from "next";
import { SequencesView } from "@/features/sequences/sequences-view";

export const metadata: Metadata = { title: "Sequences" };

/** `/marketing/sequences` (Epic 39). */
export default function SequencesPage() {
  return <SequencesView />;
}
