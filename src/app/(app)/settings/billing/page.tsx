import type { Metadata } from "next";
import { BillingSettingsView } from "@/features/billing/billing-settings-view";

export const metadata: Metadata = { title: "Billing settings" };

export default function Page() {
  return <BillingSettingsView />;
}
