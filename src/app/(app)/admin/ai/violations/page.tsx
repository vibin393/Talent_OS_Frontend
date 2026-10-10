import type { Metadata } from "next";
import { ViolationsPage } from "@/features/ai-governance/violations-page";

export const metadata: Metadata = { title: "Policy violations" };

export default function Page() {
  return <ViolationsPage />;
}
