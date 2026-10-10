import type { Metadata } from "next";
import { PaymentsView } from "@/features/receivables/payments-view";

export const metadata: Metadata = { title: "Payments" };

export default function Page() {
  return <PaymentsView />;
}
