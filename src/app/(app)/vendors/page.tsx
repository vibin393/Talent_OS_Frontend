import type { Metadata } from "next";
import { VendorsView } from "@/features/vendors/vendors-view";

export const metadata: Metadata = { title: "Vendors" };

export default function VendorsPage() {
  return <VendorsView />;
}
