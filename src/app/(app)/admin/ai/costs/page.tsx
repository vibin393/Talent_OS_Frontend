import type { Metadata } from "next";
import { CostsPage } from "@/features/ai-governance/costs-page";

export const metadata: Metadata = { title: "AI costs" };

export default function Page() {
  return <CostsPage />;
}
