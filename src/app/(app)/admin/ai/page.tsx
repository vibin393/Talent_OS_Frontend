import type { Metadata } from "next";
import { AiSettings } from "@/features/ai/ai-settings";

export const metadata: Metadata = { title: "AI settings" };

export default function Page() {
  return <AiSettings />;
}
