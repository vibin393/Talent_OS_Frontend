import { ClientSubmissionDetail } from "@/features/client-portal/client-submissions";

/** Client Portal: a sent candidate (Epic 18). */
export default async function Page({ params }: PageProps<"/client/submissions/[id]">) {
  const { id } = await params;
  return <ClientSubmissionDetail key={id} id={id} />;
}
