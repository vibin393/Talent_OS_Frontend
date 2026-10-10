import type { Metadata } from "next";
import { VendorSettingsPanel } from "@/features/vendors/vendor-settings";

export const metadata: Metadata = { title: "Vendor settings" };

export default function VendorSettingsPage() {
  return <VendorSettingsPanel />;
}
