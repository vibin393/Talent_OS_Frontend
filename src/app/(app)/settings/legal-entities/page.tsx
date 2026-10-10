import type { Metadata } from "next";
import { LegalEntitiesView } from "@/features/legal-entities/legal-entities-view";

export const metadata: Metadata = { title: "Legal entities" };

export default function LegalEntitiesPage() {
  return <LegalEntitiesView />;
}
