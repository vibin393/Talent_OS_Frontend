import type { Metadata } from "next";
import { PrivacyView } from "@/features/portal/privacy-view";

export const metadata: Metadata = { title: "Privacy" };

export default function Page() {
  return <PrivacyView />;
}
