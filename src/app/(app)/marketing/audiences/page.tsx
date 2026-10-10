import type { Metadata } from "next";
import { AudiencesView } from "@/features/audiences/audiences-view";

export const metadata: Metadata = { title: "Audiences" };

/** `/marketing/audiences` (Epic 39). */
export default function AudiencesPage() {
  return <AudiencesView />;
}
