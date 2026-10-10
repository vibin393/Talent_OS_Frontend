import type { Metadata } from "next";
import { InstitutionsList } from "@/features/campus/institutions/institutions-list";

export const metadata: Metadata = { title: "Institutions" };

/** `/campus/institutions` (Epic 43). */
export default function Page() {
  return <InstitutionsList />;
}
