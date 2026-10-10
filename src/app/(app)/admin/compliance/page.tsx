import type { Metadata } from "next";
import { ComplianceAdmin } from "@/features/compliance/admin-compliance";

export const metadata: Metadata = { title: "Compliance settings" };

export default function Page() {
  return <ComplianceAdmin />;
}
