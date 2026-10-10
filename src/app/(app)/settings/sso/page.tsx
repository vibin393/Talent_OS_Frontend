import type { Metadata } from "next";
import { SsoSettingsView } from "@/features/sso/sso-settings-view";

export const metadata: Metadata = { title: "Single sign-on" };

export default function SsoSettingsPage() {
  return <SsoSettingsView />;
}
