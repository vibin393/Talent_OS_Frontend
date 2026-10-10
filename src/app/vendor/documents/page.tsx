import type { Metadata } from "next";
import { VendorDocumentsView } from "@/features/vendor-portal/other-views";

export const metadata: Metadata = { title: "Documents" };

export default function VendorDocumentsPage() {
  return <VendorDocumentsView />;
}
