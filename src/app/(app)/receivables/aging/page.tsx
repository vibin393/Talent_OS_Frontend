import type { Metadata } from "next";
import { AgingView } from "@/features/receivables/aging-view";

export const metadata: Metadata = { title: "AR aging" };

export default function Page() {
  return <AgingView />;
}
