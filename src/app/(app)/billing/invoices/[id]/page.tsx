import type { Metadata } from "next";
import { BillingDocDetail } from "@/features/billing/invoice-detail";

export const metadata: Metadata = { title: "Billing document" };

export default async function Page({ params }: PageProps<"/billing/invoices/[id]">) {
  const { id } = await params;
  return <BillingDocDetail key={id} kind="invoice" id={id} />;
}
