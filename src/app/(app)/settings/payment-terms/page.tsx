import type { Metadata } from "next";
import { PaymentTermsView } from "@/features/commercials/payment-terms/payment-terms-view";

export const metadata: Metadata = { title: "Payment terms" };

export default function PaymentTermsPage() {
  return <PaymentTermsView />;
}
