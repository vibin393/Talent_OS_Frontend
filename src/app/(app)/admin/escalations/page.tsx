import type { Metadata } from "next";
import { EscalationPoliciesAdmin } from "@/features/escalations/escalation-policies-admin";

export const metadata: Metadata = { title: "Escalations" };

export default function Page() {
  return <EscalationPoliciesAdmin />;
}
