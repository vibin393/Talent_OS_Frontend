import type { Metadata } from "next";
import { ProjectsView } from "@/features/projects/projects-view";

export const metadata: Metadata = { title: "Projects" };

/** `/projects` (Epic 45); `?new=1&contract_id=` opens the create dialog pre-filled from a SOW. */
export default async function ProjectsPage({ searchParams }: PageProps<"/projects">) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  return <ProjectsView openNew={one(sp.new) === "1"} contractId={one(sp.contract_id) || undefined} />;
}
