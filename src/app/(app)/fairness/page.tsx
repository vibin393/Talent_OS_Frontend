import type { Metadata } from "next";
import { FairnessReportsView } from "@/features/fairness/reports-view";

export const metadata: Metadata = { title: "Fairness" };

export default function Page() {
  return <FairnessReportsView />;
}
