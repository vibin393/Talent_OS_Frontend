import type { Metadata } from "next";
import { Project360 } from "@/features/projects/project-360";

export const metadata: Metadata = { title: "Project" };

export default async function ProjectPage({ params }: PageProps<"/projects/[id]">) {
  const { id } = await params;
  return <Project360 key={id} projectId={id} />;
}
