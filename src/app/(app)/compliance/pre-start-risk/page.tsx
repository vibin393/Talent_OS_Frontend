import type { Metadata } from "next";
import { PreStartRisk } from "@/features/agents/compliance/pre-start-risk";

export const metadata: Metadata = { title: "Pre-start compliance risk" };

export default function Page() {
  return <PreStartRisk />;
}
