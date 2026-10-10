import type { Metadata } from "next";
import { ChainsAdmin } from "@/features/approvals/chains-admin";

export const metadata: Metadata = { title: "Approval chains" };

export default function Page() {
  return <ChainsAdmin />;
}
