import type { Metadata } from "next";
import { InterviewAssistantSettings } from "@/features/agents/interview-assistant/settings-page";

export const metadata: Metadata = { title: "Interview Assistant" };

export default function Page() {
  return <InterviewAssistantSettings />;
}
