import type { Metadata } from "next";
import { BgvCasesView } from "@/features/bgv/cases-view";

export const metadata: Metadata = { title: "Background verification" };

export default function Page() {
  return <BgvCasesView />;
}
