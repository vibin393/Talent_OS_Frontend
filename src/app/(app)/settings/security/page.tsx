import type { Metadata } from "next";
import { SecuritySettings } from "@/features/auth/security-settings";

export const metadata: Metadata = { title: "Security" };

export default function Page() {
  return <SecuritySettings />;
}
