import type { Metadata } from "next";
import { CollectionRulesList } from "@/features/agents/finance/collection-rules";

export const metadata: Metadata = { title: "Collection rules" };

export default function Page() {
  return <CollectionRulesList />;
}
