import type { Metadata } from "next";
import { FairnessSettingsView } from "@/features/fairness/settings-view";

export const metadata: Metadata = { title: "Fairness settings" };

export default function Page() {
  return <FairnessSettingsView />;
}
