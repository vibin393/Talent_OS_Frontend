import type { Metadata } from "next";
import { VendorStatementsView } from "@/features/vendor-portal/other-views";

export const metadata: Metadata = { title: "Statements" };

export default function VendorStatementsPage() {
  return <VendorStatementsView />;
}
