import type { Metadata } from "next";
import { SlaAdmin } from "@/features/sla/sla-admin";

export const metadata: Metadata = { title: "SLAs" };

export default function Page() {
  return <SlaAdmin />;
}
