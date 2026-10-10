import type { Metadata } from "next";
import { TelephonySettingsPage } from "@/features/telephony/settings-page";

export const metadata: Metadata = { title: "Calling and transcription" };

export default function Page() {
  return <TelephonySettingsPage />;
}
