import type { Metadata } from "next";
import { VoiceScreeningSettings } from "@/features/voice/settings-page";

export const metadata: Metadata = { title: "Voice screening" };

export default function Page() {
  return <VoiceScreeningSettings />;
}
