import type { Metadata } from "next";
import { WorkflowBuilderPage } from "@/features/workflow/builder/builder-page";

export const metadata: Metadata = { title: "Workflow" };

/** Epic 32: the visual builder (canvas + outline). Phase 1-form rules also open in the simple editor. */
export default async function Page({ params }: PageProps<"/admin/workflows/[id]">) {
  const { id } = await params;
  return <WorkflowBuilderPage key={id} id={id} />;
}
