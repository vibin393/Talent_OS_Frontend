import type { Metadata } from "next";
import { LegalEntityDetail } from "@/features/legal-entities/legal-entity-detail";

export const metadata: Metadata = { title: "Legal entity" };

export default async function LegalEntityPage({ params }: PageProps<"/settings/legal-entities/[id]">) {
  const { id } = await params;
  return <LegalEntityDetail key={id} id={id} />;
}
