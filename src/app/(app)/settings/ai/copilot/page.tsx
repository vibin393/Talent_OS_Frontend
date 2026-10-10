import type { Metadata } from "next";
import { CopilotSettingsPage } from "@/features/copilot/settings-page";
import { PortalCopilotSettingsSection } from "@/features/portal-copilot/portal-settings-section";

export const metadata: Metadata = { title: "Copilot settings" };

export default function Page() {
  return (
    <>
      <CopilotSettingsPage />
      <PortalCopilotSettingsSection />
    </>
  );
}
