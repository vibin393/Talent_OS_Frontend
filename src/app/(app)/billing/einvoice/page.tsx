import type { Metadata } from "next";
import { EinvoiceView } from "@/features/billing/einvoice-view";

export const metadata: Metadata = { title: "E-invoicing" };

export default function Page() {
  return <EinvoiceView />;
}
