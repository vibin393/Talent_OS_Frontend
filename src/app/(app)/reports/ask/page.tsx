import type { Metadata } from "next";
import { AskPage } from "@/features/agents/analytics/ask-page";

export const metadata: Metadata = { title: "Ask about your data" };

/** `/reports/ask` (Epic 64): ask questions about your data; answers are governed report queries. */
export default function AskAboutYourDataPage() {
  return <AskPage />;
}
