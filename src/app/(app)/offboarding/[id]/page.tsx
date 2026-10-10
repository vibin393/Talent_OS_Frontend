import type { Metadata } from "next";
import { OffboardingCaseDetailView } from "@/features/placement-exit/offboarding-case-detail";

export const metadata: Metadata = { title: "Offboarding case" };

export default async function OffboardingCasePage({ params }: PageProps<"/offboarding/[id]">) {
  const { id } = await params;
  return <OffboardingCaseDetailView key={id} id={id} />;
}
