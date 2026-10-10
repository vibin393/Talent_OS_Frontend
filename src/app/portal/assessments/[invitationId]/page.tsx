import type { Metadata } from "next";
import { PortalAssessmentTaking } from "@/features/assessments/taking";

export const metadata: Metadata = { title: "Assessment", referrer: "no-referrer" };

/** `/portal/assessments/[invitationId]`: the candidate takes a built-in assessment (shares `taking.tsx` with `/l/[token]`). */
export default async function Page({ params }: PageProps<"/portal/assessments/[invitationId]">) {
  const { invitationId } = await params;
  return <PortalAssessmentTaking key={invitationId} invitationId={invitationId} />;
}
