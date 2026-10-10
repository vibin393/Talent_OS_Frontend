import type { Metadata } from "next";
import { CollectionsView } from "@/features/receivables/collections-view";

export const metadata: Metadata = { title: "Collections" };

export default function Page() {
  return <CollectionsView />;
}
