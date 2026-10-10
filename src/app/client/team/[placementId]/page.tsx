import { ClientTeamMember } from "@/features/client-portal/client-workforce";

/** Client Portal: one team member (Epic 18). */
export default async function Page({ params }: PageProps<"/client/team/[placementId]">) {
  const { placementId } = await params;
  return <ClientTeamMember key={placementId} id={placementId} />;
}
