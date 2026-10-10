import type { Metadata } from "next";
import { IntakeSettingsPage } from "@/features/agents/demand/intake-settings-page";

export const metadata: Metadata = { title: "Demand intake" };

export default function Page() {
  return <IntakeSettingsPage />;
}
