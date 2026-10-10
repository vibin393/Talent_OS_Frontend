import type { Metadata } from "next";
import { WriteOffsView } from "@/features/receivables/tools-views";

export const metadata: Metadata = { title: "Write-offs" };

export default function Page() {
  return <WriteOffsView />;
}
