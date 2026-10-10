import type { Metadata } from "next";
import { SecurityPage } from "@/features/api-keys/security-page";

export const metadata: Metadata = { title: "Security" };

export default function Page() {
  return <SecurityPage />;
}
