import type { Metadata } from "next";
import { ReconciliationView } from "@/features/receivables/tools-views";

export const metadata: Metadata = { title: "Reconciliation" };

export default function Page() {
  return <ReconciliationView />;
}
