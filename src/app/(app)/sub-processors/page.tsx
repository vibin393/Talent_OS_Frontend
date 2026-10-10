import type { Metadata } from "next";
import { SubProcessorsView } from "@/features/notices/sub-processors-view";

export const metadata: Metadata = { title: "Sub-processors" };

export default function Page() {
  return <SubProcessorsView />;
}
