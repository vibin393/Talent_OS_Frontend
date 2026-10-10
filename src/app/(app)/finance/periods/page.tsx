import type { Metadata } from "next";
import { PeriodsView } from "@/features/receivables/periods-view";

export const metadata: Metadata = { title: "Accounting periods" };

export default function Page() {
  return <PeriodsView />;
}
