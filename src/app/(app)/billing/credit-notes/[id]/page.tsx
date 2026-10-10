import type { Metadata } from "next";
import { BillingDocDetail } from "@/features/billing/invoice-detail";

export const metadata: Metadata = { title: "Billing document" };

export default async function Page({ params }: PageProps<"/billing/credit-notes/[id]">) {
  const { id } = await params;
  return <BillingDocDetail key={id} kind="credit_note" id={id} />;
}
