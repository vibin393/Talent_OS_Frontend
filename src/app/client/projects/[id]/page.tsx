import { ClientProjectDetail } from "@/features/projects/client-projects";

/** Client Portal: a project with deliverables to accept and milestones (Epic 45). */
export default async function Page({ params }: PageProps<"/client/projects/[id]">) {
  const { id } = await params;
  return <ClientProjectDetail key={id} id={id} />;
}
