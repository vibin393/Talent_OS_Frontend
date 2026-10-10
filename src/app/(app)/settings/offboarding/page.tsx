import type { Metadata } from "next";
import { ExitSettingsView } from "@/features/placement-exit/exit-settings-view";

export const metadata: Metadata = { title: "Offboarding settings" };

export default function OffboardingSettingsPage() {
  return <ExitSettingsView />;
}
