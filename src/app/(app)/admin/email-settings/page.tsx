import type { Metadata } from "next";
import { MailSettingsView } from "@/features/mail-settings/mail-settings-view";

export const metadata: Metadata = { title: "Email settings" };

export default function Page() {
  return <MailSettingsView />;
}
