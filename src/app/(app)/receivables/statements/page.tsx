import type { Metadata } from "next";
import { StatementsView } from "@/features/receivables/tools-views";

export const metadata: Metadata = { title: "Statements" };

export default function Page() {
  return <StatementsView />;
}
