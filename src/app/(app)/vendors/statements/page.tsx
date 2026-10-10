import type { Metadata } from "next";
import { StatementsView } from "@/features/vendors/statements-view";

export const metadata: Metadata = { title: "Vendor statements" };

export default function VendorStatementsPage() {
  return <StatementsView />;
}
