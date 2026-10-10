import type { Metadata } from "next";
import { AudienceDetail } from "@/features/audiences/audience-detail";

export const metadata: Metadata = { title: "Audience" };

/** `/marketing/audiences/[id]` (Epic 39). */
export default async function AudiencePage({ params }: PageProps<"/marketing/audiences/[id]">) {
  const { id } = await params;
  return <AudienceDetail key={id} audienceId={id} />;
}
