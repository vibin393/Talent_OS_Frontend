import type { Metadata } from "next";
import { TdsView } from "@/features/receivables/tools-views";

export const metadata: Metadata = { title: "TDS receivable" };

export default function Page() {
  return <TdsView />;
}
