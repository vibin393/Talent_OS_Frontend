import type { Metadata } from "next";
import { InvoicesView } from "@/features/billing/invoices-view";

export const metadata: Metadata = { title: "Invoices" };

export default function Page() {
  return <InvoicesView />;
}
