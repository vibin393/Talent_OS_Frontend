import type { Metadata } from "next";
import { ExportsView } from "@/features/receivables/tools-views";

export const metadata: Metadata = { title: "Accounting export" };

export default function Page() {
  return <ExportsView />;
}
