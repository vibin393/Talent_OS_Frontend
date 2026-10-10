import type { Metadata } from "next";
import { InvoiceRunsView } from "@/features/billing/runs-view";

export const metadata: Metadata = { title: "Invoice runs" };

export default function Page() {
  return <InvoiceRunsView />;
}
