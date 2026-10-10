import type { Metadata } from "next";
import { TdsReconView } from "@/features/receivables/tds-recon/tds-recon-view";

export const metadata: Metadata = { title: "TDS reconciliation" };

export default function Page() {
  return <TdsReconView />;
}
