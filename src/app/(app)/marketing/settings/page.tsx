import type { Metadata } from "next";
import { MarketingSettingsView } from "@/features/campaigns/marketing-settings";

export const metadata: Metadata = { title: "Marketing settings" };

/** `/marketing/settings` (Epic 39, marketing:configure). */
export default function MarketingSettingsPage() {
  return <MarketingSettingsView />;
}
