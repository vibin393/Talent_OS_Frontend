import type { Metadata } from "next";
import { SubProcessorsAdmin } from "@/features/platform/sub-processors-admin";

export const metadata: Metadata = { title: "Sub-processors" };

export default function Page() {
  return <SubProcessorsAdmin />;
}
