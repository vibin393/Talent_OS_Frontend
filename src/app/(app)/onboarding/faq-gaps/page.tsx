import type { Metadata } from "next";
import { FaqGaps } from "@/features/knowledge/faq-gaps";

export const metadata: Metadata = { title: "Unanswered onboarding questions" };

export default function Page() {
  return <FaqGaps />;
}
