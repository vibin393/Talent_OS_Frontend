import type { Metadata } from "next";
import { PacksList } from "@/features/agents/submission/packs-list";

export const metadata: Metadata = { title: "Submission packs" };

export default function Page() {
  return <PacksList />;
}
