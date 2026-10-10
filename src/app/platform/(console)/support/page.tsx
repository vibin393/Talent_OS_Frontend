import type { Metadata } from "next";
import { SupportView } from "@/features/platform/support-view";

export const metadata: Metadata = { title: "Support access" };

export default function Page() {
  return <SupportView />;
}
