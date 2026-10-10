import type { Metadata } from "next";
import { RulesList } from "@/features/workflow/rules-list";

export const metadata: Metadata = { title: "Workflows" };

export default function Page() {
  return <RulesList />;
}
