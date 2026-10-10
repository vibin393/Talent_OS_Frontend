import type { Metadata } from "next";
import { RuleBuilderPage } from "@/features/workflow/rule-builder";

export const metadata: Metadata = { title: "Workflow rule" };

/** The Phase 1 form editor ("Simple editor") for rules the P1 form can express. */
export default async function Page({ params }: PageProps<"/admin/workflows/[id]/simple">) {
  const { id } = await params;
  return <RuleBuilderPage key={id} id={id} />;
}
