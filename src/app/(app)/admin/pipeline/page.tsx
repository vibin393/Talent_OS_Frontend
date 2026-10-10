import type { Metadata } from "next";
import { PipelineAdmin } from "@/features/pipeline/admin/pipeline-admin";
import { parsePipelineAdminTab } from "@/features/pipeline/admin/tabs";

export const metadata: Metadata = { title: "Pipeline settings" };

export default async function Page({ searchParams }: PageProps<"/admin/pipeline">) {
  const { tab } = await searchParams;
  return <PipelineAdmin initialTab={parsePipelineAdminTab(tab)} />;
}
