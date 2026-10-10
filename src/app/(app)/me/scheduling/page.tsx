import type { Metadata } from "next";
import { PreferencesForm } from "@/features/agents/scheduling/preferences-form";

export const metadata: Metadata = { title: "My scheduling preferences" };

export default function Page() {
  return <PreferencesForm />;
}
