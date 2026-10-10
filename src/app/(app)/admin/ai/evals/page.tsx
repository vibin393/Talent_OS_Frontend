import type { Metadata } from "next";
import { EvalsPage } from "@/features/ai-governance/evals-page";

export const metadata: Metadata = { title: "Evaluations" };

export default function Page() {
  return <EvalsPage />;
}
