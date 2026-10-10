import { ClientScorecardForm } from "@/features/client-portal/client-scorecard";

/** Client Portal: fill in a scorecard (Epic 18). */
export default async function Page({ params }: PageProps<"/client/scorecards/[id]">) {
  const { id } = await params;
  return <ClientScorecardForm key={id} participantId={id} />;
}
