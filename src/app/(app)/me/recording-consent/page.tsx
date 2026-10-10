import type { Metadata } from "next";
import { RecordingAckSettings } from "@/features/agents/interview-assistant/recording-ack-settings";

export const metadata: Metadata = { title: "My recording consent" };

export default function Page() {
  return <RecordingAckSettings />;
}
