import type { Metadata } from "next";
import { KnowledgeSourcesList } from "@/features/knowledge/sources-list";

export const metadata: Metadata = { title: "Knowledge sources" };

export default function Page() {
  return <KnowledgeSourcesList />;
}
