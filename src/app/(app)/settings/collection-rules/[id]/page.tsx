import type { Metadata } from "next";
import { CollectionRuleEditor } from "@/features/agents/finance/collection-rules";

export const metadata: Metadata = { title: "Collection rule" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CollectionRuleEditor key={id} id={id} />;
}
