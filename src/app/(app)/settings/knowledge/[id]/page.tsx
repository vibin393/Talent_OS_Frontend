import type { Metadata } from "next";
import { KnowledgeSourceDetail } from "@/features/knowledge/source-detail";

export const metadata: Metadata = { title: "Knowledge source" };

export default async function Page({ params }: PageProps<"/settings/knowledge/[id]">) {
  const { id } = await params;
  return <KnowledgeSourceDetail key={id} id={id} />;
}
