import type { Metadata } from "next";
import { ScreeningAgentSettings } from "@/features/agents/screening/screening-settings";

export const metadata: Metadata = { title: "Screening Agent" };

export default function Page() {
  return <ScreeningAgentSettings />;
}
